import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def demo_full_workflow():
    print("=" * 60)
    print("屋顶热成像漏水API - 完整流程演示")
    print("=" * 60)
    
    print("\n1. 创建屋顶区域...")
    area_data = {
        "name": "A栋屋顶西区域",
        "building": "A栋办公楼",
        "floor": "屋顶层",
        "area_size": 500.0,
        "description": "西侧屋顶，含通风管道区域"
    }
    resp = requests.post(f"{BASE_URL}/roof-areas/", json=area_data)
    roof_area = resp.json()
    print(f"   已创建: {roof_area['name']} (ID: {roof_area['id']})")
    area_id = roof_area['id']
    
    print("\n2. 创建处理人员...")
    handler_data = {
        "username": "zhangong",
        "real_name": "张工",
        "role": "工程师",
        "phone": "13800138001",
        "department": "工程部"
    }
    resp = requests.post(f"{BASE_URL}/handlers/", json=handler_data)
    handler = resp.json()
    print(f"   已创建: {handler['real_name']} ({handler['role']})")
    
    handler2_data = {
        "username": "lixunjian",
        "real_name": "李巡检",
        "role": "巡检员",
        "phone": "13800138002",
        "department": "巡检组"
    }
    resp = requests.post(f"{BASE_URL}/handlers/", json=handler2_data)
    handler2 = resp.json()
    
    print("\n3. 上传第一批原始热成像材料（自动点位归并测试）...")
    material1 = {
        "roof_area_id": area_id,
        "latitude": 31.2304,
        "longitude": 121.4737,
        "position_desc": "西屋顶通风管旁",
        "leak_level": "中度",
        "temperature": 25.5,
        "humidity": 65.0,
        "inspector": "李巡检",
        "inspection_time": datetime.now().isoformat(),
        "equipment_info": "FLIR T1040",
        "weather": "晴",
        "source_batch": "BATCH20240501",
        "notes": "热成像显示明显温差"
    }
    resp = requests.post(f"{BASE_URL}/raw-materials/", json=material1)
    mat1 = resp.json()
    print(f"   材料1: {mat1['material_code']} -> 点位ID: {mat1['inspection_point_id']}")
    
    print("\n4. 上传同一位置的第二张图（应该自动归并到同一点位）...")
    material2 = {
        "roof_area_id": area_id,
        "latitude": 31.23041,
        "longitude": 121.47371,
        "position_desc": "西屋顶通风管旁",
        "leak_level": "严重",
        "temperature": 26.0,
        "humidity": 68.0,
        "inspector": "李巡检",
        "inspection_time": datetime.now().isoformat(),
        "equipment_info": "FLIR T1040",
        "weather": "晴",
        "source_batch": "BATCH20240501",
        "notes": "不同角度拍摄"
    }
    resp = requests.post(f"{BASE_URL}/raw-materials/", json=material2)
    mat2 = resp.json()
    print(f"   材料2: {mat2['material_code']} -> 点位ID: {mat2['inspection_point_id']}")
    
    if mat1['inspection_point_id'] == mat2['inspection_point_id']:
        print("   ✅ 自动归并成功！两个材料归到同一点位")
    else:
        print("   ❌ 归并未触发")
    
    point_id = mat1['inspection_point_id']
    
    print("\n5. 查看巡检点位列表...")
    resp = requests.get(f"{BASE_URL}/inspection-points/")
    points = resp.json()
    for p in points:
        print(f"   点位 {p['point_code']}: 合并次数={p['merge_count']}, 位置={p['position_desc']}")
    
    print("\n6. 创建维修工单...")
    wo_data = {
        "inspection_point_id": point_id,
        "description": "西屋顶通风管渗漏，需尽快处理",
        "priority": 2,
        "deadline": (datetime.now() + timedelta(days=7)).isoformat(),
        "assigned_to": "张工"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/", json=wo_data)
    work_order = resp.json()
    print(f"   工单: {work_order['order_no']}")
    print(f"   当前状态: {work_order['status']}")
    print(f"   当前等级: {work_order['current_level']}")
    wo_id = work_order['id']
    
    print("\n7. 工程师判定等级...")
    judgment_data = {
        "work_order_id": wo_id,
        "judged_level": "严重",
        "judge": "张工",
        "judgment_type": "manual",
        "reason": "现场核实，渗漏面积约2平米",
        "evidence": "现场照片已存档"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/judgment", json=judgment_data)
    judgment = resp.json()
    print(f"   判定: {judgment['previous_level']} -> {judgment['judged_level']}")
    print(f"   判定人: {judgment['judge']}")
    
    print("\n8. 更新工单状态为：已确认待维修...")
    status_data = {
        "work_order_id": wo_id,
        "new_status": "已确认待维修",
        "operator": "张工",
        "reason": "已确认渗漏情况，安排维修"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/status", json=status_data)
    wo_updated = resp.json()
    print(f"   新状态: {wo_updated['status']}")
    
    print("\n9. 更新工单状态为：维修中...")
    status_data2 = {
        "work_order_id": wo_id,
        "new_status": "维修中",
        "operator": "张工",
        "reason": "维修队已进场"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/status", json=status_data2)
    wo_updated = resp.json()
    print(f"   新状态: {wo_updated['status']}")
    
    print("\n10. 更新工单状态为：待复测...")
    status_data3 = {
        "work_order_id": wo_id,
        "new_status": "待复测",
        "operator": "张工",
        "reason": "维修完成，申请复测"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/status", json=status_data3)
    wo_updated = resp.json()
    print(f"   新状态: {wo_updated['status']}")
    
    print("\n11. 提交复测结果...")
    retest_data = {
        "work_order_id": wo_id,
        "retester": "李巡检",
        "result": "维修效果良好，无明显渗漏",
        "temperature": 23.0,
        "humidity": 60.0,
        "description": "复测热成像显示温差已消除",
        "is_passed": True,
        "retest_time": datetime.now().isoformat()
    }
    resp = requests.post(f"{BASE_URL}/work-orders/retest", json=retest_data)
    retest = resp.json()
    print(f"   复测编号: {retest['retest_no']}")
    print(f"   复测结果: {'通过' if retest['is_passed'] else '未通过'}")
    
    print("\n12. 查看审计日志（等级变更）...")
    resp = requests.get(f"{BASE_URL}/audit-logs/", params={"work_order_id": wo_id})
    audits = resp.json()
    for a in audits:
        print(f"   {a['operation_time']}: {a['action_type']} - {a['old_value']} -> {a['new_value']} ({a['operator']})")
    
    print("\n13. 查看工单完整详情...")
    resp = requests.get(f"{BASE_URL}/work-orders/{wo_id}")
    detail = resp.json()
    print(f"   状态流转次数: {len(detail['status_transitions'])}")
    print(f"   判定记录数: {len(detail['judgments'])}")
    print(f"   复测记录数: {len(detail['retests'])}")
    print(f"   关联材料数: {len(detail['materials'])}")
    
    print("\n14. 查看统计数据...")
    resp = requests.get(f"{BASE_URL}/statistics/summary")
    stats = resp.json()
    print(f"   总点数: {stats['total_points']}")
    print(f"   总材料数: {stats['total_materials']}")
    print(f"   总工单数: {stats['total_work_orders']}")
    print(f"   已归并点数: {stats['merged_points']}")
    print(f"   待复测数: {stats['pending_retest_count']}")
    
    print("\n15. 导出报告测试...")
    export_data = {
        "roof_area_id": area_id
    }
    resp = requests.post(f"{BASE_URL}/reports/export", json=export_data)
    if resp.status_code == 200:
        print("   ✅ 报告导出成功！")
    else:
        print(f"   报告导出状态: {resp.status_code}")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)
    print(f"\nAPI文档地址: {BASE_URL}/docs")
    print(f"数据库文件: roof_inspection.db")


if __name__ == "__main__":
    try:
        demo_full_workflow()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请先运行: python main.py")
    except Exception as e:
        print(f"❌ 出错: {e}")
        import traceback
        traceback.print_exc()
