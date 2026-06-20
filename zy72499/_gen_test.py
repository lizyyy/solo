import os

target = "/Users/lzy/pro/solo/workspaces/zy72499/test_e2e_idempotency.py"
lines = []
lines.append('#!/usr/bin/env python3')
lines.append('"""')
lines.append('城中村门牌归并 - 端到端幂等性测试脚本')
lines.append('')
lines.append('验证场景：')
lines.append('1. 首次运行：3 条记录、2 个点位')
lines.append('2. 直接重跑：仍是 3 条记录、2 个点位（幂等性）')
lines.append('3. 交叉核对：会话 JSON / summary 命令 / Markdown 报告 三者一致')
lines.append('4. 重跑脚本可执行，且最终统计来自实际会话数据')
lines.append('"""')
lines.append('import subprocess')
lines.append('import json')
lines.append('import os')
lines.append('import sys')
lines.append('import glob')
lines.append('import re')
lines.append('import shutil')
lines.append('')
lines.append('SESSION_ID = "TEST-REPLAY"')
lines.append('WORK_DIR = os.path.dirname(os.path.abspath(__file__))')
lines.append('os.chdir(WORK_DIR)')

with open(target, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print(f"Written {len(lines)} lines to {target}")
