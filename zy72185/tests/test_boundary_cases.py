"""边界情况测试：空值、重复项、边界记录"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.data_loader import DataLoader
from src.conflict_detector import ConflictDetector
from src.traceability import Traceability
from src.version_manager import VersionManager
from src.exporter import Exporter


def test_empty_values():
    """测试空值检测"""
    print("\n" + "="*60)
    print("  测试1: 空值检测")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    detector = ConflictDetector(base_dir)

    empty_values = detector.detect_empty_values("v1.2.0")

    print(f"  检测到空值数量: {len(empty_values)}")
    for ev in empty_values:
        print(f"\n  案例ID: {ev['case_id']}")
        print(f"  空字段: {ev['empty_fields']}")
        print(f"  行号: {ev['annotation_line']}")
        print(f"  来源: {ev['source']}")
        print(f"  严重程度: {ev['severity']}")
        print(f"  建议动作: {ev['suggested_actions']}")

    # 验证：CASE017应该被检测到空值
    case017_found = any(ev['case_id'] == 'CASE017' for ev in empty_values)
    assert len(empty_values) >= 1, f"期望至少检测到1个空值，实际{len(empty_values)}"
    assert case017_found, "未检测到CASE017的空值"

    print("\n  ✅ 空值检测测试通过")
    return True


def test_duplicate_records():
    """测试重复项检测"""
    print("\n" + "="*60)
    print("  测试2: 重复项检测")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    detector = ConflictDetector(base_dir)

    duplicates = detector.detect_duplicate_records("v1.2.0")

    print(f"  检测到重复项数量: {len(duplicates)}")
    for dup in duplicates:
        print(f"\n  案例ID: {dup['case_id']}")
        print(f"  重复次数: {dup['duplicate_count']}")
        print(f"  涉及行号: {dup['lines']}")
        print(f"  来源: {dup['source']}")
        print(f"  严重程度: {dup['severity']}")
        for i, ann in enumerate(dup['annotations']):
            print(f"    第{i+1}条: 行{ann['line']}, 标签{ann['true_label']}, 标注人{ann['annotator']}, {ann['conflict_note']}")

    # 验证：CASE001应该被检测到重复
    case001_found = any(d['case_id'] == 'CASE001' for d in duplicates)
    assert len(duplicates) >= 1, f"期望至少检测到1个重复项，实际{len(duplicates)}"
    assert case001_found, "未检测到CASE001的重复项"

    case001_dup = next(d for d in duplicates if d['case_id'] == 'CASE001')
    assert case001_dup['duplicate_count'] == 2, f"期望CASE001重复2次，实际{case001_dup['duplicate_count']}"

    print("\n  ✅ 重复项检测测试通过")
    return True


def test_boundary_cases():
    """测试边界记录检测"""
    print("\n" + "="*60)
    print("  测试3: 边界记录检测")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    detector = ConflictDetector(base_dir)

    boundary = detector.detect_boundary_cases("v1.2.0")

    print(f"  检测到边界记录数量: {len(boundary)}")
    for bc in boundary:
        print(f"\n  案例ID: {bc['case_id']}")
        print(f"  案例文本: {bc['case_text']}")
        print(f"  预测分数: {bc['pred_score']}")
        print(f"  边界类型: {bc['boundary_type']}")
        print(f"  边界阈值: {bc['boundary_threshold']}")
        print(f"  严重程度: {bc['severity']}")

    # 验证：CASE002(0.71)、CASE013(0.70)、CASE016(白户)应该被检测到
    case_ids = [c['case_id'] for c in boundary]
    print(f"\n  检测到的边界案例: {case_ids}")

    # 分数在中风险区间中间附近的应该被检测
    assert len(boundary) >= 3, f"期望至少检测到3个边界记录，实际{len(boundary)}"
    assert 'CASE016' in case_ids, "未检测到CASE016白户边界样本"

    print("\n  ✅ 边界记录检测测试通过")
    return True


def test_label_conflicts():
    """测试标签冲突检测"""
    print("\n" + "="*60)
    print("  测试4: 标签冲突检测")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    detector = ConflictDetector(base_dir)

    conflicts = detector.detect_label_conflicts("v1.2.0")

    print(f"  检测到标签冲突数量: {len(conflicts)}")
    for c in conflicts:
        print(f"\n  {c['case_id']}: {c['pred_label']}(模型) vs {c['true_label']}(标注)")
        print(f"    预测分数: {c['pred_score']}")
        print(f"    标注人: {c['annotator']}")
        print(f"    来源: {c['pred_source']}")

    # 验证：CASE002、CASE004、CASE010、CASE013应该有标签冲突
    expected_conflicts = {'CASE002', 'CASE004', 'CASE010', 'CASE013'}
    actual_conflicts = {c['case_id'] for c in conflicts}
    print(f"\n  期望冲突: {expected_conflicts}")
    print(f"  实际冲突: {actual_conflicts}")

    assert len(conflicts) >= 4, f"期望至少4个标签冲突，实际{len(conflicts)}"
    assert expected_conflicts.issubset(actual_conflicts), f"缺少冲突: {expected_conflicts - actual_conflicts}"

    print("\n  ✅ 标签冲突检测测试通过")
    return True


def test_sample_leaks():
    """测试样本泄漏检测"""
    print("\n" + "="*60)
    print("  测试5: 样本泄漏检测")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    detector = ConflictDetector(base_dir)

    leaks = detector.detect_sample_leaks("v1.2.0")

    print(f"  检测到样本泄漏数量: {len(leaks)}")
    for leak in leaks:
        print(f"\n  案例ID: {leak['case_id']}")
        print(f"  描述: {leak['description']}")
        print(f"  严重程度: {leak['severity']}")
        print(f"  涉及数据集: {leak['evidence']['data_sets_involved']}")

    # 验证：CASE001应该被检测到样本泄漏
    assert len(leaks) >= 1, f"期望至少1个样本泄漏，实际{len(leaks)}"
    assert leaks[0]['case_id'] == 'CASE001', "样本泄漏案例ID不正确"
    assert leaks[0]['severity'] == 'critical', "样本泄漏严重程度应为critical"

    print("\n  ✅ 样本泄漏检测测试通过")
    return True


def test_version_conflicts():
    """测试版本冲突检测（发布记录 vs 实际数据）"""
    print("\n" + "="*60)
    print("  测试6: 版本冲突检测")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    detector = ConflictDetector(base_dir)

    conflicts = detector.detect_version_conflicts("v1.2.0")

    print(f"  检测到版本冲突数量: {len(conflicts)}")
    for c in conflicts:
        print(f"\n  冲突ID: {c['conflict_id']}")
        print(f"  冲突类型: {c['conflict_type']}")
        print(f"  严重程度: {c['severity']}")
        print(f"  需要人工决策: {c['decision_required']}")
        print(f"  备注: {c['note']}")

        if 'claimed_precision' in c['release_claim']:
            print(f"\n  [发布记录宣称] 精确率: {c['release_claim']['claimed_precision']}")
            print(f"  [实际数据] 精确率: {c['actual_data']['actual_precision']}")
            print(f"  差异: {c['difference']['precision_delta']:+.2f}")
        if 'claimed_label' in c['release_claim']:
            print(f"\n  [发布记录宣称] {c['case_id']}: {c['release_claim']['claimed_label']}")
            print(f"  [实际改判记录] -> {c['actual_data']['actual_manual_review_label']}")
            print(f"  [实际标注] {c['actual_data']['actual_annotation_label']}")

    # 验证：应该检测到指标冲突和CASE002、CASE013的改判冲突
    assert len(conflicts) >= 3, f"期望至少3个版本冲突，实际{len(conflicts)}"

    # 检查是否有需要人工决策的项
    decision_required = [c for c in conflicts if c['decision_required']]
    print(f"\n  需要人工决策的数量: {len(decision_required)}")
    assert len(decision_required) >= 3, "所有版本冲突都应该需要人工决策"

    print("\n  ✅ 版本冲突检测测试通过")
    return True


def test_traceability():
    """测试来源追溯"""
    print("\n" + "="*60)
    print("  测试7: 来源追溯")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    trace = Traceability(base_dir)

    result = trace.trace_case("v1.2.0", "CASE002")

    print(f"  版本: {result['version_id']}")
    print(f"  案例: {result['case_id']}")
    print(f"  证据链数量: {len(result['evidence_chain'])}")

    for i, e in enumerate(result['evidence_chain']):
        print(f"\n  [{i+1}] {e['source_type']}")
        print(f"      文件: {e['file']}")
        if 'line' in e:
            print(f"      行号: {e['line']}")
        print(f"      追溯路径: {e['trace_path']}")

    print(f"\n  人工改判历史: {len(result['review_history'])}条")
    for r in result['review_history']:
        print(f"    {r['original_label']} -> {r['reviewed_label']} (by {r['reviewer']})")
        print(f"    理由: {r['reason']}")

    # 验证
    assert len(result['evidence_chain']) >= 2, "CASE002应该至少有评测日志和标注表两个证据"
    assert len(result['review_history']) >= 1, "CASE002应该有人工改判记录"
    assert result['threshold_context'] is not None, "应该有阈值上下文"

    print("\n  ✅ 来源追溯测试通过")
    return True


def test_export_with_reason():
    """测试导出功能是否带原因"""
    print("\n" + "="*60)
    print("  测试8: 导出带原因")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    exporter = Exporter(base_dir)

    # 导出冲突清单
    filepath = exporter.export_conflicts("v1.2.0", "all")
    print(f"  导出文件: {filepath}")

    import json
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    export_reason = data.get("export_reason", "")
    print(f"\n  导出原因: {export_reason}")

    # 验证导出原因包含关键信息
    assert export_reason, "导出原因不能为空"
    assert "导出全部" in export_reason or "冲突" in export_reason, "导出原因应包含说明"

    # 检查是否有需要人工决策的项
    decision_items = data.get("decision_required_items", [])
    print(f"  需要人工决策的项: {len(decision_items)}")
    assert len(decision_items) >= 3, "应该包含需要人工决策的项"

    # 清理测试文件
    os.remove(filepath)
    print(f"  清理测试文件: {filepath}")

    print("\n  ✅ 导出带原因测试通过")
    return True


def test_detect_all_summary():
    """测试整体检测摘要是否正确"""
    print("\n" + "="*60)
    print("  测试9: 整体检测摘要")
    print("="*60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    detector = ConflictDetector(base_dir)

    result = detector.detect_all("v1.2.0")
    summary = result["summary"]

    print(f"  问题总数: {summary['total_conflicts']}")
    print(f"  需要人工决策: {summary['decision_required_count']}")
    print(f"  严重程度分布: {summary['severity_breakdown']}")
    print(f"  问题分类: {summary['breakdown']}")

    # 验证
    assert summary["total_conflicts"] >= 12, f"期望至少12个问题，实际{summary['total_conflicts']}"
    assert summary["decision_required_count"] >= 3, f"期望至少3个需要人工决策，实际{summary['decision_required_count']}"
    assert summary["severity_breakdown"]["critical"] >= 1, "应该有critical级问题"
    assert summary["severity_breakdown"]["high"] >= 5, "应该有high级问题"

    print("\n  ✅ 整体检测摘要测试通过")
    return True


def main():
    """运行所有边界测试"""
    print("\n" + "#"*60)
    print("#  大模型提示词版本仓库 - 边界情况测试")
    print("#"*60)

    tests = [
        test_empty_values,
        test_duplicate_records,
        test_boundary_cases,
        test_label_conflicts,
        test_sample_leaks,
        test_version_conflicts,
        test_traceability,
        test_export_with_reason,
        test_detect_all_summary,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"\n  ❌ 测试失败: {e}")
            failed += 1
        except Exception as e:
            print(f"\n  ❌ 测试异常: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "="*60)
    print(f"  测试结果: {passed} 通过, {failed} 失败")
    print("="*60)

    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
