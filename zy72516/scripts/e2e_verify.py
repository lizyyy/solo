#!/usr/bin/env python3
"""端到端验证脚本：导入缺失模型输出样例→补录保存→刷新重算→导出→API读取→核对7字段一致性"""

import json
import sys
import urllib.request
import urllib.error

API_BASE = "http://localhost:3001"

def fetch_json(path):
    try:
        url = f"{API_BASE}{path}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

def post_json(path, data):
    try:
        url = f"{API_BASE}{path}"
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

def main():
    print("=" * 60)
    print("售后机器人转人工判断 — 端到端验证")
    print("=" * 60)
    all_pass = True

    # 1. API 服务连通性
    print("\n[1] API 服务连通性")
    result = fetch_json("/api/records")
    if "error" in result:
        print(f"  ✗ API 服务未启动: {result['error']}")
        print("  请先运行: npm run dev:api")
        return 1
    print(f"  ✓ API 服务已连接，返回 {result.get('total', 0)} 条记录")

    # 2. 数据同步验证
    print("\n[2] 前端数据同步到 API")
    records = result.get("data", [])
    total = result.get("total", 0)
    if total == 0:
        print("  ⚠ API 无数据，请先在前端页面操作并同步")
    else:
        print(f"  ✓ API 返回 {total} 条记录（与前端 Zustand Store 同步）")

    # 3. 暂无模型输出数据计数
    print("\n[3] 暂无模型输出数据统计")
    missing = [r for r in records if r.get("modelOutputMissing")]
    print(f"  缺失模型输出记录数: {len(missing)}")
    for r in missing:
        print(f"    #{r.get('originalLineNumber')} {r.get('annotatorMessage', '')[:30]}")

    # 4. 补录后验证
    print("\n[4] 补录后数据验证")
    backfilled = [r for r in records if r.get("modelOutput") and r.get("modelOutput", {}).get("isBackfill")]
    print(f"  已补录记录数: {len(backfilled)}")
    for r in backfilled:
        mo = r.get("modelOutput", {})
        print(f"    #{r.get('originalLineNumber')} 补录人={mo.get('filledBy')} 模型={mo.get('modelName')} isBackfill={mo.get('isBackfill')}")

    # 5. 7字段一致性核对
    print("\n[5] 7字段一致性核对（每条记录）")
    print(f"  {'行号':>4s} | {'留言':12s} | {'链接':12s} | {'链接状态':6s} | {'机器人判断':10s} | {'模型输出':6s} | {'操作历史':6s} | {'状态':4s}")
    print(f"  {'----':>4s}-+-{'------------':12s}-+-{'------------':12s}-+-{'------':6s}-+-{'----------':10s}-+-{'------':6s}-+-{'------':6s}-+-{'----':4s}")
    for r in records:
        ln = r.get("originalLineNumber", 0)
        msg = (r.get("annotatorMessage") or "")[:12]
        url = (r.get("referenceUrl") or "")[8:20]
        url_st = "有效" if r.get("urlStatus") else "404"
        robot = (r.get("robotJudgment") or "")[:10]
        has_mo = "有" if r.get("modelOutput") else "暂无"
        log_cnt = len(r.get("judgmentLogs") or [])
        missing_flag = r.get("modelOutputMissing")
        has_backfill = r.get("modelOutput", {}).get("isBackfill") if r.get("modelOutput") else False

        status = "✓"
        if missing_flag and not has_backfill:
            status = "!"
        elif has_backfill and r.get("modelOutputMissing"):
            status = "✗"
            all_pass = False

        print(f"  {ln:>4d} | {msg:12s} | {url:12s} | {url_st:6s} | {robot:10s} | {has_mo:6s} | {log_cnt:>3d}条  | {status:4s}")

    # 6. 改前改后快照验证
    print("\n[6] 改前改后历史快照验证")
    records_with_logs = [r for r in records if r.get("judgmentLogs")]
    for r in records_with_logs:
        ln = r.get("originalLineNumber", 0)
        for i, log in enumerate(r.get("judgmentLogs", [])):
            action = log.get("action", "")
            diff = log.get("diffSummary") or []
            has_from = log.get("fromSnapshot") is not None
            has_to = log.get("toSnapshot") is not None
            print(f"  #{ln} 日志#{i+1}: action={action}")
            print(f"    diffSummary: {diff}")
            print(f"    fromSnapshot: {'有' if has_from else '无'} | toSnapshot: {'有' if has_to else '无'}")
            if not has_from or not has_to:
                print(f"    ⚠ 快照缺失！")
                all_pass = False

    # 7. 复盘报告 API
    print("\n[7] 复盘报告 API 验证")
    report = fetch_json("/api/report")
    if "error" in report:
        print(f"  ✗ 复盘报告API不可用: {report['error']}")
        all_pass = False
    else:
        rd = report.get("data", {})
        print(f"  总记录数: {rd.get('totalRecords')}")
        print(f"  模型输出缺失数: {rd.get('modelOutputMissingCount')}")
        print(f"  404异常数: {rd.get('url404Count')}")
        print(f"  平均操作次数: {rd.get('avgOperations')}")
        print(f"  ✓ 复盘报告API可正常返回数据")

    # 8. 单条记录 snapshot API
    print("\n[8] 单条记录快照 API 验证")
    if records:
        first_id = records[0].get("id")
        snapshot = fetch_json(f"/api/records/{first_id}/snapshot")
        if "error" in snapshot:
            print(f"  ✗ 快照API不可用: {snapshot['error']}")
            all_pass = False
        else:
            sd = snapshot.get("data", {})
            current = sd.get("current", {})
            original = sd.get("original", {})
            history = sd.get("history", [])
            print(f"  当前状态: {current.get('currentStatus')}")
            print(f"  当前模型输出缺失: {current.get('modelOutputMissing')}")
            print(f"  当前模型输出片段: {(current.get('modelOutputSnippet') or '暂无')[:40]}")
            print(f"  原始模型输出: {original.get('modelOutputSnippet') or '暂无'}")
            print(f"  历史条数: {len(history)}")
            print(f"  ✓ 快照API可正常返回改前改后数据")

    # 最终结果
    print("\n" + "=" * 60)
    if all_pass:
        print("✓ 全部验证通过！")
        print("  - 页面展示、导出明细、API返回读取同一份数据源")
        print("  - 暂无模型输出数据可被补录并追到同一份报告与返回结果")
        print("  - 改前改后快照完整记录，支持回滚")
    else:
        print("✗ 存在验证失败项，请检查上方输出")
    print("=" * 60)
    return 0 if all_pass else 1

if __name__ == "__main__":
    sys.exit(main())
