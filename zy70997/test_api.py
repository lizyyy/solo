#!/usr/bin/env python3
import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8001"


def print_separator(title=""):
    line = "=" * 60
    if title:
        print(f"\n{line}")
        print(f"  {title}")
        print(line)
    else:
        print(line)


def test_health():
    print_separator("1. 检查服务健康状态")
    try:
        r = requests.get(f"{BASE_URL}/")
        print(f"状态码: {r.status_code}")
        print(f"服务: {r.json()['service']} v{r.json()['version']}")
        return True
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务，请先启动服务: python run.py")
        return False


def import_employees():
    print_separator("2. 导入员工数据")
    with open("sample_data/employees.csv", "rb") as f:
        files = {"file": ("employees.csv", f, "text/csv")}
        r = requests.post(f"{BASE_URL}/import/employees", files=files)
        print(f"状态码: {r.status_code}")
        print(f"结果: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")


def import_coupons():
    print_separator("3. 导入券码数据")
    with open("sample_data/coupons.csv", "rb") as f:
        files = {"file": ("coupons.csv", f, "text/csv")}
        r = requests.post(f"{BASE_URL}/import/coupons", files=files)
        print(f"状态码: {r.status_code}")
        print(f"结果: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")


def process_claims():
    print_separator("4. 提交领用名单进行核销")
    with open("sample_data/claims.csv", "rb") as f:
        files = {"file": ("claims.csv", f, "text/csv")}
        r = requests.post(f"{BASE_URL}/upload/process", files=files)
        print(f"状态码: {r.status_code}")
        result = r.json()

        if r.status_code == 400:
            print(f"⚠️  {result['detail']['message']}")
            print(f"批次号: {result['detail']['batch_id']}")
            print(f"处理时间: {result['detail']['processed_at']}")
            return None

        print(f"批次号: {result['batch_id']}")
        print(f"总计: {result['total_count']} | "
              f"通过: {result['success_count']} | "
              f"待确认: {result['pending_count']} | "
              f"失败: {result['failed_count']}")

        print_separator("✅ 通过项 (正常发放)")
        for i, item in enumerate(result['success_items'], 1):
            print(f"\n  [{i}] {item['original_data']['employee_name']} "
                  f"({item['original_data']['employee_id']})")
            print(f"      原因: {item['reason']}")
            print(f"      建议: {item['suggestion']}")

        print_separator("⏳ 待确认项 (需人工复核)")
        for i, item in enumerate(result['pending_items'], 1):
            print(f"\n  [{i}] {item['original_data']['employee_name']} "
                  f"({item['original_data']['employee_id']})")
            print(f"      原因: {item['reason']}")
            print(f"      建议: {item['suggestion']}")

        print_separator("❌ 失败项 (拦截退回)")
        for i, item in enumerate(result['failed_items'], 1):
            print(f"\n  [{i}] {item['original_data']['employee_name']} "
                  f"({item['original_data']['employee_id']})")
            print(f"      原因: {item['reason']}")
            print(f"      建议: {item['suggestion']}")

        return result['batch_id']


def test_idempotency():
    print_separator("5. 测试幂等性 - 重复提交同一文件")
    with open("sample_data/claims.csv", "rb") as f:
        files = {"file": ("claims.csv", f, "text/csv")}
        r = requests.post(f"{BASE_URL}/upload/process", files=files)
        print(f"状态码: {r.status_code}")
        if r.status_code == 400:
            detail = r.json()['detail']
            print(f"✅ 幂等性生效: {detail['message']}")
            print(f"   原批次号: {detail['batch_id']}")
            print(f"   处理时间: {detail['processed_at']}")


def list_batches():
    print_separator("6. 查看历史批次")
    r = requests.get(f"{BASE_URL}/batches")
    batches = r.json()
    print(f"共 {len(batches)} 个批次:")
    for b in batches:
        print(f"  {b['batch_id']} | {b['file_name']} | "
              f"总数:{b['total_count']} 成功:{b['success_count']} "
              f"待确认:{b['pending_count']} 失败:{b['failed_count']} | "
              f"{b['created_at'][:19]}")


def list_records():
    print_separator("7. 查看已生效的发放记录")
    r = requests.get(f"{BASE_URL}/records")
    records = r.json()
    print(f"共 {len(records)} 条已生效记录:")
    for r in records:
        proxy_note = f" [代领人: {r['proxy_employee_name']}]" if r['is_proxy'] else ""
        delivery_note = f" [{r['delivery_method']}]" if r['delivery_method'] else ""
        print(f"  {r['employee_name']} ({r['employee_id']}) | "
              f"{r['claim_type']} | 券码:{r['coupon_code'] or '无'}"
              f"{proxy_note}{delivery_note} | {r['created_at'][:19]}")


def show_employees_status():
    print_separator("8. 查看员工状态")
    r = requests.get(f"{BASE_URL}/employees")
    emps = r.json()
    print(f"共 {len(emps)} 名员工:")
    for e in emps:
        status_icon = "✅" if e['is_active'] else "❌"
        print(f"  {status_icon} {e['employee_id']} {e['name']} "
              f"- {e['department'] or '未分配'} | {e['status_text']}")


def main():
    if not test_health():
        sys.exit(1)

    import_employees()
    import_coupons()
    batch_id = process_claims()

    if batch_id:
        test_idempotency()

    list_batches()
    list_records()
    show_employees_status()

    print_separator()
    print("🎉 测试完成！你可以拿着失败项的详细说明向同事解释为什么被退回。")
    print("📖 访问 http://127.0.0.1:8000/docs 查看交互式 API 文档")
    print_separator()


if __name__ == "__main__":
    main()
