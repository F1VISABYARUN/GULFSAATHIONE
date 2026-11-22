// Plivo sends raw G.711 μ-law at 8 kHz. OpenAI PCM speech output is mono 24 kHz, signed LE.
function decode(sample: number) {
  const bits = ~sample & 255;
  const value = (((bits & 15) << 3) + 132) << ((bits >> 4) & 7);
  return bits & 128 ? 132 - value : value - 132;
}

function encode(sample: number) {
  const sign = sample < 0 ? 128 : 0;
  const value = Math.min(32635, Math.abs(sample)) + 132;
  const exponent = Math.floor(Math.log2(value)) - 7;
  return ~(sign | (exponent << 4) | ((value >> (exponent + 3)) & 15)) & 255;
}

export function hasVoice(frame: Buffer) {
  let energy = 0;
  for (const sample of frame) energy += decode(sample) ** 2;
  return frame.length > 0 && energy / frame.length > 200 ** 2;
}

export function wavFromMulaw(bytes: Buffer) {
  const wav = Buffer.alloc(44 + 2 * bytes.length);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < bytes.length; i++) wav.writeInt16LE(decode(bytes[i]), 44 + i * 2);
  return wav;
}

export function mulawFromPcm24k(pcm: Buffer) {
  if (pcm.length < 6 || pcm.length % 2) throw Error('Invalid PCM speech');
  const bytes = Buffer.alloc(Math.floor(pcm.length / 6));
  for (let i = 0; i < bytes.length; i++) {
    const offset = 6 * i;
    bytes[i] = encode(Math.round((pcm.readInt16LE(offset) + pcm.readInt16LE(offset + 2) + pcm.readInt16LE(offset + 4)) / 3));
  }
  return bytes;
}
