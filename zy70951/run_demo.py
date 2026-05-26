#!/usr/bin/env python3
"""一键跑通：创建批次 -> 查询统计 -> 追加处理人 -> 下载报告 -> 再次提交验证去重。

用法:
    python run_demo.py            # 启动内置 server 的场景
    python run_demo.py --external # 仅对已在 127.0.0.1:5001 运行的服务发请求
"""
import argparse
import csv
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:5001"

SAMPLE = {
    "submitter": "张三",
    "handler": "李四",
    "handler_note": "首次录入",
    "remark": "2026年5月体检套餐加项结算",
    "addons": [
        {"item_name": "甲状腺彩超加项", "patient_name": "王小明", "onsite_price": 280.0, "settle_price": 260.0},
        {"item_name": "颈椎MRI加项",   "patient_name": "李小红", "onsite_price": 650.0, "settle_price": 650.0},
        {"item_name": "胃镜加项",     "patient_name": "赵六",   "onsite_price": 420.0, "settle_price": 400.0},
    ],
    "coupons": [
        {"coupon_code": "VIP100", "patient_name": "王小明", "onsite_amount": 100.0, "settle_amount": 80.0},
        {"coupon_code": "NEW50",  "patient_name": "李小红", "onsite_amount": 50.0,  "settle_amount": 50.0},
    ],
    "unit_bills": [
        {"patient_name": "王小明", "onsite_total": 1280.0, "settle_total": 1200.0},
        {"patient_name": "李小红", "onsite_total":  980.0, "settle_total":  980.0},
        {"patient_name": "赵六",   "onsite_total":  720.0, "settle_total":  700.0},
    ],
}


def post_json(path, payload):
    req = urllib.request.Request(
        BASE_URL + path,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def get_json(path):
    with urllib.request.urlopen(BASE_URL + path) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def get_bytes(path):
    with urllib.request.urlopen(BASE_URL + path) as resp:
        return resp.status, resp.read(), resp.headers


def wait_for_server(timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            s, _ = get_json("/api/health")
            if s == 200:
                return True
        except Exception:
            time.sleep(0.5)
    return False


def start_server():
    env = os.environ.copy()
    env["FLASK_RUN_PORT"] = "5001"
    proc = subprocess.Popen(
        [sys.executable, "app.py"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
    )
    return proc


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--external", action="store_true")
    args = parser.parse_args()

    proc = None
    if not args.external:
        proc = start_server()
        if not wait_for_server():
            proc.kill()
            print("server failed to start")
            sys.exit(1)

    try:
        print(">>> 1. 创建批次")
        _, data = post_json("/api/batches", SAMPLE)
        print(json.dumps({"duplicate": data["duplicate"], "batch_no": data["batch"]["batch_no"]}, ensure_ascii=False))
        batch_no = data["batch"]["batch_no"]

        print("\n>>> 2. 查询批次统计")
        _, stats = get_json(f"/api/batches/{batch_no}/stats")
        print(json.dumps(stats, ensure_ascii=False, indent=2))

        print("\n>>> 3. 追加最后处理人（财务复核）")
        _, hand = post_json(f"/api/batches/{batch_no}/handlers", {"handler": "王五", "note": "财务复核通过"})
        print(json.dumps(hand, ensure_ascii=False))

        print("\n>>> 4. 下载报告 CSV")
        _, content, headers = get_bytes(f"/api/batches/{batch_no}/report")
        fname = "sample_report.csv"
        with open(fname, "wb") as f:
            f.write(content)
        print(f"saved {fname} ({len(content)} bytes, disposition={headers.get('Content-Disposition')})")

        with open(fname, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            rows = list(reader)
        print("csv rows:", len(rows))
        print("header:", rows[0])
        print("first data:", rows[1])

        print("\n>>> 5. 重复提交同一批材料（应去重返回原结果）")
        _, dup = post_json("/api/batches", SAMPLE)
        print(json.dumps({
            "duplicate": dup["duplicate"],
            "message": dup["message"],
            "same_batch_no": dup["batch"]["batch_no"] == batch_no,
        }, ensure_ascii=False))

        print("\n>>> 6. 比对：导出与查询接口统计一致")
        def total_diff_from_csv():
            vals = set()
            for r in rows[1:]:
                vals.add(r[-1])
            return vals
        csv_diffs = total_diff_from_csv()
        print("csv total_diff values:", csv_diffs)
        print("stats total_diff:", f"{stats['stats']['total_diff']:.2f}")
        assert len(csv_diffs) == 1 and f"{stats['stats']['total_diff']:.2f}" in csv_diffs, "导出与查询接口统计不一致！"
        print("OK: 导出与查询接口统计一致")

        print("\n全部通过 ✅")
    finally:
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    main()
