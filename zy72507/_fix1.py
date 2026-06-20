#!/usr/bin/env python3
"""修复1: 给 drift_system.py 添加 get_import_breakdown 方法"""
import ast

with open('drift_system.py', 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

insert_idx = -1
for i, line in enumerate(lines):
    if 'def get_report_summary_text(report' in line:
        insert_idx = i - 1
        break

new_method = [
    '    @staticmethod',
    '    def get_import_breakdown() -> Dict:',
    '        """获取导入重复判断分类明细，用于评测报告展示"""',
    '        conn = sqlite3.connect(DB_PATH)',
    '        conn.row_factory = sqlite3.Row',
    '        batches = conn.execute(',
    '            "SELECT id, batch_type, source_file, import_time, record_count, duplicate_count, "',
    '            "new_count, history_duplicate_count, current_duplicate_count, same_file_duplicate, import_hash "',
    '            "FROM import_batches ORDER BY import_time DESC"',
    '        ).fetchall()',
    '        conn.close()',
    '        by_batch = []',
    '        total_new = 0',
    '        total_history_dup = 0',
    '        total_current_dup = 0',
    '        total_file_dup = 0',
    '        for b in batches:',
    '            d = dict(b)',
    '            by_batch.append(d)',
    '            total_new += d.get("new_count", 0) or 0',
    '            total_history_dup += d.get("history_duplicate_count", 0) or 0',
    '            total_current_dup += d.get("current_duplicate_count", 0) or 0',
    '            total_file_dup += 1 if d.get("same_file_duplicate") else 0',
    '        return {',
    '            "by_batch": by_batch,',
    '            "total_new": total_new,',
    '            "total_history_dup": total_history_dup,',
    '            "total_current_dup": total_current_dup,',
    '            "total_file_dup": total_file_dup,',
    '            "generated_at": datetime.now().isoformat(),',
    '        }',
    '',
]

lines = lines[:insert_idx] + new_method + lines[insert_idx:]
code = '\n'.join(lines)
ast.parse(code)

with open('drift_system.py', 'w', encoding='utf-8') as f:
    f.write(code)

print(f"OK: inserted at line {insert_idx+1}, total {len(lines)} lines")
print("get_import_breakdown" in code)
