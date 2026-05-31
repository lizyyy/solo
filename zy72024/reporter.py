import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List


class Reporter:
    def __init__(self, output_dir: str = None):
        self.output_dir = Path(output_dir) if output_dir else Path.cwd() / "reports"
        self.output_dir.mkdir(exist_ok=True)

    def print_import_summary(self, result: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("  水电费预付余额对账 - 导入结果摘要")
        lines.append("=" * 60)
        lines.append(f"  批次ID: {result['batch_id']}")
        lines.append(f"  处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("-" * 60)
        lines.append(f"  总计记录:     {result['total']}")
        lines.append(f"  成功导入:     {result['imported']}  {'✓' if result['imported'] > 0 else ''}")
        lines.append(f"  跳过记录:     {result['skipped']}  {'⚠' if result['skipped'] > 0 else ''}")
        lines.append(f"  更新记录:     {result['updated']}  {'↻' if result['updated'] > 0 else ''}")
        lines.append(f"  冲突记录:     {result['conflicts']}  {'✗' if result['conflicts'] > 0 else ''}")

        if result.get('warnings'):
            lines.append("-" * 60)
            lines.append("  警告信息:")
            for i, warn in enumerate(result['warnings'][:20], 1):
                lines.append(f"    {i}. {warn}")
            if len(result['warnings']) > 20:
                lines.append(f"    ... 还有 {len(result['warnings']) - 20} 条警告，详见明细文件")

        lines.append("=" * 60)

        summary = "\n".join(lines)
        print(summary)
        return summary

    def print_reconciliation_summary(self, result: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("  水电费预付余额对账 - 对账结果摘要")
        lines.append("=" * 70)
        lines.append(f"  对账期间: {result.get('period', '全部')}")
        lines.append(f"  对账时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("-" * 70)
        lines.append(f"  记录总数:       {result['total_records']}")
        lines.append(f"  预付总额:       ¥{result['total_prepay']:>12,.2f}")
        lines.append(f"  使用总额:       ¥{result['total_usage']:>12,.2f}")
        lines.append(f"  期末余额:       ¥{result['final_balance']:>12,.2f}")
        lines.append("-" * 70)

        status_colors = {
            "matched": "✓",
            "warning": "⚠",
            "conflict": "✗",
            "pending": "?"
        }

        lines.append(f"  匹配正常:       {result['matched']}  {status_colors['matched']}")
        lines.append(f"  存在警告:       {result['warnings']}  {status_colors['warning']}")
        lines.append(f"  存在冲突:       {result['conflicts']}  {status_colors['conflict']}")
        lines.append(f"  待处理:         {result['pending']}  {status_colors['pending']}")
        lines.append(f"  余额为负记录:   {result['negative_balance_count']}  {'⚠' if result['negative_balance_count'] > 0 else ''}")

        if result.get('negative_balance_records'):
            lines.append("-" * 70)
            lines.append("  余额为负的记录:")
            for nb in result['negative_balance_records']:
                lines.append(f"    记录{nb['record_id']}: {nb['date']} 余额 ¥{nb['balance']:,.2f}")

        if result.get('warnings_list'):
            lines.append("-" * 70)
            lines.append("  异常警告:")
            for i, warn in enumerate(result['warnings_list'][:15], 1):
                lines.append(f"    {i}. {warn}")
            if len(result['warnings_list']) > 15:
                lines.append(f"    ... 还有 {len(result['warnings_list']) - 15} 条警告，详见明细文件")

        lines.append("=" * 70)

        summary = "\n".join(lines)
        print(summary)
        return summary

    def print_running_balance(self, result: Dict[str, Any], limit: int = 30) -> str:
        lines = []
        lines.append("\n" + "=" * 90)
        lines.append(f"  逐笔余额明细 (前{min(limit, len(result['running_balance']))}条)")
        lines.append("-" * 90)
        lines.append(f"  {'ID':<6} {'日期':<12} {'类型':<8} {'金额':>12} {'余额':>14} {'状态':<10} 来源")
        lines.append("-" * 90)

        type_map = {"prepay": "预付", "usage": "使用"}
        status_map = {"matched": "正常", "warning": "警告", "conflict": "冲突", "pending": "待处理"}

        for i, rec in enumerate(result['running_balance'][:limit]):
            type_cn = type_map.get(rec['trans_type'], rec['trans_type'])
            status_cn = status_map.get(rec['status'], rec['status'])
            amount_prefix = "+" if rec['trans_type'] == 'prepay' else "-"
            status_marker = "✓" if rec['status'] == 'matched' else ("⚠" if rec['status'] == 'warning' else "✗")
            lines.append(
                f"  {rec['record_id']:<6} {rec['trans_date']:<12} {type_cn:<8} "
                f"{amount_prefix}¥{rec['amount']:>10,.2f} ¥{rec['running_balance']:>12,.2f} "
                f"{status_marker}{status_cn:<8} {rec['source']}"
            )

        if len(result['running_balance']) > limit:
            lines.append(f"  ... 还有 {len(result['running_balance']) - limit} 条记录，详见导出文件")

        lines.append("=" * 90)

        output = "\n".join(lines)
        print(output)
        return output

    def print_monthly_summary(self, monthly_data: List[Dict[str, Any]]) -> str:
        lines = []
        lines.append("\n" + "=" * 80)
        lines.append("  月度汇总")
        lines.append("-" * 80)
        lines.append(f"  {'期间':<10} {'笔数':>6} {'预付':>14} {'使用':>14} {'净额':>14} {'累计余额':>14}")
        lines.append("-" * 80)

        for m in monthly_data:
            net_prefix = "+" if m['net'] >= 0 else ""
            lines.append(
                f"  {m['period']:<10} {m['record_count']:>6} "
                f"¥{m['prepay']:>12,.2f} ¥{m['usage']:>12,.2f} "
                f"{net_prefix}¥{m['net']:>12,.2f} ¥{m['running_balance']:>12,.2f}"
            )

        lines.append("=" * 80)

        output = "\n".join(lines)
        print(output)
        return output

    def print_comparison(self, comparison: Dict[str, Any]) -> str:
        lines = []
        lines.append("\n" + "=" * 70)
        lines.append("  两次对账差异对比")
        lines.append("-" * 70)

        b = comparison['before_summary']
        a = comparison['after_summary']
        lines.append(f"  之前: 余额 ¥{b.get('final_balance', 0):,.2f}, 共 {b.get('total_records', 0)} 条")
        lines.append(f"  之后: 余额 ¥{a.get('final_balance', 0):,.2f}, 共 {a.get('total_records', 0)} 条")

        if comparison['has_differences']:
            lines.append("-" * 70)
            lines.append("  发现以下差异:")
            for i, diff in enumerate(comparison['differences'], 1):
                lines.append(f"    {i}. {diff}")
        else:
            lines.append("  ✓ 两次对账结果一致，无差异")

        lines.append("=" * 70)

        output = "\n".join(lines)
        print(output)
        return output

    def print_trace(self, trace: Dict[str, Any]) -> str:
        lines = []
        lines.append("\n" + "=" * 80)
        lines.append(f"  记录溯源 - 记录ID: {trace.get('record_id')}")
        lines.append("=" * 80)

        if 'error' in trace:
            lines.append(f"  ✗ {trace['error']}")
            lines.append("=" * 80)
            output = "\n".join(lines)
            print(output)
            return output

        std = trace['standardized']
        src = trace['source']
        rec = trace['reconciliation']

        lines.append("  ▶ 标准化数据:")
        lines.append(f"    日期: {std['trans_date']} | 类型: {'预付' if std['trans_type'] == 'prepay' else '使用'}")
        lines.append(f"    金额: ¥{std['amount']:,.2f} {std['currency']} | 经办人: {std.get('handler', '未填写')}")
        lines.append(f"    部门: {std.get('department', '未填写')} | 单号: {std.get('bill_no', '未填写')}")
        lines.append(f"    备注: {std.get('remark', '无')}")

        lines.append("-" * 80)
        lines.append("  ▶ 来源信息:")
        lines.append(f"    文件: {src['file']}")
        lines.append(f"    工作表: {src.get('sheet', 'N/A')} | 行号: {src['row_number']}")
        lines.append(f"    原始数据: {json.dumps(src['raw_data'], ensure_ascii=False, indent=6)[1:-1]}")

        lines.append("-" * 80)
        lines.append("  ▶ 对账结果:")
        status_map = {"matched": "✓ 正常", "warning": "⚠ 警告", "conflict": "✗ 冲突", "pending": "? 待处理"}
        lines.append(f"    期间: {rec.get('period', 'N/A')} | 状态: {status_map.get(rec.get('status'), rec.get('status'))}")
        lines.append(f"    对账后余额: ¥{rec.get('prepaid_balance', 0):,.2f}")
        if rec.get('conflict_detail'):
            lines.append(f"    问题说明: {rec['conflict_detail']}")

        if trace.get('notes'):
            lines.append("-" * 80)
            lines.append("  ▶ 备注历史:")
            for note in trace['notes']:
                lines.append(f"    [{note['created_at']}] {note['created_by']}: {note['note_text']}")

        if trace.get('change_history'):
            lines.append("-" * 80)
            lines.append("  ▶ 变更历史:")
            for ch in trace['change_history']:
                lines.append(
                    f"    [{ch['changed_at']}] {ch['field_name']}: "
                    f"'{ch['old_value']}' -> '{ch['new_value']}' ({ch.get('change_note', '')})"
                )

        lines.append("=" * 80)

        output = "\n".join(lines)
        print(output)
        return output

    def export_financial_detail(self, records: List[Dict[str, Any]],
                                period: str = None) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"水电费对账明细_{period or '全部'}_{timestamp}.csv"
        filepath = self.output_dir / filename

        type_map = {"prepay": "预付", "usage": "使用"}
        status_map = {"matched": "正常", "warning": "警告", "conflict": "冲突", "pending": "待处理"}

        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                "记录ID", "日期", "类型", "金额", "币种", "经办人", "部门",
                "单号", "备注", "对账后余额", "对账状态", "问题说明",
                "来源文件", "来源工作表", "来源行号", "数据清洗警告"
            ])

            for rec in records:
                writer.writerow([
                    rec['id'],
                    rec['trans_date'],
                    type_map.get(rec['trans_type'], rec['trans_type']),
                    f"{rec['amount']:.2f}",
                    rec.get('currency', 'CNY'),
                    rec.get('handler', ''),
                    rec.get('department', ''),
                    rec.get('bill_no', ''),
                    rec.get('remark', ''),
                    f"{rec.get('prepaid_balance', 0):.2f}",
                    status_map.get(rec.get('reconcile_status', ''), rec.get('reconcile_status', '')),
                    rec.get('conflict_detail', ''),
                    rec['source_file'],
                    rec.get('sheet_name', ''),
                    rec['row_number'],
                    rec.get('warnings', '')
                ])

        print(f"\n  ✓ 财务明细已导出: {filepath}")
        return filepath

    def export_import_batch_report(self, batch_summary: Dict[str, Any],
                                   warnings: List[str]) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"导入批次报告_{batch_summary['batch_id']}_{timestamp}.txt"
        filepath = self.output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("  水电费预付余额对账 - 导入批次报告\n")
            f.write("=" * 60 + "\n")
            f.write(f"  批次ID: {batch_summary['batch_id']}\n")
            f.write(f"  源文件: {batch_summary['source_file']}\n")
            f.write(f"  开始时间: {batch_summary['started_at']}\n")
            f.write(f"  完成时间: {batch_summary['completed_at']}\n")
            f.write(f"  状态: {batch_summary['status']}\n")
            f.write("-" * 60 + "\n")
            f.write(f"  总计: {batch_summary['total_records']}\n")
            f.write(f"  跳过: {batch_summary['skipped']}\n")
            f.write(f"  更新: {batch_summary['updated']}\n")
            f.write(f"  冲突: {batch_summary['conflicts']}\n")

            if warnings:
                f.write("-" * 60 + "\n")
                f.write("  警告明细:\n")
                for i, w in enumerate(warnings, 1):
                    f.write(f"  {i}. {w}\n")

            f.write("=" * 60 + "\n")

        print(f"  ✓ 批次报告已导出: {filepath}")
        return filepath

    def export_reconciliation_report(self, reconcile_result: Dict[str, Any],
                                     monthly_summary: List[Dict[str, Any]]) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        period = reconcile_result.get('period') or '全部'
        filename = f"对账报告_{period}_{timestamp}.txt"
        filepath = self.output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 70 + "\n")
            f.write("  水电费预付余额对账报告\n")
            f.write("=" * 70 + "\n")
            f.write(f"  对账期间: {period}\n")
            f.write(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("-" * 70 + "\n")
            f.write(f"  记录总数: {reconcile_result['total_records']}\n")
            f.write(f"  预付总额: ¥{reconcile_result['total_prepay']:,.2f}\n")
            f.write(f"  使用总额: ¥{reconcile_result['total_usage']:,.2f}\n")
            f.write(f"  期末余额: ¥{reconcile_result['final_balance']:,.2f}\n")
            f.write("-" * 70 + "\n")
            f.write(f"  正常: {reconcile_result['matched']}  |  警告: {reconcile_result['warnings']}  |  冲突: {reconcile_result['conflicts']}\n")

            f.write("\n" + "-" * 70 + "\n")
            f.write("  月度汇总:\n")
            f.write("-" * 70 + "\n")
            f.write(f"  {'期间':<10} {'笔数':>6} {'预付':>14} {'使用':>14} {'净额':>14} {'累计余额':>14}\n")
            for m in monthly_summary:
                net_prefix = "+" if m['net'] >= 0 else ""
                f.write(
                    f"  {m['period']:<10} {m['record_count']:>6} "
                    f"¥{m['prepay']:>12,.2f} ¥{m['usage']:>12,.2f} "
                    f"{net_prefix}¥{m['net']:>12,.2f} ¥{m['running_balance']:>12,.2f}\n"
                )

            if reconcile_result.get('negative_balance_records'):
                f.write("\n" + "-" * 70 + "\n")
                f.write("  ⚠ 余额为负的记录:\n")
                for nb in reconcile_result['negative_balance_records']:
                    f.write(f"    记录{nb['record_id']}: {nb['date']} 余额 ¥{nb['balance']:,.2f}\n")

            if reconcile_result.get('warnings_list'):
                f.write("\n" + "-" * 70 + "\n")
                f.write("  ⚠ 异常警告:\n")
                for i, warn in enumerate(reconcile_result['warnings_list'], 1):
                    f.write(f"    {i}. {warn}\n")

            f.write("\n" + "=" * 70 + "\n")
            f.write("  逐笔明细:\n")
            f.write("-" * 70 + "\n")
            f.write(f"  {'ID':<6} {'日期':<12} {'类型':<8} {'金额':>12} {'余额':>14} {'状态':<10} 来源\n")
            type_map = {"prepay": "预付", "usage": "使用"}
            for rec in reconcile_result['running_balance']:
                type_cn = type_map.get(rec['trans_type'], rec['trans_type'])
                amount_prefix = "+" if rec['trans_type'] == 'prepay' else "-"
                status_marker = "✓" if rec['status'] == 'matched' else ("⚠" if rec['status'] == 'warning' else "✗")
                f.write(
                    f"  {rec['record_id']:<6} {rec['trans_date']:<12} {type_cn:<8} "
                    f"{amount_prefix}¥{rec['amount']:>10,.2f} ¥{rec['running_balance']:>12,.2f} "
                    f"{status_marker} {rec['source']}\n"
                )
                if rec.get('conflict_detail'):
                    f.write(f"        问题: {rec['conflict_detail']}\n")

            f.write("=" * 70 + "\n")

        print(f"  ✓ 对账报告已导出: {filepath}")
        return filepath
