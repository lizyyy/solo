import uuid
from datetime import datetime


def generate_id(prefix: str = "") -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    if prefix:
        return f"{prefix}_{timestamp}_{unique_id}"
    return f"{timestamp}_{unique_id}"


def generate_sample_id() -> str:
    return generate_id("SMP")


def generate_temperature_id() -> str:
    return generate_id("TMP")


def generate_waste_id() -> str:
    return generate_id("WST")


def generate_batch_id() -> str:
    return generate_id("BAT")


def generate_rule_result_id() -> str:
    return generate_id("RUL")


def generate_review_id() -> str:
    return generate_id("REV")
