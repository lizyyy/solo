import httpx
import json
import os

BASE_URL = "http://localhost:8000"
EXAMPLES_DIR = os.path.join(os.path.dirname(__file__), "examples")


def read_csv(filename):
    filepath = os.path.join(EXAMPLES_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def test_import_normal_ring():
    print("=" * 60)
    print("测试 1: 导入正常环号 (环号 100)")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        files = {
            "segment_layout": ("segment_layout_100.csv", read_csv("segment_layout_100.csv"), "text/csv"),
            "jack_stroke": ("jack_stroke_100.csv", read_csv("jack_stroke_100.csv"), "text/csv"),
            "grouting": ("grouting_100_normal.csv", read_csv("grouting_100_normal.csv"), "text/csv"),
            "measurement": ("measurement_100_normal.csv", read_csv("measurement_100_normal.csv"), "text/csv"),
        }
        data = {"ring_number": 100}
        
        response = client.post("/api/rings/import", files=files, data=data)
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        
        assert response.status_code == 200
        result = response.json()
        assert result["ring_number"] == 100
        print(f"\n✓ 环号 100 导入成功，整体风险: {result['overall_risk']}")
        return result


def test_import_risky_misalignment():
    print("\n" + "=" * 60)
    print("测试 2: 导入存在错台风险的环号 (环号 101)")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        files = {
            "segment_layout": ("segment_layout_101_risky.csv", read_csv("segment_layout_101_risky.csv"), "text/csv"),
            "jack_stroke": ("jack_stroke_100.csv", read_csv("jack_stroke_100.csv"), "text/csv"),
            "grouting": ("grouting_100_normal.csv", read_csv("grouting_100_normal.csv"), "text/csv"),
            "measurement": ("measurement_100_normal.csv", read_csv("measurement_100_normal.csv"), "text/csv"),
        }
        data = {"ring_number": 101}
        
        response = client.post("/api/rings/import", files=files, data=data)
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        
        assert response.status_code == 200
        result = response.json()
        assert result["ring_number"] == 101
        print(f"\n✓ 环号 101 导入成功，整体风险: {result['overall_risk']}")
        print(f"  错台风险: {result['risks']['misalignment']}")
        return result


def test_import_low_grouting():
    print("\n" + "=" * 60)
    print("测试 3: 导入注浆量不足的环号 (环号 102)")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        files = {
            "segment_layout": ("segment_layout_100.csv", read_csv("segment_layout_100.csv"), "text/csv"),
            "jack_stroke": ("jack_stroke_100.csv", read_csv("jack_stroke_100.csv"), "text/csv"),
            "grouting": ("grouting_102_low.csv", read_csv("grouting_102_low.csv"), "text/csv"),
            "measurement": ("measurement_100_normal.csv", read_csv("measurement_100_normal.csv"), "text/csv"),
        }
        data = {"ring_number": 102}
        
        response = client.post("/api/rings/import", files=files, data=data)
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        
        assert response.status_code == 200
        result = response.json()
        assert result["ring_number"] == 102
        print(f"\n✓ 环号 102 导入成功，整体风险: {result['overall_risk']}")
        print(f"  注浆风险: {result['risks']['grouting']}")
        return result


def test_import_high_risk_attitude():
    print("\n" + "=" * 60)
    print("测试 4: 导入姿态超限+复测缺口的环号 (环号 103)")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        files = {
            "segment_layout": ("segment_layout_100.csv", read_csv("segment_layout_100.csv"), "text/csv"),
            "jack_stroke": ("jack_stroke_100.csv", read_csv("jack_stroke_100.csv"), "text/csv"),
            "grouting": ("grouting_100_normal.csv", read_csv("grouting_100_normal.csv"), "text/csv"),
            "measurement": ("measurement_103_risky.csv", read_csv("measurement_103_risky.csv"), "text/csv"),
        }
        data = {"ring_number": 103}
        
        response = client.post("/api/rings/import", files=files, data=data)
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        
        assert response.status_code == 200
        result = response.json()
        assert result["ring_number"] == 103
        print(f"\n✓ 环号 103 导入成功，整体风险: {result['overall_risk']}")
        print(f"  姿态风险: {result['risks']['attitude']}")
        print(f"  复测缺口风险: {result['risks']['recheck_gap']}")
        return result


def test_query_all_rings():
    print("\n" + "=" * 60)
    print("测试 5: 查询所有环号")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        response = client.get("/api/rings")
        print(f"状态码: {response.status_code}")
        rings = response.json()
        print(f"共查询到 {len(rings)} 个环号:")
        for ring in rings:
            print(f"  环号 {ring['ring_number']}: 整体风险={ring['overall_risk']}")
        return rings


def test_query_single_ring():
    print("\n" + "=" * 60)
    print("测试 6: 查询单个环号详情 (环号 103)")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        response = client.get("/api/rings/103")
        print(f"状态码: {response.status_code}")
        detail = response.json()
        print(f"风险详情:")
        print(f"  整体风险: {detail['risks']['overall']['status']}")
        print(f"  错台: {detail['risks']['misalignment']['status']} - {detail['risks']['misalignment']['details']}")
        print(f"  姿态: {detail['risks']['attitude']['status']} - {detail['risks']['attitude']['details']}")
        print(f"  注浆: {detail['risks']['grouting']['status']} - {detail['risks']['grouting']['details']}")
        print(f"  复测: {detail['risks']['recheck_gap']['status']} - {detail['risks']['recheck_gap']['details']}")
        return detail


def test_manual_review():
    print("\n" + "=" * 60)
    print("测试 7: 人工复核与改判 (环号 103)")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "manual_review_note": "经现场复核，姿态偏差为临时调整，已恢复正常，改判为警告。",
            "manual_override": "warning"
        }
        response = client.put("/api/rings/103/review", data=data)
        print(f"状态码: {response.status_code}")
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        
        print(f"\n✓ 环号 103 复核完成")
        print(f"  改判后整体风险: {result['overall_risk']}")
        print(f"  复核备注: {result['manual_review_note']}")
        return result


