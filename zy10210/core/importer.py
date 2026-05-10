import csv
import os
from datetime import datetime
from .database import get_connection

IMPORT_CONFIGS = {
    "sessions": {
        "required": ["session_id", "name"],
        "optional": ["start_time", "end_time"],
        "table": "live_sessions",
        "unique_key": "session_id"
    },
    "products": {
        "required": ["sku", "name", "price"],
        "optional": [],
        "table": "products",
        "unique_key": "sku"
    },
    "rules": {
        "required": ["rule_id", "gift_sku", "min_amount"],
        "optional": ["session_id", "product_sku", "gift_quantity", "priority", "active"],
        "table": "gift_rules",
        "unique_key": "rule_id"
    },
    "orders": {
        "required": ["order_id", "total_amount"],
        "optional": ["session_id", "customer_name", "customer_phone", "refund_amount", "order_time", "status"],
        "table": "orders",
        "unique_key": "order_id"
    },
    "order_items": {
        "required": ["order_id", "product_sku", "quantity", "unit_price"],
        "optional": [],
        "table": "order_items",
        "unique_key": None
    },
    "inventory": {
        "required": ["sku", "available_qty"],
        "optional": ["reserved_qty"],
        "table": "inventory",
        "unique_key": "sku"
    },
    "requests": {
        "required": ["request_id", "order_id"],
        "optional": ["request_time", "status", "notes"],
        "table": "replacement_requests",
        "unique_key": "request_id"
    }
}

def parse_date(date_str):
    if not date_str:
        return None
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"]:
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, AttributeError):
            continue
    return date_str

def parse_float(value):
    if value is None or value == "":
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0

def parse_int(value):
    if value is None or value == "":
        return 0
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return 0

def import_csv(data_type, file_path, skip_duplicates=True):
    if data_type not in IMPORT_CONFIGS:
        raise ValueError(f"Unknown data type: {data_type}")
    
    config = IMPORT_CONFIGS[data_type]
    results = {"inserted": 0, "updated": 0, "skipped": 0, "errors": []}
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        
        missing_required = [f for f in config["required"] if f not in reader.fieldnames]
        if missing_required:
            raise ValueError(f"Missing required columns: {', '.join(missing_required)}")
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    data = {}
                    
                    for field in config["required"]:
                        data[field] = row.get(field, "").strip()
                    
                    for field in config["optional"]:
                        val = row.get(field, "").strip()
                        if val:
                            data[field] = val
                    
                    if "price" in data:
                        data["price"] = parse_float(data["price"])
                    if "min_amount" in data:
                        data["min_amount"] = parse_float(data["min_amount"])
                    if "gift_quantity" in data:
                        data["gift_quantity"] = parse_int(data["gift_quantity"])
                    if "priority" in data:
                        data["priority"] = parse_int(data["priority"])
                    if "active" in data:
                        data["active"] = 1 if str(data["active"]).lower() in ["1", "true", "yes", "是"] else 0
                    
                    if "total_amount" in data:
                        data["total_amount"] = parse_float(data["total_amount"])
                    if "refund_amount" in data:
                        data["refund_amount"] = parse_float(data["refund_amount"])
                    if "final_amount" not in data and "total_amount" in data:
                        data["final_amount"] = data["total_amount"] - data.get("refund_amount", 0)
                    
                    if "quantity" in data:
                        data["quantity"] = parse_int(data["quantity"])
                    if "unit_price" in data:
                        data["unit_price"] = parse_float(data["unit_price"])
                    if "subtotal" not in data and "quantity" in data and "unit_price" in data:
                        data["subtotal"] = data["quantity"] * data["unit_price"]
                    
                    if "available_qty" in data:
                        data["available_qty"] = parse_int(data["available_qty"])
                    if "reserved_qty" in data:
                        data["reserved_qty"] = parse_int(data["reserved_qty"])
                    
                    if "start_time" in data and data["start_time"]:
                        data["start_time"] = parse_date(data["start_time"])
                    if "end_time" in data and data["end_time"]:
                        data["end_time"] = parse_date(data["end_time"])
                    if "order_time" in data and data["order_time"]:
                        data["order_time"] = parse_date(data["order_time"])
                    if "request_time" in data and data["request_time"]:
                        data["request_time"] = parse_date(data["request_time"])
                    
                    unique_key = config["unique_key"]
                    
                    if unique_key and skip_duplicates:
                        cursor.execute(
                            f"SELECT id FROM {config['table']} WHERE {unique_key} = ?",
                            (data[unique_key],)
                        )
                        existing = cursor.fetchone()
                        if existing:
                            results["skipped"] += 1
                            continue
                    
                    columns = list(data.keys())
                    placeholders = ["?"] * len(columns)
                    
                    if unique_key:
                        conflict_cols = [c for c in columns if c != unique_key]
                        if conflict_cols:
                            update_clause = ", ".join([f"{c} = excluded.{c}" for c in conflict_cols])
                            sql = f"""
                                INSERT INTO {config['table']} ({', '.join(columns)})
                                VALUES ({', '.join(placeholders)})
                                ON CONFLICT({unique_key}) DO UPDATE SET {update_clause}
                            """
                        else:
                            sql = f"""
                                INSERT OR IGNORE INTO {config['table']} ({', '.join(columns)})
                                VALUES ({', '.join(placeholders)})
                            """
                    else:
                        sql = f"""
                            INSERT INTO {config['table']} ({', '.join(columns)})
                            VALUES ({', '.join(placeholders)})
                        """
                    
                    cursor.execute(sql, list(data.values()))
                    
                    if cursor.rowcount > 0:
                        results["inserted" if not unique_key or cursor.lastrowid else "inserted"] += 1
                    
                except Exception as e:
                    results["errors"].append(f"Row {row_num}: {str(e)}")
    
    return results
