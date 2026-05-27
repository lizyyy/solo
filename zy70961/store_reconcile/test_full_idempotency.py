"""完整的幂等性测试 - 覆盖文件上传和结构化数据两种接口"""
import json
import os


def test_structured_idempotency():
    """测试结构化接口 /api/v1/reconcile 的幂等性"""
    import http.client

    sample_dir = os.path.join(os.path.dirname(__file__), "sample")
    with open(os.path.join(sample_dir, "deposit.csv"), "r") as f:
        deposit_lines = f.read().strip().split("\n")[1:]
    with open(os.path.join(sample_dir, "sales.json"), "r") as f:
        sales = json.load(f)
    with open(os.path.join(sample_dir, "petty_cash.json"), "r") as f:
        petty_cash = json.load(f)

    deposits = []
    for line in deposit_lines:
        parts = line.split(",")
        deposits.append({
            "store_id": parts[0],
            "deposit_date": parts[1],
            "amount": float(parts[2]),
            "deposit_method": parts[3],
            "reference_no": parts[4] if len(parts) > 4 else None,
        })

    payload = {
        "store_id": "STORE001",
        "batch_date": "2026-05-24",
        "deposits": deposits,
        "sales": sales,
        "petty_cash": petty_cash,
    }

    conn = http.client.HTTPConnection("localhost", 8001)
    headers = {"Content-Type": "application/json"}

    print("=" * 60)
    print("结构化接口幂等性测试")
    print("=" * 60)

    print("\n[1/3] 第一次提交:")
    conn.request("POST", "/api/v1/reconcile", json.dumps(payload), headers)
    resp = conn.getresponse()
    raw_data = resp.read()
    if resp.status != 200:
        print(f"  Status: {resp.status}")
        print(f"  Response: {raw_data.decode()[:500]}")
        conn.close()
        return False
    data = json.loads(raw_data)
    batch_id_1 = data["batch_id"]
    count_1 = data["total_count"]
    print(f"  Status: {resp.status}")
    print(f"  batch_id: {batch_id_1}")
    print(f"  处理条数: {count_1}")

    print("\n[2/3] 第二次提交（相同数据）:")
    conn.request("POST", "/api/v1/reconcile", json.dumps(payload), headers)
    resp = conn.getresponse()
    raw_data = resp.read()
    if resp.status != 200:
        print(f"  Status: {resp.status}")
        print(f"  Response: {raw_data.decode()[:500]}")
        conn.close()
        return False
    data = json.loads(raw_data)
    batch_id_2 = data["batch_id"]
    count_2 = data["total_count"]
    note = data.get("summary", {}).get("note", "")
    print(f"  Status: {resp.status}")
    print(f"  batch_id: {batch_id_2}")
    print(f"  处理条数: {count_2}")
    print(f"  返回说明: {note}")

    print("\n[3/3] 验证结果:")
    if batch_id_1 == batch_id_2 and count_1 == count_2 and "已处理" in note:
        print("  ✓ 结构化接口幂等性验证通过")
        structured_ok = True
    else:
        print("  ✗ 结构化接口幂等性验证失败")
        structured_ok = False

    conn.close()
    return structured_ok


def test_upload_idempotency():
    """测试文件上传接口 /api/v1/reconcile/upload 的幂等性"""
    import http.client

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
    body += add_field("store_id", "STORE002")
    body += add_field("batch_date", "2026-05-24")
    body += add_field("deposit_file", deposit_csv, True, "deposit.csv", "text/csv")
    body += add_field("sales_file", sales_json, True, "sales.json", "application/json")
    body += add_field("petty_cash_file", petty_cash_json, True, "petty_cash.json", "application/json")
    body += f"--{boundary}--\r\n".encode()

    conn = http.client.HTTPConnection("localhost", 8001)
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}

    print("\n" + "=" * 60)
    print("文件上传接口幂等性测试")
    print("=" * 60)

    print("\n[1/3] 第一次提交:")
    conn.request("POST", "/api/v1/reconcile/upload", body, headers)
    resp = conn.getresponse()
    data = json.loads(resp.read())
    batch_id_1 = data["batch_id"]
    count_1 = data["total_count"]
    print(f"  Status: {resp.status}")
    print(f"  batch_id: {batch_id_1}")
    print(f"  处理条数: {count_1}")

    print("\n[2/3] 第二次提交（相同数据）:")
    conn.request("POST", "/api/v1/reconcile/upload", body, headers)
    resp = conn.getresponse()
    data = json.loads(resp.read())
    batch_id_2 = data["batch_id"]
    count_2 = data["total_count"]
    note = data.get("summary", {}).get("note", "")
    print(f"  Status: {resp.status}")
    print(f"  batch_id: {batch_id_2}")
    print(f"  处理条数: {count_2}")
    print(f"  返回说明: {note}")

    print("\n[3/3] 验证结果:")
    if batch_id_1 == batch_id_2 and count_1 == count_2 and "已处理" in note:
        print("  ✓ 文件上传接口幂等性验证通过")
        upload_ok = True
    else:
        print("  ✗ 文件上传接口幂等性验证失败")
        upload_ok = False

    conn.close()
    return upload_ok


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("双接口幂等性完整测试")
    print("=" * 60)

    try:
        structured_ok = test_structured_idempotency()
        upload_ok = test_upload_idempotency()

        print("\n" + "=" * 60)
        print("最终结果")
        print("=" * 60)
        print(f"  结构化接口: {'✓ 通过' if structured_ok else '✗ 失败'}")
        print(f"  文件上传接口: {'✓ 通过' if upload_ok else '✗ 失败'}")
        print(f"  整体: {'✓ 全部通过' if (structured_ok and upload_ok) else '✗ 存在失败'}")
        print("=" * 60)
    except Exception as e:
        print(f"\n测试失败: {e}")
        import traceback
        traceback.print_exc()
