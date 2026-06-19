#!/usr/bin/env python3
"""API 端到端验证脚本"""
import urllib.request
import json

BASE = "http://localhost:8000"

def get(path):
    return json.loads(urllib.request.urlopen(BASE + path).read())

def main():
    print("=" * 60)
    print("  API 端到端验证")
    print("=" * 60)

    # 1. 列表
    print("\n1️⃣  记录列表")
    data = get("/api/records")
    aurora = [r for r in data["records"] if r["band_name"] == "极光乐队"][0]
    print(f"  总记录: {len(data['records'])} 条")
    print(f"  极光乐队 - 调音师: {aurora['tuner_name']}")
    print(f"  极光乐队 - 状态: {aurora['status_text']}")
    print(f"  极光乐队 - 待复核: {aurora['needs_review']}")
    print(f"  极光乐队 - 已修正: {aurora['has_corrections']}")

    # 2. 详情
    print(f"\n2️⃣  记录详情 (ID: {aurora['id']})")
    detail = get(f"/api/records/{aurora['id']}")
    print(f"  乐队: {detail['band_name']}")
    print(f"  调音师: {detail['tuner_name']}")
    print(f"  请假: {detail['is_leave']}")
    print(f"  消耗: {detail['is_consumed']}")
    print(f"  待复核: {detail['needs_review']}")
    print(f"  修正次数: {detail['correction_count']}")
    print(f"  复核说明: {detail['review_note']}")

    # 3. 统计
    print("\n3️⃣  统计数据")
    stats = get("/api/stats")
    print(f"  总记录: {stats['total']}")
    print(f"  待复核: {stats['pending_review']} 条")
    print(f"  待复核课时: {stats['pending_hours']} 小时")
    print(f"  已人工修正: {stats['corrected']} 条")
    print(f"  总课时: {stats['total_hours']} 小时")

    # 4. 文本报告
    print("\n4️⃣  文本报告关键字检查")
    text = urllib.request.urlopen(BASE + "/api/report/text").read().decode("utf-8")
    keywords = [
        "极光乐队",
        "李明（主调音师）",
        "⚠️待复核",
        "🔧已人工修正",
        "请假课时被算进已消耗",
        "待复核课时: 2.0 小时"
    ]
    all_ok = True
    for kw in keywords:
        ok = kw in text
        all_ok &= ok
        status = "✅" if ok else "❌"
        print(f"  {status} {kw}")

    # 5. 曲目核对表
    print("\n5️⃣  曲目核对表")
    checklist_data = get("/api/checklist")
    checklist = checklist_data["checklist"]
    bands = set(c["band_name"] for c in checklist)
    print(f"  有曲目的乐队: {len(bands)} 个 ({', '.join(bands)})")

    print("\n" + "=" * 60)
    if all_ok:
        print("🎉 全部 API 验证通过！")
        return 0
    else:
        print("❌ 有验证失败项")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
