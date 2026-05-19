import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from i18n_placeholder_checker.file_loader import FileLoader
from i18n_placeholder_checker.comparator import CrossLanguageComparator
from i18n_placeholder_checker.report_generator import ReportGenerator

def test_normal_sample():
    print("=" * 60)
    print("验收测试 1: 正常样例 - 期望无问题")
    print("=" * 60)
    
    en = FileLoader.load_file("samples/normal/en.json")
    zh = FileLoader.load_file("samples/normal/zh.json")
    
    comparator = CrossLanguageComparator()
    issues = comparator.compare(en, zh, "en", "zh")
    
    all_issues = {"zh": issues}
    reporter = ReportGenerator()
    
    json_report = reporter.generate_machine_readable(all_issues)
    text_report = reporter.generate_human_readable(all_issues)
    
    print(f"发现问题数: {len(issues)}")
    
    assert len(issues) == 0, f"期望0个问题，实际发现{len(issues)}个"
    assert json_report["summary"]["total_issues"] == 0
    assert "未发现占位符不一致" in text_report or "总问题数: 0" in text_report
    
    print("✓ 正常样例测试通过！")
    print()
    return True

def test_dirty_sample():
    print("=" * 60)
    print("验收测试 2: 脏数据样例 - 期望有问题")
    print("=" * 60)
    
    en = FileLoader.load_file("samples/dirty/en.json")
    zh = FileLoader.load_file("samples/dirty/zh.json")
    
    comparator = CrossLanguageComparator()
    issues = comparator.compare(en, zh, "en", "zh")
    
    all_issues = {"zh": issues}
    reporter = ReportGenerator()
    
    json_report = reporter.generate_machine_readable(all_issues)
    text_report = reporter.generate_human_readable(all_issues)
    
    print(f"发现问题数: {len(issues)}")
    
    assert len(issues) > 0, "期望发现至少1个问题"
    assert json_report["summary"]["total_issues"] == len(issues)
    
    greeting_issue = next((i for i in issues if i.key == "greeting"), None)
    assert greeting_issue is not None, "greeting缺失问题未检测到"
    assert "name" in greeting_issue.missing_in_target, "name占位符缺失未检测到"
    
    welcome_issue = next((i for i in issues if i.key == "welcome"), None)
    assert welcome_issue is not None, "welcome缺失问题未检测到"
    assert "user" in welcome_issue.missing_in_target, "user占位符缺失未检测到"
    
    notification_issue = next((i for i in issues if i.key == "notification"), None)
    assert notification_issue is not None, "notification多余问题未检测到"
    assert "total" in notification_issue.extra_in_target, "total多余占位符未检测到"
    
    error_issue = next((i for i in issues if i.key == "error"), None)
    assert error_issue is not None, "error缺失问题未检测到"
    assert "code" in error_issue.missing_in_target, "code占位符缺失未检测到"
    
    print("检测到的问题:")
    for issue in issues:
        print(f"  - {issue.key}:")
        if issue.missing_in_target:
            print(f"    缺失: {sorted(issue.missing_in_target)}")
        if issue.extra_in_target:
            print(f"    多余: {sorted(issue.extra_in_target)}")
    
    print("✓ 脏数据样例测试通过！")
    print()
    return True

def verify_report_consistency():
    print("=" * 60)
    print("验收测试 3: 报告一致性检查")
    print("=" * 60)
    
    en = FileLoader.load_file("samples/dirty/en.json")
    zh = FileLoader.load_file("samples/dirty/zh.json")
    
    comparator = CrossLanguageComparator()
    issues = comparator.compare(en, zh, "en", "zh")
    all_issues = {"zh": issues}
    
    reporter = ReportGenerator()
    json_report = reporter.generate_machine_readable(all_issues)
    text_report = reporter.generate_human_readable(all_issues)
    
    json_issue_count = json_report["summary"]["total_issues"]
    assert json_issue_count == len(issues), f"JSON报告问题数不一致: {json_issue_count} vs {len(issues)}"
    
    for lang, lang_issues in json_report["issues"].items():
        for idx, issue_data in enumerate(lang_issues):
            original_issue = issues[idx]
            assert issue_data["key"] == original_issue.key
            assert issue_data["severity"] == original_issue.severity
            assert issue_data["missing_in_target"] == sorted(original_issue.missing_in_target)
            assert issue_data["extra_in_target"] == sorted(original_issue.extra_in_target)
    
    for issue in issues:
        assert issue.key in text_report, f"{issue.key} 不在文本报告中"
        if issue.missing_in_target:
            for ph in issue.missing_in_target:
                assert ph in text_report, f"缺失占位符 {ph} 不在文本报告中"
    
    print("✓ 报告一致性检查通过！")
    print()
    return True

def test_empty_sample():
    print("=" * 60)
    print("验收测试 4: 空占位符样例")
    print("=" * 60)
    
    en = FileLoader.load_file("samples/empty/en.json")
    zh = FileLoader.load_file("samples/empty/zh.json")
    
    comparator = CrossLanguageComparator()
    issues = comparator.compare(en, zh, "en", "zh")
    
    print(f"发现问题数: {len(issues)}")
    assert len(issues) == 0, "无占位符的文件不应有问题"
    print("✓ 空占位符样例测试通过！")
    print()
    return True

def run_all_tests():
    print()
    print("╔" + "=" * 58 + "╗")
    print("║" + "翻译占位符一致性缺失定位排查CLI - 验收测试".center(58) + "║")
    print("╚" + "=" * 58 + "╝")
    print()
    
    results = []
    
    try:
        results.append(("正常样例", test_normal_sample()))
        results.append(("脏数据样例", test_dirty_sample()))
        results.append(("报告一致性", verify_report_consistency()))
        results.append(("空占位符样例", test_empty_sample()))
    except AssertionError as e:
        print(f"✗ 断言失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print("=" * 60)
    print("测试总结")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False
    
    print()
    if all_passed:
        print("🎉 所有验收测试通过！")
        print()
        print("项目交付物:")
        print("  ✓ 占位符抽取模块")
        print("  ✓ 跨语言比对模块")
        print("  ✓ 缺失定位和修复建议模块")
        print("  ✓ CLI命令行接口")
        print("  ✓ 报告输出模块 (JSON + 文本)")
        print("  ✓ 样例数据 (正常/脏数据/边界冲突/空结果)")
        print("  ✓ 验收测试套件")
    else:
        print("❌ 部分测试失败！")
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
