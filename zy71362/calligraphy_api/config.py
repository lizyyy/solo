import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'calligraphy.db')}"
IMAGE_MAX_SIZE = (2048, 2048)
TILT_THRESHOLD_DEGREES = 2.0
CHAR_SPACING_IDEAL = 1.0
LINE_SPACING_IDEAL = 1.5
SIGNATURE_REGION_RATIO = 0.25

os.makedirs(UPLOAD_DIR, exist_ok=True)
