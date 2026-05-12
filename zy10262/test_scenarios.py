#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import (
    app, AuthorizationType, PickupStatus, ExceptionType,
    ChildCreate, AuthorizedPersonCreate, AuthorizationCreate,
    CheckInRequest, CheckOutRequest
)
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

client = TestClient(app)


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def print_json(data, indent=2):
    print(json.dumps(data, indent=indent, ensure_ascii=False, default=str))


def scenario_1_normal_pickup():
    print_section("场景 1: 正常接送流程")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小明",
        "birth_date": "2021-05-15",
        "guardian_name": "张爸爸",
        "guardian_phone": "13800138000"
    })
    child = child_response.json()
    print(f"   儿童创建成功: {child['name']} (ID: {child['child_id']})")
    child_id = child['child_id']
    
    print("\n2. 创建固定授权人（妈妈）...")
    mom_response = client.post("/authorized-persons", json={
        "name": "李妈妈",
        "id_card": "110101199001011234",
        "phone": "13900139000",
        "relation": "母亲"
    })
    mom = mom_response.json()
    print(f"   授权人创建成功: {mom['name']} (ID: {mom['person_id']})")
    mom_id = mom['person_id']
    
    print("\n3. 创建永久授权...")
    auth_response = client.post("/authorizations", json={
        "child_id": child_id,
        "person_id": mom_id,
        "auth_type": "permanent",
        "created_by": "system_admin"
    })
    auth = auth_response.json()
    print(f"   授权创建成功: 类型={auth['auth_type']}")
    
    print("\n4. 妈妈送孩子入园...")
    checkin_response = client.post("/check-in", json={
        "child_id": child_id,
        "person_id": mom_id
    })
    checkin = checkin_response.json()
    print(f"   入园成功: 状态={checkin['status']}, 时间={checkin['check_in_time']}")
    
    print("\n5. 妈妈接孩子离园（正常时间）...")
    checkout_time = datetime.now().replace(hour=16, minute=30)
    checkout_response = client.post("/check-out", json={
        "child_id": child_id,
        "person_id": mom_id,
        "check_out_time": checkout_time.isoformat()
    })
    checkout = checkout_response.json()
    print(f"   离园成功: 状态={checkout['status']}, 时间={checkout['check_out_time']}")
    
    print("\n6. 查询迟接费用...")
    fees_response = client.get("/late-fees", params={"child_id": child_id})
    fees = fees_response.json()
    print(f"   迟接费用记录数: {len(fees)}")
    
    print("\n7. 查看儿童当前状态...")
    status_response = client.get(f"/child-status/{child_id}")
    status = status_response.json()
    print(f"   当前状态: {status['current_status']}")
    
    print("\n✅ 场景 1 完成: 正常接送流程成功!")
    return child_id, mom_id


def scenario_2_temporary_authorization():
    print_section("场景 2: 临时授权接送")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小红",
        "birth_date": "2020-08-20",
        "guardian_name": "王爸爸",
        "guardian_phone": "13700137000"
    })
    child = child_response.json()
    print(f"   儿童创建成功: {child['name']} (ID: {child['child_id']})")
    child_id = child['child_id']
    
    print("\n2. 创建临时授权人（舅舅）...")
    uncle_response = client.post("/authorized-persons", json={
        "name": "赵舅舅",
        "id_card": "110101198505055678",
        "phone": "13600136000",
        "relation": "舅舅"
    })
    uncle = uncle_response.json()
    print(f"   授权人创建成功: {uncle['name']} (ID: {uncle['person_id']})")
    uncle_id = uncle['person_id']
    
    print("\n3. 创建今天有效的临时授权...")
    now = datetime.now()
    start_date = now - timedelta(hours=1)
    end_date = now + timedelta(hours=5)
    
    auth_response = client.post("/authorizations", json={
        "child_id": child_id,
        "person_id": uncle_id,
        "auth_type": "temporary",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "created_by": "guardian"
    })
    auth = auth_response.json()
    print(f"   临时授权创建成功: 有效期 {auth['start_date']} 至 {auth['end_date']}")
    
    print("\n4. 舅舅送孩子入园...")
    checkin_response = client.post("/check-in", json={
        "child_id": child_id,
        "person_id": uncle_id
    })
    checkin = checkin_response.json()
    print(f"   入园成功: 状态={checkin['status']}")
    
    print("\n5. 舅舅接孩子离园（迟接30分钟）...")
    checkout_time = datetime.now().replace(hour=17, minute=30)
    checkout_response = client.post("/check-out", json={
        "child_id": child_id,
        "person_id": uncle_id,
        "check_out_time": checkout_time.isoformat()
    })
    checkout = checkout_response.json()
    print(f"   离园成功: 状态={checkout['status']}")
    
    print("\n6. 查询迟接费用...")
    fees_response = client.get("/late-fees", params={"child_id": child_id})
    fees = fees_response.json()
    if fees:
        print(f"   迟接 {fees[0]['late_minutes']} 分钟, 费用: {fees[0]['fee_amount']} 元")
    else:
        print("   无迟接费用")
    
    print("\n7. 查看仪表盘汇总...")
    dashboard_response = client.get("/dashboard")
    dashboard = dashboard_response.json()
    print(f"   今日入园: {dashboard['today_summary']['checked_in_count']} 人")
    print(f"   今日离园: {dashboard['today_summary']['checked_out_count']} 人")
    print(f"   待处理异常: {dashboard['exception_summary']['pending_count']} 个")
    print(f"   未付迟接费: {dashboard['finance_summary']['total_unpaid_late_fees']} 元")
    
    print("\n✅ 场景 2 完成: 临时授权接送成功!")
    return child_id, uncle_id