def test_export_handover():
    print("\n" + "=" * 60)
    print("测试 8: 导出 Markdown 交班单")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        params = {
            "shift_date": "2026-05-05",
            "shift_name": "白班",
            "operator": "张测量员"
        }
        response = client.get("/api/export/handover", params=params)
        print(f"状态码: {response.status_code}")
        markdown = response.text
        
        output_path = os.path.join(os.path.dirname(__file__), "handover_output.md")
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        print(f"\n✓ 交班单已导出到: {output_path}")
        print("交班单预览 (前50行):")
        print("\n".join(markdown.split("\n")[:50]))
        return markdown


def test_export_audit():
    print("\n" + "=" * 60)
    print("测试 9: 导出 JSON 审计明细")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        response = client.get("/api/export/audit")
        print(f"状态码: {response.status_code}")
        audit_data = response.json()
        
        output_path = os.path.join(os.path.dirname(__file__), "audit_output.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ 审计明细已导出到: {output_path}")
        print(f"统计摘要:")
        print(f"  总环数: {audit_data['total_rings']}")
        print(f"  严重风险: {audit_data['risk_summary']['critical']}")
        print(f"  警告风险: {audit_data['risk_summary']['warning']}")
        print(f"  正常: {audit_data['risk_summary']['normal']}")
        return audit_data


def test_get_stats():
    print("\n" + "=" * 60)
    print("测试 10: 获取风险统计摘要")
    print("=" * 60)
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        response = client.get("/api/stats/summary")
        print(f"状态码: {response.status_code}")
        stats = response.json()
        print(f"统计结果:")
        print(f"  总环数: {stats['total_rings']}")
        print(f"  风险分布: 严重={stats['risk_summary']['critical']}, 警告={stats['risk_summary']['warning']}, 正常={stats['risk_summary']['normal']}")
        print(f"  复核状态: 已复核={stats['review_status']['reviewed']}, 待复核={stats['review_status']['pending']}")
        return stats


def main():
    print("🚀 开始盾构施工测量风险分析系统测试")
    print(f"目标服务: {BASE_URL}")
    print("请确保服务已启动: python main.py\n")
    
    try:
        test_import_normal_ring()
        test_import_risky_misalignment()
        test_import_low_grouting()
        test_import_high_risk_attitude()
        test_query_all_rings()
        test_query_single_ring()
        test_manual_review()
        test_export_handover()
        test_export_audit()
        test_get_stats()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        print("\n生成的文件:")
        print("  - handover_output.md: Markdown 交班单")
        print("  - audit_output.json: JSON 审计明细")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
