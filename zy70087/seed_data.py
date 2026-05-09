import requests
import json
from datetime import date, datetime, timedelta

BASE_URL = "http://localhost:8000"

def main():
    print("开始初始化测试数据...")
    
    today = date.today()
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)
    
    elderly_data = [
        {
            "name": "张大爷",
            "id_card": "110101194001011234",
            "gender": "男",
            "birth_date": "1940-01-01",
            "address": "北京市朝阳区幸福小区1号楼101室",
            "phone": "13900139001",
            "family_contact_name": "张伟",
            "family_contact_phone": "13800138001",
            "health_status": "高血压，需定期监测血压",
            "special_needs": "行动不便，需搀扶"
        },
        {
            "name": "李奶奶",
            "id_card": "110101194505052345",
            "gender": "女",
            "birth_date": "1945-05-05",
            "address": "北京市朝阳区幸福小区2号楼202室",
            "phone": "13900139002",
            "family_contact_name": "李芳",
            "family_contact_phone": "13800138002",
            "health_status": "糖尿病，需按时服药",
            "special_needs": "视力不佳"
        },
        {
            "name": "王爷爷",
            "id_card": "110101193812123456",
            "gender": "男",
            "birth_date": "1938-12-12",
            "address": "北京市朝阳区幸福小区3号楼303室",
            "phone": "13900139003",
            "family_contact_name": "王强",
            "family_contact_phone": "13800138003",
            "health_status": "心脏病，需随身携带急救药",
            "special_needs": "需要有人陪同外出"
        }
    ]
    
    elderly_ids = []
    for i, data in enumerate(elderly_data, 1):
        try:
            response = requests.post(f"{BASE_URL}/elderly/", json=data)
            if response.status_code == 200:
                elderly = response.json()
                elderly_ids.append(elderly["id"])
                print(f"✓ 创建老人信息: {elderly['name']} (ID: {elderly['id']})")
            elif response.status_code == 400:
                print(f"⚠ 老人信息已存在: {data['name']}")
                list_response = requests.get(f"{BASE_URL}/elderly/")
                for e in list_response.json():
                    if e["id_card"] == data["id_card"]:
                        elderly_ids.append(e["id"])
                        break
        except Exception as e:
            print(f"✗ 创建老人信息失败: {e}")
    
    print(f"\n共创建/获取 {len(elderly_ids)} 位老人信息")
    
    if not elderly_ids:
        print("错误：没有老人信息，无法继续创建探访计划")
        return
    
    plan_data_list = [
        {
            "elderly_id": elderly_ids[0],
            "plan_date": str(today),
            "plan_time": "09:00",
            "visit_type": "daily_care",
            "caregiver": "赵护工",
            "caregiver_phone": "13700137001",
            "idempotency_key": f"plan_{today}_elderly1_daily",
            "notes": "每日常规探访"
        },
        {
            "elderly_id": elderly_ids[0],
            "plan_date": str(today),
            "plan_time": "14:00",
            "visit_type": "health_check",
            "caregiver": "赵护工",
            "caregiver_phone": "13700137001",
            "idempotency_key": f"plan_{today}_elderly1_health",
            "notes": "健康检查，测量血压"
        },
        {
            "elderly_id": elderly_ids[1],
            "plan_date": str(today),
            "plan_time": "10:00",
            "visit_type": "medication_assistance",
            "caregiver": "钱护工",
            "caregiver_phone": "13700137002",
            "idempotency_key": f"plan_{today}_elderly2_medication",
            "notes": "协助服药"
        },
        {
            "elderly_id": elderly_ids[2],
            "plan_date": str(today),
            "plan_time": "11:00",
            "visit_type": "daily_care",
            "caregiver": "孙护工",
            "caregiver_phone": "13700137003",
            "idempotency_key": f"plan_{today}_elderly3_daily",
            "notes": "每日常规探访"
        },
        {
            "elderly_id": elderly_ids[0],
            "plan_date": str(tomorrow),
            "plan_time": "09:30",
            "visit_type": "psychological_counseling",
            "caregiver": "周社工",
            "caregiver_phone": "13700137004",
            "idempotency_key": f"plan_{tomorrow}_elderly1_psych",
            "notes": "心理疏导"
        }
    ]
    
    plan_ids = []
    for plan_data in plan_data_list:
        try:
            response = requests.post(f"{BASE_URL}/plans/", json=plan_data)
            if response.status_code == 200:
                result = response.json()
                plan = result["plan"]
                plan_ids.append(plan["id"])
                created = result["created"]
                dup_warning = result.get("duplicate_warning", False)
                if created:
                    print(f"✓ 创建探访计划: 计划ID {plan['id']} - {plan['visit_type']}")
                else:
                    print(f"⚠ 计划已存在 (幂等性处理): 计划ID {plan['id']}")
                if dup_warning:
                    print(f"  ⚠ 警告：发现潜在重复任务 {result['duplicate_count']} 个")
        except Exception as e:
            print(f"✗ 创建探访计划失败: {e}")
    
    print(f"\n共创建/获取 {len(plan_ids)} 个探访计划")
    
    if plan_ids:
        print(f"\n演示主流程：完成第一个探访计划的签到和签退...")
        plan1_id = plan_ids[0]
        
        check_in_data = {
            "elderly_id": elderly_ids[0],
            "plan_id": plan1_id,
            "latitude": 39.9042,
            "longitude": 116.4074,
            "location_accuracy": 10.5,
            "caregiver": "赵护工"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/visits/check-in", json=check_in_data)
            if response.status_code == 200:
                result = response.json()
                visit_record = result["visit_record"]
                print(f"✓ 签到成功: 记录ID {visit_record['id']}")
                
                check_out_data = {
                    "check_out_time": datetime.utcnow().isoformat(),
                    "actual_visit_type": "daily_care",
                    "health_condition": "血压正常，精神状态良好",
                    "services_provided": "日常护理，聊天陪伴",
                    "notes": "一切正常"
                }
                
                try:
                    response = requests.post(
                        f"{BASE_URL}/visits/{visit_record['id']}/check-out",
                        params={"operator": "赵护工"},
                        json=check_out_data
                    )
                    if response.status_code == 200:
                        print(f"✓ 签退成功")
                    else:
                        print(f"✗ 签退失败: {response.text}")
                except Exception as e:
                    print(f"✗ 签退异常: {e}")
            else:
                print(f"✗ 签到失败: {response.text}")
        except Exception as e:
            print(f"✗ 签到异常: {e}")
    
    print(f"\n演示异常上报流程...")
    if elderly_ids:
        exception_data = {
            "elderly_id": elderly_ids[1],
            "plan_id": plan_ids[2] if len(plan_ids) > 2 else None,
            "exception_type": "elderly_not_at_home",
            "exception_level": "medium",
            "report_time": datetime.utcnow().isoformat(),
            "reported_by": "钱护工",
            "description": "按约定时间上门探访，老人不在家，电话联系不上。邻居称可能去公园了，但不确定何时返回。",
            "location": "幸福小区2号楼楼下",
            "latitude": 39.9050,
            "longitude": 116.4080
        }
        
        try:
            response = requests.post(f"{BASE_URL}/exceptions/", json=exception_data)
            if response.status_code == 200:
                result = response.json()
                exception = result["exception"]
                print(f"✓ 异常上报成功: 异常ID {exception['id']}")
                print(f"  消息: {result['message']}")
                
                resolve_data = {
                    "resolution": "1小时后再次上门，老人已回家。询问后得知老人临时去社区医院取药，未携带手机。已确认老人安全。",
                    "resolved_by": "钱护工"
                }
                
                try:
                    response = requests.post(
                        f"{BASE_URL}/exceptions/{exception['id']}/resolve",
                        json=resolve_data
                    )
                    if response.status_code == 200:
                        print(f"✓ 异常解决成功")
                    else:
                        print(f"✗ 解决异常失败: {response.text}")
                except Exception as e:
                    print(f"✗ 解决异常异常: {e}")
            else:
                print(f"✗ 异常上报失败: {response.text}")
        except Exception as e:
            print(f"✗ 异常上报异常: {e}")
    
    print(f"\n演示补录历史探访记录...")
    if elderly_ids:
        backdate_data = {
            "elderly_id": elderly_ids[2],
            "plan_id": plan_ids[3] if len(plan_ids) > 3 else None,
            "visit_date": str(yesterday),
            "check_in_time": datetime.combine(yesterday, datetime.min.time().replace(hour=11, minute=0)).isoformat(),
            "latitude": 39.9060,
            "longitude": 116.4090,
            "location_accuracy": 15.0,
            "caregiver": "孙护工",
            "actual_visit_type": "daily_care",
            "health_condition": "身体状况良好",
            "services_provided": "协助购买生活用品，打扫卫生",
            "notes": "老人很开心",
            "is_backdated": True,
            "backdated_reason": "系统故障，今日补录昨日探访记录"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/visits/backdate",
                params={"operator": "孙护工"},
                json=backdate_data
            )
            if response.status_code == 200:
                result = response.json()
                print(f"✓ 补录成功: 状态 {result['status']}")
            else:
                print(f"✗ 补录失败: {response.text}")
        except Exception as e:
            print(f"✗ 补录异常: {e}")
    
    print(f"\n查看今日日报...")
    try:
        response = requests.get(f"{BASE_URL}/reports/daily", params={"report_date": str(today)})
        if response.status_code == 200:
            report = response.json()
            print(f"✓ 日报获取成功:")
            print(f"  日期: {report['report_date']}")
            print(f"  总计划数: {report['total_plans']}")
            print(f"  已完成探访: {report['completed_visits']}")
            print(f"  待完成探访: {report['pending_visits']}")
            print(f"  异常总数: {report['total_exceptions']}")
            print(f"  家属通知数: {report['family_notifications_sent']}")
        else:
            print(f"✗ 获取日报失败: {response.text}")
    except Exception as e:
        print(f"✗ 获取日报异常: {e}")
    
    print(f"\n导出业务复核用日报...")
    try:
        response = requests.get(f"{BASE_URL}/reports/export/daily", params={"report_date": str(today)})
        if response.status_code == 200:
            export_data = response.json()
            print(f"✓ 导出成功:")
            print(f"  报表类型: {export_data['report_type']}")
            print(f"  探访完成率: {export_data['summary']['visit_completion_rate']}")
            print(f"  待跟进事项:")
            print(f"    - 待完成探访: {export_data['review_checklist']['pending_visits_to_follow_up']}")
            print(f"    - 待解决异常: {export_data['review_checklist']['pending_exceptions_to_resolve']}")
            
            with open(f"daily_report_{today}.json", "w", encoding="utf-8") as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
            print(f"  已保存到: daily_report_{today}.json")
        else:
            print(f"✗ 导出日报失败: {response.text}")
    except Exception as e:
        print(f"✗ 导出日报异常: {e}")
    
    print(f"\n{'='*60}")
    print("测试数据初始化完成！")
    print(f"{'='*60}")
    print("\n可用API端点:")
    print(f"  Swagger UI: {BASE_URL}/docs")
    print(f"  ReDoc: {BASE_URL}/redoc")
    print("\n推荐操作顺序:")
    print("  1. 创建探访计划 (POST /plans/)")
    print("  2. 签到 (POST /visits/check-in)")
    print("  3. 签退 (POST /visits/{id}/check-out)")
    print("  4. 异常上报 (POST /exceptions/)")
    print("  5. 解决异常 (POST /exceptions/{id}/resolve)")
    print("  6. 查看报表 (GET /reports/daily)")
    print("  7. 查看操作历史 (GET /plans/{id}/history)")

if __name__ == "__main__":
    main()