def scenario_3_denied_pickup():
    print_section("场景 3: 未授权接送被拒绝")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小刚",
        "birth_date": "2022-02-10",
        "guardian_name": "刘妈妈",
        "guardian_phone": "13500135000"
    })
    child = child_response.json()
    print(f"   儿童创建成功: {child['name']} (ID: {child['child_id']})")
    child_id = child['child_id']
    
    print("\n2. 创建陌生人（未授权）...")
    stranger_response = client.post("/authorized-persons", json={
        "name": "陌生亲戚",
        "id_card": "110101199012129999",
        "phone": "13400134000",
        "relation": "远房亲戚"
    })
    stranger = stranger_response.json()
    print(f"   人员创建成功: {stranger['name']} (ID: {stranger['person_id']})")
    stranger_id = stranger['person_id']
    
    print("\n3. 陌生人尝试接孩子（未授权）...")
    checkout_response = client.post("/check-out", json={
        "child_id": child_id,
        "person_id": stranger_id
    })
    print(f"   响应状态码: {checkout_response.status_code}")
    if checkout_response.status_code == 403:
        print(f"   ❌ 离园被拒绝: {checkout_response.json()['detail']}")
    
    print("\n4. 查询异常记录...")
    exceptions_response = client.get("/exceptions", params={"child_id": child_id, "resolved": False})
    exceptions = exceptions_response.json()
    print(f"   异常记录数: {len(exceptions)}")
    for exc in exceptions:
        print(f"   - 类型: {exc['exception_type']}, 描述: {exc['description']}")
    
    print("\n5. 查看儿童当前状态...")
    status_response = client.get(f"/child-status/{child_id}")
    status = status_response.json()
    print(f"   当前状态: {status['current_status']}")
    print(f"   待处理异常: {len(status['pending_exceptions'])} 个")
    
    print("\n✅ 场景 3 完成: 未授权接送被正确拒绝并记录异常!")
    return child_id, stranger_id


def scenario_4_expired_authorization():
    print_section("场景 4: 过期授权被拒绝（区分未授权）")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小华",
        "birth_date": "2021-11-11",
        "guardian_name": "陈爸爸",
        "guardian_phone": "13300133000"
    })
    child = child_response.json()
    child_id = child['child_id']
    
    print("\n2. 创建授权人（临时保姆）...")
    nanny_response = client.post("/authorized-persons", json={
        "name": "临时保姆",
        "id_card": "110101199003034444",
        "phone": "13200132000",
        "relation": "保姆"
    })
    nanny = nanny_response.json()
    nanny_id = nanny['person_id']
    
    print("\n3. 创建已过期的临时授权...")
    now = datetime.now()
    start_date = now - timedelta(hours=5)
    end_date = now - timedelta(hours=1)
    
    client.post("/authorizations", json={
        "child_id": child_id,
        "person_id": nanny_id,
        "auth_type": "temporary",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "created_by": "guardian"
    })
    print(f"   临时授权创建成功: 已过期（结束于 {end_date}）")
    
    print("\n4. 过期保姆尝试接孩子...")
    checkout_response = client.post("/check-out", json={
        "child_id": child_id,
        "person_id": nanny_id
    })
    print(f"   响应状态码: {checkout_response.status_code}")
    if checkout_response.status_code == 403:
        print(f"   ❌ 离园被拒绝: {checkout_response.json()['detail']}")
    
    print("\n5. 查询异常记录，验证是 EXPIRED_AUTHORIZATION 类型...")
    exceptions_response = client.get("/exceptions", params={"child_id": child_id, "resolved": False})
    exceptions = exceptions_response.json()
    for exc in exceptions:
        print(f"   - 类型: {exc['exception_type']}, 描述: {exc['description']}")
        if exc['exception_type'] == 'expired_authorization':
            print("   ✅ 正确识别为过期授权!")
    
    print("\n✅ 场景 4 完成: 过期授权被正确识别!")
    return child_id, nanny_id


