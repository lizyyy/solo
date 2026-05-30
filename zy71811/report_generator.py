from datetime import datetime
from typing import List, Dict
from pathlib import Path
from models import SettlementRecord, SettlementStatus, SettlementBatch


class ReportGenerator:
    @staticmethod
    def generate_reconciliation_report(
        records: List[SettlementRecord],
        batch: SettlementBatch,
        rate_changes: List[Dict],
        output_path: Path
    ) -> None:
        lines = []
        
        lines.append("=" * 80)
        lines.append("                    会 员 卡 清 算 拆 账 - 对 账 说 明")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"批次号: {batch.batch_id}")
        lines.append(f"处理时间: {batch.process_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"费率版本: {batch.rate_version}")
        lines.append("-" * 80)
        lines.append(f"交易总数: {batch.total_transactions}")
        lines.append(f"正常清算: {batch.settled_count} 笔")
        lines.append(f"挂账待处理: {batch.suspended_count} 笔")
        lines.append(f"有争议需复核: {batch.disputed_count} 笔")
        lines.append("=" * 80)
        lines.append("")
        
        if rate_changes:
            lines.append("【重要】费率变更提醒")
            lines.append("-" * 60)
            for change in rate_changes:
                lines.append(f"* [{change['type']}] {change['merchant_id']}-{change['card_type']}")
                lines.append(f"  {change['field']}: {change['old_value']} → {change['new_value']}")
                if change.get('impact'):
                    lines.append(f"  影响: {change['impact']}")
            lines.append("")
            lines.append("=" * 80)
            lines.append("")
        
        suspended_records = [r for r in records if r.status == SettlementStatus.SUSPENDED]
        if suspended_records:
            lines.append(">>> 重点关注：挂账记录清单（需人工处理）")
            lines.append("-" * 80)
            
            for i, record in enumerate(suspended_records, 1):
                lines.append("")
                lines.append(f"--- 挂账 #{i} | 交易ID: {record.txn_id} ---")
                lines.append(f"订单号: {record.order_id}")
                lines.append(f"卡号: {record.card_no}")
                lines.append(f"原交易金额: {record.original_amount:.2f} 元")
                lines.append("")
                lines.append(f"【判断原因】{record.judgment_reason.value}")
                lines.append(f"【详细说明】{record.judgment_detail}")
                lines.append(f"【下一步操作】{record.next_step}")
                lines.append("")
            
            lines.append("=" * 80)
            lines.append("")
        
        lines.append(">>> 逐笔交易明细")
        lines.append("-" * 80)
        
        for i, record in enumerate(records, 1):
            hist_marker = "【历史】" if record.is_historical else ""
            status_icon = "✓" if record.status == SettlementStatus.MATCHED else "⚠"
            
            lines.append("")
            lines.append(f"{status_icon} #{i} {hist_marker}交易ID: {record.txn_id}")
            lines.append(f"    订单号: {record.order_id} | 卡号: {record.card_no}")
            lines.append(f"    金额: {record.original_amount:.2f}元 | 手续费: {record.fee_amount:.2f}元 | 清算额: {record.settlement_amount:.2f}元")
            lines.append(f"    状态: [{record.status.value}] | 判断: {record.judgment_reason.value}")
            
            if not record.is_historical:
                lines.append(f"    说明: {record.judgment_detail}")
                lines.append(f"    下一步: {record.next_step}")
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("                      报 告 结 束")
        lines.append("=" * 80)
        lines.append("")
        lines.append("交班备注:")
        lines.append("- 请优先处理【高优先级】标记的挂账")
        lines.append("- 历史记录已自动跳过，无需重复处理")
        lines.append("- 费率变更记录已归档，可在 data/rates/ 目录查询")
        lines.append("- 本报告归档于: data/output/")
        
        content = "\n".join(lines)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        print(f"对账报告已生成: {output_path}")

    @staticmethod
    def generate_summary_text(records: List[SettlementRecord], stats: Dict) -> str:
        lines = []
        lines.append("")
        lines.append("=" * 60)
        lines.append("                清算处理摘要")
        lines.append("=" * 60)
        lines.append(f"总交易数: {stats['total']}")
        lines.append(f"正常匹配: {stats['matched']} 笔")
        lines.append(f"挂账待处理: {stats['suspended']} 笔")
        lines.append(f"历史跳过: {stats['skipped']} 笔")
        
        if stats['suspended'] > 0:
            lines.append("")
            lines.append("⚠  有挂账需要人工处理，请查看完整报告！")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
