import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, 'data')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')

IRRIGATION_THRESHOLD_LOW = 30.0
IRRIGATION_THRESHOLD_HIGH = 70.0
TEMPERATURE_MIN = 5.0
TEMPERATURE_MAX = 45.0
HUMIDITY_MIN = 0.0
HUMIDITY_MAX = 100.0

VALID_UNITS = {
    'humidity': ['%', 'percent', 'percentage', '%RH'],
    'temperature': ['C', '°C', 'celsius', 'degrees', '°F', 'F', 'fahrenheit']
}

DATE_FORMATS = ['%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']

RANDOM_SEED = 42
