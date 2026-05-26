import hashlib
import json
import uuid
from typing import List, Dict, Any, Optional
from io import StringIO
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime

import models
import schemas
from rules import RuleEngine


def generate_record_hash(record: Dict[str, Any]) -> str:
    key = f"{record.get('chemical_code')}_{record.get('area_code')}_{record.get('spray_date')}_{record.get('dosage')}"
    return hashlib.md5(key.encode()).hexdigest()


def generate_batch_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = str(uuid.uuid4())[:6].upper()
    return f"BATCH-{timestamp}-{suffix}"


def parse_csv_content(content: str) -> List[Dict[str, Any]]:
    df = pd.read_csv(StringIO(content))
    return df.to_dict("records")


class ChemicalService:
    @staticmethod
    def import_chemicals(db: Session, chemicals: List[Dict[str, Any]]) -> int:
        count = 0
        for chem in chemicals:
            existing = db.query(models.ChemicalInventory).filter(
                models.ChemicalInventory.chemical_code == chem["chemical_code"]
            ).first()
            if existing:
                for key, value in chem.items():
                    setattr(existing, key, value)
            else:
                db_chem = models.ChemicalInventory(**chem)
                db.add(db_chem)
            count += 1
        db.commit()
        return count

    @staticmethod
    def get_all_chemicals(db: Session) -> Dict[str, Dict[str, Any]]:
        chemicals = db.query(models.ChemicalInventory).all()
        return {
            c.chemical_code: {
                "chemical_code": c.chemical_code,
                "name": c.name,
                "max_dosage_per_100m2": c.max_dosage_per_100m2,
                "min_interval_days": c.min_interval_days,
                "wind_speed_limit": c.wind_speed_limit,
                "hazard_level": c.hazard_level
            }
            for c in chemicals
        }


class WeatherService:
    @staticmethod
    def import_weather(db: Session, weather_records: List[Dict[str, Any]]) -> int:
        count = 0
        for wr in weather_records:
            existing = db.query(models.WeatherRecord).filter(
                models.WeatherRecord.weather_code == wr["weather_code"]
            ).first()
            if existing:
                for key, value in wr.items():
                    setattr(existing, key, value)
            else:
                db_wr = models.WeatherRecord(**wr)
                db.add(db_wr)
            count += 1
        db.commit()
        return count

    @staticmethod
    def get_all_weather(db: Session) -> Dict[str, Dict[str, Any]]:
        records = db.query(models.WeatherRecord).all()
        return {
            w.weather_code: {
                "weather_code": w.weather_code,
                "record_date": w.record_date,
                "wind_speed": w.wind_speed,
                "temperature": w.temperature,
                "humidity": w.humidity,
                "rainfall": w.rainfall,
                "weather_condition": w.weather_condition
            }
            for w in records
        }


