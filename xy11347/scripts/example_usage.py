#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json

BASE_URL = "http://localhost:8001/api/v1"


def get_token(username, password):
    response = requests.post(
        f"{BASE_URL}/token",
        data={"username": username, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    print(f"获取token失败: {response.text}")
    return None


def import_order_json(token, filepath):
    with open(filepath, "rb") as f:
        files = {"file": ("orders.json", f, "application/json")}
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/import/order-json",
            files=files,
            headers=headers
        )
    print(f"\n导入订单结果: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def import_color_csv(token, filepath):
    with open(filepath, "rb") as f:
        files = {"file": ("color.csv", f, "text/csv")}
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/import/color-csv",
            files=files,
            headers=headers
        )
    print(f"\n导入测色数据结果: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def import_rework_csv(token, filepath):
    with open(filepath, "rb") as f:
        files = {"file": ("rework.csv", f, "text/csv")}
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/import/rework-notes",
            files=files,
            headers=headers
        )
    print(f"\n导入返工记录结果: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def get_orders(token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/orders/", headers=headers)
    print(f"\n获取订单列表: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def evaluate_order(token, order_id):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/orders/{order_id}/evaluate", headers=headers)
    print(f"\n评估订单质检结果: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def generate_qc_report(token, order_no):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/qc-reports/generate/{order_no}", headers=headers)
    print(f"\n生成质检报告: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def review_report(token, report_id, after_status="pass"):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "qc_report_id": report_id,
        "review_action": "复核通过",
        "review_notes": "数据复核无误，符合品质要求",
        "after_status": after_status
    }
    response = requests.post(
        f"{BASE_URL}/qc-reports/{report_id}/review",
        json=data,
        headers=headers
    )
    print(f"\n复核质检报告: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def export_report(token, report_id):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/qc-reports/{report_id}/export",
        headers=headers
    )
    print(f"\n导出质检报告: {response.status_code}")
    result = response.json()
    print(f"报告编号: {result.get('report_no')}")
    print(f"合格率: {result.get('pass_rate')}")
    print(f"结论: {result.get('conclusion')}")
    return result


def get_trend_analysis(token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/trend/daily", headers=headers)
    print(f"\n趋势分析: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def get_import_errors(token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/import/errors", headers=headers)
    print(f"\n导入错误记录: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()


def main():
    print("=" * 60)
    print("印刷车间品控系统使用示例")
    print("=" * 60)

    token = get_token("admin", "admin123")
    if not token:
        print("请先启动服务器: uvicorn app.main:app --reload")
        return

    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_data")

    print("\n1. 导入订单数据")
    import_order_json(token, os.path.join(sample_dir, "orders.json"))

    print("\n2. 导入正常测色数据")
    import_color_csv(token, os.path.join(sample_dir, "color_measurements.csv"))

    print("\n3. 导入带错误的测色数据（展示错误记录功能）")
    import_color_csv(token, os.path.join(sample_dir, "color_measurements_with_errors.csv"))

    print("\n4. 查看导入错误记录")
    get_import_errors(token)

    print("\n5. 导入返工记录")
    import_rework_csv(token, os.path.join(sample_dir, "rework_notes.csv"))

    print("\n6. 获取订单列表")
    orders = get_orders(token)

    if orders and len(orders) > 0:
        first_order = orders[0]
        print(f"\n7. 评估订单 '{first_order['order_no']}' 的质检结果")
        evaluate_order(token, first_order["id"])

        print(f"\n8. 为订单 '{first_order['order_no']}' 生成质检报告")
        report = generate_qc_report(token, first_order["order_no"])

        if report and "id" in report:
            print(f"\n9. 复核质检报告 (ID: {report['id']})")
            review_report(token, report["id"])

            print(f"\n10. 导出质检报告")
            export_report(token, report["id"])

    print("\n11. 趋势分析")
    get_trend_analysis(token)

    print("\n" + "=" * 60)
    print("示例流程执行完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
