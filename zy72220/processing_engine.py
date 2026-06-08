import uuid
from datetime import datetime
from typing import Tuple, List, Optional

from models import (
    FeeRateRecord, RecordStatus, Currency, ProcessingResult,
    ConflictType, ConflictEvidence, ProfessionalCalc,
    AuditDetail, HistoryRecord
)


class CurrencyDetector:
    @staticmethod
    def detect_currency(currency_raw: str) -> Tuple[Currency, bool]:
        raw = currency_raw.upper().strip()
        has_cny = any(x in raw for x in ["CNY", "人民币"])
        has_hkd = any(x in raw for x in ["HKD", "港币", "港元"])
        
        if has_cny and has_hkd:
            return Currency.MIXED, True
        elif has_cny:
            return Currency.CNY, False
        elif has_hkd:
            return Currency.HKD, False
        else:
            return Currency.UNKNOWN, False


class ConflictDetector:
    @staticmethod
    def detect_conflicts(record: FeeRateRecord) -> List[ConflictEvidence]:
        conflicts = []
        if not record.email_supplement or not record.settlement_batch:
            return conflicts

        email = record.email_supplement
        settle = record.settlement_batch

        email_currency, _ = CurrencyDetector.detect_currency(email.currency_raw)
        if email_currency != settle.currency and email_currency != Currency.MIXED and settle.currency != Currency.MIXED:
            conflicts.append(ConflictEvidence(
                conflict_type=ConflictType.CURRENCY_CONFLICT,
                field_name="currency",
                email_value=email.currency_raw,
                settlement_value=settle.currency.value,
                description=f"邮件标注币种为{email.currency_raw}，但清算批次记录为{settle.currency.value}",
                email_source=f"{email.email_id} {email.sender}",
                settlement_source=f"{settle.batch_no} 清算系统"
            ))

        if abs(email.rate - settle.rate) > 1e-8:
            conflicts.append(ConflictEvidence(
                conflict_type=ConflictType.RATE_CONFLICT,
                field_name="rate",
                email_value=email.rate,
                settlement_value=settle.rate,
                description=f"邮件费率为{email.rate*100:.4f}%，清算批次费率为{settle.rate*100:.4f}%",
                email_source=f"{email.email_id} {email.sender}",
                settlement_source=f"{settle.batch_no} 清算系统"
            ))

        if email.effective_date != settle.effective_date:
            conflicts.append(ConflictEvidence(
                conflict_type=ConflictType.CALIBER_CONFLICT,
                field_name="effective_date",
                email_value=email.effective_date,
                settlement_value=settle.effective_date,
                description=f"邮件生效日期为{email.effective_date}，清算批次为{settle.effective_date}",
                email_source=f"{email.email_id} {email.sender}",
                settlement_source=f"{settle.batch_no} 清算系统"
            ))

        return conflicts


class RateCalculator:
    MODEL_VERSION = "RATE-CALC-V2.1"
    PARAM_VERSION = "PARAM-2026-Q2"

    @classmethod
    def calculate_adjusted_rate(
        cls,
        base_rate: float,
        product_type: str,
        is_old_caliber: bool = False
    ) -> ProfessionalCalc:
        adjustment_params = {
            "稳健型": 0.95,
            "平衡型": 1.0,
            "进取型": 1.05,
            "default": 1.0
        }
        
        if is_old_caliber:
            cls.PARAM_VERSION = "PARAM-2026-Q1-LEGACY"
            adjustment_params = {
                "稳健型": 0.98,
                "平衡型": 1.0,
                "进取型": 1.03,
                "default": 1.0
            }

        product_key = "default"
        for key in adjustment_params.keys():
            if key in product_type:
                product_key = key
                break

        multiplier = adjustment_params[product_key]
        adjusted_rate = base_rate * multiplier

        reason = (
            f"使用模型版本{cls.MODEL_VERSION}，参数版本{cls.PARAM_VERSION}。"
            f"产品类型映射为{product_key}，调整系数{multiplier}。"
            f"基础费率{base_rate*100:.4f}% × 调整系数{multiplier} = {adjusted_rate*100:.4f}%。"
            f"{'采用旧口径V1.5计算规则。' if is_old_caliber else '采用新口径V2.0计算规则。'}"
        )

        return ProfessionalCalc(
            calc_model_version=cls.MODEL_VERSION,
            parameter_version=cls.PARAM_VERSION,
            input_params={
                "base_rate": base_rate,
                "product_type": product_type,
                "is_old_caliber": is_old_caliber,
                "multiplier": multiplier,
                "product_key": product_key
            },
            calc_result=adjusted_rate,
            decision_reason=reason,
            calc_time=datetime.now()
        )