class SprayRecordService:
    @staticmethod
    def get_history_records(db: Session) -> List[Dict[str, Any]]:
        records = db.query(models.SprayRecord).filter(
            models.SprayRecord.is_duplicate == False,
            models.SprayRecord.status != "failed"
        ).all()
        return [
            {
                "chemical_code": r.chemical_code,
                "area_code": r.area_code,
                "spray_date": r.spray_date
            }
            for r in records
        ]

    @staticmethod
    def check_duplicate(db: Session, record_hash: str) -> bool:
        existing = db.query(models.SprayRecord).filter(
            models.SprayRecord.record_hash == record_hash,
            models.SprayRecord.is_duplicate == False
        ).first()
        return existing is not None

    @staticmethod
    def process_submission(db: Session, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        batch_no = generate_batch_no()
        rule_engine = RuleEngine()

        chemical_map = ChemicalService.get_all_chemicals(db)
        weather_map = WeatherService.get_all_weather(db)
        history_records = SprayRecordService.get_history_records(db)

        batch = models.SubmissionBatch(
            batch_no=batch_no,
            total_records=len(records)
        )
        db.add(batch)
        db.flush()

        normal_items = []
        confirm_items = []
        failed_items = []
        duplicate_items = []

        for idx, record in enumerate(records):
            record_hash = generate_record_hash(record)
            is_duplicate = SprayRecordService.check_duplicate(db, record_hash)

            if is_duplicate:
                status = "duplicate"
                violations = ["重复提交记录"]
                suggestion = "该记录已存在，跳过处理"
            else:
                status, violations, suggestion = rule_engine.validate(
                    record, weather_map, chemical_map, history_records
                )

            db_record = models.SprayRecord(
                batch_id=batch.id,
                record_hash=record_hash,
                is_duplicate=is_duplicate,
                chemical_code=record.get("chemical_code", ""),
                area_code=record.get("area_code", ""),
                spray_date=record.get("spray_date", ""),
                dosage=float(record.get("dosage", 0)),
                operator=record.get("operator", ""),
                weather_code=record.get("weather_code", ""),
                status=status,
                rule_violations=json.dumps(violations, ensure_ascii=False),
                suggestion=suggestion,
                raw_data=json.dumps(record, ensure_ascii=False)
            )
            db.add(db_record)

            result_item = schemas.SprayRecordResult(
                record_index=idx,
                chemical_code=record.get("chemical_code", ""),
                area_code=record.get("area_code", ""),
                spray_date=record.get("spray_date", ""),
                dosage=float(record.get("dosage", 0)),
                operator=record.get("operator", ""),
                weather_code=record.get("weather_code", ""),
                status=status,
                is_duplicate=is_duplicate,
                rule_violations=violations,
                suggestion=suggestion,
                raw_data=record
            )

            if is_duplicate:
                duplicate_items.append(result_item)
            elif status == "normal":
                normal_items.append(result_item)
            elif status == "confirm":
                confirm_items.append(result_item)
            else:
                failed_items.append(result_item)

        batch.normal_count = len(normal_items)
        batch.confirm_count = len(confirm_items)
        batch.failed_count = len(failed_items) + len(duplicate_items)

        db.commit()

        ReportService.generate_report(db, batch.id, normal_items, confirm_items, failed_items, duplicate_items)

        return {
            "batch_no": batch_no,
            "submitted_at": batch.submitted_at,
            "summary": {
                "total": len(records),
                "normal": len(normal_items),
                "confirm": len(confirm_items),
                "failed": len(failed_items),
                "duplicate": len(duplicate_items)
            },
            "normal_items": normal_items,
            "confirm_items": confirm_items,
            "failed_items": failed_items,
            "duplicate_items": duplicate_items
        }

    @staticmethod
    def get_record_detail(db: Session, record_id: int) -> Optional[Dict[str, Any]]:
        record = db.query(models.SprayRecord).filter(models.SprayRecord.id == record_id).first()
        if not record:
            return None

        batch = db.query(models.SubmissionBatch).filter(models.SubmissionBatch.id == record.batch_id).first()
        chemical = db.query(models.ChemicalInventory).filter(
            models.ChemicalInventory.chemical_code == record.chemical_code
        ).first()
        weather = db.query(models.WeatherRecord).filter(
            models.WeatherRecord.weather_code == record.weather_code
        ).first()

        return {
            "id": record.id,
            "batch_no": batch.batch_no if batch else "",
            "chemical_code": record.chemical_code,
            "chemical_name": chemical.name if chemical else None,
            "area_code": record.area_code,
            "spray_date": record.spray_date,
            "dosage": record.dosage,
            "operator": record.operator,
            "weather_code": record.weather_code,
            "weather_info": {
                "wind_speed": weather.wind_speed,
                "temperature": weather.temperature,
                "humidity": weather.humidity,
                "weather_condition": weather.weather_condition
            } if weather else None,
            "status": record.status,
            "rule_violations": json.loads(record.rule_violations) if record.rule_violations else [],
            "suggestion": record.suggestion,
            "is_duplicate": record.is_duplicate
        }


class ReportService:
    @staticmethod
    def generate_report(db: Session, batch_id: int, normal_items, confirm_items, failed_items, duplicate_items):
        report_lines = []
        report_lines.append("=" * 60)
        report_lines.append("园林养护药剂喷洒作业处理报告")
        report_lines.append("=" * 60)
        report_lines.append(f"批次号: {db.query(models.SubmissionBatch).get(batch_id).batch_no}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")

        total = len(normal_items) + len(confirm_items) + len(failed_items) + len(duplicate_items)
        report_lines.append(f"总记录数: {total}")
        report_lines.append(f"正常: {len(normal_items)} 待确认: {len(confirm_items)} 失败: {len(failed_items)} 重复: {len(duplicate_items)}")
        report_lines.append("")

        if failed_items:
            report_lines.append("-" * 60)
            report_lines.append("失败记录明细")
            report_lines.append("-" * 60)
            for item in failed_items:
                report_lines.append(f"记录#{item.record_index}: 区域{item.area_code} - {item.chemical_code}")
                report_lines.append(f"  问题: {'; '.join(item.rule_violations)}")
                report_lines.append(f"  建议: {item.suggestion}")
                report_lines.append("")

        if confirm_items:
            report_lines.append("-" * 60)
            report_lines.append("待确认记录明细")
            report_lines.append("-" * 60)
            for item in confirm_items:
                report_lines.append(f"记录#{item.record_index}: 区域{item.area_code} - {item.chemical_code}")
                report_lines.append(f"  问题: {'; '.join(item.rule_violations)}")
                report_lines.append(f"  建议: {item.suggestion}")
                report_lines.append("")

        if duplicate_items:
            report_lines.append("-" * 60)
            report_lines.append("重复记录明细")
            report_lines.append("-" * 60)
            for item in duplicate_items:
                report_lines.append(f"记录#{item.record_index}: 区域{item.area_code} - {item.chemical_code}")
                report_lines.append(f"  说明: 该记录已存在，未重复生效")
                report_lines.append("")

        report_lines.append("=" * 60)
        report_lines.append("报告结束")
        report_lines.append("=" * 60)

        report_content = "\n".join(report_lines)
        db_report = models.ProcessReport(
            batch_id=batch_id,
            report_content=report_content
        )
        db.add(db_report)
        db.commit()

    @staticmethod
    def get_report_by_batch(db: Session, batch_no: str) -> Optional[Dict[str, Any]]:
        batch = db.query(models.SubmissionBatch).filter(
            models.SubmissionBatch.batch_no == batch_no
        ).first()
        if not batch:
            return None

        report = db.query(models.ProcessReport).filter(
            models.ProcessReport.batch_id == batch.id
        ).first()

        if not report:
            return None

        return {
            "batch_no": batch_no,
            "generated_at": report.generated_at,
            "report_content": report.report_content
        }

    @staticmethod
    def get_all_batches(db: Session) -> List[Dict[str, Any]]:
        batches = db.query(models.SubmissionBatch).order_by(
            models.SubmissionBatch.submitted_at.desc()
        ).all()
        return [
            {
                "batch_no": b.batch_no,
                "submitted_at": b.submitted_at,
                "total_records": b.total_records,
                "normal_count": b.normal_count,
                "confirm_count": b.confirm_count,
                "failed_count": b.failed_count
            }
            for b in batches
        ]
