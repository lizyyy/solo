from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import uuid

from models import (
    Batch,
    Customer,
    PurchaseRecord,
    ProcessedRecord,
    FollowupReminder,
)
from utils import (
    parse_csv,
    parse_json,
    normalize_purchase_record,
    normalize_customer_record,
    normalize_rule_record,
    mask_phone,
    mask_id_card,
    mask_address,
    generate_trace_id,
)
from utils.json_utils import clean_for_json
from rules import RuleEngine
from models import FollowupRule


class DataProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.rule_engine = RuleEngine(db)

    def _check_duplicate_batch(self, file_hash: str, source_type: str) -> Optional[Batch]:
        return (
            self.db.query(Batch)
            .filter(Batch.file_hash == file_hash, Batch.source_type == source_type)
            .first()
        )

    def _create_batch(self, source_type: str, file_name: str, file_hash: str, total: int) -> Batch:
        batch = Batch(
            batch_no=f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}",
            source_type=source_type,
            file_name=file_name,
            file_hash=file_hash,
            total_records=total,
            status="processing",
        )
        self.db.add(batch)
        self.db.flush()
        return batch

    def process_purchase_csv(self, content: bytes, file_name: str) -> Dict[str, Any]:
        records, file_hash = parse_csv(content, file_name)

        existing_batch = self._check_duplicate_batch(file_hash, "purchase_csv")
        if existing_batch:
            return self._build_existing_batch_response(existing_batch)

        batch = self._create_batch("purchase_csv", file_name, file_hash, len(records))

        normal_records = []
        pending_records = []
        failed_records = []

        for idx, raw_record in enumerate(records):
            normalized = normalize_purchase_record(raw_record, idx)
            trace_id = normalized["_trace_id"]

            customer = (
                self.db.query(Customer)
                .filter(Customer.customer_id == normalized.get("customer_id"))
                .first()
            )

            status, matched_rules, error_msg = self.rule_engine.validate_purchase_record(
                normalized, customer
            )

            suggestion = ""
            if status in ["failed", "pending"]:
                suggestion = self.rule_engine.suggest_handling(error_msg, "purchase")

            processed = ProcessedRecord(
                batch_id=batch.id,
                record_type="purchase",
                source_id=normalized.get("record_id"),
                status=status,
                result_category=status,
                raw_data=normalized["_raw"],
                processed_data={k: v for k, v in normalized.items() if not k.startswith("_")},
                error_message=error_msg if error_msg else None,
                suggestion=suggestion if suggestion else None,
                rule_matched=matched_rules if matched_rules else None,
                trace_id=trace_id,
            )
            self.db.add(processed)
            self.db.flush()

            result_data = {
                "id": processed.id,
                "batch_id": batch.id,
                "record_type": "purchase",
                "source_id": normalized.get("record_id"),
                "status": status,
                "result_category": status,
                "raw_data": normalized["_raw"],
                "processed_data": {k: v for k, v in normalized.items() if not k.startswith("_")},
                "error_message": error_msg if error_msg else None,
                "suggestion": suggestion if suggestion else None,
                "rule_matched": matched_rules if matched_rules else None,
                "trace_id": trace_id,
                "created_at": datetime.utcnow(),
            }

            if status == "normal":
                normal_records.append(result_data)
                self._save_purchase_record(normalized)
            elif status == "pending":
                pending_records.append(result_data)
            else:
                failed_records.append(result_data)

        batch.status = "completed"
        self.db.commit()

        result = {
            "batch_no": batch.batch_no,
            "total_records": len(records),
            "normal_count": len(normal_records),
            "pending_count": len(pending_records),
            "failed_count": len(failed_records),
            "normal": normal_records,
            "pending": pending_records,
            "failed": failed_records,
        }
        return clean_for_json(result)

    def process_customers_json(self, content: bytes, file_name: str) -> Dict[str, Any]:
        records, file_hash = parse_json(content)

        existing_batch = self._check_duplicate_batch(file_hash, "customer_json")
        if existing_batch:
            return self._build_existing_batch_response(existing_batch)

        batch = self._create_batch("customer_json", file_name, file_hash, len(records))

        normal_records = []
        pending_records = []
        failed_records = []

        for idx, raw_record in enumerate(records):
            normalized = normalize_customer_record(raw_record, idx)
            trace_id = normalized["_trace_id"]

            status, matched_rules, error_msg = self.rule_engine.validate_customer_record(normalized)

            suggestion = ""
            if status in ["failed", "pending"]:
                suggestion = self.rule_engine.suggest_handling(error_msg, "customer")

            masked_data = {
                "customer_id": normalized.get("customer_id"),
                "name": normalized.get("name"),
                "phone_masked": mask_phone(normalized.get("phone", "")),
                "id_card_masked": mask_id_card(normalized.get("id_card", "")),
                "disease_type": normalized.get("disease_type"),
                "birthday": normalized.get("birthday"),
                "address_masked": mask_address(normalized.get("address", "")),
            }

            processed = ProcessedRecord(
                batch_id=batch.id,
                record_type="customer",
                source_id=normalized.get("customer_id"),
                status=status,
                result_category=status,
                raw_data=normalized["_raw"],
                processed_data=masked_data,
                error_message=error_msg if error_msg else None,
                suggestion=suggestion if suggestion else None,
                rule_matched=matched_rules if matched_rules else None,
                trace_id=trace_id,
            )
            self.db.add(processed)
            self.db.flush()

            result_data = {
                "id": processed.id,
                "batch_id": batch.id,
                "record_type": "customer",
                "source_id": normalized.get("customer_id"),
                "status": status,
                "result_category": status,
                "raw_data": normalized["_raw"],
                "processed_data": masked_data,
                "error_message": error_msg if error_msg else None,
                "suggestion": suggestion if suggestion else None,
                "rule_matched": matched_rules if matched_rules else None,
                "trace_id": trace_id,
                "created_at": datetime.utcnow(),
            }

            if status == "normal":
                normal_records.append(result_data)
                self._save_customer_record(normalized, masked_data)
            elif status == "pending":
                pending_records.append(result_data)
            else:
                failed_records.append(result_data)

        batch.status = "completed"
        self.db.commit()

        result = {
            "batch_no": batch.batch_no,
            "total_records": len(records),
            "normal_count": len(normal_records),
            "pending_count": len(pending_records),
            "failed_count": len(failed_records),
            "normal": normal_records,
            "pending": pending_records,
            "failed": failed_records,
        }
        return clean_for_json(result)

    def process_rules_json(self, content: bytes, file_name: str) -> Dict[str, Any]:
        records, file_hash = parse_json(content)

        existing_batch = self._check_duplicate_batch(file_hash, "rule_json")
        if existing_batch:
            return self._build_existing_batch_response(existing_batch)

        batch = self._create_batch("rule_json", file_name, file_hash, len(records))

        normal_records = []
        pending_records = []
        failed_records = []

        for idx, raw_record in enumerate(records):
            normalized = normalize_rule_record(raw_record, idx)
            trace_id = normalized["_trace_id"]

            status, error_msg = self._validate_rule(normalized)

            suggestion = ""
            if status in ["failed", "pending"]:
                suggestion = self.rule_engine.suggest_handling(error_msg, "rule")

            processed = ProcessedRecord(
                batch_id=batch.id,
                record_type="rule",
                source_id=normalized.get("rule_id"),
                status=status,
                result_category=status,
                raw_data=normalized["_raw"],
                processed_data={k: v for k, v in normalized.items() if not k.startswith("_")},
                error_message=error_msg if error_msg else None,
                suggestion=suggestion if suggestion else None,
                rule_matched=None,
                trace_id=trace_id,
            )
            self.db.add(processed)
            self.db.flush()

            result_data = {
                "id": processed.id,
                "batch_id": batch.id,
                "record_type": "rule",
                "source_id": normalized.get("rule_id"),
                "status": status,
                "result_category": status,
                "raw_data": normalized["_raw"],
                "processed_data": {k: v for k, v in normalized.items() if not k.startswith("_")},
                "error_message": error_msg if error_msg else None,
                "suggestion": suggestion if suggestion else None,
                "rule_matched": None,
                "trace_id": trace_id,
                "created_at": datetime.utcnow(),
            }

            if status == "normal":
                normal_records.append(result_data)
                self._save_rule_record(normalized)
            elif status == "pending":
                pending_records.append(result_data)
            else:
                failed_records.append(result_data)

        batch.status = "completed"
        self.db.commit()

        result = {
            "batch_no": batch.batch_no,
            "total_records": len(records),
            "normal_count": len(normal_records),
            "pending_count": len(pending_records),
            "failed_count": len(failed_records),
            "normal": normal_records,
            "pending": pending_records,
            "failed": failed_records,
        }
        return clean_for_json(result)

    def _validate_rule(self, normalized: Dict[str, Any]) -> Tuple[str, str]:
        errors = []
        warnings = []

        if not normalized.get("rule_type"):
            errors.append("缺少规则类型")

        if normalized.get("rule_type") not in ["interval", "forbidden"]:
            errors.append("规则类型必须是 interval 或 forbidden")

        if normalized.get("rule_type") == "interval":
            if not normalized.get("interval_days"):
                errors.append("间隔提醒规则需要指定间隔天数")
            elif int(normalized["interval_days"]) <= 0:
                errors.append("间隔天数必须大于0")

        if normalized.get("rule_type") == "forbidden":
            if not normalized.get("forbidden_drugs"):
                warnings.append("禁忌药规则未指定禁忌药品列表")

        if errors:
            return "failed", "; ".join(errors)
        if warnings:
            return "pending", "; ".join(warnings)
        return "normal", ""

    def _save_purchase_record(self, normalized: Dict[str, Any]):
        existing = (
            self.db.query(PurchaseRecord)
            .filter(PurchaseRecord.record_id == normalized["record_id"])
            .first()
        )
        if existing:
            return

        try:
            purchase_date = pd.to_datetime(normalized["purchase_date"]).date()
        except Exception:
            purchase_date = datetime.now().date()

        record = PurchaseRecord(
            record_id=normalized["record_id"],
            customer_id=normalized.get("customer_id", ""),
            drug_name=normalized.get("drug_name", ""),
            drug_spec=normalized.get("drug_spec"),
            purchase_date=purchase_date,
            quantity=normalized.get("quantity"),
            dosage=normalized.get("dosage"),
            doctor=normalized.get("doctor"),
        )
        self.db.add(record)

    def _save_customer_record(self, normalized: Dict[str, Any], masked_data: Dict[str, Any]):
        existing = (
            self.db.query(Customer)
            .filter(Customer.customer_id == normalized["customer_id"])
            .first()
        )
        if existing:
            existing.name = normalized.get("name", existing.name)
            existing.phone_masked = masked_data.get("phone_masked", existing.phone_masked)
            existing.id_card_masked = masked_data.get("id_card_masked", existing.id_card_masked)
            existing.disease_type = normalized.get("disease_type", existing.disease_type)
            existing.birthday = normalized.get("birthday", existing.birthday)
            existing.address_masked = masked_data.get("address_masked", existing.address_masked)
            return

        customer = Customer(
            customer_id=normalized["customer_id"],
            name=normalized.get("name", ""),
            phone_masked=masked_data.get("phone_masked"),
            id_card_masked=masked_data.get("id_card_masked"),
            disease_type=normalized.get("disease_type"),
            birthday=normalized.get("birthday"),
            address_masked=masked_data.get("address_masked"),
        )
        self.db.add(customer)

    def _save_rule_record(self, normalized: Dict[str, Any]):
        existing = (
            self.db.query(FollowupRule)
            .filter(FollowupRule.rule_id == normalized["rule_id"])
            .first()
        )
        if existing:
            existing.rule_type = normalized.get("rule_type", existing.rule_type)
            existing.disease_type = normalized.get("disease_type", existing.disease_type)
            existing.drug_name = normalized.get("drug_name", existing.drug_name)
            existing.interval_days = normalized.get("interval_days", existing.interval_days)
            existing.forbidden_drugs = normalized.get("forbidden_drugs", existing.forbidden_drugs)
            existing.description = normalized.get("description", existing.description)
            return

        rule = FollowupRule(
            rule_id=normalized["rule_id"],
            rule_type=normalized.get("rule_type", ""),
            disease_type=normalized.get("disease_type"),
            drug_name=normalized.get("drug_name"),
            interval_days=normalized.get("interval_days"),
            forbidden_drugs=normalized.get("forbidden_drugs"),
            description=normalized.get("description"),
        )
        self.db.add(rule)

    def _build_existing_batch_response(self, batch: Batch) -> Dict[str, Any]:
        records = (
            self.db.query(ProcessedRecord)
            .filter(ProcessedRecord.batch_id == batch.id)
            .all()
        )

        normal = []
        pending = []
        failed = []

        for r in records:
            data = {
                "id": r.id,
                "batch_id": r.batch_id,
                "record_type": r.record_type,
                "source_id": r.source_id,
                "status": r.status,
                "result_category": r.result_category,
                "raw_data": r.raw_data,
                "processed_data": r.processed_data,
                "error_message": r.error_message,
                "suggestion": r.suggestion,
                "rule_matched": r.rule_matched,
                "trace_id": r.trace_id,
                "created_at": r.created_at,
            }
            if r.result_category == "normal":
                normal.append(data)
            elif r.result_category == "pending":
                pending.append(data)
            else:
                failed.append(data)

        result = {
            "batch_no": batch.batch_no,
            "total_records": batch.total_records,
            "normal_count": len(normal),
            "pending_count": len(pending),
            "failed_count": len(failed),
            "normal": normal,
            "pending": pending,
            "failed": failed,
            "is_duplicate": True,
            "message": "该文件已处理过，返回历史结果",
        }
        return clean_for_json(result)

    def generate_followup_report(self, batch_no: Optional[str] = None) -> Dict[str, Any]:
        report_id = f"REPORT_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"

        customers = self.db.query(Customer).all()
        all_reminders = []

        for customer in customers:
            purchase_records = (
                self.db.query(PurchaseRecord)
                .filter(PurchaseRecord.customer_id == customer.customer_id)
                .all()
            )
            reminders = self.rule_engine.generate_followup_reminders(customer, purchase_records)

            for rem in reminders:
                trace_id = generate_trace_id(
                    customer.customer_id,
                    rem["drug_name"],
                    rem["last_purchase_date"],
                    rem["next_followup_date"],
                )

                reminder = FollowupReminder(
                    reminder_id=f"REM_{uuid.uuid4().hex[:12]}",
                    customer_id=customer.customer_id,
                    customer_name=customer.name,
                    drug_name=rem["drug_name"],
                    last_purchase_date=rem["last_purchase_date"],
                    next_followup_date=rem["next_followup_date"],
                    reminder_type=rem["reminder_type"],
                    content=rem["content"],
                    status="pending",
                    trace_id=trace_id,
                    report_id=report_id,
                )
                self.db.add(reminder)
                self.db.flush()

                all_reminders.append({
                    "reminder_id": reminder.reminder_id,
                    "customer_id": customer.customer_id,
                    "customer_name": customer.name,
                    "drug_name": rem["drug_name"],
                    "last_purchase_date": rem["last_purchase_date"],
                    "next_followup_date": rem["next_followup_date"],
                    "reminder_type": rem["reminder_type"],
                    "content": rem["content"],
                    "status": "pending",
                    "trace_id": trace_id,
                    "report_id": report_id,
                    "created_at": datetime.utcnow(),
                })

        self.db.commit()

        overdue_count = len([r for r in all_reminders if r["reminder_type"] == "overdue"])
        upcoming_count = len([r for r in all_reminders if r["reminder_type"] == "upcoming"])

        result = {
            "report_id": report_id,
            "batch_no": batch_no or "",
            "generated_at": datetime.utcnow(),
            "summary": {
                "total_customers": len(customers),
                "total_reminders": len(all_reminders),
                "overdue_count": overdue_count,
                "upcoming_count": upcoming_count,
            },
            "reminders": all_reminders,
        }
        return clean_for_json(result)

    def get_trace_detail(self, trace_id: str) -> Dict[str, Any]:
        reminder = (
            self.db.query(FollowupReminder)
            .filter(FollowupReminder.trace_id == trace_id)
            .first()
        )

        processed = (
            self.db.query(ProcessedRecord)
            .filter(ProcessedRecord.trace_id == trace_id)
            .first()
        )

        purchase = None
        customer = None

        if reminder:
            purchase = (
                self.db.query(PurchaseRecord)
                .filter(
                    PurchaseRecord.customer_id == reminder.customer_id,
                    PurchaseRecord.drug_name == reminder.drug_name,
                )
                .order_by(PurchaseRecord.purchase_date.desc())
                .first()
            )
            customer = (
                self.db.query(Customer)
                .filter(Customer.customer_id == reminder.customer_id)
                .first()
            )

        if processed and processed.source_id:
            if processed.record_type == "purchase":
                purchase = (
                    self.db.query(PurchaseRecord)
                    .filter(PurchaseRecord.record_id == processed.source_id)
                    .first()
                )
            if processed.record_type == "customer":
                customer = (
                    self.db.query(Customer)
                    .filter(Customer.customer_id == processed.source_id)
                    .first()
                )

        result = {
            "trace_id": trace_id,
            "reminder": {
                "reminder_id": reminder.reminder_id,
                "customer_id": reminder.customer_id,
                "customer_name": reminder.customer_name,
                "drug_name": reminder.drug_name,
                "last_purchase_date": reminder.last_purchase_date,
                "next_followup_date": reminder.next_followup_date,
                "reminder_type": reminder.reminder_type,
                "content": reminder.content,
                "status": reminder.status,
                "trace_id": reminder.trace_id,
                "report_id": reminder.report_id,
                "created_at": reminder.created_at,
            }
            if reminder
            else None,
            "processed_record": {
                "id": processed.id,
                "batch_id": processed.batch_id,
                "record_type": processed.record_type,
                "source_id": processed.source_id,
                "status": processed.status,
                "result_category": processed.result_category,
                "raw_data": processed.raw_data,
                "processed_data": processed.processed_data,
                "error_message": processed.error_message,
                "suggestion": processed.suggestion,
                "rule_matched": processed.rule_matched,
                "trace_id": processed.trace_id,
                "created_at": processed.created_at,
            }
            if processed
            else None,
            "purchase_record": {
                "record_id": purchase.record_id,
                "customer_id": purchase.customer_id,
                "drug_name": purchase.drug_name,
                "drug_spec": purchase.drug_spec,
                "purchase_date": purchase.purchase_date,
                "quantity": purchase.quantity,
                "dosage": purchase.dosage,
                "doctor": purchase.doctor,
                "created_at": purchase.created_at,
            }
            if purchase
            else None,
            "customer": {
                "customer_id": customer.customer_id,
                "name": customer.name,
                "phone_masked": customer.phone_masked,
                "id_card_masked": customer.id_card_masked,
                "disease_type": customer.disease_type,
                "birthday": customer.birthday,
                "address_masked": customer.address_masked,
                "created_at": customer.created_at,
            }
            if customer
            else None,
        }
        return clean_for_json(result)


import pandas as pd
