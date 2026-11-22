"""Emit one JSON line per detected turn from a recording or a live mono PCM pipe."""
import argparse
import json
import os
import subprocess
import sys

RATE = 16000
WINDOW = 512


def pcm_blocks(source):
    """Handle short reads and pad the final analysis window."""
    remaining = b""
    while True:
        data = source.read(WINDOW * 2 - len(remaining))
        if not data:
            if len(remaining) % 2:
                raise ValueError("Incomplete PCM sample")
            if remaining:
                yield remaining.ljust(WINDOW * 2, b"\0"), len(remaining) // 2
            return
        remaining += data
        if len(remaining) == WINDOW * 2:
            yield remaining, WINDOW
            remaining = b""


def turns(source, vad, recognizer):
    import numpy as np
    elapsed = 0

    def drain():
        while not vad.empty():
            segment = vad.front
            start = segment.start
            samples = segment.samples
            stream = recognizer.create_stream()
            stream.accept_waveform(RATE, samples)
            recognizer.decode_stream(stream)
            text = stream.result.text.strip()
            vad.pop()
            yield dict(start_s=start / RATE, end_s=min(elapsed, start + len(samples)) / RATE,
                       text=text, status="transcribed" if text else "needs_confirm")

    for block, valid in pcm_blocks(source):
        elapsed += valid
        vad.accept_waveform(np.frombuffer(block, dtype="<i2").astype("float32") / 32768)
        yield from drain()
    vad.flush()
    yield from drain()


def main():
    import sherpa_onnx as sherpa
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", help="Audio recording, or - for live 16 kHz mono signed little-endian PCM")
    parser.add_argument("--language", default="", help="Optional spoken language code, e.g. te or ar")
    parser.add_argument("--channel", type=int, choices=[0, 1], help="Select a known input channel")
    parser.add_argument("--model-prefix", default=os.getenv("WHISPER_ONNX_PREFIX"))
    parser.add_argument("--vad", default=os.getenv("SILERO_VAD_MODEL"))
    args = parser.parse_args()
    if not args.model_prefix or not args.vad:
        parser.error("Supply --model-prefix and --vad or their environment variables")
    if args.file == "-" and args.channel is not None:
        parser.error("PCM input is already mono")
    prefix = args.model_prefix
    recognizer = sherpa.OfflineRecognizer.from_whisper(
        encoder=prefix + "-encoder.int8.onnx", decoder=prefix + "-decoder.int8.onnx",
        tokens=prefix + "-tokens.txt", language=args.language, num_threads=4, tail_paddings=300)
    cfg = sherpa.VadModelConfig()
    cfg.silero_vad.model = args.vad
    cfg.silero_vad.min_silence_duration = 0.6
    cfg.silero_vad.max_speech_duration = 24
    vad = sherpa.VoiceActivityDetector(cfg, buffer_size_in_seconds=40)

    def emit(source):
        for turn in turns(source, vad, recognizer):
            print(json.dumps(turn, ensure_ascii=False), flush=True)

    if args.file == "-":
        emit(sys.stdin.buffer)
        return
    command = ["ffmpeg", "-nostdin", "-v", "error", "-i", args.file, "-map", "0:a:0"]
    if args.channel is not None:
        command.extend(["-af", f"pan=mono|c0=c{args.channel}"])
    with subprocess.Popen(command + ["-ac", "1", "-ar", str(RATE), "-f", "s16le", "-"],
                          stdout=subprocess.PIPE) as process:
        try:
            emit(process.stdout)
        finally:
            process.stdout.close()
        if process.wait():
            raise SystemExit("Audio decoding failed")


if __name__ == "__main__":
    main()
