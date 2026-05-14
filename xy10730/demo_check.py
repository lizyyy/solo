#!/usr/bin/env python3
"""
健康巡检系统演示脚本
演示如何创建服务、提交健康检查记录等
"""

import requests
import json
import uuid
import time

BASE_URL = "http://localhost:8000"


def create_service(name, description="演示服务", service_type="web", owner="admin"):
    """创建服务"""
    url = f"{BASE_URL}/api/services"
    data = {
        "name": name,
        "description": description,
        "service_type": service_type,
        "status": "online",
        "health_check_url": f"http://{name}.example.com/health",
        "dependencies": {"db": "mysql", "cache": "redis"},
        "owner": owner
    }
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            service = response.json()
            print(f"✅ 服务创建成功: {service['name']} (ID: {service['id']})")
            return service
        else:
            print(f"⚠️  服务可能已存在: {name}")
            # 获取服务列表
            response = requests.get(f"{BASE_URL}/api/services")
            services = response.json()
            for s in services:
                if s['name'] == name:
                    return s
    except Exception as e:
        print(f"❌ 创建服务失败: {e}")
    return None


def create_health_check(service_id, request_id=None, success=True, errors=None):
    """创建健康检查记录"""
    url = f"{BASE_URL}/api/health-check"
    if request_id is None:
        request_id = str(uuid.uuid4())
    
    probe_result = {
        "success": success,
        "status_code": 200 if success else 500,
        "response_time_ms": 150 if success else 30000,
        "errors": errors or []
    }
    
    dependency_result = {
        "success": success,
        "dependencies": {
            "db": {"status": "up" if success else "down", "response_time_ms": 10},
            "cache": {"status": "up" if success else "down", "response_time_ms": 5}
        }
    }
    
    data = {
        "service_id": service_id,
        "request_id": request_id,
        "probe_result": probe_result,
        "dependency_check_result": dependency_result
    }
    
    try:
        response = requests.post(url, json=data)
        record = response.json()
        print(f"✅ 巡检记录创建: 健康状态={record['health_status']}, 检查状态={record['check_status']}, 重试次数={record['retry_count']}")
        return record
    except Exception as e:
        print(f"❌ 创建巡检记录失败: {e}")
    return None


def get_health_records(service_id=None):
    """获取巡检记录"""
    url = f"{BASE_URL}/api/health-records"
    params = {}
    if service_id:
        params['service_id'] = service_id
    
    try:
        response = requests.get(url, params=params)
        result = response.json()
        records = result['data']['records']
        print(f"\n📊 共找到 {len(records)} 条巡检记录:")
        for r in records:
            print(f"  - ID: {r['id']}, 服务ID: {r['service_id']}, 健康状态: {r['health_status']}, 检查状态: {r['check_status']}")
        return records
    except Exception as e:
        print(f"❌ 获取巡检记录失败: {e}")
    return None


def review_record(record_id, reviewer, check_status=None):
    """复核记录"""
    url = f"{BASE_URL}/api/health-records/{record_id}/review"
    data = {
        "reviewed_by": reviewer,
        "review_comment": "已人工复核，确认故障属实",
        "check_status": check_status or "intercepted"
    }
    
    try:
        response = requests.post(url, json=data)
        record = response.json()
        print(f"✅ 复核完成: 复核人={record['reviewed_by']}, 已复核={record['reviewed']}")
        return record
    except Exception as e:
        print(f"❌ 复核失败: {e}")
    return None


def confirm_recovery(record_id, confirmer):
    """确认恢复"""
    url = f"{BASE_URL}/api/health-records/{record_id}/confirm-recovery"
    data = {
        "confirmed_by": confirmer,
        "review_comment": "故障已修复，服务恢复正常"
    }
    
    try:
        response = requests.post(url, json=data)
        record = response.json()
        print(f"✅ 恢复确认完成: 确认人={record['confirmed_by']}, 已恢复确认={record['recovery_confirmed']}")
        return record
    except Exception as e:
        print(f"❌ 恢复确认失败: {e}")
    return None


def get_statistics():
    """获取统计数据"""
    url = f"{BASE_URL}/api/statistics"
    try:
        response = requests.get(url)
        result = response.json()
        stats = result['data']
        print(f"\n📈 系统统计:")
        print(f"  - 服务总数: {stats['total_services']}")
        print(f"  - 健康状态分布: {stats['health_status_stats']}")
        print(f"  - 检查状态分布: {stats['check_status_stats']}")
        print(f"  - 待复核数量: {stats['pending_review_count']}")
        return stats
    except Exception as e:
        print(f"❌ 获取统计失败: {e}")
    return None


def main():
    print("=" * 50)
    print("内部服务健康巡检系统 - 演示脚本")
    print("=" * 50)
    
    # 检查服务是否启动
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✅ 后端服务运行正常: {response.json()}")
    except Exception:
        print("❌ 后端服务未启动，请先启动后端服务")
        print("   命令: cd backend && uvicorn app.main:app --reload --port 8000")
        return
    
    print("\n" + "-" * 50)
    print("1. 创建演示服务")
    print("-" * 50)
    
    service1 = create_service("order-service", "订单服务")
    service2 = create_service("payment-service", "支付服务")
    service3 = create_service("user-service", "用户服务")
    
    if not service1:
        print("❌ 创建服务失败，退出演示")
        return
    
    print("\n" + "-" * 50)
    print("2. 提交健康检查记录（正常）")
    print("-" * 50)
    create_health_check(service1['id'], success=True)
    
    print("\n" + "-" * 50)
    print("3. 提交健康检查记录（异常-超时）")
    print("-" * 50)
    record_error = create_health_check(
        service2['id'],
        success=False,
        errors=["Connection timeout after 30000ms", "Database connection failed"]
    )
    
    print("\n" + "-" * 50)
    print("4. 演示幂等性 - 重复提交相同request_id")
    print("-" * 50)
    request_id = str(uuid.uuid4())
    create_health_check(service3['id'], request_id=request_id, success=False, errors=["Timeout"])
    print("  重复提交...")
    create_health_check(service3['id'], request_id=request_id, success=False, errors=["Timeout"])
    create_health_check(service3['id'], request_id=request_id, success=False, errors=["Timeout"])
    
    print("\n" + "-" * 50)
    print("5. 获取所有巡检记录")
    print("-" * 50)
    records = get_health_records()
    
    print("\n" + "-" * 50)
    print("6. 复核异常记录")
    print("-" * 50)
    if record_error:
        review_record(record_error['id'], "张三", "intercepted")
    
    print("\n" + "-" * 50)
    print("7. 确认恢复")
    print("-" * 50)
    if record_error:
        confirm_recovery(record_error['id'], "李四")
    
    print("\n" + "-" * 50)
    print("8. 获取统计数据")
    print("-" * 50)
    get_statistics()
    
    print("\n" + "=" * 50)
    print("🎉 演示完成！")
    print("=" * 50)
    print("\n📝 下一步操作:")
    print("  1. 打开浏览器访问 http://localhost:3000")
    print("  2. 查看巡检记录、进行筛选和导出")
    print("  3. 访问 http://localhost:8000/docs 查看API文档")


if __name__ == "__main__":
    main()
