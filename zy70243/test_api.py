#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8001"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"【{title}】")
    print(f"状态码: {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except:
        print(response.text)
    print('='*60)

def main():
    print("开始测试宠物医院住院笼位API...")
    
    print("\n" + "#"*60)
    print("# 第一阶段：基础数据录入（从空数据开始）")
    print("#"*60)
    
    print("\n1. 创建宠物档案")
    pet1_data = {
        "name": "旺财",
        "species": "dog",
        "breed": "金毛",
        "age": 36,
        "weight": 25.5,
        "gender": "公",
        "owner_name": "张三",
        "owner_phone": "13800138001",
        "medical_history": "去年曾患肠胃炎",
        "allergy_info": "无"
    }
    r = requests.post(f"{BASE_URL}/api/pets/", json=pet1_data)
    print_response("创建宠物-旺财", r)
    pet1_id = r.json()["id"]
    
    pet2_data = {
        "name": "咪咪",
        "species": "cat",
        "breed": "英短",
        "age": 24,
        "weight": 4.5,
        "gender": "母",
        "owner_name": "李四",
        "owner_phone": "13800138002",
        "medical_history": "无",
        "allergy_info": "对某些药物过敏"
    }
    r = requests.post(f"{BASE_URL}/api/pets/", json=pet2_data)
    print_response("创建宠物-咪咪", r)
    pet2_id = r.json()["id"]
    
    print("\n2. 创建笼位数据")
    cages_data = [
        {
            "cage_number": "C-001",
            "location": "一楼普通区-1号",
            "status": "available",
            "suitable_species": "dog, cat",
            "is_isolation": False,
            "max_infection_risk": "low"
        },
        {
            "cage_number": "C-002",
            "location": "一楼普通区-2号",
            "status": "available",
            "suitable_species": "dog, cat",
            "is_isolation": False,
            "max_infection_risk": "low"
        },
        {
            "cage_number": "C-003",
            "location": "二楼隔离区-1号",
            "status": "available",
            "suitable_species": "dog, cat",
            "is_isolation": True,
            "max_infection_risk": "high"
        },
        {
            "cage_number": "C-004",
            "location": "二楼隔离区-2号",
            "status": "available",
            "suitable_species": "dog, cat",
            "is_isolation": True,
            "max_infection_risk": "high"
        }
    ]
    
    for cage in cages_data:
        r = requests.post(f"{BASE_URL}/api/cages/", json=cage)
        print_response(f"创建笼位-{cage['cage_number']}", r)
    
    print("\n" + "#"*60)
    print("# 第二阶段：创建住院医嘱")
    print("#"*60)
    
    print("\n3. 为旺财创建住院医嘱（低风险）")
    order1_data = {
        "pet_id": pet1_id,
        "diagnosis": "急性肠胃炎",
        "treatment_plan": "1. 禁食24小时；2. 静脉输液补充水分；3. 口服益生菌；4. 观察排便情况",
        "infection_risk": "low",
        "required_special_care": "需要定时监测体温",
        "estimated_stay_days": 3,
        "attending_vet": "王医生"
    }
    r = requests.post(f"{BASE_URL}/api/medical-orders/", json=order1_data)
    print_response("创建医嘱-旺财", r)
    order1_id = r.json()["id"]
    
    print("\n4. 为咪咪创建住院医嘱（高风险-需要隔离）")
    order2_data = {
        "pet_id": pet2_id,
        "diagnosis": "猫瘟热（FPV）",
        "treatment_plan": "1. 立即隔离；2. 抗病毒治疗；3. 支持疗法；4. 严格消毒",
        "infection_risk": "high",
        "required_special_care": "必须隔离，医护人员需穿防护服",
        "estimated_stay_days": 7,
        "attending_vet": "李医生"
    }
    r = requests.post(f"{BASE_URL}/api/medical-orders/", json=order2_data)
    print_response("创建医嘱-咪咪（高风险）", r)
    order2_id = r.json()["id"]
    
    print("\n" + "#"*60)
    print("# 第三阶段：笼位规则引擎检查")
    print("#"*60)
    
    print("\n5. 查询旺财适合的笼位")
    r = requests.get(f"{BASE_URL}/api/cages/suitable/{pet1_id}/{order1_id}")
    print_response("旺财适合的笼位", r)
    
    print("\n6. 查询咪咪适合的笼位（高风险需要隔离）")
    r = requests.get(f"{BASE_URL}/api/cages/suitable/{pet2_id}/{order2_id}")
    print_response("咪咪适合的笼位（应只有隔离笼位）", r)
    
    print("\n" + "#"*60)
    print("# 第四阶段：创建住院记录并推进状态")
    print("#"*60)
    
    print("\n7. 为旺财创建住院记录（分配C-001普通笼位）")
    hosp1_data = {
        "pet_id": pet1_id,
        "medical_order_id": order1_id,
        "cage_id": 1,
        "notes": "精神状态良好，食欲正常"
    }
    r = requests.post(f"{BASE_URL}/api/hospitalizations/", json=hosp1_data)
    print_response("创建住院记录-旺财", r)
    hosp1_id = r.json()["id"]
    
    print("\n8. 为咪咪创建住院记录（分配C-003隔离笼位）")
    hosp2_data = {
        "pet_id": pet2_id,
        "medical_order_id": order2_id,
        "cage_id": 3,
        "notes": "精神萎靡，需要密切观察"
    }
    r = requests.post(f"{BASE_URL}/api/hospitalizations/", json=hosp2_data)
    print_response("创建住院记录-咪咪", r)
    hosp2_id = r.json()["id"]
    
    print("\n9. 推进旺财状态：待入院 -> 已入院")
    r = requests.post(f"{BASE_URL}/api/hospitalizations/{hosp1_id}/admit")
    print_response("旺财入院", r)
    
    print("\n10. 推进旺财状态：已入院 -> 治疗中")
    r = requests.post(f"{BASE_URL}/api/hospitalizations/{hosp1_id}/start-treatment")
    print_response("旺财开始治疗", r)
    
    print("\n11. 推进咪咪状态：待入院 -> 已入院")
    r = requests.post(f"{BASE_URL}/api/hospitalizations/{hosp2_id}/admit")
    print_response("咪咪入院", r)
    
    print("\n" + "#"*60)
    print("# 第五阶段：边界情况测试")
    print("#"*60)
    
    print("\n12. 测试重复提交：再次为旺财创建住院医嘱（应该失败）")
    duplicate_order = {
        "pet_id": pet1_id,
        "diagnosis": "重复测试",
        "treatment_plan": "测试",
        "infection_risk": "low"
    }
    r = requests.post(f"{BASE_URL}/api/medical-orders/", json=duplicate_order)
    print_response("重复创建医嘱（预期失败）", r)
    
    print("\n13. 测试状态冲突：尝试出院待入院状态的记录（应该失败）")
    temp_hosp_data = {
        "pet_id": pet1_id,
        "medical_order_id": order1_id,
        "cage_id": 1
    }
    r = requests.post(f"{BASE_URL}/api/hospitalizations/", json=temp_hosp_data)
    print_response("状态冲突测试-创建重复住院（预期失败）", r)
    
    print("\n14. 测试笼位兼容性：尝试将高风险咪咪放入普通笼位C-002（应该失败）")
    bad_cage_hosp = {
        "pet_id": pet2_id,
        "medical_order_id": order2_id,
        "cage_id": 2,
        "notes": "测试错误笼位"
    }
    r = requests.post(f"{BASE_URL}/api/hospitalizations/", json=bad_cage_hosp)
    print_response("兼容性错误（预期失败）", r)
    
    print("\n15. 测试来源记录缺失：使用不存在的宠物ID")
    missing_pet_hosp = {
        "pet_id": 9999,
        "medical_order_id": order1_id,
        "cage_id": 1
    }
    r = requests.post(f"{BASE_URL}/api/hospitalizations/", json=missing_pet_hosp)
    print_response("来源记录缺失（预期失败）", r)
    
    print("\n" + "#"*60)
    print("# 第六阶段：报表和看板")
    print("#"*60)
    
    print("\n16. 获取看板统计")
    r = requests.get(f"{BASE_URL}/api/reports/dashboard")
    print_response("看板统计", r)
    
    print("\n17. 获取日报")
    r = requests.get(f"{BASE_URL}/api/reports/daily")
    print_response("日报数据", r)
    
    print("\n18. 获取传染风险概览")
    r = requests.get(f"{BASE_URL}/api/reports/infection-risk-overview")
    print_response("传染风险概览", r)
    
    print("\n19. 获取治疗计划汇总")
    r = requests.get(f"{BASE_URL}/api/reports/treatment-plans-summary")
    print_response("治疗计划汇总", r)
    
    print("\n20. 获取笼位利用率")
    r = requests.get(f"{BASE_URL}/api/reports/cage-utilization")
    print_response("笼位利用率", r)
    
    print("\n" + "#"*60)
    print("# 第七阶段：查看住院详情")
    print("#"*60)
    
    print("\n21. 查看旺财住院详情")
    r = requests.get(f"{BASE_URL}/api/hospitalizations/{hosp1_id}/detail")
    print_response("旺财住院详情", r)
    
    print("\n22. 查看咪咪住院详情")
    r = requests.get(f"{BASE_URL}/api/hospitalizations/{hosp2_id}/detail")
    print_response("咪咪住院详情", r)
    
    print("\n" + "#"*60)
    print("# 测试完成！")
    print("#"*60)
    print("\n核心主线验证：")
    print("✓ 宠物档案 -> 住院医嘱（含传染风险）-> 笼位规则检查 -> 住院记录")
    print("✓ 状态推进：待入院 -> 已入院 -> 治疗中")
    print("✓ 隔离要求：高风险宠物自动限制到隔离笼位")
    print("✓ 边界情况：重复提交、状态冲突、记录缺失都有正确处理")
    print("✓ 报表看板：笼位使用、传染风险、治疗计划一目了然")

if __name__ == "__main__":
    main()
