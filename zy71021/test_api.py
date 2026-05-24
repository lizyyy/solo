import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"


def test_upload_compensation():
    print("=" * 60)
    print("测试1: 上传补偿申请（支付成功无电量场景）")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/upload"
    data = {
        "batch_no": "BATCH20240101001",
        "case_no": "CASE20240101001",
        "user_id": "USER001",
        "pile_no": "PILE-A01",
        "order_no": "ORD20240101001",
        "fault_code": "E001",
        "fault_description": "支付成功但无法充电",
        "description": "用户反馈支付50元后未充到电",
        "order": {
            "order_no": "ORD20240101001",
            "user_id": "USER001",
            "pile_no": "PILE-A01",
            "amount": 50.0,
            "pay_time": (datetime.now() - timedelta(hours=2)).isoformat(),
            "pay_status": "paid",
            "start_time": (datetime.now() - timedelta(hours=2)).isoformat(),
            "end_time": (datetime.now() - timedelta(hours=1)).isoformat(),
            "raw_data": '{"payment_channel": "alipay", "transaction_id": "TX123456"}'
        },
        "electricity": {
            "record_no": "ELEC20240101001",
            "order_no": "ORD20240101001",
            "pile_no": "PILE-A01",
            "start_energy": 100.0,
            "end_energy": 100.0,
            "total_energy": 0.0,
            "start_time": (datetime.now() - timedelta(hours=2)).isoformat(),
            "end_time": (datetime.now() - timedelta(hours=1)).isoformat(),
            "raw_data": '{"meter_start": 100, "meter_end": 100}'
        },
        "raw_input": {
            "source": "customer_service",
            "agent_id": "CS001",
            "complaint_time": datetime.now().isoformat()
        }
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def test_duplicate_upload():
    print("\n" + "=" * 60)
    print("测试2: 重复上传（幂等性测试）")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/upload"
    data = {
        "case_no": "CASE20240101001",
        "user_id": "USER001",
        "pile_no": "PILE-A01",
        "order_no": "ORD20240101001"
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"是否重复: {result.get('is_duplicate')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_query_record():
    print("\n" + "=" * 60)
    print("测试3: 查询单条记录")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101001"
    response = requests.get(url)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_confirm_approved():
    print("\n" + "=" * 60)
    print("测试4: 确认批准补偿")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101001/confirm"
    data = {
        "operator": "ADMIN001",
        "approved": True,
        "conclusion": "pile_fault",
        "compensation_amount": 50.0,
        "remark": "经核实，确为充电桩硬件故障"
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"当前状态: {result.get('status')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_cancel_record():
    print("\n" + "=" * 60)
    print("测试5: 撤回补偿申请")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101001/cancel"
    params = {
        "operator": "ADMIN001",
        "remark": "用户取消申请"
    }

    response = requests.post(url, params=params)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"当前状态: {result.get('status')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_resubmit():
    print("\n" + "=" * 60)
    print("测试6: 撤回后重新提交")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/upload"
    params = {"resubmit": True}
    data = {
        "batch_no": "BATCH20240101001",
        "case_no": "CASE20240101001",
        "user_id": "USER001",
        "pile_no": "PILE-A01",
        "order_no": "ORD20240101001",
        "fault_code": "E002",
        "fault_description": "支付成功但无法充电",
        "description": "用户重新提交，补充新证据",
        "order": {
            "order_no": "ORD20240101001",
            "user_id": "USER001",
            "pile_no": "PILE-A01",
            "amount": 50.0,
            "pay_time": (datetime.now() - timedelta(hours=2)).isoformat(),
            "pay_status": "paid",
            "start_time": (datetime.now() - timedelta(hours=2)).isoformat(),
            "end_time": (datetime.now() - timedelta(hours=1)).isoformat()
        },
        "electricity": {
            "record_no": "ELEC20240101001",
            "order_no": "ORD20240101001",
            "pile_no": "PILE-A01",
            "start_energy": 100.0,
            "end_energy": 100.0,
            "total_energy": 0.0,
            "start_time": (datetime.now() - timedelta(hours=2)).isoformat(),
            "end_time": (datetime.now() - timedelta(hours=1)).isoformat()
        }
    }

    response = requests.post(url, json=data, params=params)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"当前状态: {result.get('status')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_rejudge():
    print("\n" + "=" * 60)
    print("测试7: 人工改判")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101001/rejudge"
    data = {
        "operator": "MANAGER001",
        "new_status": "closed",
        "conclusion": "pile_fault",
        "compensation_amount": 50.0,
        "remark": "已完成补偿发放，结案"
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"当前状态: {result.get('status')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_get_operation_logs():
    print("\n" + "=" * 60)
    print("测试8: 查询操作日志（追踪历史）")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101001/logs"
    response = requests.get(url)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"操作记录数: {len(result)}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_query_list():
    print("\n" + "=" * 60)
    print("测试9: 分页查询记录列表")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/"
    params = {
        "user_id": "USER001",
        "page": 1,
        "page_size": 10
    }
    response = requests.get(url, params=params)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"总记录数: {result.get('total')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_get_statistics():
    print("\n" + "=" * 60)
    print("测试10: 获取统计数据")
    print("=" * 60)

    url = f"{BASE_URL}/export/statistics"
    response = requests.get(url)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_export_excel():
    print("\n" + "=" * 60)
    print("测试11: 导出Excel")
    print("=" * 60)

    url = f"{BASE_URL}/export/excel"
    response = requests.get(url)
    print(f"状态码: {response.status_code}")
    print(f"内容类型: {response.headers.get('content-type')}")
    if response.status_code == 200:
        filename = f"export_test_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"文件已保存: {filename}")


def test_check_voucher_after_confirm():
    print("\n" + "=" * 60)
    print("测试12: 确认补偿后自动创建补偿券")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101002"
    response = requests.get(url)
    print(f"状态码: {response.status_code}")
    result = response.json()
    voucher = result.get('voucher')
    if voucher:
        print(f"补偿券编号: {voucher.get('voucher_no')}")
        print(f"补偿券金额: {voucher.get('amount')}")
        print(f"补偿券状态: {voucher.get('status')}")
    else:
        print("未找到关联的补偿券")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_query_vouchers():
    print("\n" + "=" * 60)
    print("测试13: 查询补偿券列表")
    print("=" * 60)

    url = f"{BASE_URL}/voucher/"
    params = {
        "user_id": "USER001",
        "page": 1,
        "page_size": 10
    }
    response = requests.get(url, params=params)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"总记录数: {result.get('total')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_use_voucher():
    print("\n" + "=" * 60)
    print("测试14: 核销补偿券")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101002"
    response = requests.get(url)
    result = response.json()
    voucher = result.get('voucher')
    if not voucher:
        print("未找到补偿券，跳过核销测试")
        return

    voucher_no = voucher.get('voucher_no')
    print(f"核销券号: {voucher_no}")

    url = f"{BASE_URL}/voucher/{voucher_no}/use"
    data = {
        "operator": "ADMIN001",
        "remark": "用户线下核销"
    }
    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"券状态: {result.get('status')}")
    print(f"使用时间: {result.get('used_time')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def test_state_machine_validation():
    print("\n" + "=" * 60)
    print("测试15: 状态机校验（非法状态转换应被拒绝）")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101002/cancel"
    params = {
        "operator": "ADMIN001",
        "remark": "测试非法撤回"
    }
    response = requests.post(url, params=params)
    print(f"状态码: {response.status_code}")
    if response.status_code == 400:
        print("✅ 状态机校验生效，非法转换被拒绝")
        result = response.json()
        print(f"错误信息: {result.get('detail')}")
    else:
        print("❌ 状态机校验未生效")
    print()


def test_upload_for_voucher():
    print("\n" + "=" * 60)
    print("准备: 上传新的补偿申请用于券测试")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/upload"
    data = {
        "batch_no": "BATCH20240101002",
        "case_no": "CASE20240101002",
        "user_id": "USER001",
        "pile_no": "PILE-A02",
        "order_no": "ORD20240101002",
        "fault_code": "E002",
        "fault_description": "支付成功但无法充电",
        "description": "测试自动创建补偿券",
        "order": {
            "order_no": "ORD20240101002",
            "user_id": "USER001",
            "pile_no": "PILE-A02",
            "amount": 30.0,
            "pay_time": (datetime.now() - timedelta(hours=1)).isoformat(),
            "pay_status": "paid",
            "start_time": (datetime.now() - timedelta(hours=1)).isoformat(),
            "end_time": datetime.now().isoformat()
        },
        "electricity": {
            "record_no": "ELEC20240101002",
            "order_no": "ORD20240101002",
            "pile_no": "PILE-A02",
            "start_energy": 100.0,
            "end_energy": 100.0,
            "total_energy": 0.0
        }
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"状态: {result.get('status')}")


def test_confirm_for_voucher():
    print("\n" + "=" * 60)
    print("准备: 确认补偿申请")
    print("=" * 60)

    url = f"{BASE_URL}/compensation/CASE20240101002/confirm"
    data = {
        "operator": "ADMIN001",
        "approved": True,
        "conclusion": "pile_fault",
        "compensation_amount": 30.0,
        "remark": "测试自动创券"
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"状态: {result.get('status')}")
    voucher = result.get('voucher')
    if voucher:
        print(f"✅ 自动创建补偿券成功: {voucher.get('voucher_no')}")


if __name__ == "__main__":
    print("充电桩故障补偿 API 测试脚本")
    print("请先确保服务已启动: python main.py")
    print()

    try:
        test_upload_compensation()
        test_duplicate_upload()
        test_query_record()
        test_confirm_approved()
        test_cancel_record()
        test_resubmit()
        test_rejudge()
        test_get_operation_logs()
        test_query_list()
        test_get_statistics()
        test_export_excel()

        test_upload_for_voucher()
        test_confirm_for_voucher()
        test_check_voucher_after_confirm()
        test_query_vouchers()
        test_use_voucher()
        test_state_machine_validation()

        print("\n" + "=" * 60)
        print("所有测试完成!")
        print("=" * 60)
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务:")
        print("  pip install -r requirements.txt")
        print("  python main.py")
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
