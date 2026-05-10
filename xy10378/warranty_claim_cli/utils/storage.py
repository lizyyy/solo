import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
IMPORTED_DIR = DATA_DIR / "imported"
CLAIMS_DIR = DATA_DIR / "claims"

DEVICE_FILE = IMPORTED_DIR / "devices.json"
FAILURE_FILE = IMPORTED_DIR / "failures.json"
INSPECTION_FILE = IMPORTED_DIR / "inspections.json"
WARRANTY_FILE = IMPORTED_DIR / "warranties.json"
MATERIALS_FILE = IMPORTED_DIR / "materials.json"

def ensure_dirs():
    for d in [IMPORTED_DIR, CLAIMS_DIR]:
        d.mkdir(parents=True, exist_ok=True)

def load_json(file_path, default=None):
    if default is None:
        default = []
    if not file_path.exists():
        return default
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(file_path, data):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_devices():
    return load_json(DEVICE_FILE, [])

def save_devices(devices):
    ensure_dirs()
    save_json(DEVICE_FILE, devices)

def load_failures():
    return load_json(FAILURE_FILE, [])

def save_failures(failures):
    ensure_dirs()
    save_json(FAILURE_FILE, failures)

def load_inspections():
    return load_json(INSPECTION_FILE, [])

def save_inspections(inspections):
    ensure_dirs()
    save_json(INSPECTION_FILE, inspections)

def load_warranties():
    return load_json(WARRANTY_FILE, [])

def save_warranties(warranties):
    ensure_dirs()
    save_json(WARRANTY_FILE, warranties)

def load_materials():
    return load_json(MATERIALS_FILE, [])

def save_materials(materials):
    ensure_dirs()
    save_json(MATERIALS_FILE, materials)

def load_claims():
    claims = []
    if CLAIMS_DIR.exists():
        for f in CLAIMS_DIR.glob("*.json"):
            data = load_json(f, None)
            if data is None:
                continue
            if isinstance(data, list):
                claims.extend(data)
            elif isinstance(data, dict):
                claims.append(data)
    return claims

def save_claim(claim_id, claim_data):
    ensure_dirs()
    file_path = CLAIMS_DIR / f"{claim_id}.json"
    save_json(file_path, claim_data)

def get_claim_by_id(claim_id):
    file_path = CLAIMS_DIR / f"{claim_id}.json"
    if file_path.exists():
        return load_json(file_path, None)
    return None
