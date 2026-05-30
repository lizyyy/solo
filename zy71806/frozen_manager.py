from datetime import datetime
from typing import List, Optional
from models import SaleFeeRecord, RecordStatus, FrozenAmount, ReviewLog, ReviewResult
from utils import generate_id, format_amount


class FrozenAmountManager:
    def __init__(self):
        self.frozen_records: List[FrozenAmount] = []

    def freeze_amount(self, record: SaleFeeRecord, amount: float, reason: str,
                     operator: str) -> FrozenAmount:
        frozen = FrozenAmount(
            id=generate_id(),
            record_id=record.id,
            amount=amount,
            frozen_at=datetime.now(),
            frozen_reason=reason
        )
        
        record.frozen_amounts.append(frozen)
        record.status = RecordStatus.FROZEN
        record.review_reason = (
            f"【额度冻结】冻结金额：{format_amount(amount)}元。"
            f"冻结原因：{reason}。"
            f"操作人：{operator}。"
            f"【注意：此额度需人工确认后才能释放，未释放前不计入最终归集。"
        )
        record.next_step = (
            "请核实冻结原因真实性，确认无误后释放额度；"
            "如存在争议，请补充说明材料后再处理。"
        )
        record.updated_at = datetime.now()
        
        self.frozen_records.append(frozen)
        return frozen

    def release_amount(self, record: SaleFeeRecord, frozen_id: str, release_reason: str,
                     released_by: str) -> Optional[FrozenAmount]:
        for frozen in record.frozen_amounts:
            if frozen.id == frozen_id and not frozen.is_released:
                frozen.is_released = True
                frozen.released_at = datetime.now()
                frozen.released_reason = release_reason
                frozen.released_by = released_by
                
                all_released = all(f.is_released for f in record.frozen_amounts)
                if all_released:
                    record.status = RecordStatus.RELEASED
                    record.review_reason = (
                        f"【额度已释放】"
                        f"原始冻结金额：{format_amount(frozen.amount)}元。"
                        f"冻结原因：{frozen.frozen_reason}。"
                        f"释放原因：{release_reason}。"
                        f"释放操作人：{released_by}。"
                        f"释放时间：{frozen.released_at.strftime('%Y-%m-%d %H:%M:%S')}。"
                    )
                    record.next_step = "额度已全部释放，可进入下一步归集。"
                else:
                    record.review_reason += (
                        f"\n【部分释放】已释放冻结项{frozen_id}："
                        f"金额{format_amount(frozen.amount)}元，"
                        f"原因：{release_reason}，操作人：{released_by}。"
                    )
                    record.next_step = "还有未释放的冻结额度，请继续处理剩余冻结项。"
                
                record.updated_at = datetime.now()
                return frozen
        
        return None

    def add_review_log(self, record: SaleFeeRecord, reviewer: str, result: ReviewResult,
                       comment: str) -> ReviewLog:
        previous_status = record.status
        
        if result == ReviewResult.PASS:
            new_status = RecordStatus.FINALIZED
        elif result == ReviewResult.REJECT:
            new_status = RecordStatus.AUTO_REJECTED
        else:
            new_status = RecordStatus.MANUAL_REVIEW
        
        log = ReviewLog(
            id=generate_id(),
            record_id=record.id,
            reviewer=reviewer,
            reviewed_at=datetime.now(),
            result=result,
            comment=comment,
            previous_status=previous_status,
            new_status=new_status
        )
        
        record.review_logs.append(log)
        record.status = new_status
        
        if result == ReviewResult.PASS:
            record.review_reason = (
                f"【复核通过】复核人：{reviewer}。"
                f"复核意见：{comment}。"
                f"状态变更：{previous_status.value} → {new_status.value}。"
            )
            record.next_step = "已完成复核，可归档。"
        elif result == ReviewResult.REJECT:
            record.review_reason = (
                f"【复核拒绝】复核人：{reviewer}。"
                f"拒绝原因：{comment}。"
                f"状态变更：{previous_status.value} → {new_status.value}。"
            )
            record.next_step = "已拒绝，请跟进后续处理。"
        else:
            record.review_reason = (
                f"【需补充材料】复核人：{reviewer}。"
                f"补充要求：{comment}。"
                f"状态变更：{previous_status.value} → {new_status.value}。"
            )
            record.next_step = "请按要求补充材料后再次提交复核。"
        
        record.updated_at = datetime.now()
        return log

    def get_frozen_summary(self, record: SaleFeeRecord) -> str:
        if not record.frozen_amounts:
            return "无冻结记录"
        
        total_frozen = sum(f.amount for f in record.frozen_amounts if not f.is_released)
        total_released = sum(f.amount for f in record.frozen_amounts if f.is_released)
        
        summary_parts = [
            f"冻结总额度明细："]
        for i, frozen in enumerate(record.frozen_amounts, 1):
            status = "已释放" if frozen.is_released else "未释放"
            summary_parts.append(
                f"  {i}. 冻结项{frozen.id}: "
                f"{format_amount(frozen.amount)}元 - {status} - "
                f"原因：{frozen.frozen_reason}"
            )
            if frozen.is_released:
                summary_parts.append(
                    f"     释放原因：{frozen.released_reason}，"
                    f"释放人：{frozen.released_by}"
                )
        
        summary_parts.append(
            f"【汇总：未释放{format_amount(total_frozen)}元，"
            f"已释放{format_amount(total_released)}元"
        )
        
        return "\n".join(summary_parts)

    def get_controversial_record_note(self, record: SaleFeeRecord) -> str:
        note_parts = [f"【争议记录完整留痕】记录{record.id}："]
        note_parts.append(f"流水号：{record.serial_number}")
        note_parts.append(f"产品：{record.product_name}")
        
        if record.frozen_amounts:
            note_parts.append("\n【额度冻结历史】")
            for frozen in record.frozen_amounts:
                status = "已释放" if frozen.is_released else "未释放"
                note_parts.append(
                    f"- 冻结时间：{frozen.frozen_at.strftime('%Y-%m-%d %H:%M')} - {status}"
                )
                note_parts.append(f"  冻结金额：{format_amount(frozen.amount)}元")
                note_parts.append(f"  冻结原因：{frozen.frozen_reason}")
                if frozen.is_released:
                    note_parts.append(
                        f"  释放时间：{frozen.released_at.strftime('%Y-%m-%d %H:%M')}"
                    )
                    note_parts.append(f"  释放原因：{frozen.released_reason}")
                    note_parts.append(f"  释放人：{frozen.released_by}")
        
        if record.review_logs:
            note_parts.append("\n【复核历史】")
            for log in record.review_logs:
                note_parts.append(
                    f"- 复核时间：{log.reviewed_at.strftime('%Y-%m-%d %H:%M')} - "
                    f"{log.result.value}"
                )
                note_parts.append(f"  复核人：{log.reviewer}")
                note_parts.append(f"  复核意见：{log.comment}")
                note_parts.append(
                    f"  状态变更：{log.previous_status.value} → {log.new_status.value}"
                )
        
        return "\n".join(note_parts)
