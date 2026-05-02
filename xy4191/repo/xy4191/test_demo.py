#!/usr/bin/env python3
import sys
from pathlib import Path

src_dir = Path(__file__).parent / "src"
sys.path.insert(0, str(src_dir))

from release_validator.indexer import FileIndexer
from release_validator.rules import RuleEngine
from release_validator.reporter import Reporter
from release_validator.quarantine import QuarantineManager


def test_scan():
    print("=" * 60)
    print("测试 scan 功能")
    print("=" * 60)
    
    indexer = FileIndexer(Path("examples/good_release"))
    entries = indexer.scan()
    
    print(f"\n扫描完成，找到 {len(entries)} 个文件")
    summary = indexer.get_index_summary()
    print(f"文件类型: {summary['files_by_type']}")
    print(f"版本号: {summary['versions_detected']}")
    
    return indexer


def test_verify():
    print("\n" + "=" * 60)
    print("测试 verify 功能 (bad_release)")
    print("=" * 60)
    
    indexer = FileIndexer(Path("examples/bad_release"))
    indexer.scan()
    
    print(f"\n扫描 bad_release，找到 {len(indexer.entries)} 个文件")
    
    engine = RuleEngine(indexer)
    result = engine.verify({})
    
    print(f"\n验证结果: {'通过' if result.overall_passed else '失败'}")
    print(f"总违规数: {result.total_violations}")
    print(f"严重违规: {len(result.critical_violations)}")
    
    for rule_result in result.results:
        status = '通过' if rule_result.passed else '失败'
        symbol = '✓' if rule_result.passed else '✗'
        print(f"\n{symbol} {rule_result.rule_name} [{status}]")
        
        if rule_result.violations:
            for v in rule_result.violations:
                print(f"   - [{v.severity.value}] {v.message}")
        
        if rule_result.warnings:
            for w in rule_result.warnings:
                print(f"   ⚠ [{w.severity.value}] {w.message}")
    
    return result


def test_report():
    print("\n" + "=" * 60)
    print("测试 report 功能")
    print("=" * 60)
    
    indexer = FileIndexer(Path("examples/good_release"))
    indexer.scan()
    
    engine = RuleEngine(indexer)
    result = engine.verify({})
    
    reporter = Reporter(output_dir=Path("test_reports"))
    
    report_data = {
        "title": "发布证据包验收报告",
        "summary": {
            "total_files": len(indexer.entries),
            "total_issues": result.total_violations,
            "passed": result.overall_passed,
        },
        "files": [
            {
                "filename": e.filename,
                "file_type": e.file_type,
                "size": e.size,
                "sha256": e.sha256,
                "version": e.version,
            }
            for e in indexer.entries.values()
        ],
        "issues": [],
    }
    
    outputs = reporter.generate_all(report_data)
    
    print(f"\n报告已生成到: test_reports/")
    for format_name, path in outputs.items():
        print(f"  - {format_name}: {path.name}")


def test_quarantine():
    print("\n" + "=" * 60)
    print("测试 quarantine 功能")
    print("=" * 60)
    
    import tempfile
    import shutil
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        test_file = temp_path / "test.txt"
        test_file.write_text("This is a test file with bad content")
        
        quarantine_base = temp_path / ".quarantine"
        qm = QuarantineManager(quarantine_base)
        
        quarantined_path = qm.quarantine(
            source_path=test_file,
            reason="Test quarantine - bad content",
            category="test",
            original_base=temp_path,
        )
        
        print(f"\n原始文件: {test_file}")
        print(f"隔离后路径: {quarantined_path}")
        
        print(f"\n隔离清单: {qm.get_manifest_path()}")
        print(f"隔离数量: {len(qm.entries)}")
        
        summary = qm.get_summary()
        print(f"摘要: {summary}")


if __name__ == "__main__":
    print("Release Validator - 发布证据包验收员")
    print("版本: 0.1.0")
    
    test_scan()
    test_verify()
    test_report()
    test_quarantine()
    
    print("\n" + "=" * 60)
    print("所有测试完成!")
    print("=" * 60)
