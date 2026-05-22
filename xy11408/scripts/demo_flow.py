#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"


def get_token(username, password):
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": username, "password": password}
    )
    if response.status_code == 200:
        return response.json()["data"]["access_token"]
    return None


def demo_full_flow():
    print("=" * 70)
    print("乡镇药房近效期验收回放链路 - 完整流程演示")
    print("=" * 70)

    print("\n【1/7】登录系统 - 主管(guanpeixun)")
    token = get_token("guanpeixun", "guan123")
    if not token:
        print("   ✗ 登录失败，请确保服务已启动")
        return
    print("   ✓ 登录成功")
    headers = {"Authorization": f"Bearer {token}"}

    print("\n【2/7】生成10条样例验收记录")
    response = requests.post(
        f"{BASE_URL}/replay/generate-samples?count=10",
        headers=headers
    )
    result = response.json()
    print(f"   ✓ 生成 {result['data']['generated_count']} 条记录")

    print("\n【3/7】生成坏数据样例（缺附件、重复提交、人工改判）")
    response = requests.post(
        f"{BASE_URL}/replay/generate-bad-data",
        headers=headers
    )
    result = response.json()
    print(f"   ✓ 缺附件记录 ID: {result['data']['missing_attachment_id']}")
    print(f"   ✓ 重复提交记录 ID: {result['data']['duplicate_submit_id']}")
    print(f"   ✓ 人工改判记录 ID: {result['data']['manual_fix_id']}")

    print("\n【4/7】查看验收记录列表（过滤坏数据）")
    response = requests.get(
        f"{BASE_URL}/records?is_bad_data=true&page_size=5",
        headers=headers
    )
    result = response.json()
    print(f"   ✓ 共找到 {result['data']['total']} 条坏数据记录")

    print("\n【5/7】查看失败记录详情")
    response = requests.get(
        f"{BASE_URL}/records/failed?resolved=false&page_size=10",
        headers=headers
    )
    result = response.json()
    print(f"   ✓ 共找到 {result['data']['total']} 条未解决的失败记录")
    for i, item in enumerate(result['data']['items'][:3], 1):
        print(f"     {i}. [{item['error_type']}] {item['error_message'][:40]}...")

    print("\n【6/7】人工改判第一条失败记录")
    if result['data']['items']:
        failed_id = result['data']['items'][0]['id']
        response = requests.post(
            f"{BASE_URL}/records/failed/{failed_id}/resolve",
            data={"resolution_notes": "经主管核实，数据有效，予以通过"},
            headers=headers
        )
        if response.status_code == 200:
            print(f"   ✓ 失败记录 {failed_id} 已人工改判为通过")

    print("\n【7/7】生成验收报告")
    response = requests.post(
        f"{BASE_URL}/exports/report",
        headers=headers
    )
    result = response.json()
    summary = result['data']['report_data']['summary']
    print(f"   ✓ 报告已生成: {result['data']['report_file']}")
    print(f"     - 总记录数: {summary['总记录数']}")
    print(f"     - 有效记录数: {summary['有效记录数']}")
    print(f"     - 坏数据数量: {summary['坏数据数量']}")
    print(f"     - 待解决失败记录: {summary['待解决失败记录']}")

    print("\n" + "=" * 70)
    print("演示完成!")
    print("=" * 70)
    print("\n后续操作建议:")
    print("  1. 访问 http://localhost:8000/docs 查看完整API文档")
    print("  2. 以不同角色登录体验权限控制:")
    print("     - 录入员: luruyuan / luru123")
    print("     - 复核员: fuyipei / fuyi123")
    print("     - 主管: guanpeixun / guan123")
    print("     - 只读: chaijiehao / chai123")
    print("  3. 查看审计日志: GET /api/v1/audit-logs/http")
    print("  4. 导出数据: POST /api/v1/exports/records")


if __name__ == "__main__":
    demo_full_flow()