class ProcessingEngine:
    def __init__(self):
        self.audit_seq = 0
        self.history_seq = 0

    def _generate_audit_id(self) -> str:
        self.audit_seq += 1
        return f"AUD-{datetime.now().strftime('%Y%m%d')}-{self.audit_seq:04d}"

    def _generate_history_id(self) -> str:
        self.history_seq += 1
        return f"HIS-{datetime.now().strftime('%Y%m%d')}-{self.history_seq:04d}"

    def _add_audit(
        self,
        record: FeeRateRecord,
        step_name: str,
        operator: str,
        before_status: RecordStatus,
        after_status: RecordStatus,
        change_content: str,
        currency_verified: Optional[bool] = None,
        professional_calc: Optional[ProfessionalCalc] = None,
        conflict_evidence: Optional[ConflictEvidence] = None,
        decision_choice: Optional[str] = None
    ):
        audit = AuditDetail(
            audit_id=self._generate_audit_id(),
            record_id=record.record_id,
            step_name=step_name,
            operator=operator,
            operation_time=datetime.now(),
            before_status=before_status,
            after_status=after_status,
            change_content=change_content,
            currency_verified=currency_verified,
            professional_calc=professional_calc,
            conflict_evidence=conflict_evidence,
            decision_choice=decision_choice
        )
        record.audit_details.append(audit)
        record.updated_at = datetime.now()
        return audit

    def _add_history(
        self,
        record: FeeRateRecord,
        field_name: str,
        old_value: any,
        new_value: any,
        change_reason: str,
        operator: str,
        source_type: str
    ):
        version_no = len(record.history_records) + 1
        history = HistoryRecord(
            history_id=self._generate_history_id(),
            record_id=record.record_id,
            version_no=version_no,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            change_reason=change_reason,
            operator=operator,
            operate_time=datetime.now(),
            source_type=source_type
        )
        record.history_records.append(history)
        record.updated_at = datetime.now()
        return history

    def step1_import_email(self, record: FeeRateRecord) -> FeeRateRecord:
        before_status = record.status
        
        if not record.email_supplement:
            raise ValueError("缺少客户经理补充邮件数据")

        email = record.email_supplement
        detected_currency, is_mixed = CurrencyDetector.detect_currency(email.currency_raw)
        
        self._add_history(
            record=record,
            field_name="email_supplement",
            old_value=None,
            new_value=email.email_id,
            change_reason="客户经理补充邮件第一次导入",
            operator=email.sender,
            source_type="EMAIL"
        )

        self._add_history(
            record=record,
            field_name="currency_raw",
            old_value=None,
            new_value=email.currency_raw,
            change_reason="从邮件提取币种原始值",
            operator="System",
            source_type="EMAIL_PARSE"
        )

        if is_mixed:
            record.need_custodian_review = True
            record.status = RecordStatus.CUSTODIAN_PENDING
            change_msg = (
                f"邮件导入完成，检测到币种列包含港币和人民币（{email.currency_raw}），"
                f"已标记待托管对接人复核，暂不归入正常处理"
            )
        else:
            record.status = RecordStatus.EMAIL_IMPORTED
            change_msg = (
                f"邮件导入完成，产品{record.product_code}，"
                f"币种{email.currency_raw}，费率{email.rate*100:.4f}%"
            )

        self._add_audit(
            record=record,
            step_name="第一步：客户经理补充邮件导入",
            operator=email.sender,
            before_status=before_status,
            after_status=record.status,
            change_content=change_msg,
            currency_verified=not is_mixed
        )

        return record

    def step2_check_settlement(self, record: FeeRateRecord) -> FeeRateRecord:
        before_status = record.status
        
        if not record.settlement_batch:
            raise ValueError("缺少清算批次号数据")

        if record.need_custodian_review:
            self._add_audit(
                record=record,
                step_name="第二步：风控值班补看清算批次号",
                operator="风控值班老秦",
                before_status=before_status,
                after_status=record.status,
                change_content="检测到港币人民币同列待托管对接人复核，暂不处理清算批次核对",
                currency_verified=False
            )
            return record

        settle = record.settlement_batch
        email = record.email_supplement

        conflicts = ConflictDetector.detect_conflicts(record)
        
        if settle.is_old_caliber:
            if record.processing_result is None:
                record.processing_result = ProcessingResult.OLD_CALIBER
            calc = RateCalculator.calculate_adjusted_rate(
                base_rate=settle.rate,
                product_type=record.product_name,
                is_old_caliber=True
            )
            record.professional_calcs.append(calc)
            record.final_rate = calc.calc_result
            record.final_currency = settle.currency
            record.final_effective_date = settle.effective_date
            record.status = RecordStatus.SETTLEMENT_CHECKED

            self._add_history(
                record=record,
                field_name="settlement_batch",
                old_value=None,
                new_value=settle.batch_no,
                change_reason="从历史清算批次补来旧口径数据",
                operator="风控值班老秦",
                source_type="SETTLEMENT"
            )

            self._add_history(
                record=record,
                field_name="final_rate",
                old_value=None,
                new_value=calc.calc_result,
                change_reason=calc.decision_reason,
                operator="RateCalculator",
                source_type="PROFESSIONAL_CALC"
            )

            change_msg = (
                f"补看清算批次{settle.batch_no}，检测为旧口径（版本{settle.caliber_version}），"
                f"已使用旧口径参数重新计算费率。原费率{settle.rate*100:.4f}% → "
                f"调整后费率{calc.calc_result*100:.4f}%"
            )
            self._add_audit(
                record=record,
                step_name="第二步：风控值班补看清算批次号",
                operator="风控值班老秦",
                before_status=before_status,
                after_status=record.status,
                change_content=change_msg,
                professional_calc=calc,
                currency_verified=True
            )

        elif conflicts:
            record.has_conflict = True
            record.conflict_evidences = conflicts
            record.status = RecordStatus.CONFLICT

            for conflict in conflicts:
                self._add_history(
                    record=record,
                    field_name=f"conflict_{conflict.field_name}",
                    old_value=getattr(email, conflict.field_name, "N/A"),
                    new_value=conflict.settlement_value,
                    change_reason=f"检测到冲突: {conflict.description}",
                    operator="风控值班老秦",
                    source_type="CONFLICT_DETECT"
                )

            change_msg = (
                f"补看清算批次{settle.batch_no}，发现{len(conflicts)}处冲突，"
                f"已列出冲突证据，等待风控值班老秦确认或驳回"
            )
            self._add_audit(
                record=record,
                step_name="第二步：风控值班补看清算批次号",
                operator="风控值班老秦",
                before_status=before_status,
                after_status=record.status,
                change_content=change_msg,
                conflict_evidence=conflicts[0] if conflicts else None
            )

        else:
            calc = RateCalculator.calculate_adjusted_rate(
                base_rate=settle.rate,
                product_type=record.product_name,
                is_old_caliber=False
            )
            record.professional_calcs.append(calc)
            if record.final_currency is None:
                record.final_currency = settle.currency
            if record.final_rate is None:
                record.final_rate = calc.calc_result
            if record.final_effective_date is None:
                record.final_effective_date = settle.effective_date
            record.status = RecordStatus.SETTLEMENT_CHECKED
            if record.processing_result is None:
                record.processing_result = ProcessingResult.SMOOTH

            custodian_note = ""
            if record.custodian_review_result is True and record.final_currency != settle.currency:
                custodian_note = (
                    f"（托管对接人已复核确认币种为{record.final_currency.value}，"
                    f"保留复核结论，不采用清算批次币种{settle.currency.value}）"
                )

            self._add_history(
                record=record,
                field_name="settlement_batch",
                old_value=None,
                new_value=settle.batch_no,
                change_reason="核对清算批次数据一致",
                operator="风控值班老秦",
                source_type="SETTLEMENT"
            )

            change_msg = (
                f"补看清算批次{settle.batch_no}，与邮件数据核对一致，"
                f"已完成专业计算，最终费率{record.final_rate*100:.4f}%"
                f"{custodian_note}"
            )
            self._add_audit(
                record=record,
                step_name="第二步：风控值班补看清算批次号",
                operator="风控值班老秦",
                before_status=before_status,
                after_status=record.status,
                change_content=change_msg,
                professional_calc=calc,
                currency_verified=(record.final_currency == settle.currency)
            )

        return record

    def step3_update_audit(self, record: FeeRateRecord) -> FeeRateRecord:
        before_status = record.status

        if record.status == RecordStatus.CUSTODIAN_PENDING:
            change_msg = "托管对接人尚未完成港币人民币同列复核，审计更新暂挂起"
            self._add_audit(
                record=record,
                step_name="第三步：审计明细更新",
                operator="审计系统",
                before_status=before_status,
                after_status=record.status,
                change_content=change_msg,
                currency_verified=False
            )
            return record

        if record.status == RecordStatus.CONFLICT:
            change_msg = "存在冲突待风控值班老秦确认或驳回，审计更新暂挂起"
            self._add_audit(
                record=record,
                step_name="第三步：审计明细更新",
                operator="审计系统",
                before_status=before_status,
                after_status=record.status,
                change_content=change_msg
            )
            return record

        is_aligned = self._verify_audit_history_alignment(record)
        
        if is_aligned:
            record.status = RecordStatus.AUDIT_UPDATED
            change_msg = (
                f"审计明细更新完成，审计明细与历史记录共{len(record.audit_details)}条审计、"
                f"{len(record.history_records)}条历史记录，双向核对一致"
            )
        else:
            change_msg = "审计明细与历史记录存在偏差，需人工核查"

        self._add_audit(
            record=record,
            step_name="第三步：审计明细更新",
            operator="审计系统",
            before_status=before_status,
            after_status=record.status,
            change_content=change_msg
        )

        return record

    def _verify_audit_history_alignment(self, record: FeeRateRecord) -> bool:
        audit_steps = {a.step_name: a.change_content for a in record.audit_details}
        history_fields = {h.field_name: h.change_reason for h in record.history_records}
        
        has_step1 = any("第一步" in k for k in audit_steps.keys())
        has_step2 = any("第二步" in k for k in audit_steps.keys())
        has_email_hist = "email_supplement" in history_fields
        has_settle_hist = "settlement_batch" in history_fields
        
        return has_step1 and has_step2 and has_email_hist and has_settle_hist

    def process_full_flow(self, record: FeeRateRecord) -> FeeRateRecord:
        record = self.step1_import_email(record)
        record = self.step2_check_settlement(record)
        record = self.step3_update_audit(record)
        return record
