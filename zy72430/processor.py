import uuid
from datetime import datetime
from typing import List, Tuple
from models import (
    MusicUseRecord, RecordStatus, MusicUseType,
    ProcessingStep, ContractScreenshot, RoyaltyDetail, RunResult
)


class MusicUseProcessor:
    def __init__(self):
        self.run_history: List[RunResult] = []

    def import_from_group_chat(self, record: MusicUseRecord, operator: str = "系统自动") -> MusicUseRecord:
        has_jielong_format = any("接龙" in msg.content for msg in record.source_messages)
        has_contract_mention = any("合同" in msg.content for msg in record.source_messages)
        msg_count = len(record.source_messages)

        record.processing_history.append(
            ProcessingStep(
                step_name="排练群接龙导入",
                operator=operator,
                timestamp=datetime.now(),
                action=f"从排练群导入 {msg_count} 条消息",
                remark=f"接龙格式:{'是' if has_jielong_format else '否'}, 提及合同:{'是' if has_contract_mention else '否'}"
            )
        )

        if msg_count == 1 and not has_jielong_format:
            record.status = RecordStatus.PENDING_REVIEW
            record.use_type = MusicUseType.SUBSTITUTE
            record.current_caliber = "临时替补曲目，仅群聊口头提及，待票务复核"
            record.processing_history.append(
                ProcessingStep(
                    step_name="状态标记",
                    operator=operator,
                    timestamp=datetime.now(),
                    action="标记为【待票务复核】",
                    remark="临时替补只在群里说了一句，不自动归正常，留待人工确认"
                )
            )
        elif has_jielong_format and has_contract_mention:
            record.status = RecordStatus.NORMAL
            record.use_type = MusicUseType.OFFICIAL
        else:
            record.status = RecordStatus.NEEDS_MANUAL_FIX

        return record

    def supplement_contract(self, record: MusicUseRecord, contract: ContractScreenshot, operator: str) -> MusicUseRecord:
        record.contract_screenshot = contract
        record.status = RecordStatus.CONTRACT_SUPPLEMENTED
        record.use_type = MusicUseType.REVISED
        record.current_caliber = f"旧口径已修正，以合同页截图 {contract.contract_no} 为准"

        record.processing_history.append(
            ProcessingStep(
                step_name="合同页截图补录",
                operator=operator,
                timestamp=datetime.now(),
                action=f"上传合同 {contract.contract_no} 截图，补录正确口径",
                remark=f"费用口径{int(contract.fee_rate * 100)}%，{contract.use_scope}"
            )
        )

        return record

    def calculate_royalty(self, record: MusicUseRecord, operator: str = "系统自动") -> MusicUseRecord:
        if record.status == RecordStatus.PENDING_REVIEW:
            record.royalty = RoyaltyDetail(
                music_name=record.music_name,
                artist=record.artist,
                use_count=1,
                unit_price=0.0,
                total_amount=0.0,
                fee_rate=0.0,
                settlement_status="暂缓-待复核"
            )
            record.processing_history.append(
                ProcessingStep(
                    step_name="分账明细计算",
                    operator=operator,
                    timestamp=datetime.now(),
                    action="生成分账明细（暂缓）",
                    remark="待票务复核后再确认金额"
                )
            )
            return record

        fee_rate = record.contract_screenshot.fee_rate if record.contract_screenshot else 0.05
        use_count = record.royalty.use_count if record.royalty else 1
        unit_price = 500.0 if record.use_type == MusicUseType.OFFICIAL else 300.0
        total_amount = use_count * unit_price

        settlement_status = "待结算"
        if record.status == RecordStatus.CONTRACT_SUPPLEMENTED:
            settlement_status = "已修正-待结算"

        record.royalty = RoyaltyDetail(
            music_name=record.music_name,
            artist=record.artist,
            use_count=use_count,
            unit_price=unit_price,
            total_amount=total_amount,
            fee_rate=fee_rate,
            settlement_status=settlement_status
        )

        record.processing_history.append(
            ProcessingStep(
                step_name="分账明细计算",
                operator=operator,
                timestamp=datetime.now(),
                action="生成分账明细",
                remark=f"使用{use_count}次, 单价{unit_price}元, 费率{int(fee_rate * 100)}%"
            )
        )

        return record

    def manual_fix(self, record: MusicUseRecord, fix_note: str, operator: str) -> MusicUseRecord:
        record.status = RecordStatus.FIXED
        record.processing_history.append(
            ProcessingStep(
                step_name="人工修正",
                operator=operator,
                timestamp=datetime.now(),
                action="人工修正记录",
                remark=fix_note
            )
        )
        return record

    def rerun_record(self, record: MusicUseRecord, operator: str = "系统自动") -> MusicUseRecord:
        record.processing_history.append(
            ProcessingStep(
                step_name="重跑",
                operator=operator,
                timestamp=datetime.now(),
                action="重新执行处理流程",
                remark="历史记录已保留，基于最新状态重跑"
            )
        )

        if record.contract_screenshot:
            record = self.calculate_royalty(record, operator)
        elif record.status == RecordStatus.PENDING_REVIEW:
            pass
        else:
            record.status = RecordStatus.NEEDS_MANUAL_FIX

        return record

    def run_batch(self, records: List[MusicUseRecord]) -> RunResult:
        run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        run_time = datetime.now()

        processed_records = []
        for record in records:
            if not record.processing_history:
                record = self.import_from_group_chat(record)
            if record.contract_screenshot and not record.royalty:
                record = self.calculate_royalty(record)
            processed_records.append(record)

        normal_count = sum(1 for r in processed_records if r.status == RecordStatus.NORMAL)
        pending_count = sum(1 for r in processed_records if r.status == RecordStatus.PENDING_REVIEW)
        fixed_count = sum(1 for r in processed_records if r.status == RecordStatus.FIXED)
        contract_supplemented_count = sum(1 for r in processed_records if r.status == RecordStatus.CONTRACT_SUPPLEMENTED)

        result = RunResult(
            run_id=run_id,
            run_time=run_time,
            total_records=len(processed_records),
            normal_count=normal_count,
            pending_count=pending_count,
            fixed_count=fixed_count,
            contract_supplemented_count=contract_supplemented_count,
            records=processed_records
        )

        self.run_history.append(result)
        return result

    def run_full_workflow_demo(self, records: List[MusicUseRecord]) -> Tuple[RunResult, List[str]]:
        steps_log = []
        steps_log.append("=" * 60)
        steps_log.append("【短视频配乐使用回看 - 完整流程演示】")
        steps_log.append("=" * 60)

        steps_log.append("\n▶ 第一步：排练群接龙第一次导入")
        for r in records:
            r = self.import_from_group_chat(r)
            steps_log.append(f"  {r.record_id}: {r.video_title} → 状态: {r.status.value}")

        steps_log.append("\n▶ 第二步：巡演统筹阿梅补看合同页截图")
        record3 = next(r for r in records if r.record_id == "REC-003")
        if record3.contract_screenshot:
            record3 = self.supplement_contract(record3, record3.contract_screenshot, "巡演统筹-阿梅")
            steps_log.append(f"  {record3.record_id}: 补录合同 {record3.contract_screenshot.contract_no}")

        steps_log.append("\n▶ 第三步：分账明细更新")
        for r in records:
            r = self.calculate_royalty(r)
            steps_log.append(f"  {r.record_id}: 分账 {r.royalty.total_amount}元, 状态: {r.royalty.settlement_status}")

        result = self.run_batch(records)
        steps_log.append(f"\n▶ 运行完成: {result.run_id}")
        steps_log.append(f"  总计 {result.total_records} 条 | 正常{result.normal_count} | 待复核{result.pending_count} | 合同补录{result.contract_supplemented_count}")

        return result, steps_log
