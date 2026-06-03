from datetime import datetime
from typing import List, Optional

from models import (
    FeeRateRecord, RecordStatus, ProcessingResult,
    ConflictEvidence, AuditDetail, HistoryRecord, Currency
)
from processing_engine import ProcessingEngine


class ConflictDisplayer:
    @staticmethod
    def display_conflicts(record: FeeRateRecord) -> str:
        if not record.has_conflict or not record.conflict_evidences:
            return "该记录无冲突"
        
        output = [
            "=" * 80,
            f"【冲突证据清单】  记录ID: {record.record_id}",
            f"产品: {record.product_name} ({record.product_code})",
            f"邮件来源: {record.email_supplement.email_id} {record.email_supplement.sender}",
            f"清算来源: {record.settlement_batch.batch_no} 清算系统",
            "-" * 80,
            f"发现 {len(record.conflict_evidences)} 处冲突，请风控值班老秦选择【确认】或【驳回】",
            "-" * 80
        ]
        
        for i, conflict in enumerate(record.conflict_evidences, 1):
            output.append(f"\n冲突 #{i}: {conflict.conflict_type.value}")
            output.append(f"  字段: {conflict.field_name}")
            output.append(f"  邮件值: {conflict.email_value} (来源: {conflict.email_source})")
            output.append(f"  清算值: {conflict.settlement_value} (来源: {conflict.settlement_source})")
            output.append(f"  说明: {conflict.description}")
        
        output.append("\n" + "=" * 80)
        output.append("请决策：输入 CONFIRM 确认邮件值 或 REJECT 驳回邮件值（以清算值为准）")
        output.append("=" * 80)
        
        return "\n".join(output)


class DecisionMaker:
    def __init__(self, engine: ProcessingEngine):
        self.engine = engine

    def _parse_currency(self, currency_raw: str) -> Currency:
        from processing_engine import CurrencyDetector
        curr, _ = CurrencyDetector.detect_currency(currency_raw)
        return curr

    def resolve_conflict(
        self,
        record: FeeRateRecord,
        decision: str,
        decision_maker: str = "风控值班老秦"
    ) -> FeeRateRecord:
        if not record.has_conflict:
            return record

        before_status = record.status
        decision = decision.upper()

        if decision == "CONFIRM":
            record.final_currency = self._parse_currency(record.email_supplement.currency_raw)
            record.final_rate = record.email_supplement.rate
            record.final_effective_date = record.email_supplement.effective_date
            decision_choice = "确认：采用客户经理补充邮件数据"
            change_reason = "风控值班老秦确认采用邮件数据，驳回清算批次数据"
        
        elif decision == "REJECT":
            record.final_currency = record.settlement_batch.currency
            record.final_rate = record.settlement_batch.rate
            record.final_effective_date = record.settlement_batch.effective_date
            decision_choice = "驳回：采用清算批次数据"
            change_reason = "风控值班老秦驳回邮件数据，采用清算批次数据"
        
        else:
            raise ValueError("决策必须为 CONFIRM 或 REJECT")

        record.status = RecordStatus.CONFIRMED if decision == "CONFIRM" else RecordStatus.REJECTED
        record.final_decision_maker = decision_maker
        record.final_decision_time = datetime.now()
        record.has_conflict = False
        if record.processing_result is None or record.processing_result == ProcessingResult.CONFLICT_FOUND:
            record.processing_result = ProcessingResult.SMOOTH

        for conflict in record.conflict_evidences:
            old_val = conflict.email_value if decision == "REJECT" else conflict.settlement_value
            new_val = conflict.email_value if decision == "CONFIRM" else conflict.settlement_value
            
            self.engine._add_history(
                record=record,
                field_name=f"resolved_{conflict.field_name}",
                old_value=old_val,
                new_value=new_val,
                change_reason=f"{change_reason}。原冲突：{conflict.description}",
                operator=decision_maker,
                source_type="MANUAL_DECISION"
            )

        self.engine._add_audit(
            record=record,
            step_name="冲突决策：风控值班老秦确认或驳回",
            operator=decision_maker,
            before_status=before_status,
            after_status=record.status,
            change_content=f"{decision_choice}，共解决{len(record.conflict_evidences)}处冲突",
            conflict_evidence=record.conflict_evidences[0] if record.conflict_evidences else None,
            decision_choice=decision_choice
        )

        record.conflict_evidences = []
        return record


