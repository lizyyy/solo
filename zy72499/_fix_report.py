import sys
with open('report.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """    lines.append('echo "============================================================")
    lines.append('echo "------------------------------------------------------------"')
    lines.append(f'echo "  复盘记录:   output/复盘记录_{session.session_id}_*.md"')"""

new_block = """    lines.append('echo "============================================================")
    lines.append('echo "  归并流程重跑完成！结果统计（来自实际会话数据）："')
    lines.append('echo "------------------------------------------------------------"')
    lines.append(f'python3 main.py summary --session {session.session_id}')
    lines.append('echo "------------------------------------------------------------"')
    lines.append(f'echo "  复盘记录:   output/复盘记录_{session.session_id}_*.md"')"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('report.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK: report.py fixed")
else:
    print("ERROR: old block not found")
    sys.exit(1)
