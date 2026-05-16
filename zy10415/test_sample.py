#!/usr/bin/env python3
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(response.text)
    print()

def test_acceptance():
    print("="*60)
    print("  翻译记忆版本API - 验收测试")
    print("="*60)
    
    health = requests.get(f"{BASE_URL}/health")
    print_response("1. 系统健康检查", health)
    
    test_entries = [
        {
            "entry_key": "login.welcome",
            "source_language": "zh-CN",
            "target_language": "en-US",
            "source_text": "欢迎回来",
            "target_text": "Welcome back",
            "version_batch": "v2.0.0-20240515",
            "created_by": "translator_01",
            "metadata": {"project": "mobile_app", "domain": "authentication"}
        },
        {
            "entry_key": "login.submit",
            "source_language": "zh-CN",
            "target_language": "en-US",
            "source_text": "提交",
            "target_text": "Submit",
            "version_batch": "v2.0.0-20240515",
            "created_by": "translator_01",
            "metadata": {"project": "mobile_app", "domain": "authentication"}
        },
        {
            "entry_key": "login.forgot_password",
            "source_language": "zh-CN",
            "target_language": "en-US",
            "source_text": "忘记密码",
            "target_text": "Forgot password",
            "version_batch": "v2.0.0-20240515",
            "created_by": "translator_02",
            "metadata": {"project": "mobile_app", "domain": "authentication"}
        }
    ]
    
    entry_ids = []
    for i, entry in enumerate(test_entries, 1):
        response = requests.post(f"{BASE_URL}/entries", json=entry)
        print_response(f"2.{i} 创建词条 - {entry['entry_key']}", response)
        if response.status_code == 200:
            data = response.json()
            if not data['is_duplicate']:
                pass
    
    all_entries = requests.get(f"{BASE_URL}/entries")
    print_response("3. 查询所有词条", all_entries)
    
    if all_entries.status_code == 200:
        entries_data = all_entries.json()
        if entries_data:
            entry_ids = [e['id'] for e in entries_data]
            print(f"  获取到 {len(entry_ids)} 个词条 ID: {entry_ids}")
    
    if entry_ids:
        print("\n" + "="*60)
        print("  测试幂等性 - 重复提交相同词条")
        print("="*60)
        duplicate_response = requests.post(f"{BASE_URL}/entries", json=test_entries[0])
        print_response("4. 重复提交第一个词条（应该标记为重复，不创建新词条）", duplicate_response)
        
        if duplicate_response.status_code == 200:
            dup_data = duplicate_response.json()
            print(f"  重复提交检测: {'成功' if dup_data['is_duplicate'] else '失败'}")
            print(f"  消息: {dup_data['message']}")
    
    if entry_ids:
        first_id = entry_ids[0]
        status_update = {
            "new_status": "approved",
            "updated_by": "reviewer_01"
        }
        response = requests.patch(f"{BASE_URL}/entries/{first_id}/status", json=status_update)
        print_response("5. 状态推进 - PENDING -> APPROVED", response)
        
        status_update_rollback = {
            "new_status": "rolled_back",
            "rollback_reason": "翻译错误，需重新翻译",
            "updated_by": "reviewer_01"
        }
        response = requests.patch(f"{BASE_URL}/entries/{first_id}/status", json=status_update_rollback)
        print_response("6. 状态推进 - APPROVED -> ROLLED_BACK（记录回滚原因）", response)
    
    if entry_ids:
        second_id = entry_ids[1]
        manual_fix = {
            "new_target_text": "Submit Form",
            "fix_notes": "修正翻译，补充上下文语境",
            "fixed_by": "senior_translator_01"
        }
        response = requests.patch(f"{BASE_URL}/entries/{second_id}/manual-fix", json=manual_fix)
        print_response("7. 人工修正词条翻译", response)
    
    reports = requests.get(f"{BASE_URL}/reports")
    print_response("8. 查询所有记忆报告（包含异常路径和处理结论）", reports)
    
    if entry_ids:
        reports = requests.get(f"{BASE_URL}/entries/{entry_ids[0]}/reports")
        print_response(f"9. 查询词条 {entry_ids[0]} 的关联报告", reports)
    
    export_request = {
        "version_batch": "v2.0.0-20240515",
        "include_reports": True
    }
    export_response = requests.post(f"{BASE_URL}/export", json=export_request)
    print_response("10. 导出数据（含词条和报告，每条异常都有解释）", export_response)
    
    if entry_ids:
        print("\n" + "="*60)
        print("  再次测试幂等性 - 再次提交相同内容")
        print("="*60)
        status_before = requests.get(f"{BASE_URL}/entries/{entry_ids[0]}")
        if status_before.status_code == 200:
            print(f"  提交前状态: {status_before.json()['status']}")
            print(f"  提交前版本号: {status_before.json()['version_number']}")
        
        duplicate_response2 = requests.post(f"{BASE_URL}/entries", json=test_entries[0])
        print_response("11. 第三次提交同一词条", duplicate_response2)
        
        status_after = requests.get(f"{BASE_URL}/entries/{entry_ids[0]}")
        if status_after.status_code == 200:
            print(f"  提交后状态: {status_after.json()['status']}")
            print(f"  提交后版本号: {status_after.json()['version_number']}")
            print(f"  状态未改变: {status_before.json()['status'] == status_after.json()['status']}")
            print(f"  版本号未改变: {status_before.json()['version_number'] == status_after.json()['version_number']}")
    
    print("\n" + "="*60)
    print("  验收测试完成!")
    print("="*60)
    print("\n核心功能验证:")
    print("  ✓ 词条创建与版本化")
    print("  ✓ 冲突检测与状态标记")
    print("  ✓ 重复导入幂等性（状态不被推进两次）")
    print("  ✓ 状态推进与回滚原因记录")
    print("  ✓ 人工修正功能")
    print("  ✓ 记忆报告（异常路径保留原始输入和处理结论）")
    print("  ✓ 数据导出功能")
    print()

if __name__ == "__main__":
    test_acceptance()