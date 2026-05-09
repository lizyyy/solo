from database import get_db_context
from models import Permission, PollutantType
from datetime import date, datetime, timedelta
import requests
import json

BASE_URL = "http://127.0.0.1:8000"


def setup_sample_data():
    print("正在创建示例数据...")
    
    with get_db_context() as db:
        existing = db.query(Permission).filter(Permission.permit_no == "PERMIT-2026-001").first()
        if existing:
            print("示例数据已存在，跳过创建")
            return
        
        today = date.today()
        
        p1 = Permission(
            permit_no="PERMIT-2026-001",
            enterprise_name="长江化工有限公司",
            pollutant_type=PollutantType.WATER,
            pollutant_name="化学需氧量(COD)",
            limit_value=50.0,
            limit_unit="mg/L",
            effective_date=today.replace(year=today.year - 1),
            expiry_date=today.replace(year=today.year + 2)
        )
        db.add(p1)
        
        p2 = Permission(
            permit_no="PERMIT-2026-002",
            enterprise_name="东方造纸集团",
            pollutant_type=PollutantType.WATER,
            pollutant_name="氨氮",
            limit_value=5.0,
            limit_unit="mg/L",
            effective_date=today.replace(year=today.year - 1),
            expiry_date=today.replace(year=today.year + 2)
        )
        db.add(p2)
        
        p3 = Permission(
            permit_no="PERMIT-2026-003",
            enterprise_name="蓝天热电有限公司",
            pollutant_type=PollutantType.AIR,
            pollutant_name="二氧化硫",
            limit_value=100.0,
            limit_unit="mg/m³",
            effective_date=today.replace(year=today.year - 1),
            expiry_date=today.replace(year=today.year + 2)
        )
        db.add(p3)
        
        db.commit()
        
    print("示例许可证数据已创建")
    print("\n开始创建检测报告...")
    
    now = datetime.now()
    
    detections = [
        {
            "report_no": "DET-2026-001",
            "permit_no": "PERMIT-2026-001",
            "detection_date": (now - timedelta(days=30)).isoformat(),
            "detection_value": 42.5,
            "detection_unit": "mg/L",
            "lab_name": "市环境监测站",
            "operator": "张三"
        },
        {
            "report_no": "DET-2026-002",
            "permit_no": "PERMIT-2026-001",
            "detection_date": (now - timedelta(days=15)).isoformat(),
            "detection_value": 58.3,
            "detection_unit": "mg/L",
            "lab_name": "市环境监测站",
            "operator": "李四"
        },
        {
            "report_no": "DET-2026-003",
            "permit_no": "PERMIT-2026-002",
            "detection_date": (now - timedelta(days=20)).isoformat(),
            "detection_value": 3.2,
            "detection_unit": "mg/L",
            "lab_name": "市环境监测站",
            "operator": "王五"
        },
        {
            "report_no": "DET-2026-004",
            "permit_no": "PERMIT-2026-002",
            "detection_date": (now - timedelta(days=5)).isoformat(),
            "detection_value": 6.8,
            "detection_unit": "mg/L",
            "lab_name": "市环境监测站",
            "operator": "赵六"
        },
        {
            "report_no": "DET-2026-005",
            "permit_no": "PERMIT-2026-003",
            "detection_date": (now - timedelta(days=10)).isoformat(),
            "detection_value": 125.6,
            "detection_unit": "mg/m³",
            "lab_name": "市环境监测站",
            "operator": "钱七"
        }
    ]
    
    for det in detections:
        response = requests.post(f"{BASE_URL}/api/v1/detection", json=det)
        if response.status_code == 200:
            result = response.json()
            status = "超标!" if result["is_overlimit"] else "合格"
            print(f"  ✓ 导入 {det['report_no']}: {det['detection_value']}{det['detection_unit']} - {status}")
        else:
            print(f"  ✗ 导入失败 {det['report_no']}: {response.text}")
    
    print("\n示例数据创建完成！")
    print("\n" + "="*60)
    print("完整业务流程演示:")
    print("="*60)
    
    print("\n1. 查看超标记录列表:")
    response = requests.get(f"{BASE_URL}/api/v1/overlimit")
    overlimits = response.json()
    for ol in overlimits:
        print(f"   - {ol['enterprise_name']}: {ol['pollutant_name']} 超标 {ol['overlimit_ratio']:.2f}%")
    
    if overlimits:
        first_ol = overlimits[0]
        print(f"\n2. 为超标记录 {first_ol['id']} 创建整改任务:")
        task_data = {
            "overlimit_record_id": first_ol["id"],
            "deadline": (datetime.now() + timedelta(days=15)).isoformat(),
            "rectification_measures": "1. 优化污水处理工艺参数\n2. 增加曝气时间\n3. 定期检查设备运行状态",
            "responsible_person": "王厂长",
            "contact_info": "13800138000"
        }
        response = requests.post(f"{BASE_URL}/api/v1/rectification", json=task_data)
        task = response.json()
        print(f"   ✓ 整改任务已创建: {task['task_no']}")
        
        print(f"\n3. 开始整改 (状态从 pending -> in_progress):")
        response = requests.post(f"{BASE_URL}/api/v1/rectification/{task['id']}/start")
        print(f"   ✓ 整改已开始")
        
        print(f"\n4. 提交整改完成:")
        response = requests.post(f"{BASE_URL}/api/v1/rectification/{task['id']}/submit")
        print(f"   ✓ 整改已提交，等待复查")
        
        print(f"\n5. 创建复查回执:")
        review_data = {
            "rectification_task_id": task["id"],
            "review_date": datetime.now().isoformat(),
            "reviewer": "环境监察支队-李监察",
            "review_organization": "市生态环境局",
            "review_result": True,
            "review_comment": "整改措施落实到位，污水处理设施运行正常",
            "redetection_value": 41.2,
            "redetection_unit": "mg/L",
            "is_qualified": True
        }
        response = requests.post(f"{BASE_URL}/api/v1/review-receipts", json=review_data)
        receipt = response.json()
        print(f"   ✓ 复查通过: {receipt['receipt_no']}")
        
        print(f"\n6. 创建监管报告:")
        supervision_data = {
            "rectification_task_id": task["id"],
            "report_date": datetime.now().isoformat(),
            "reporter": "监察一科",
            "report_organization": "市生态环境局",
            "supervision_content": "现场检查企业污水处理设施运行情况，查阅运维记录",
            "supervision_result": "企业已按要求完成整改，各项整改措施落实到位",
            "suggestion": "建议加强日常运维管理，定期开展自行监测"
        }
        response = requests.post(f"{BASE_URL}/api/v1/supervision-reports", json=supervision_data)
        report = response.json()
        print(f"   ✓ 监管报告已创建: {report['report_no']}")
    
    print("\n" + "="*60)
    print("演示完成！可以通过以下接口查看完整数据:")
    print("="*60)
    print(f"   - 数据追溯: GET {BASE_URL}/api/v1/trace/PERMIT-2026-001")
    print(f"   - 导出超标汇总: GET {BASE_URL}/api/v1/export/overlimit-summary")
    print(f"   - 导出整改清单: GET {BASE_URL}/api/v1/export/rectification-tasks")
    print(f"   - 完整追溯报告: GET {BASE_URL}/api/v1/export/trace/PERMIT-2026-001")
    print(f"   - API 文档: {BASE_URL}/docs")


if __name__ == "__main__":
    setup_sample_data()
