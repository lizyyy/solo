#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"


def print_separator(title=""):
    print(f"\n{'='*60}")
    if title:
        print(f"  {title}")
        print("="*60)


def test_import_visitors():
    print_separator("1. 导入访客CSV数据")
    with open("test_data/visitors.csv", "rb") as f:
        files = {"file": ("visitors.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/import/visitors", files=files, params={"handler": "张主管"})
    result = response.json()
    print(f"总记录数: {result['summary']['total']}")
    print(f"成功导入: {result['summary']['success']} 条")
    print(f"失败记录: {result['summary']['failed']} 条")
    if result['errors']:
        print("错误详情:")
        for err in result['errors']:
            print(f"  - 第{err['line']}行: {err['error']}")
            print(f"    建议: {err['suggestion']}")
    return result


def test_import_plates():
    print_separator("2. 导入临时车牌JSON数据")
    with open("test_data/plates.json", "rb") as f:
        files = {"file": ("plates.json", f, "application/json")}
        response = requests.post(f"{BASE_URL}/import/plates", files=files, params={"handler": "张主管"})
    result = response.json()
    print(f"总记录数: {result['total']}")
    print(f"成功导入: {result['success']} 条")
    print(f"失败记录: {result['failed']} 条")
    return result


def test_import_blacklist():
    print_separator("3. 导入黑名单数据")
    with open("test_data/blacklist.csv", "rb") as f:
        files = {"file": ("blacklist.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/import/blacklist", files=files, params={"handler": "张主管"})
    result = response.json()
    print(f"总记录数: {result['total']}")
    print(f"成功导入: {result['success']} 条")
    print(f"失败记录: {result['failed']} 条")
    return result


def test_verify_normal():
    print_separator("4. 正常访客核验（有预约+有效车牌）")
    response = requests.post(f"{BASE_URL}/verify", params={
        "id_card": "110101199001011234",
        "plate_number": "京A12345",
        "handler": "门岗王"
    })
    result = response.json()
    print(f"是否异常: {result['is_anomaly']}")
    print(f"核验状态: {result['status']}")
    print(f"详情: {result['detail']}")
    print(f"访客信息: {result.get('visitor_info')}")
    return result


def test_verify_blacklist():
    print_separator("5. 黑名单人员核验")
    response = requests.post(f"{BASE_URL}/verify", params={
        "id_card": "110101198001019999",
        "handler": "门岗王"
    })
    result = response.json()
    print(f"是否异常: {result['is_anomaly']}")
    print(f"异常类型: {result['anomaly_type']}")
    print(f"核验状态: {result['status']}")
    print(f"详情: {result['detail']}")
    return result


def test_verify_no_appointment():
    print_separator("6. 无预约人员核验")
    response = requests.post(f"{BASE_URL}/verify", params={
        "name": "陌生人",
        "phone": "13800000000",
        "handler": "门岗王"
    })
    result = response.json()
    print(f"是否异常: {result['is_anomaly']}")
    print(f"异常类型: {result['anomaly_type']}")
    print(f"核验状态: {result['status']}")
    print(f"详情: {result['detail']}")
    return result


def test_verify_expired_plate():
    print_separator("7. 过期车牌核验")
    response = requests.post(f"{BASE_URL}/verify", params={
        "id_card": "110101199005057890",
        "plate_number": "京C11111",
        "handler": "门岗李"
    })
    result = response.json()
    print(f"是否异常: {result['is_anomaly']}")
    print(f"异常类型: {result['anomaly_type']}")
    print(f"核验状态: {result['status']}")
    print(f"详情: {result['detail']}")
    return result


def test_get_import_errors():
    print_separator("8. 查询导入错误记录")
    response = requests.get(f"{BASE_URL}/errors", params={"import_type": "visitor"})
    result = response.json()
    print(f"错误记录总数: {result['total']}")
    for err in result['errors']:
        print(f"  - 文件: {err['source_file']} 第{err['original_line']}行")
        print(f"    原始数据: {err['original_data']}")
        print(f"    错误原因: {err['error_message']}")
        print(f"    修改建议: {err['suggestion']}")
    return result


def test_get_records():
    print_separator("9. 查询核验记录（按操作人筛选）")
    response = requests.get(f"{BASE_URL}/records", params={"handler": "门岗王"})
    result = response.json()
    print(f"记录总数: {result['total']}")
    for r in result['records']:
        print(f"  - [{r['verify_time'][:19]} {r['visitor_name']} {'异常' if r['is_anomaly'] else '正常'} - {r['detail']}")
    return result


def test_get_anomaly_records():
    print_separator("10. 查询异常记录")
    response = requests.get(f"{BASE_URL}/records", params={"is_anomaly": True})
    result = response.json()
    print(f"异常记录总数: {result['total']}")
    anomaly_types = {}
    for r in result['records']:
        anomaly_types[r['anomaly_type']] = anomaly_types.get(r['anomaly_type'], 0) + 1
    print(f"异常类型统计: {anomaly_types}")
    return result


def test_export_records():
    print_separator("11. 导出核验记录CSV")
    response = requests.get(f"{BASE_URL}/records/export")
    filename = f"exported_records_{int(time.time())}.csv"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(response.text)
    print(f"已导出到: {filename}")
    print("内容预览:")
    for i, line in enumerate(response.text.split('\n')[:5]):
        print(f"  {line}")
    return filename


def test_get_stats():
    print_separator("12. 查看统计数据")
    response = requests.get(f"{BASE_URL}/stats")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result


def main():
    print("园区访客核验系统 - 完整流程测试")
    print("请确保服务已启动: python main.py")
    
    try:
        requests.get(f"{BASE_URL}/")
        print("服务连接成功!")
    except:
        print("无法连接到服务，请先运行: python main.py")
        return

    test_import_visitors()
    test_import_plates()
    test_import_blacklist()
    
    test_verify_normal()
    test_verify_blacklist()
    test_verify_no_appointment()
    test_verify_expired_plate()
    
    test_get_import_errors()
    test_get_records()
    test_get_anomaly_records()
    test_export_records()
    test_get_stats()
    
    print_separator("测试完成!")
    print("\n提示:")
    print("  - 重启服务后再次运行测试脚本，历史数据依然存在")
    print("  - 数据库文件: visitor_verification.db")
    print("  - API文档: http://localhost:8000/docs")


if __name__ == "__main__":
    main()
