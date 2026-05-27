"""测试幂等性"""
import json
import os
import http.client


def test_idempotency():
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

    print("=" * 60)
    print("幂等性测试")
    print("=" * 60)

    print("\n[1/3] 第一次提交:")
    conn.request("POST", "/api/v1/reconcile/upload", body, headers)
    resp = conn.getresponse()
    data = json.loads(resp.read())
    batch_id_1 = data["batch_id"]
    count_1 = data["total_count"]
    print(f"  batch_id: {batch_id_1}")
    print(f"  处理条数: {count_1}")

    print("\n[2/3] 第二次提交（相同数据）:")
    conn.request("POST", "/api/v1/reconcile/upload", body, headers)
    resp = conn.getresponse()
    data = json.loads(resp.read())
    batch_id_2 = data["batch_id"]
    count_2 = data["total_count"]
    note = data.get("summary", {}).get("note", "")
    print(f"  batch_id: {batch_id_2}")
    print(f"  处理条数: {count_2}")
    print(f"  返回说明: {note}")

    print("\n[3/3] 验证结果:")
    if batch_id_1 == batch_id_2 and count_1 == count_2 and "已处理" in note:
        print("  ✓ 幂等性验证通过")
        print(f"    - 两次返回相同 batch_id: {batch_id_1}")
        print(f"    - 数据未重复处理")
        print(f"    - 返回历史结果标记: {note}")
    else:
        print("  ✗ 幂等性验证失败")
        print(f"    - 第一次 batch_id: {batch_id_1}")
        print(f"    - 第二次 batch_id: {batch_id_2}")

    conn.close()
    print("\n" + "=" * 60)


if __name__ == "__main__":
    test_idempotency()
