from datetime import datetime
from typing import List, Dict, Optional, Tuple
import hashlib
import json
import uuid

from models import (
    TailDifferenceRecord, TailDifferenceStatus,
    ClientEmail, SettlementBatch, ChangeHistory, ChangeType,
    CalculationParams
)


class TailDifferenceTracker:
    def __init__(self):
        self.records: Dict[str, TailDifferenceRecord] = {}
        self.client_emails: Dict[str, ClientEmail] = {}
        self.settlement_batches: Dict[str, SettlementBatch] = {}
        self.content_hashes: Dict[str, str] = {}
        self._business_key_index: Dict[str, str] = {}
        self.calculation_params = CalculationParams(
            version="v1.2.0",
            tolerance_threshold=0.01,
            rounding_method="四舍五入至分位",
            trade_date_cutoff="T+1 10:00",
            notes="尾差计算采用申请金额-赎回金额-清算金额公式，小于阈值0.01元视为计算误差"
        )

    @staticmethod
    def _make_business_key(trade_date: str, fund_code: str) -> str:
        return f"{trade_date}|{fund_code}"

    def import_client_email_batch(
        self,
        source_file: str,
        email_batch_data: List[Dict],
        operator: str
    ) -> Tuple[List[TailDifferenceRecord], int]:
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        imported_records = []
        for email_data in email_batch_data:
            trade_date = email_data.get('trade_date', '')
            fund_code = email_data.get('fund_code', '')
            business_key = self._make_business_key(trade_date, fund_code)

            new_remark = email_data.get('remark')
            application_amount = float(email_data.get('application_amount', 0))
            redemption_amount = float(email_data.get('redemption_amount', 0))
            settlement_amount = float(email_data.get('settlement_amount', 0))

            item_hash = hashlib.md5(
                json.dumps(email_data, sort_keys=True).encode()
            ).hexdigest()

            if business_key in self._business_key_index:
                existing_id = self._business_key_index[business_key]
                existing = self.records[existing_id]

                if item_hash in self.content_hashes:
                    continue

                self.content_hashes[item_hash] = batch_id

                if (existing.application_amount == application_amount
                        and existing.redemption_amount == redemption_amount
                        and existing.settlement_amount == settlement_amount):

                    if existing.remark != new_remark:
                        old_remark = existing.remark
                        change = ChangeHistory(
                            id=f"chg_{uuid.uuid4().hex[:8]}",
                            timestamp=datetime.now(),
                            field_name="remark",
                            old_value=old_remark,
                            new_value=new_remark,
                            operator=operator,
                            change_type=ChangeType.IMPORT_UPDATE,
                            reason=f"重导入时备注变更（来源：{source_file}）"
                        )
                        existing.add_change_history(change)
                        existing.remark = new_remark
                        imported_records.append(existing)
                else:
                    old_amounts = (
                        f"申请{existing.application_amount:.2f}/"
                        f"赎回{existing.redemption_amount:.2f}/"
                        f"清算{existing.settlement_amount:.2f}"
                    )
                    new_amounts = (
                        f"申请{application_amount:.2f}/"
                        f"赎回{redemption_amount:.2f}/"
                        f"清算{settlement_amount:.2f}"
                    )
                    change = ChangeHistory(
                        id=f"chg_{uuid.uuid4().hex[:8]}",
                        timestamp=datetime.now(),
                        field_name="amounts",
                        old_value=old_amounts,
                        new_value=new_amounts,
                        operator=operator,
                        change_type=ChangeType.IMPORT_UPDATE,
                        reason=f"重导入时金额变更（来源：{source_file}）"
                    )
                    existing.add_change_history(change)
                    existing.application_amount = application_amount
                    existing.redemption_amount = redemption_amount
                    existing.settlement_amount = settlement_amount
                    existing.tail_difference = (
                        application_amount - redemption_amount - settlement_amount
                    )
                    if existing.remark != new_remark:
                        remark_change = ChangeHistory(
                            id=f"chg_{uuid.uuid4().hex[:8]}",
                            timestamp=datetime.now(),
                            field_name="remark",
                            old_value=existing.remark,
                            new_value=new_remark,
                            operator=operator,
                            change_type=ChangeType.IMPORT_UPDATE,
                            reason=f"重导入时备注变更（来源：{source_file}）"
                        )
                        existing.add_change_history(remark_change)
                        existing.remark = new_remark
                    imported_records.append(existing)
                continue

            email_id = f"email_{uuid.uuid4().hex[:8]}"
            self.content_hashes[item_hash] = batch_id

            client_email = ClientEmail(
                id=email_id,
                batch_id=batch_id,
                source_file=source_file,
                import_time=datetime.now(),
                content_hash=item_hash,
                raw_data=email_data
            )
            self.client_emails[email_id] = client_email

            record = self._create_record_from_email(
                client_email, email_data, operator
            )
            if record:
                bk = self._make_business_key(record.trade_date, record.fund_code)
                self._business_key_index[bk] = record.id
                imported_records.append(record)

        return imported_records, len(imported_records)

    def _create_record_from_email(
        self,
        client_email: ClientEmail,
        email_data: Dict,
        operator: str
    ) -> Optional[TailDifferenceRecord]:
        record_id = f"td_{uuid.uuid4().hex[:8]}"

        application_amount = float(email_data.get('application_amount', 0))
        redemption_amount = float(email_data.get('redemption_amount', 0))
        settlement_amount = float(email_data.get('settlement_amount', 0))
        tail_difference = application_amount - redemption_amount - settlement_amount

        record = TailDifferenceRecord(
            id=record_id,
            trade_date=email_data.get('trade_date', ''),
            fund_code=email_data.get('fund_code', ''),
            fund_name=email_data.get('fund_name', ''),
            application_amount=application_amount,
            redemption_amount=redemption_amount,
            settlement_amount=settlement_amount,
            tail_difference=tail_difference,
            status=TailDifferenceStatus.PENDING_REVIEW,
            remark=email_data.get('remark'),
            client_email_id=client_email.id,
            calculation_params=self.calculation_params,
            responsible_person="风控同事",
            next_action="请风控同事复核此条记录",
            missing_materials=[]
        )

        if tail_difference == 0 and record.remark and "已冲正" in record.remark:
            record.next_action = "金额为0但备注已冲正，请风控同事人工确认后再决定是否标记为正常"
            record.responsible_person = "风控同事"

        self.records[record_id] = record
        return record

    def update_remark(
        self,
        record_id: str,
        new_remark: str,
        operator: str,
        reason: str = ""
    ) -> bool:
        if record_id not in self.records:
            return False

        record = self.records[record_id]
        old_remark = record.remark

        if old_remark == new_remark:
            return True

        change = ChangeHistory(
            id=f"chg_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            field_name="remark",
            old_value=old_remark,
            new_value=new_remark,
            operator=operator,
            change_type=ChangeType.REMARK_CHANGE,
            reason=reason
        )
        record.add_change_history(change)
        record.remark = new_remark
        return True

    def link_settlement_batch(
        self,
        record_id: str,
        batch_number: str,
        operator: str
    ) -> bool:
        if record_id not in self.records:
            return False

        record = self.records[record_id]
        old_batch = record.settlement_batch_number

        if batch_number not in self.settlement_batches:
            return False

        change = ChangeHistory(
            id=f"chg_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            field_name="settlement_batch_number",
            old_value=old_batch,
            new_value=batch_number,
            operator=operator,
            change_type=ChangeType.BATCH_LINK,
            reason="风控值班老秦补录清算批次号"
        )
        record.add_change_history(change)
        record.settlement_batch_number = batch_number

        if record.status == TailDifferenceStatus.PENDING_REVIEW:
            record.next_action = "已关联清算批次，待风控同事最终复核"
            record.responsible_person = "风控同事"

        return True

    def update_status(
        self,
        record_id: str,
        new_status: TailDifferenceStatus,
        operator: str,
        reason: str
    ) -> bool:
        if record_id not in self.records:
            return False

        record = self.records[record_id]
        old_status = record.status

        if record.needs_manual_review() and new_status == TailDifferenceStatus.NORMAL:
            if "老秦" not in operator and "风控值班" not in operator:
                reason += "（注意：此条原标记待人工复核，已强制标记为正常）"

        change = ChangeHistory(
            id=f"chg_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            field_name="status",
            old_value=old_status.value,
            new_value=new_status.value,
            operator=operator,
            change_type=ChangeType.STATUS_CHANGE,
            reason=reason
        )
        record.add_change_history(change)
        record.status = new_status

        if new_status == TailDifferenceStatus.NORMAL:
            record.next_action = "已标记为正常，无需进一步操作"
            record.responsible_person = None
        elif new_status == TailDifferenceStatus.NEED_MATERIAL:
            record.next_action = "请联系客户经理补充材料"
            record.responsible_person = "风控值班老秦"

        return True

    def get_record_change_history(
        self,
        record_id: str
    ) -> List[Dict]:
        if record_id not in self.records:
            return []

        record = self.records[record_id]
        history = []
        for change in record.change_history:
            history.append({
                '时间': change.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                '操作人': change.operator,
                '变更类型': change.change_type.value,
                '字段': change.field_name,
                '变更前': change.old_value or '(空)',
                '变更后': change.new_value or '(空)',
                '原因': change.reason or ''
            })
        return history

    def get_pending_review_records(self) -> List[TailDifferenceRecord]:
        return [
            r for r in self.records.values()
            if r.status in [TailDifferenceStatus.PENDING_REVIEW, TailDifferenceStatus.REVIEWING]
        ]

    def add_settlement_batch(self, batch: SettlementBatch):
        self.settlement_batches[batch.batch_number] = batch

    def trace_to_email(self, record_id: str) -> Optional[ClientEmail]:
        if record_id not in self.records:
            return None
        record = self.records[record_id]
        if record.client_email_id:
            return self.client_emails.get(record.client_email_id)
        return None

    def trace_to_settlement_batch(self, record_id: str) -> Optional[SettlementBatch]:
        if record_id not in self.records:
            return None
        record = self.records[record_id]
        if record.settlement_batch_number:
            return self.settlement_batches.get(record.settlement_batch_number)
        return None
