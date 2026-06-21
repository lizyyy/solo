import os

target = os.path.join(os.path.dirname(__file__), 'track_prediction_patch', 'examples', 'demo_verification.py')

content = '''"""
轨迹预测缺失修补系统 - 完整可复现验证脚本
==========================================
"""

import json
import sys
sys.path.insert(0, '.')

from track_prediction_patch.models import CandidateRecord
from track_prediction_patch.core import PatchWorkflow


def print_sep(title="", char="=", width=80):
    print()
    if title:
        prefix = " " + char * 2 + " " + title + " "
        suffix = char * max(0, width - len(prefix))
        print(prefix + suffix)
    else:
        print(char * width)


def print_state(state, label=""):
    print_sep(label, "-")
    print("  当前步骤:", state.current_step)
    print("  状态消息:", state.status_message)
    can = "是" if state.can_proceed else "否"
    print("  能否进入下一步:", can)
    if state.blocking_issues:
        print("  阻塞问题:")
        for issue in state.blocking_issues:
            print("    -", issue)
    if state.result_summary:
        print("  结果摘要:")
        for k, v in state.result_summary.items():
            if isinstance(v, list) and len(v) > 5:
                print("    -", k, ":", v[:5], "... (共", len(v), "项)")
            else:
                print("    -", k, ":", v)


def print_history(workflow):
    print_sep("历史留痕 - step_history", "-")
    for i, step in enumerate(workflow.state.step_history, 1):
        ts = step.get("timestamp", "")[:19]
        s = step.get("step", "")
        op = step.get("operator", "未知")
        desc = step.get("description", "")
        print("  [%d] %s - %s" % (i, ts, s))
        print("      操作人:", op)
        print("      描述:", desc)


def print_audit_logs(workflow):
    print_sep("审计日志 - 谁改了什么", "-")
    history = workflow.reviewer.get_who_changed_what(workflow.patch_record.patch_id)
    for i, change in enumerate(history, 1):
        ts = change.get("timestamp", "")[:19]
        print("  [%d] %s" % (i, ts))
        print("      操作人:", change.get("operator", ""))
        print("      操作类型:", change.get("operation", ""))
        print("      变更内容:", change.get("changes", ""))
        print("      原因:", change.get("reason", ""))


def find_track_detail(track_details, track_id):
    for detail in track_details:
        if detail["track_id"] == track_id:
            return detail
    return None
'''

with open(target, 'w', encoding='utf-8') as f:
    f.write(content)
print("Part 1 written to", target)
