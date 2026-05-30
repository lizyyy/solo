from datetime import datetime
from typing import List
import csv
import os
from models import SaleFeeRecord, RecordStatus, RecordType
from utils import format_datetime, format_amount
from frozen_manager import FrozenAmountManager


class ReviewListExporter:
    def __init__(self, frozen_manager: FrozenAmountManager):
        self.frozen_manager = frozen_manager

    def generate_review_list_content(self, records: List[SaleFeeRecord]) -> str:
        lines = []
        
        lines.append("=" * 80)
        lines.append("代销费尾差归集复核清单")
        lines.append(f"生成时间：{format_datetime(datetime.now())}")
        lines.append(f"记录总数：{len(records)}条")
        
        pending_count = len([r for r in records if r.status in [
            RecordStatus.MANUAL_REVIEW, RecordStatus.FROZEN]])
        lines.append(f"待处理记录数：{pending_count}条")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append("【待人工复核记录】")
        lines.append("-" * 80)
        manual_review_records = [r for r in records if r.status == RecordStatus.MANUAL_REVIEW]
        lines.extend(self._format_record_group(manual_review_records))
        
        lines.append("")
        lines.append("【额度冻结记录（重点关注！）】")
        lines.append("-" * 80)
        frozen_records = [r for r in records if r.status == RecordStatus.FROZEN]
        lines.extend(self._format_frozen_records(frozen_records))
        
        lines.append("")
        lines.append("【自动通过记录】")
        lines.append("-" * 80)
        auto_approved = [r for r in records if r.status == RecordStatus.AUTO_APPROVED]
        lines.extend(self._format_record_group(auto_approved))
        
        lines.append("")
        lines.append("【已完成记录】")
        lines.append("-" * 80)
        finalized = [r for r in records if r.status == RecordStatus.FINALIZED]
        lines.extend(self._format_record_group(finalized))
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("【汇总统计】")
        lines.append(f"- 正常记录：{len([r for r in records if r.record_type == RecordType.NORMAL])}条")
        lines.append(f"- 晚到附件：{len([r for r in records if r.record_type == RecordType.LATE_ATTACHMENT])}条")
        lines.append(f"- 重复项：{len([r for r in records if r.record_type == RecordType.DUPLICATE])}条")
        lines.append(f"- 人工更正：{len([r for r in records if r.record_type == RecordType.MANUAL_CORRECTION])}条")
        lines.append("")
        total_expected = sum(r.expected_fee for r in records)
        total_actual = sum(r.actual_fee for r in records)
        total_tail = sum(r.tail_diff for r in records)
        lines.append(f"预期费用总计：{format_amount(total_expected)}元")
        lines.append(f"实际费用总计：{format_amount(total_actual)}元")
        lines.append(f"尾差总计：{format_amount(total_tail)}元")
        
        frozen_total = sum(
            f.amount for r in records for f in r.frozen_amounts if not f.is_released
        )
        if frozen_total > 0:
            lines.append("")
            lines.append(f"！！！未释放冻结额度：{format_amount(frozen_total)}元")
            lines.append("请务必在完成前释放所有冻结额度，否则影响最终统计！")
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("【下一班工作指引】")
        lines.append("1. 优先处理【额度冻结记录】部分，释放或确认冻结")
        lines.append("2. 其次处理【待人工复核记录】部分，逐条完成复核")
        lines.append("3. 所有冻结记录处理完成后，再核对总数是否正确")
        lines.append("4. 如有疑问，查看每条记录的'复核原因'和'历史留痕'")
        lines.append("=" * 80)
        
        return "\n".join(lines)

    def _format_record_group(self, records: List[SaleFeeRecord]) -> List[str]:
        lines = []
        if not records:
            lines.append("（无）")
            return lines
        
        for i, record in enumerate(records, 1):
            lines.extend(self._format_single_record(record, i))
            lines.append("")
        
        return lines

    def _format_frozen_records(self, records: List[SaleFeeRecord]) -> List[str]:
        lines = []
        if not records:
            lines.append("（无）")
            return lines
        
        for i, record in enumerate(records, 1):
            lines.append(f"【冻结记录{i}】")
            lines.append(f"  记录ID：{record.id}")
            lines.append(f"  流水号：{record.serial_number}")
            lines.append(f"  产品：{record.product_name}")
            lines.append(f"  尾差：{format_amount(record.tail_diff)}元")
            lines.append("")
            lines.append("  【冻结明细】")
            lines.append(self.frozen_manager.get_frozen_summary(record))
            lines.append("")
            lines.append(f"  【复核原因】{record.review_reason}")
            lines.append(f"  【下一步】{record.next_step}")
            lines.append("")
            lines.append("  【完整留痕记录】")
            lines.append(self.frozen_manager.get_controversial_record_note(record))
            lines.append("")
            lines.append("  " + "-" * 60)
        
        return lines

    def _format_single_record(self, record: SaleFeeRecord, index: int) -> List[str]:
        lines = []
        lines.append(f"【记录{index}】ID: {record.id} | 流水号: {record.serial_number}")
        lines.append(f"  产品: {record.product_code} - {record.product_name}")
        lines.append(f"  销售日期: {format_datetime(record.sale_date)}")
        lines.append(f"  记录类型: {record.record_type.value} | 状态: {record.status.value}")
        lines.append(f"  预期费用: {format_amount(record.expected_fee)} | "
                     f"实际费用: {format_amount(record.actual_fee)} | "
                     f"尾差: {format_amount(record.tail_diff)}")
        
        if record.attachments:
            lines.append(f"  附件数: {len(record.attachments)}个")
            for att in record.attachments:
                late_mark = "【晚到】" if att.is_late else ""
                lines.append(f"    - {late_mark}{att.name} ({format_datetime(att.uploaded_at)})")
        
        if record.auto_judgement:
            lines.append("")
            lines.append("  【自动判断】")
            lines.append(f"    判断结果: {record.auto_judgement.judgement}")
            lines.append(f"    判断理由: {record.auto_judgement.reason}")
            lines.append(f"    应用规则: {record.auto_judgement.rule_applied}")
            lines.append(f"    置信度: {record.auto_judgement.confidence:.1%}")
        
        if record.review_reason:
            lines.append("")
            lines.append(f"  【复核原因】{record.review_reason}")
        
        if record.next_step:
            lines.append(f"  【下一步】{record.next_step}")
        
        if record.manual_correction_note:
            lines.append("")
            lines.append(f"  【人工更正说明】{record.manual_correction_note}")
            lines.append(f"  【更正来源】{record.correction_source}")
        
        if record.review_logs:
            lines.append("")
            lines.append("  【复核历史】")
            for log in record.review_logs:
                lines.append(
                    f"    - {format_datetime(log.reviewed_at)} | "
                    f"{log.reviewer} | {log.result.value} | {log.comment}"
                )
        
        return lines

    def export_to_text(self, records: List[SaleFeeRecord], filepath: str) -> None:
        content = self.generate_review_list_content(records)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    def export_to_csv(self, records: List[SaleFeeRecord], filepath: str) -> None:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '记录ID', '流水号', '销售日期', '产品代码', '产品名称',
                '记录类型', '状态', '预期费用', '实际费用', '尾差',
                '复核原因', '下一步', '附件数', '是否有冻结',
                '冻结未释放金额', '自动判断结果', '自动判断理由'
            ])
            
            for record in records:
                frozen_unreleased = sum(
                    f.amount for f in record.frozen_amounts if not f.is_released
                )
                writer.writerow([
                    record.id,
                    record.serial_number,
                    format_datetime(record.sale_date),
                    record.product_code,
                    record.product_name,
                    record.record_type.value,
                    record.status.value,
                    record.expected_fee,
                    record.actual_fee,
                    record.tail_diff,
                    record.review_reason or '',
                    record.next_step or '',
                    len(record.attachments),
                    '是' if record.frozen_amounts else '否',
                    frozen_unreleased,
                    record.auto_judgement.judgement if record.auto_judgement else '',
                    record.auto_judgement.reason if record.auto_judgement else ''
                ])
