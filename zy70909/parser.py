import csv
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from models import OrderRecord, ChargingLog, PaymentReceipt

def parse_datetime(dt_str):
    if not dt_str:
        return None
    formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S"]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str.strip(), fmt)
        except:
            continue
    return None

def parse_csv_file(content):
    try:
        return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV error: {e}")

def parse_json_file(content):
    try:
        data = json.loads(content.decode("utf-8"))
        return data if isinstance(data, list) else [data]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON error: {e}")

# test line
