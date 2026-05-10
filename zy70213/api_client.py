#!/usr/bin/env python3
"""
动物园饲料日配系统 - API 调用脚本

直接通过 HTTP 调用 API，模拟客户端操作
"""

import sys
import json
import requests
from datetime import date

BASE_URL = "http://localhost:8000"


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_response(label, response):
    print(f"\n{label}:")
    print(f"  状态码: {response.status_code}")
    try:
        data = response.json()
        print(f"  响应体:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return data
    except:
        print(f"  响应体: {response.text}")
        return None


def check_api_health():
    print_header("1. 检查 API 健康状态")
    resp = requests.get(f"{BASE_URL}/health")
    data = print_response("健康检查", resp)
    if data and data.get("status") == "healthy":
        print("✅ API 服务正常")
        return True
    else:
        print("❌ API 服务异常，请确认服务已启动")
        return False


def create_animal():
    print_header("2. 创建动物档案")
    animal_data = {
        "name": "圆圆",
        "species": "大熊猫",
        "age_years": 7,
        "weight_kg": 110,
        "health_status": "healthy",
        "status": "active",
        "area": "熊猫馆A区",
        "last_checkup_date": "2026-03-15"
    }
    print(f"请求数据: {json.dumps(animal_data, ensure_ascii=False)}")
    resp = requests.post(f"{BASE_URL}/animals", json=animal_data)
    data = print_response("创建动物", resp)
    return data.get("id") if data else None


def get_animals():
    print_header("3. 查看所有动物")
    resp = requests.get(f"{BASE_URL}/animals")
    data = print_response("动物列表", resp)
    return data


def get_formulas():
    print_header("4. 查看所有饲料配方")
    resp = requests.get(f"{BASE_URL}/formulas")
    data = print_response("配方列表", resp)
    return data


def generate_ration(animal_id, ration_date):
    print_header("5. 生成日配计划")
    ration_data = {
        "animal_id": animal_id,
        "ration_date": ration_date.isoformat(),
        "created_by": "api_test"
    }
    print(f"请求数据: {json.dumps(ration_data, ensure_ascii=False)}")
    resp = requests.post(f"{BASE_URL}/rations/generate", json=ration_data)
    data = print_response("生成日配", resp)
    return data.get("id") if data else None


def validate_ration(ration_id):
    print_header("6. 验证日配计划")
    resp = requests.post(f"{BASE_URL}/rations/{ration_id}/validate")
    data = print_response("验证日配", resp)
    return data


def confirm_ration(ration_id):
    print_header("7. 确认日配计划")
    resp = requests.post(f"{BASE_URL}/rations/{ration_id}/confirm")
    data = print_response("确认日配", resp)
    return data


def execute_ration(ration_id):
    print_header("8. 执行日配计划")
    resp = requests.post(f"{BASE_URL}/rations/{ration_id}/execute")
    data = print_response("执行日配", resp)
    return data


def get_ration_verifications(ration_id):
    print_header("9. 查看日配验证详情")
    resp = requests.get(f"{BASE_URL}/rations/{ration_id}/verifications")
    data = print_response("验证详情", resp)
    return data


def main():
    print("\n" + "#" * 70)
    print("#" + "           动物园饲料日配系统 - API 调用演示".center(66) + "#")
    print("#" * 70)

    if not check_api_health():
        print("\n请先启动服务器: python main.py")
        return 1

    animals = get_animals()
    if not animals or len(animals) == 0:
        animal_id = create_animal()
    else:
        animal_id = animals[0]["id"]
        print(f"使用已有动物: {animals[0]['name']} (ID: {animal_id})")

    get_formulas()

    today = date.today()
    ration_id = generate_ration(animal_id, today)

    if ration_id:
        validate_ration(ration_id)
        confirm_ration(ration_id)
        execute_ration(ration_id)
        get_ration_verifications(ration_id)

    print_header("API 调用演示完成")
    print("""
可用 API 端点:
  GET    /health                           - 健康检查
  GET    /animals                          - 动物列表
  POST   /animals                          - 创建动物
  GET    /animals/{id}                     - 获取动物详情
  GET    /formulas                         - 配方列表
  POST   /formulas                         - 创建配方
  GET    /inventories                      - 库存列表
  POST   /inventories                      - 创建库存
  POST   /correction-rules                 - 创建健康修正规则
  POST   /rations/generate                 - 生成日配计划
  POST   /rations/{id}/validate            - 验证日配计划
  POST   /rations/{id}/confirm             - 确认日配计划
  POST   /rations/{id}/execute             - 执行日配计划
  POST   /rations/{id}/retry               - 重跑失败的日配计划
  GET    /rations/{id}                     - 获取日配详情
  GET    /rations/date/{date}              - 按日期查询日配
  GET    /rations/{id}/verifications       - 获取验证详情
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
