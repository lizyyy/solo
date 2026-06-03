from datetime import datetime
from typing import List, Dict, Optional, Tuple
import uuid

from models import (
    AccountManagerEmail,
    SettlementBatch,
    LoanInterestRecord,
    RecordStatus,
    SupplementaryRecord,
    NextHandler,
    CalculationResult,
    CalculationParameter,
)


class InterestCalculationService:
    def __init__(self):
        self.emails: Dict[str, AccountManagerEmail] = {}
        self.batches: Dict[str, SettlementBatch] = {}
        self.records: Dict[str, LoanInterestRecord] = {}
        self.email_unique_keys: Dict[str, str] = {}

    def calculate_days(self, start_date: str, end_date: str) -> int:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        return (end - start).days

    def calculate_interest(self, principal: float, rate: float, days: int) -> CalculationResult:
        params = [
            CalculationParameter(
                version="v1.0",
                parameter_name="计息基数",
                value=principal,
                reason="采用合同约定的借款本金作为计息基数",
                effective_date="2024-01-01",
                created_by="系统"
            ),
            CalculationParameter(
                version="v1.0",
                parameter_name="日利率计算方式",
                value="rate / 360",
                reason="金融行业通用的360天计息规则",
                effective_date="2024-01-01",
                created_by="系统"
            ),
            CalculationParameter(
                version="v1.0",
                parameter_name="实际天数",
                value=days,
                reason="采用算头不算尾的方式计算实际天数",
                effective_date="2024-01-01",
                created_by="系统"
            ),
        ]

        daily_rate = rate / 360
        interest = principal * daily_rate * days
        formula = "利息 = 本金 × (年利率/360) × 实际天数"

        return CalculationResult(
            principal=principal,
            days=days,
            rate=rate,
            interest=round(interest, 2),
            formula=formula,
            parameters=params
        )

    def import_account_manager_email(self, email_data: Dict) -> Tuple[AccountManagerEmail, bool]:
        email = AccountManagerEmail(
            email_id=str(uuid.uuid4()),
            batch_no=email_data["batch_no"],
            institution_name=email_data["institution_name"],
            institution_short_name=email_data["institution_short_name"],
            loan_amount=email_data["loan_amount"],
            interest_rate=email_data["interest_rate"],
            start_date=email_data["start_date"],
            end_date=email_data["end_date"],
            import_time=datetime.now(),
            source_file=email_data.get("source_file", "unknown"),
            raw_content=email_data.get("raw_content", "")
        )

        unique_key = email.get_unique_key()

        if unique_key in self.email_unique_keys:
            existing_email_id = self.email_unique_keys[unique_key]
            return self.emails[existing_email_id], True

        self.emails[email.email_id] = email
        self.email_unique_keys[unique_key] = email.email_id
        return email, False

    def import_settlement_batch(self, batch_data: Dict) -> SettlementBatch:
        batch = SettlementBatch(
            batch_id=str(uuid.uuid4()),
            batch_no=batch_data["batch_no"],
            institution_name=batch_data["institution_name"],
            institution_short_name=batch_data["institution_short_name"],
            settlement_amount=batch_data["settlement_amount"],
            settlement_date=batch_data["settlement_date"],
            import_time=datetime.now(),
            source_file=batch_data.get("source_file", "unknown")
        )
        self.batches[batch.batch_id] = batch
        return batch

    def create_interest_record_from_email(self, email: AccountManagerEmail) -> LoanInterestRecord:
        days = self.calculate_days(email.start_date, email.end_date)
        calculation = self.calculate_interest(
            email.loan_amount,
            email.interest_rate,
            days
        )

        record = LoanInterestRecord(
            record_id=str(uuid.uuid4()),
            source_email_ids=[email.email_id],
            source_batch_ids=[],
            institution_name=email.institution_name,
            email_short_name=email.institution_short_name,
            batch_short_name="",
            loan_amount=email.loan_amount,
            interest_rate=email.interest_rate,
            start_date=email.start_date,
            end_date=email.end_date,
            calculation=calculation,
            status=RecordStatus.PENDING
        )

        self.records[record.record_id] = record
        return record

    def link_settlement_to_record(self, record_id: str, batch: SettlementBatch, operator: str):
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]

        old_batch_short_name = record.batch_short_name
        old_status = record.status

        if batch.batch_id not in record.source_batch_ids:
            record.source_batch_ids.append(batch.batch_id)

        record.batch_short_name = batch.institution_short_name

        if record.has_short_name_conflict():
            record.status = RecordStatus.CONFLICT
        else:
            record.status = RecordStatus.NORMAL

        record.add_audit_record(
            "batch_short_name",
            old_batch_short_name,
            batch.institution_short_name,
            operator,
            "关联清算批次号，更新机构简称"
        )

        record.add_audit_record(
            "status",
            old_status,
            record.status,
            operator,
            "根据机构简称一致性更新状态"
        )

    def update_remark(self, record_id: str, new_remark: str, operator: str):
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]
        old_remark = record.remark

        record.add_audit_record(
            "remark",
            old_remark,
            new_remark,
            operator,
            "更新备注信息"
        )
        record.remark = new_remark

    def get_record_history(self, record_id: str) -> List[Dict]:
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]
        history = []

        for audit in record.audit_history:
            history.append({
                "字段": audit.field_name,
                "修改前": audit.old_value,
                "修改后": audit.new_value,
                "修改人": audit.changed_by,
                "修改时间": audit.changed_at.strftime("%Y-%m-%d %H:%M:%S"),
                "修改原因": audit.change_reason
            })

        return history

    def get_source_data_for_record(self, record_id: str) -> Dict:
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]
        emails = [self.emails[eid] for eid in record.source_email_ids if eid in self.emails]
        batches = [self.batches[bid] for bid in record.source_batch_ids if bid in self.batches]

        return {
            "客户经理补充邮件": [
                {
                    "邮件ID": e.email_id,
                    "批次号": e.batch_no,
                    "机构全称": e.institution_name,
                    "机构简称": e.institution_short_name,
                    "导入时间": e.import_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "源文件": e.source_file
                }
                for e in emails
            ],
            "清算批次号": [
                {
                    "批次ID": b.batch_id,
                    "批次号": b.batch_no,
                    "机构全称": b.institution_name,
                    "机构简称": b.institution_short_name,
                    "导入时间": b.import_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "源文件": b.source_file
                }
                for b in batches
            ]
        }

    def get_conflict_records(self) -> List[LoanInterestRecord]:
        return [r for r in self.records.values() if r.status == RecordStatus.CONFLICT]
