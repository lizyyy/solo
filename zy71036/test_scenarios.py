import requests
import json
import os

BASE_URL = "http://localhost:8001"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_scenario_1_basic_workflow():
    print_section("场景1: 完整验收流程（正常通过）")
    
    area = requests.post(f"{BASE_URL}/areas/", json={
        "name": "东区施工现场",
        "description": "项目东区1-5号楼脚手架区域"
    }).json()
    print(f"✓ 创建区域: {area['name']} (ID: {area['id']})")
    
    scaffold = requests.post(f"{BASE_URL}/scaffolds/", json={
        "scaffold_number": "SCAF-EAST-001",
        "area_id": area["id"],
        "type": "门式脚手架",
        "height": 18.5,
        "specification": "符合JGJ130-2011标准"
    }).json()
    print(f"✓ 创建脚手架: {scaffold['scaffold_number']} (ID: {scaffold['id']})")
    
    record = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-2024-001",
        "scaffold_id": scaffold["id"],
        "inspector": "张工",
        "created_by": "李工"
    }).json()
    print(f"✓ 创建验收记录: {record['batch_no']} (ID: {record['id']})")
    
    photo_types = ["overall", "detail", "connection"]
    for i, ptype in enumerate(photo_types):
        with open(f"test_image_{i}.jpg", "wb") as f:
            f.write(b"fake_image_content")
        
        with open(f"test_image_{i}.jpg", "rb") as f:
            photo = requests.post(
                f"{BASE_URL}/acceptance/{record['id']}/photos/",
                params={"photo_type": ptype, "description": f"{ptype}照片", "uploaded_by": "王工"},
                files={"file": (f"photo_{i}.jpg", f, "image/jpeg")}
            ).json()
        print(f"✓ 上传{ptype}照片 (ID: {photo['id']})")
        os.remove(f"test_image_{i}.jpg")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit", params={"operator": "李工"}).json()
    print(f"✓ 提交验收 - 状态: {result['record']['status']}")
    print(f"  自动校验通过: {result['validation']['auto_check_passed']}")
    print(f"  问题列表: {result['validation']['issues']}")
    print(f"  是否需要人工审核: {result['validation']['requires_manual_review']}")
    
    return result


def test_scenario_2_deactivation_interception():
    print_section("场景2: 停用区域拦截功能")
    
    area = requests.post(f"{BASE_URL}/areas/", json={
        "name": "西区危险区域",
        "description": "临时停用区域"
    }).json()
    print(f"✓ 创建区域: {area['name']}")
    
    scaffold = requests.post(f"{BASE_URL}/scaffolds/", json={
        "scaffold_number": "SCAF-WEST-001",
        "area_id": area["id"],
        "type": "扣件式钢管脚手架"
    }).json()
    print(f"✓ 创建脚手架: {scaffold['scaffold_number']}")
    
    area = requests.post(
        f"{BASE_URL}/areas/{area['id']}/deactivate",
        params={"reason": "发现重大安全隐患", "operator": "安全总监"}
    ).json()
    print(f"✓ 停用区域: is_deactivated={area['is_deactivated']}")
    
    check = requests.get(f"{BASE_URL}/scaffolds/{scaffold['id']}/deactivation-check").json()
    print(f"✓ 停用检查: blocked={check['blocked']}")
    print(f"  原因: {check['reason']}")
    
    record = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-2024-002",
        "scaffold_id": scaffold["id"],
        "inspector": "张工"
    }).json()
    print(f"✓ 创建验收记录")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit").json()
    print(f"✓ 提交验收 - 状态: {result['record']['status']}")
    print(f"  问题: {result['validation']['issues']}")
    
    return result


