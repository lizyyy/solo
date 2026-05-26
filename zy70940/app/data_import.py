import pandas as pd
import json
from io import StringIO
from datetime import datetime
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from . import models, schemas


def parse_datetime(value: str) -> datetime:
    if not value or pd.isna(value):
        return None
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(str(value), fmt)
        except (ValueError, TypeError):
            continue
    return None


def import_waybills_from_csv(db: Session, batch_id: int, csv_content: str) -> schemas.ImportResult:
    success = 0
    failed = 0
    errors = []

    try:
        df = pd.read_csv(StringIO(csv_content))
    except Exception as e:
        return schemas.ImportResult(success=0, failed=0, errors=[f"CSV解析失败: {str(e)}"])

    required_columns = ["waybill_no"]
    for col in required_columns:
        if col not in df.columns:
            return schemas.ImportResult(success=0, failed=0, errors=[f"缺少必要列: {col}"])

    for idx, row in df.iterrows():
        try:
            waybill_data = {
                "waybill_no": str(row["waybill_no"]).strip(),
                "batch_id": batch_id,
                "sender": str(row.get("sender", "")) if pd.notna(row.get("sender")) else None,
                "receiver": str(row.get("receiver", "")) if pd.notna(row.get("receiver")) else None,
                "origin": str(row.get("origin", "")) if pd.notna(row.get("origin")) else None,
                "destination": str(row.get("destination", "")) if pd.notna(row.get("destination")) else None,
                "weight": float(row["weight"]) if pd.notna(row.get("weight")) else None,
                "volume": float(row["volume"]) if pd.notna(row.get("volume")) else None,
                "expected_delivery": parse_datetime(row.get("expected_delivery")),
                "actual_delivery": parse_datetime(row.get("actual_delivery")),
            }

            existing = db.query(models.Waybill).filter(
                models.Waybill.batch_id == batch_id,
                models.Waybill.waybill_no == waybill_data["waybill_no"]
            ).first()

            if existing:
                errors.append(f"第{idx + 2}行: 运单号 {waybill_data['waybill_no']} 已存在于批次中")
                failed += 1
                continue

            waybill = models.Waybill(**waybill_data)
            db.add(waybill)
            success += 1
        except Exception as e:
            errors.append(f"第{idx + 2}行: {str(e)}")
            failed += 1

    db.commit()
    return schemas.ImportResult(success=success, failed=failed, errors=errors)


def import_tracking_from_json(db: Session, json_content: str) -> schemas.ImportResult:
    success = 0
    failed = 0
    errors = []

    try:
        data = json.loads(json_content)
        if isinstance(data, dict) and "records" in data:
            records = data["records"]
        elif isinstance(data, list):
            records = data
        else:
            return schemas.ImportResult(success=0, failed=0, errors=["JSON格式不正确，应为数组或包含records字段的对象"])
    except Exception as e:
        return schemas.ImportResult(success=0, failed=0, errors=[f"JSON解析失败: {str(e)}"])

    for idx, record in enumerate(records):
        try:
            waybill_no = str(record.get("waybill_no", "")).strip()
            if not waybill_no:
                errors.append(f"第{idx + 1}条记录: 缺少waybill_no")
                failed += 1
                continue

            waybill = db.query(models.Waybill).filter(
                models.Waybill.waybill_no == waybill_no
            ).first()

            if not waybill:
                errors.append(f"第{idx + 1}条记录: 运单号 {waybill_no} 不存在")
                failed += 1
                continue

            timestamp = parse_datetime(record.get("timestamp"))
            if not timestamp:
                errors.append(f"第{idx + 1}条记录: 缺少或格式错误的timestamp")
                failed += 1
                continue

            tracking = models.TrackingRecord(
                waybill_id=waybill.id,
                timestamp=timestamp,
                node=str(record.get("node", "")).strip(),
                node_type=str(record.get("node_type", "")) if record.get("node_type") else None,
                status=str(record.get("status", "")).strip(),
                operator=str(record.get("operator", "")) if record.get("operator") else None,
                location=str(record.get("location", "")) if record.get("location") else None,
                temperature=float(record["temperature"]) if record.get("temperature") is not None else None,
                remark=str(record.get("remark", "")) if record.get("remark") else None,
            )
            db.add(tracking)
            success += 1
        except Exception as e:
            errors.append(f"第{idx + 1}条记录: {str(e)}")
            failed += 1

    db.commit()
    return schemas.ImportResult(success=success, failed=failed, errors=errors)


def import_penalty_rules(db: Session, rules_data: List[Dict[str, Any]]) -> schemas.ImportResult:
    success = 0
    failed = 0
    errors = []

    for idx, rule in enumerate(rules_data):
        try:
            rule_code = str(rule.get("rule_code", "")).strip()
            if not rule_code:
                errors.append(f"第{idx + 1}条规则: 缺少rule_code")
                failed += 1
                continue

            existing = db.query(models.PenaltyRule).filter(
                models.PenaltyRule.rule_code == rule_code
            ).first()

            if existing:
                existing.rule_name = str(rule.get("rule_name", existing.rule_name))
                existing.penalty_type = str(rule.get("penalty_type", existing.penalty_type))
                existing.penalty_ratio = float(rule.get("penalty_ratio", existing.penalty_ratio))
                existing.conditions = str(rule.get("conditions", "")) if rule.get("conditions") else existing.conditions
                existing.is_active = bool(rule.get("is_active", existing.is_active))
                success += 1
            else:
                new_rule = models.PenaltyRule(
                    rule_code=rule_code,
                    rule_name=str(rule.get("rule_name", "")).strip(),
                    penalty_type=str(rule.get("penalty_type", "")).strip(),
                    penalty_ratio=float(rule.get("penalty_ratio", 0)),
                    conditions=str(rule.get("conditions", "")) if rule.get("conditions") else None,
                )
                db.add(new_rule)
                success += 1
        except Exception as e:
            errors.append(f"第{idx + 1}条规则: {str(e)}")
            failed += 1

    db.commit()
    return schemas.ImportResult(success=success, failed=failed, errors=errors)
