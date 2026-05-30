DEFAULT_SAMPLE_RATE = 44100
MIN_SAMPLE_RATE = 8000
MAX_SAMPLE_RATE = 192000

DEFAULT_WINDOW_SIZE = 2048
MIN_WINDOW_SIZE = 256
MAX_WINDOW_SIZE = 16384

DEFAULT_HOP_SIZE = 512
DEFAULT_WINDOW_TYPE = 'hann'
VALID_WINDOW_TYPES = ['hann', 'hamming', 'blackman', 'rectangular']

DEFAULT_N_FFT = 2048
DEFAULT_PEAK_THRESHOLD = 0.05
DEFAULT_FUNDAMENTAL_TOLERANCE = 0.02

FREQ_LABELS = {
    'sub_bass': (20, 60),
    'bass': (60, 250),
    'low_mid': (250, 500),
    'mid': (500, 2000),
    'high_mid': (2000, 4000),
    'presence': (4000, 6000),
    'brilliance': (6000, 20000)
}

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
A4_FREQ = 440.0
