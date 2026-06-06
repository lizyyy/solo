import requests
import json
import sys
import os

BASE_URL = "http://127.0.0.1:8000"


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def step1_import_accounts():
    print_separator("步骤 1: 导入贷款账户数据")

    file_path = os.path.join("sample_data", "sample_accounts.csv")
    if not os.path.exists(file_path):
        print(f"错误: 文件不存在 {file_path}")
        return False

    with open(file_path, "rb") as f:
        files = {"file": ("sample_accounts.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/import/accounts", files=files)

    if response.status_code == 200:
        data = response.json()
        print(f"✅ 导入成功!")
        print(f"   文件: {data['file_name']}")
        print(f"   总记录: {data['total_records']}")
        print(f"   有效记录: {data['valid_records']}")
        print(f"   无效记录: {data['invalid_records']}")
        print(f"   导入日志ID: {data['import_log_id']}")
        print("\n📝 数据清洗备注:")
        for line in data['cleaning_notes'].split('\n')[:10]:
            if line.strip():
                print(f"   {line}")
        if len(data['cleaning_notes'].split('\n')) > 10:
            print(f"   ... (更多备注请查看导入日志)")
        return True
    else:
        print(f"❌ 导入失败: {response.text}")
        return False


def step2_import_repayments():
    print_separator("步骤 2: 导入还款记录数据")

    file_path = os.path.join("sample_data", "sample_repayments.csv")
    if not os.path.exists(file_path):
        print(f"错误: 文件不存在 {file_path}")
        return False

    with open(file_path, "rb") as f:
        files = {"file": ("sample_repayments.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/import/repayments", files=files)

    if response.status_code == 200:
        data = response.json()
        print(f"✅ 导入成功!")
        print(f"   文件: {data['file_name']}")
        print(f"   总记录: {data['total_records']}")
        print(f"   有效记录: {data['valid_records']}")
        print(f"   无效记录: {data['invalid_records']}")
        return True
    else:
        print(f"❌ 导入失败: {response.text}")
        return False


def step3_run_warnings():
    print_separator("步骤 3: 执行预警检查")

    response = requests.post(f"{BASE_URL}/warnings/run", params={"warning_days": 60})

    if response.status_code == 200:
        data = response.json()
        print(f"✅ 预警检查完成!")
        print(f"   新增预警: {data['new_warnings']}")
        print(f"   跳过重复: {data['skipped_duplicates']}")
        print(f"   预警总数: {data['total_warnings']}")
        return True
    else:
        print(f"❌ 预警检查失败: {response.text}")
        return False


def step4_view_warnings():
    print_separator("步骤 4: 查看预警列表")

    response = requests.get(f"{BASE_URL}/warnings")

    if response.status_code == 200:
        warnings = response.json()
        print(f"共发现 {len(warnings)} 条预警:\n")

        type_map = {
            "MULTI_ACCOUNT_SAME_CUSTOMER": "🔴 同一客户多账号",
            "OVERDUE_IMMINENT": "🟡 即将到期",
            "ALREADY_OVERDUE": "🔴 已逾期",
            "REFUND_CROSS_CLEARING": "🟡 退款跨清算日",
            "EXTENSION_SUSPECTED": "🔴 疑似展期",
            "DATA_QUALITY_ISSUE": "🔵 数据质量"
        }

        for w in warnings:
            w_type = type_map.get(w['warning_type'], w['warning_type'])
            print(f"  [{w['warning_level']}] {w_type}")
            print(f"      账号: {w['account_no']} | 客户: {w['customer_id']}")
            print(f"      {w['warning_message'][:100]}...")
            print(f"      关联材料: {w['related_materials'][:80] if w['related_materials'] else '无'}")
            print()
        return True
    else:
        print(f"❌ 获取预警失败: {response.text}")
        return False


def step5_view_multi_account_stats():
    print_separator("步骤 5: 查看多账号客户统计")

    response = requests.get(f"{BASE_URL}/stats/multi-account-customers")

    if response.status_code == 200:
        stats = response.json()
        if stats:
            print(f"发现 {len(stats)} 个存在多账号问题的客户记录:\n")
            for s in stats:
                print(f"  客户编号: {s['customer_id']}")
                print(f"  客户姓名: {s['customer_name']}")
                print(f"  账户数量: {s['account_count']}")
                print(f"  剩余本金合计: {s['total_outstanding']:.2f} 元")
                print(f"  关联预警数: {s['warning_count']}")
                print()
        else:
            print("暂无多账号客户问题")
        return True
    else:
        print(f"❌ 获取统计失败: {response.text}")
        return False


def step6_create_review():
    print_separator("步骤 6: 提交复核记录（模拟财务复核员操作）")

    response = requests.get(f"{BASE_URL}/warnings", params={"only_unreviewed": True})

    if response.status_code != 200:
        print(f"❌ 获取预警失败: {response.text}")
        return False

    warnings = response.json()
    if not warnings:
        print("暂无待复核的预警")
        return True

    warning_id = warnings[0]['id']
    print(f"选择预警 #{warning_id} 进行复核\n")

    review_data = {
        "warning_id": warning_id,
        "reviewer": "李财务",
        "review_result": "需进一步核实",
        "review_comments": "已核对系统数据，确认该客户确实存在两个客户编号，请业务部门确认是否为同一人并办理客户合并手续。",
        "exception_explanation": (
            "【异常说明】\n"
            "客户张三存在两个客户编号（C001、C002），对应两个贷款账号（LOAN001、LOAN002），"
            "但身份证号均为 110101199001011234，确认为同一客户。\n\n"
            "请相关业务部门：\n"
            "1. 核实客户信息，确认是否为同一人\n"
            "2. 办理客户编号合并手续\n"
            "3. 重新评估该客户的总授信额度\n\n"
            "关联材料：客户身份证复印件、贷款合同两份\n"
            "复核员：李财务"
        )
    }

    response = requests.post(f"{BASE_URL}/reviews", json=review_data)

    if response.status_code == 200:
        data = response.json()
        print(f"✅ 复核记录提交成功!")
        print(f"   复核ID: {data['id']}")
        print(f"   复核员: {data['reviewer']}")
        print(f"   复核结果: {data['review_result']}")
        return True
    else:
        print(f"❌ 提交失败: {response.text}")
        return False


def step7_export_reviews():
    print_separator("步骤 7: 导出复核记录")

    response = requests.get(f"{BASE_URL}/reviews/export")

    if response.status_code == 200:
        print("✅ 导出成功! 导出内容如下:\n")
        print(response.text)

        output_file = "复核记录导出.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(response.text)
        print(f"\n💾 已保存到文件: {output_file}")
        return True
    else:
        print(f"❌ 导出失败: {response.text}")
        return False


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║              小微贷款展期预警系统 - 演示脚本                  ║
╚══════════════════════════════════════════════════════════════╝

请确保已启动服务:
  pip install -r requirements.txt
  uvicorn app.main:app --reload

""")

    try:
        requests.get(BASE_URL)
    except:
        print("❌ 无法连接到服务，请先启动 uvicorn")
        sys.exit(1)

    steps = [
        step1_import_accounts,
        step2_import_repayments,
        step3_run_warnings,
        step4_view_warnings,
        step5_view_multi_account_stats,
        step6_create_review,
        step7_export_reviews
    ]

    success_count = 0
    for step in steps:
        if step():
            success_count += 1
        input("\n按 Enter 继续下一步...")

    print_separator("演示完成")
    print(f"✅ 完成 {success_count}/{len(steps)} 个步骤")
    print()
    print("📌 下一步操作建议:")
    print("   1. 打开浏览器访问 http://127.0.0.1:8000/docs 查看完整API文档")
    print("   2. 查看生成的 SQLite 数据库文件 loan_warning.db")
    print("   3. 查看导出的 复核记录导出.txt 文件")
    print()


if __name__ == "__main__":
    main()
