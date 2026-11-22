import io
import unittest
from transcribe_call import pcm_blocks, WINDOW


class ShortReads(io.BytesIO):
    def read(self, n):
        return super().read(min(n, 17))


class AudioBlocksTest(unittest.TestCase):
    def test_stream_preserves_samples_on_short_reads_and_tail(self):
        raw = b"ab" * (WINDOW + 5)
        blocks = list(pcm_blocks(ShortReads(raw)))
        self.assertEqual([valid for _, valid in blocks], [WINDOW, 5])
        self.assertEqual(b"".join(block[:2*n] for block, n in blocks), raw)
        self.assertEqual(len(blocks[-1][0]), WINDOW * 2)

    def test_partial_sample_and_empty_input(self):
        with self.assertRaises(ValueError):
            list(pcm_blocks(io.BytesIO(b"x")))
        self.assertEqual(list(pcm_blocks(io.BytesIO())), [])


if __name__ == "__main__":
    unittest.main()
