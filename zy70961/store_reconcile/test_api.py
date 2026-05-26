"""简单的 API 测试脚本"""
import json
import os
import http.client


def test_upload_api():
    sample_dir = os.path.join(os.path.dirname(__file__), "sample")

    with open(os.path.join(sample_dir, "deposit.csv"), "r") as f:
        deposit_csv = f.read()
    with open(os.path.join(sample_dir, "sales.json"), "r") as f:
        sales_json = f.read()
    with open(os.path.join(sample_dir, "petty_cash.json"), "r") as f:
        petty_cash_json = f.read()

    boundary = "----TestBoundary1234567890"

    def add_field(name, value, is_file=False, filename="", content_type=""):
        body = b""
        body += f"--{boundary}\r\n".encode()
        if is_file:
            body += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
            body += f"Content-Type: {content_type}\r\n\r\n".encode()
            body += value.encode() + b"\r\n"
        else:
            body += f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
            body += value.encode() + b"\r\n"
        return body

    body = b""
    body += add_field("store_id", "STORE001")
    body += add_field("batch_date", "2026-05-24")
    body += add_field("deposit_file", deposit_csv, True, "deposit.csv", "text/csv")
    body += add_field("sales_file", sales_json, True, "sales.json", "application/json")
    body += add_field("petty_cash_file", petty_cash_json, True, "petty_cash.json", "application/json")
    body += f"--{boundary}--\r\n".encode()

    conn = http.client.HTTPConnection("localhost", 8001)
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    conn.request("POST", "/api/v1/reconcile/upload", body, headers)
    response = conn.getresponse()
    data = json.loads(response.read())

    print("=" * 60)
    print("API 上传对账测试")
    print("=" * 60)
    print(f"\n批次ID: {data['batch_id']}")
    print(f"总计: {data['total_count']} 条")
    print(f"正常: {data['normal_count']} 条")
    print(f"待确认: {data['pending_count']} 条")
    print(f"失败: {data['failed_count']} 条")

    print("\n失败明细:")
    for item in data["failed_items"]:
        print(f"\n  [{item['record_date']}]")
        print(f"    缴存: {item['deposit_amount']:.2f} 元")
        print(f"    销售: {item['sales_amount']:.2f} 元")
        if item.get("difference"):
            print(f"    差额: {item['difference']:.2f} 元")
        if item.get("error_message"):
            print(f"    错误: {item['error_message']}")
        if item.get("suggestion"):
            print(f"    建议: {item['suggestion']}")

    print("\n" + "=" * 60)
    print("备用金追溯测试")
    print("=" * 60)

    conn.request("GET", "/api/v1/petty-cash/trace?store_id=STORE001&target_date=2026-05-24")
    response = conn.getresponse()
    trace_data = json.loads(response.read())

    print(f"\n当前余额: {trace_data['current_balance']:.2f} 元")
    print(f"最早记录: {trace_data['earliest_date']}")
    print(f"资金来源:")
    print(f"  收入: {trace_data['total_income']:.2f} 元")
    print(f"  支出: {trace_data['total_expense']:.2f} 元")
    print(f"  充值: {trace_data['total_replenish']:.2f} 元")

    print(f"\n流水明细:")
    for node in trace_data["trace_path"]:
        type_cn = {"income": "收入", "expense": "支出", "replenish": "充值", "adjust": "调整"}[
            node["txn_type"]
        ]
        print(
            f"  {node['txn_date']} | {type_cn} | {node['amount']:>10.2f} | "
            f"余额: {node['balance_after']:>10.2f} | {node.get('description', '')}"
        )

    conn.close()


if __name__ == "__main__":
    test_upload_api()