def test_scenario_3_rectification_workflow():
    print_section("场景3: 整改项流程")
    
    area = requests.post(f"{BASE_URL}/areas/", json={
        "name": "南区整改区",
        "description": "整改测试区域"
    }).json()
    scaffold = requests.post(f"{BASE_URL}/scaffolds/", json={
        "scaffold_number": "SCAF-SOUTH-001",
        "area_id": area["id"],
        "type": "悬挑脚手架"
    }).json()
    
    record = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-2024-003",
        "scaffold_id": scaffold["id"],
        "inspector": "陈工",
        "rectifications": [
            {"item_no": "R-001", "description": "扫地杆缺失", "severity": "high"},
            {"item_no": "R-002", "description": "扣件松动", "severity": "normal"}
        ]
    }).json()
    print(f"✓ 创建验收记录，含2项整改")
    
    photo_types = ["overall", "detail", "connection"]
    for i, ptype in enumerate(photo_types):
        with open(f"rect_test_{i}.jpg", "wb") as f:
            f.write(b"fake_image_content")
        with open(f"rect_test_{i}.jpg", "rb") as f:
            requests.post(
                f"{BASE_URL}/acceptance/{record['id']}/photos/",
                params={"photo_type": ptype},
                files={"file": (f"p{i}.jpg", f, "image/jpeg")}
            ).json()
        os.remove(f"rect_test_{i}.jpg")
    print(f"✓ 上传3张照片")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit").json()
    print(f"✓ 提交验收 - 状态: {result['record']['status']}")
    print(f"  未关闭整改: {result['validation']['open_rectification_count']}")
    print(f"  问题: {result['validation']['issues']}")
    
    rectifications = requests.get(f"{BASE_URL}/rectifications/", params={"record_id": record["id"]}).json()
    for rect in rectifications:
        requests.post(
            f"{BASE_URL}/rectifications/{rect['id']}/close",
            json={"operator": "整改负责人", "verification_method": "现场复核+照片验证"}
        ).json()
        print(f"✓ 关闭整改项: {rect['item_no']} - {rect['description']}")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/recalculate").json()
    print(f"✓ 重新计算状态: {result['record']['status']}")
    print(f"  未关闭整改: {result['validation']['open_rectification_count']}")
    
    return result


def test_scenario_4_return_and_resubmit():
    print_section("场景4: 退回补充与重新提交")
    
    area = requests.post(f"{BASE_URL}/areas/", json={
        "name": "北区测试区",
        "description": "退回测试区域"
    }).json()
    scaffold = requests.post(f"{BASE_URL}/scaffolds/", json={
        "scaffold_number": "SCAF-NORTH-001",
        "area_id": area["id"]
    }).json()
    
    record = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-2024-004",
        "scaffold_id": scaffold["id"],
        "inspector": "刘工"
    }).json()
    print(f"✓ 创建验收记录 (版本: {record['version']})")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit").json()
    print(f"✓ 提交验收 - 状态: {result['record']['status']}")
    print(f"  问题: {result['validation']['issues']}")
    
    returned = requests.post(
        f"{BASE_URL}/acceptance/{record['id']}/return",
        json={"operator": "审核员", "reason": "照片不完整，缺少节点详图"}
    ).json()
    print(f"✓ 退回补充 - 状态: {returned['status']}, 版本: {returned['version']}")
    
    with open("supplement.jpg", "wb") as f:
        f.write(b"supplement_image")
    with open("supplement.jpg", "rb") as f:
        for ptype in ["overall", "detail", "connection"]:
            requests.post(
                f"{BASE_URL}/acceptance/{record['id']}/photos/",
                params={"photo_type": ptype},
                files={"file": ("photo.jpg", f, "image/jpeg")}
            ).json()
    os.remove("supplement.jpg")
    print(f"✓ 补充上传照片")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit", params={"operator": "刘工"}).json()
    print(f"✓ 重新提交 - 状态: {result['record']['status']}")
    print(f"  提交次数: {result['record']['submission_count']}")
    
    return result


def test_scenario_5_manual_review():
    print_section("场景5: 人工审核改判")
    
    area = requests.post(f"{BASE_URL}/areas/", json={
        "name": "中心区",
        "description": "人工审核测试"
    }).json()
    scaffold = requests.post(f"{BASE_URL}/scaffolds/", json={
        "scaffold_number": "SCAF-CENTER-001",
        "area_id": area["id"]
    }).json()
    
    record = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-2024-005",
        "scaffold_id": scaffold["id"],
        "inspector": "赵工",
        "rectifications": [
            {"item_no": "M-001", "description": "严重安全隐患", "severity": "critical"}
        ]
    }).json()
    
    for ptype in ["overall", "detail", "connection"]:
        with open("m.jpg", "wb") as f:
            f.write(b"content")
        with open("m.jpg", "rb") as f:
            requests.post(
                f"{BASE_URL}/acceptance/{record['id']}/photos/",
                params={"photo_type": ptype},
                files={"file": ("p.jpg", f, "image/jpeg")}
            ).json()
    os.remove("m.jpg")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit").json()
    print(f"✓ 提交验收 - 状态: {result['record']['status']}")
    print(f"  需要人工审核: {result['validation']['requires_manual_review']}")
    
    approved = requests.post(
        f"{BASE_URL}/acceptance/{record['id']}/manual-review",
        json={
            "operator": "安全总监",
            "reason": "经现场核查，隐患已排除，特批通过",
            "approved": True
        }
    ).json()
    print(f"✓ 人工审核通过 - 状态: {approved['status']}")
    print(f"  人工改判人: {approved['manual_override_by']}")
    print(f"  改判原因: {approved['manual_override_reason']}")
    
    return approved


