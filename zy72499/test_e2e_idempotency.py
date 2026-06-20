#!/usr/bin/env python3
"""
城中村门牌归并 - 端到端幂等性测试脚本

验证场景：
1. 首次运行：3 条记录、2 个点位
2. 直接重跑：仍是 3 条记录、2 个点位（幂等性）
3. 交叉核对：会话 JSON / summary 命令 / Markdown 报告 三者一致
4. 重跑脚本可执行，且最终统计来自实际会话数据
"""
import subprocess
import json
import os
import sys
import glob
import re
import shutil

SESSION_ID = "TEST-REPLAY"
WORK_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(WORK_DIR)


def run(cmd, check=True):
    print()
    print("$ " + cmd, flush=True)
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, cwd=WORK_DIR,
    )
    if result.stdout:
        print(result.stdout, flush=True)
    if result.stderr:
        print(result.stderr, file=sys.stderr, flush=True)
    if check and result.returncode != 0:
        print("ERROR: Command failed: " + cmd, flush=True)
        sys.exit(1)
    return result.stdout


def load_session_json(session_id):
    path = os.path.join(WORK_DIR, "sessions", session_id + ".json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def assert_eq(label, actual, expected):
    ok = actual == expected
    status = "PASS" if ok else "FAIL"
    print("  [" + status + "] " + label + ": expected=" + str(expected) + ", actual=" + str(actual), flush=True)
    if not ok:
        print("  ASSERTION FAILED: " + label, flush=True)
        sys.exit(1)


def extract_step1_stats(output):
    m = re.search(r"新增\s*(\d+)\s*条.*跳过重复\s*(\d+)\s*条", output)
    if not m:
        print("  ERROR: parse Step1 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2))


def extract_step2_stats(output):
    m = re.search(r"更新\s*(\d+)\s*条.*跳过\s*(\d+)\s*条", output)
    if not m:
        print("  ERROR: parse Step2 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2))


def extract_step3_stats(output):
    m = re.search(
        r"正常归并\s*(\d+)\s*条.*临时改道待复核\s*(\d+)\s*条.*旧口径补录\s*(\d+)\s*条.*冲突待确认\s*(\d+)\s*条",
        output,
    )
    if not m:
        print("  ERROR: parse Step3 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
