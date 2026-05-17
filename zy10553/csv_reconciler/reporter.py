import json
from datetime import datetime
from pathlib import Path
from decimal import Decimal
from typing import Optional

from .reconciler import ReconciliationResult, Reconciler


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


class ConsoleReporter:
    def __init__(self, result: ReconciliationResult):
        self.result = result
    
    def print_summary(self):
        print("=" * 70)
        print("CSV金额对账报告 - 摘要")
        print("=" * 70)
        print(f"对账时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"源文件1: {self.result.source1_file}")
        print(f"源文件2: {self.result.source2_file}")
        print("-" * 70)
        print(f"总交易数: {self.result.total_transactions}")
        print(f"匹配交易数: {self.result.matched_transactions}")
        print(f"未匹配(源1独有): {len(self.result.unmatched_source1)}")
        print(f"未匹配(源2独有): {len(self.result.unmatched_source2)}")
        print(f"差异记录数: {len(self.result.differences)}")
        print(f"坏行数: {len(self.result.bad_rows)}")
        print("-" * 70)
        
        if self.result.differences:
            reconciler = Reconciler()
            by_field = reconciler.group_differences_by_field(self.result)
            print("差异按字段分组:")
            for field, diffs in by_field.items():
                print(f"  - {field}: {len(diffs)} 处")
            print("-" * 70)
            
            print("前10条差异详情:")
            for i, diff in enumerate(self.result.differences[:10]):
                if diff.field_name == 'refund_status':
                    print(f"  [{diff.transaction_id}] {diff.field_name}: "
                          f"'{diff.source1_value}' vs '{diff.source2_value}'")
                else:
                    print(f"  [{diff.transaction_id}] {diff.field_name}: "
                          f"{diff.source1_value} vs {diff.source2_value} (差: {diff.difference})")
        
        if self.result.bad_rows:
            print("-" * 70)
            print("坏行记录:")
            for bad in self.result.bad_rows[:5]:
                print(f"  [{Path(bad.file_path).name}:{bad.row_number}] {bad.error_reason}")
        
        print("=" * 70)


class JSONReporter:
    def __init__(self, result: ReconciliationResult):
        self.result = result
    
    def generate(self) -> dict:
        data = {
            "reconciliation_time": datetime.now().isoformat(),
            "source_files": {
                "source1": self.result.source1_file,
                "source2": self.result.source2_file
            },
            "summary": {
                "total_transactions": self.result.total_transactions,
                "matched_transactions": self.result.matched_transactions,
                "unmatched_source1_count": len(self.result.unmatched_source1),
                "unmatched_source2_count": len(self.result.unmatched_source2),
                "differences_count": len(self.result.differences),
                "bad_rows_count": len(self.result.bad_rows)
            },
            "unmatched": {
                "source1": self.result.unmatched_source1,
                "source2": self.result.unmatched_source2
            },
            "differences": [
                {
                    "transaction_id": diff.transaction_id,
                    "field": diff.field_name,
                    "source1_value": diff.source1_value,
                    "source2_value": diff.source2_value,
                    "difference": diff.difference
                }
                for diff in self.result.differences
            ],
            "bad_rows": [
                {
                    "file_path": bad.file_path,
                    "row_number": bad.row_number,
                    "error_reason": bad.error_reason,
                    "raw_content": bad.raw_content
                }
                for bad in self.result.bad_rows
            ]
        }
        return data
    
    def write_to_file(self, output_path: str):
        data = self.generate()
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DecimalEncoder)


class MarkdownReporter:
    def __init__(self, result: ReconciliationResult):
        self.result = result
    
    def generate(self) -> str:
        lines = []
        
        lines.append("# CSV金额对账报告")
        lines.append("")
        lines.append(f"**对账时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("## 文件信息")
        lines.append("")
        lines.append(f"- 源文件1: `{self.result.source1_file}`")
        lines.append(f"- 源文件2: `{self.result.source2_file}`")
        lines.append("")
        
        lines.append("## 对账摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总交易数 | {self.result.total_transactions} |")
        lines.append(f"| 匹配交易数 | {self.result.matched_transactions} |")
        lines.append(f"| 未匹配(源1独有) | {len(self.result.unmatched_source1)} |")
        lines.append(f"| 未匹配(源2独有) | {len(self.result.unmatched_source2)} |")
        lines.append(f"| 差异记录数 | {len(self.result.differences)} |")
        lines.append(f"| 坏行数 | {len(self.result.bad_rows)} |")
        lines.append("")
        
        if self.result.differences:
            lines.append("## 差异详情")
            lines.append("")
            reconciler = Reconciler()
            by_field = reconciler.group_differences_by_field(self.result)
            for field, diffs in by_field.items():
                lines.append(f"### {field} 字段差异 ({len(diffs)} 处)")
                lines.append("")
                lines.append("| 交易号 | 源1值 | 源2值 | 差额 |")
                lines.append("|--------|-------|-------|------|")
                for diff in diffs:
                    if field == 'refund_status':
                        lines.append(f"| {diff.transaction_id} | {diff.source1_value} | {diff.source2_value} | - |")
                    else:
                        lines.append(f"| {diff.transaction_id} | {diff.source1_value} | {diff.source2_value} | {diff.difference} |")
                lines.append("")
        
        if self.result.unmatched_source1 or self.result.unmatched_source2:
            lines.append("## 未匹配交易")
            lines.append("")
            if self.result.unmatched_source1:
                lines.append("### 源1独有交易")
                lines.append("")
                for tx_id in self.result.unmatched_source1[:20]:
                    lines.append(f"- {tx_id}")
                if len(self.result.unmatched_source1) > 20:
                    lines.append(f"- ... 共 {len(self.result.unmatched_source1)} 条")
                lines.append("")
            if self.result.unmatched_source2:
                lines.append("### 源2独有交易")
                lines.append("")
                for tx_id in self.result.unmatched_source2[:20]:
                    lines.append(f"- {tx_id}")
                if len(self.result.unmatched_source2) > 20:
                    lines.append(f"- ... 共 {len(self.result.unmatched_source2)} 条")
                lines.append("")
        
        if self.result.bad_rows:
            lines.append("## 坏行记录")
            lines.append("")
            lines.append("| 文件 | 行号 | 错误原因 |")
            lines.append("|------|------|----------|")
            for bad in self.result.bad_rows:
                lines.append(f"| {Path(bad.file_path).name} | {bad.row_number} | {bad.error_reason} |")
            lines.append("")
        
        lines.append("---")
        lines.append("*本报告由 CSV金额对账CLI 自动生成*")
        
        return "\n".join(lines)
    
    def write_to_file(self, output_path: str):
        content = self.generate()
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