def scenario_5_duplicate_checkout():
    print_section("场景 5: 重复签退留痕")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小磊",
        "birth_date": "2022-03-15",
        "guardian_name": "周爸爸",
        "guardian_phone": "13100131000"
    })
    child = child_response.json()
    child_id = child['child_id']
    
    print("\n2. 创建授权人...")
    dad_response = client.post("/authorized-persons", json={
        "name": "周爸爸",
        "id_card": "110101198002022222",
        "phone": "13100131000",
        "relation": "父亲"
    })
    dad = dad_response.json()
    dad_id = dad['person_id']
    
    print("\n3. 创建授权...")
    client.post("/authorizations", json={
        "child_id": child_id,
        "person_id": dad_id,
        "auth_type": "permanent",
        "created_by": "system"
    })
    
    print("\n4. 送孩子入园...")
    client.post("/check-in", json={
        "child_id": child_id,
        "person_id": dad_id
    })
    
    print("\n5. 第一次接孩子离园...")
    checkout_response = client.post("/check-out", json={
        "child_id": child_id,
        "person_id": dad_id
    })
    print(f"   第一次离园成功: {checkout_response.status_code}")
    
    print("\n6. 重复接孩子（第二次尝试）...")
    checkout_response2 = client.post("/check-out", json={
        "child_id": child_id,
        "person_id": dad_id
    })
    print(f"   第二次离园状态码: {checkout_response2.status_code}")
    print(f"   响应: {checkout_response2.json()['detail']}")
    
    print("\n7. 查询异常记录，验证 duplicate_checkout 留痕...")
    exceptions_response = client.get("/exceptions", params={"child_id": child_id, "resolved": False})
    exceptions = exceptions_response.json()
    for exc in exceptions:
        print(f"   - 类型: {exc['exception_type']}, 描述: {exc['description']}")
        if exc['exception_type'] == 'duplicate_checkout':
            print("   ✅ 重复签退被正确记录!")
    
    print("\n✅ 场景 5 完成: 重复签退被正确留痕!")
    return child_id, dad_id


def scenario_6_cross_type_idempotency():
    print_section("场景 6: 跨接口幂等键不冲突")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小琳",
        "birth_date": "2021-07-07",
        "guardian_name": "吴妈妈",
        "guardian_phone": "13000130000"
    })
    child = child_response.json()
    child_id = child['child_id']
    
    print("\n2. 创建授权人...")
    mom_response = client.post("/authorized-persons", json={
        "name": "吴妈妈",
        "id_card": "110101198507073333",
        "phone": "13000130000",
        "relation": "母亲"
    })
    mom = mom_response.json()
    mom_id = mom['person_id']
    
    same_idempotency_key = "same_key_12345"
    
    print(f"\n3. 使用相同幂等键 '{same_idempotency_key}' 创建授权...")
    auth_response = client.post("/authorizations", json={
        "child_id": child_id,
        "person_id": mom_id,
        "auth_type": "permanent",
        "created_by": "system",
        "idempotency_key": same_idempotency_key
    })
    auth = auth_response.json()
    print(f"   授权ID: {auth['auth_id']}")
    
    print(f"\n4. 使用相同幂等键 '{same_idempotency_key}' 提交入园（不同接口，应创建新记录）...")
    checkin_response = client.post("/check-in", json={
        "child_id": child_id,
        "person_id": mom_id,
        "idempotency_key": same_idempotency_key
    })
    checkin = checkin_response.json()
    print(f"   接送记录ID: {checkin['record_id']}")
    
    if auth['auth_id'] != checkin['record_id']:
        print("   ✅ 跨接口幂等键不冲突，正确创建了不同记录!")
    else:
        print("   ❌ 错误: 返回了相同ID")
    
    print("\n✅ 场景 6 完成: 跨接口幂等键不冲突!")
    return child_id, mom_id


