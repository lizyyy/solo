import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DB_PATH = os.environ.get(
    "PET_TRAINING_DB",
    str(BASE_DIR / "output" / "pet_training.db"),
)

REPORT_OUTPUT_DIR = os.environ.get(
    "PET_TRAINING_REPORT_DIR",
    str(BASE_DIR / "output"),
)

RULE_REGISTRY = [
    "pet_training_audit.rules.vaccine_rule",
    "pet_training_audit.rules.training_session_rule",
    "pet_training_audit.rules.medication_rule",
]

EXIT_OK = 0
EXIT_IMPORT_ERROR = 1
EXIT_AUDIT_HAS_ANOMALIES = 2
EXIT_RUNTIME_ERROR = 3
EXIT_INVALID_ARGS = 4