def test_scenario_6_report_and_history():
    print_section("场景6: 报告导出与历史追溯")
    
    area = requests.post(f"{BASE_URL}/areas/", json={
        "name": "报告生成区",
        "description": "报告测试"
    }).json()
    scaffold = requests.post(f"{BASE_URL}/scaffolds/", json={
        "scaffold_number": "SCAF-REPORT-001",
        "area_id": area["id"]
    }).json()
    
    record = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-2024-006",
        "scaffold_id": scaffold["id"],
        "inspector": "周工"
    }).json()
    
    for ptype in ["overall", "detail", "connection"]:
        with open("r.jpg", "wb") as f:
            f.write(b"content")
        with open("r.jpg", "rb") as f:
            requests.post(
                f"{BASE_URL}/acceptance/{record['id']}/photos/",
                params={"photo_type": ptype},
                files={"file": ("p.jpg", f, "image/jpeg")}
            ).json()
    os.remove("r.jpg")
    
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit").json()
    print(f"✓ 提交验收 - 状态: {result['record']['status']}")
    
    report = requests.post(
        f"{BASE_URL}/acceptance/{record['id']}/report",
        params={"generated_by": "资料员"}
    ).json()
    print(f"✓ 生成验收报告: {report['report_no']}")
    print(f"  报告路径: {report['file_path']}")
    
    logs = requests.get(f"{BASE_URL}/acceptance/{record['id']}/logs/").json()
    print(f"✓ 操作日志数量: {len(logs)}")
    for log in logs:
        print(f"  - {log['operation']}: {log['previous_status']} -> {log['new_status']} (by {log['operator']})")
    
    return report


def test_scenario_7_statistics_verification():
    print_section("场景7: 统计数据一致性核对")
    
    stats = requests.get(f"{BASE_URL}/statistics").json()
    print("✓ 统计数据:")
    print(f"  总记录数: {stats['total_records']}")
    print(f"  通过数: {stats['total_accepted']}")
    print(f"  拒绝数: {stats['total_rejected']}")
    print(f"  待审核: {stats['pending_review']}")
    print(f"  停用脚手架: {stats['total_deactivated']}")
    print(f"  未关闭整改: {stats['open_rectifications']}")
    print(f"  照片缺失: {stats['photo_missing_count']}")
    print(f"  活跃区域: {stats['active_areas']}")
    print(f"  停用区域: {stats['deactivated_areas']}")
    
    verification = requests.get(f"{BASE_URL}/statistics/verify").json()
    print("\n✓ 数据一致性校验:")
    for check, result in verification["verification_checks"].items():
        status = "✓ 一致" if result else "✗ 不一致"
        print(f"  {check}: {status}")
    
    all_passed = all(verification["verification_checks"].values())
    print(f"\n  总体校验结果: {'✓ 全部通过' if all_passed else '✗ 存在不一致'}")
    
    return verification


def run_all_tests():
    print("\n" + "╔" + "═"*58 + "╗")
    print("║" + " "*10 + "脚手架验收停用 API 功能测试套件" + " "*10 + "║")
    print("╚" + "═"*58 + "╝")
    
    try:
        test_scenario_1_basic_workflow()
        test_scenario_2_deactivation_interception()
        test_scenario_3_rectification_workflow()
        test_scenario_4_return_and_resubmit()
        test_scenario_5_manual_review()
        test_scenario_6_report_and_history()
        test_scenario_7_statistics_verification()
        
        print_section("测试完成")
        print("所有测试场景执行完毕！")
        print("\n请访问 http://localhost:8000/docs 查看完整的 API 文档")
        
    except Exception as e:
        print(f"\n✗ 测试出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_all_tests()