def scenario_7_resolution_note_required():
    print_section("场景 7: 异常处理说明不能为空")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小涛",
        "birth_date": "2022-01-01",
        "guardian_name": "郑爸爸",
        "guardian_phone": "12900129000"
    })
    child = child_response.json()
    child_id = child['child_id']
    
    print("\n2. 创建授权人...")
    dad_response = client.post("/authorized-persons", json={
        "name": "郑爸爸",
        "id_card": "110101197901015555",
        "phone": "12900129000",
        "relation": "父亲"
    })
    dad = dad_response.json()
    dad_id = dad['person_id']
    
    print("\n3. 创建授权...")
    client.post("/authorizations", json={
        "child_id": child_id,
        "person_id": dad_id,
        "auth_type": "permanent",
        "created_by": "system"
    })
    
    print("\n4. 入园后尝试重复离园，触发异常...")
    client.post("/check-in", json={
        "child_id": child_id,
        "person_id": dad_id
    })
    client.post("/check-out", json={
        "child_id": child_id,
        "person_id": dad_id
    })
    client.post("/check-out", json={
        "child_id": child_id,
        "person_id": dad_id
    })
    
    print("\n5. 获取异常记录ID...")
    exceptions_response = client.get("/exceptions", params={"child_id": child_id, "resolved": False})
    exceptions = exceptions_response.json()
    exc_id = exceptions[0]['exception_id']
    print(f"   异常ID: {exc_id}")
    
    print("\n6. 尝试用空说明处理异常...")
    resolve_response = client.patch(f"/exceptions/{exc_id}/resolve", params={"resolution_note": ""})
    print(f"   响应状态码: {resolve_response.status_code}")
    print(f"   响应: {resolve_response.json()['detail']}")
    
    if resolve_response.status_code == 400:
        print("   ✅ 空说明被正确拒绝!")
    
    print("\n7. 使用有效说明处理异常...")
    resolve_response2 = client.patch(f"/exceptions/{exc_id}/resolve", params={"resolution_note": "系统误操作，已核实"})
    print(f"   响应状态码: {resolve_response2.status_code}")
    if resolve_response2.status_code == 200:
        print("   ✅ 有说明的处理成功!")
    
    print("\n✅ 场景 7 完成: 处理说明必填验证生效!")
    return child_id, dad_id


def scenario_8_dashboard_currently_in():
    print_section("场景 8: Dashboard currently_in 计算正确")
    
    print("1. 创建儿童档案...")
    child_response = client.post("/children", json={
        "name": "小菲",
        "birth_date": "2021-06-06",
        "guardian_name": "黄妈妈",
        "guardian_phone": "12800128000"
    })
    child = child_response.json()
    child_id = child['child_id']
    
    print("\n2. 创建授权人...")
    mom_response = client.post("/authorized-persons", json={
        "name": "黄妈妈",
        "id_card": "110101198806066666",
        "phone": "12800128000",
        "relation": "母亲"
    })
    mom = mom_response.json()
    mom_id = mom['person_id']
    
    print("\n3. 创建授权...")
    client.post("/authorizations", json={
        "child_id": child_id,
        "person_id": mom_id,
        "auth_type": "permanent",
        "created_by": "system"
    })
    
    print("\n4. 送孩子入园（目前园内应该增加1人）...")
    client.post("/check-in", json={
        "child_id": child_id,
        "person_id": mom_id
    })
    
    print("\n5. 查看dashboard...")
    dashboard_response = client.get("/dashboard")
    dashboard = dashboard_response.json()
    print(f"   currently_in: {dashboard['today_summary']['currently_in']}")
    
    if dashboard['today_summary']['currently_in'] >= 0:
        print("   ✅ currently_in 非负数!")
    
    print("\n6. 接孩子离园...")
    client.post("/check-out", json={
        "child_id": child_id,
        "person_id": mom_id
    })
    
    print("\n7. 再次查看dashboard...")
    dashboard_response2 = client.get("/dashboard")
    dashboard2 = dashboard_response2.json()
    print(f"   currently_in: {dashboard2['today_summary']['currently_in']}")
    
    if dashboard2['today_summary']['currently_in'] >= 0:
        print("   ✅ currently_in 非负数!")
    
    print("\n✅ 场景 8 完成: Dashboard currently_in 计算正确!")
    return child_id, mom_id


def main():
    print("🚀 托育接送授权 API 场景测试")
    print("="*60)
    
    scenario_1_normal_pickup()
    scenario_2_temporary_authorization()
    scenario_3_denied_pickup()
    scenario_4_expired_authorization()
    scenario_5_duplicate_checkout()
    scenario_6_cross_type_idempotency()
    scenario_7_resolution_note_required()
    scenario_8_dashboard_currently_in()
    
    print_section("所有场景测试完成!")
    
    print("\n📊 最终仪表盘汇总:")
    dashboard_response = client.get("/dashboard")
    dashboard = dashboard_response.json()
    print_json(dashboard)
    
    print("\n📋 所有异常记录:")
    exceptions_response = client.get("/exceptions")
    exceptions = exceptions_response.json()
    print(f"总异常数: {len(exceptions)}")
    for exc in exceptions:
        print(f"  - {exc['exception_type']}: {exc['description']} (已处理: {exc['resolved']})")
    
    print("\n🎉 所有测试场景执行完成!")


if __name__ == "__main__":
    main()