class CustodianReviewer:
    def __init__(self, engine: ProcessingEngine):
        self.engine = engine

    def review_mixed_currency(
        self,
        record: FeeRateRecord,
        review_result: bool,
        final_currency: Optional[Currency] = None,
        reviewer: str = "托管对接人"
    ) -> FeeRateRecord:
        if not record.need_custodian_review:
            return record

        before_status = record.status

        if review_result and final_currency:
            record.final_currency = final_currency
            record.need_custodian_review = False
            record.custodian_review_result = True
            record.status = RecordStatus.SETTLEMENT_CHECKED
            change_content = (
                f"托管对接人已完成港币人民币同列复核，"
                f"最终确定币种为 {final_currency.value}，可进入后续处理"
            )
        else:
            record.custodian_review_result = False
            change_content = "托管对接人复核不通过，需退回客户经理重新确认币种"

        record.custodian_reviewer = reviewer
        record.custodian_review_time = datetime.now()

        self.engine._add_history(
            record=record,
            field_name="final_currency",
            old_value=Currency.MIXED,
            new_value=final_currency.value if final_currency else "待重提",
            change_reason=f"托管对接人复核港币人民币同列。复核结果：{'通过' if review_result else '不通过'}",
            operator=reviewer,
            source_type="CUSTODIAN_REVIEW"
        )

        self.engine._add_audit(
            record=record,
            step_name="托管对接人复核：港币人民币同列处理",
            operator=reviewer,
            before_status=before_status,
            after_status=record.status,
            change_content=change_content,
            currency_verified=review_result
        )

        return record

    def display_review_prompt(self, record: FeeRateRecord) -> str:
        if not record.need_custodian_review:
            return "该记录无需托管复核"
        
        email = record.email_supplement
        output = [
            "=" * 80,
            f"【港币人民币同列复核】  记录ID: {record.record_id}",
            f"产品: {record.product_name} ({record.product_code})",
            f"邮件原始币种列: {email.currency_raw}",
            f"邮件内容摘录: {email.raw_content[:200]}...",
            "-" * 80,
            "请托管对接人复核币种列，确认最终币种应为：",
            "  1. CNY - 人民币",
            "  2. HKD - 港币",
            "  3. 退回客户经理重填",
            "-" * 80,
            "决策说明：港币和人民币写在同一列时，系统不自动判断，必须由托管对接人人工复核",
            "=" * 80
        ]
        return "\n".join(output)


class CalcDisplayer:
    @staticmethod
    def display_calculations(record: FeeRateRecord) -> str:
        if not record.professional_calcs:
            return "该记录无专业计算"
        
        output = [
            "=" * 80,
            f"【专业计算明细】  记录ID: {record.record_id}",
            f"产品: {record.product_name} ({record.product_code})",
            "-" * 80
        ]
        
        for i, calc in enumerate(record.professional_calcs, 1):
            output.append(f"\n计算 #{i}")
            output.append(f"  模型版本: {calc.calc_model_version}")
            output.append(f"  参数版本: {calc.parameter_version}")
            output.append(f"  计算时间: {calc.calc_time.strftime('%Y-%m-%d %H:%M:%S')}")
            output.append(f"  输入参数:")
            for k, v in calc.input_params.items():
                output.append(f"    - {k}: {v}")
            output.append(f"  计算结果: {calc.calc_result * 100:.4f}%")
            output.append(f"  取舍理由: {calc.decision_reason}")
        
        output.append("\n" + "=" * 80)
        return "\n".join(output)

    @staticmethod
    def display_audit_history_alignment(record: FeeRateRecord) -> str:
        output = [
            "=" * 80,
            f"【审计明细与历史记录核对】  记录ID: {record.record_id}",
            "-" * 80,
            f"审计明细数量: {len(record.audit_details)} 条",
            f"历史记录数量: {len(record.history_records)} 条",
            "-" * 80,
            "审计明细列表:"
        ]
        
        for i, audit in enumerate(record.audit_details, 1):
            output.append(
                f"  {i}. [{audit.operation_time.strftime('%H:%M:%S')}] {audit.step_name} "
                f"- {audit.operator} - {audit.before_status.value} → {audit.after_status.value}"
            )
            output.append(f"     {audit.change_content}")
        
        output.append("\n历史记录列表:")
        for i, hist in enumerate(record.history_records, 1):
            output.append(
                f"  {i}. [{hist.operate_time.strftime('%H:%M:%S')}] V{hist.version_no} "
                f"{hist.field_name}: {hist.old_value} → {hist.new_value}"
            )
            output.append(f"     {hist.operator} ({hist.source_type}) - {hist.change_reason}")
        
        audit_steps = set(a.step_name for a in record.audit_details)
        has_full_flow = ("第一步：客户经理补充邮件导入" in audit_steps and 
                        "第二步：风控值班补看清算批次号" in audit_steps and
                        "第三步：审计明细更新" in audit_steps)
        
        output.append("\n" + "-" * 80)
        output.append(f"三步流程完整性: {'✓ 完整' if has_full_flow else '✗ 缺失'}")
        output.append(f"双向核对结果: {'✓ 一致' if len(record.audit_details) > 2 and len(record.history_records) > 2 else '⚠ 需核查'}")
        output.append("=" * 80)
        
        return "\n".join(output)
