#!/usr/bin/env python3
"""
项目验证脚本 - 验证庭审笔录证据编号校验员的所有模块是否正常工作
"""

import sys
from pathlib import Path
from datetime import datetime
import tempfile

print("=" * 60)
print("庭审笔录证据编号校验员 - 项目验证脚本")
print("=" * 60)
print()


def test_imports():
    """测试所有模块导入"""
    print("[1/5] 测试模块导入...")
    
    try:
        from court_evidence_checker import __version__
        print(f"  ✓ 版本: {__version__}")
    except ImportError as e:
        print(f"  ✗ 导入失败: {e}")
        return False
    
    try:
        from court_evidence_checker.models import (
            Evidence, EvidenceCatalog, EvidenceType, EvidenceStatus,
            Reference, ReferenceType, Objection, ObjectionType, ObjectionStatus,
            CheckSession, CheckResult, RuleResult, RuleType, Severity,
        )
        print("  ✓ models 模块")
        print(f"    EvidenceStatus 值: {[s.value for s in EvidenceStatus]}")
        print(f"    EvidenceType 值: {[t.value for t in EvidenceType]}")
    except ImportError as e:
        print(f"  ✗ models 模块导入失败: {e}")
        return False
    
    try:
        from court_evidence_checker.parsers import (
            EvidenceCSVParser, MarkdownTranscriptParser,
            CrossExaminationJSONParser, JudgmentDraftParser,
        )
        print("  ✓ parsers 模块")
    except ImportError as e:
        print(f"  ✗ parsers 模块导入失败: {e}")
        return False
    
    try:
        from court_evidence_checker.rules import (
            RuleEngine, MissingReferenceRule, DuplicateReferenceRule,
            ConflictingReferenceRule, DateConflictRule, UnhandledObjectionRule,
        )
        print("  ✓ rules 模块")
    except ImportError as e:
        print(f"  ✗ rules 模块导入失败: {e}")
        return False
    
    try:
        from court_evidence_checker.exporters import (
            MarkdownExporter, CSVExporter, JSONExporter,
            export_markdown_report, export_csv_issues, export_json_audit,
        )
        print("  ✓ exporters 模块")
    except ImportError as e:
        print(f"  ✗ exporters 模块导入失败: {e}")
        return False
    
    try:
        from court_evidence_checker.storage import SessionManager
        print("  ✓ storage 模块")
    except ImportError as e:
        print(f"  ✗ storage 模块导入失败: {e}")
        return False
    
    try:
        from court_evidence_checker.sample_data import SampleDataGenerator, generate_sample_files
        print("  ✓ sample_data 模块")
    except ImportError as e:
        print(f"  ✗ sample_data 模块导入失败: {e}")
        return False
    
    try:
        from court_evidence_checker.cli import cli, main
        print("  ✓ cli 模块")
    except ImportError as e:
        print(f"  ✗ cli 模块导入失败: {e}")
        return False
    
    print("  ✓ 所有模块导入成功!")
    print()
    return True


def test_models():
    """测试数据模型"""
    print("[2/5] 测试数据模型...")
    
    from court_evidence_checker.models import (
        Evidence, EvidenceCatalog, EvidenceType, EvidenceStatus,
        Reference, ReferenceType, Objection, ObjectionType, ObjectionStatus,
        CheckSession, RuleResult, RuleType, Severity,
    )
    
    try:
        evidence = Evidence(
            evidence_number="1",
            display_name="货物买卖合同",
            evidence_type=EvidenceType.DOCUMENT,
            submitter="原告",
            submission_date=datetime(2025, 3, 15),
            description="测试证据",
            status=EvidenceStatus.ADMITTED,
            aliases=["合同", "买卖合同"],
            page_count=5,
        )
        print(f"  ✓ Evidence: {evidence.evidence_number} - {evidence.display_name}")
        print(f"    状态: {evidence.status.value}")
        
        catalog = EvidenceCatalog(
            case_number="(2026)京民初字第123号",
            case_name="测试案件",
        )
        catalog.add_evidence(evidence)
        print(f"  ✓ EvidenceCatalog: {catalog.case_number}")
        print(f"    证据数量: {len(catalog.evidences)}")
        
        reference = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            source_context="出示证据1",
            source_file="庭审笔录.md",
        )
        print(f"  ✓ Reference: {reference.evidence_number}")
        
        objection = Objection(
            objection_id="obj_001",
            evidence_number="1",
            objection_type=ObjectionType.RELEVANCE,
            raised_by="被告代理人",
            raised_at=datetime(2026, 4, 15, 9, 35),
            description="对关联性提出异议",
            status=ObjectionStatus.PENDING,
        )
        print(f"  ✓ Objection: {objection.objection_id}")
        
        rule_result = RuleResult(
            rule_type=RuleType.MISSING_REFERENCE,
            severity=Severity.HIGH,
            message="证据2未被引用",
            evidence_number="2",
        )
        print(f"  ✓ RuleResult: {rule_result.rule_type.value}")
        
        session = CheckSession(
            session_id="test_001",
            created_at=datetime.now(),
        )
        print(f"  ✓ CheckSession: {session.session_id}")
        
    except Exception as e:
        print(f"  ✗ 模型测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("  ✓ 所有数据模型测试通过!")
    print()
    return True


def test_sample_data():
    """测试样例数据生成"""
    print("[3/5] 测试样例数据生成...")
    
    from court_evidence_checker.sample_data import SampleDataGenerator, generate_sample_files
    
    try:
        generator = SampleDataGenerator()
        
        transcript_md = generator.generate_transcript_md()
        print(f"  ✓ 庭审笔录: {len(transcript_md)} 字符")
        assert "庭审笔录" in transcript_md
        
        evidence_csv = generator.generate_evidence_csv()
        print(f"  ✓ 证据目录 CSV: {len(evidence_csv)} 字符")
        assert "证据编号" in evidence_csv
        
        cross_exam_json = generator.generate_cross_exam_json()
        print(f"  ✓ 举证质证 JSON: {len(cross_exam_json)} 字符")
        assert "case_number" in cross_exam_json
        
        judgment_md = generator.generate_judgment_draft_md()
        print(f"  ✓ 裁判要点草稿: {len(judgment_md)} 字符")
        assert "民事判决书" in judgment_md
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            files = generate_sample_files(tmp_path)
            
            assert files["transcript"].exists()
            assert files["evidence_list"].exists()
            assert files["cross_examination"].exists()
            assert files["judgment_draft"].exists()
            
            print(f"  ✓ 生成文件到临时目录成功")
        
    except Exception as e:
        print(f"  ✗ 样例数据生成失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("  ✓ 样例数据生成测试通过!")
    print()
    return True


def test_parsers():
    """测试解析器"""
    print("[4/5] 测试解析器...")
    
    from court_evidence_checker.parsers import (
        EvidenceCSVParser, MarkdownTranscriptParser,
        CrossExaminationJSONParser, JudgmentDraftParser,
    )
    from court_evidence_checker.sample_data import SampleDataGenerator
    
    try:
        generator = SampleDataGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            
            csv_path = tmp_path / "证据目录.csv"
            csv_path.write_text(generator.generate_evidence_csv(), encoding="utf-8")
            
            csv_parser = EvidenceCSVParser()
            csv_result = csv_parser.parse(csv_path)
            
            assert csv_result.success is True
            print(f"  ✓ CSV 解析器: 成功")
            print(f"    数据: {csv_result.data}")
            
            md_path = tmp_path / "庭审笔录.md"
            md_path.write_text(generator.generate_transcript_md(), encoding="utf-8")
            
            md_parser = MarkdownTranscriptParser()
            md_result = md_parser.parse(md_path)
            
            assert md_result.success is True
            print(f"  ✓ Markdown 解析器: 成功")
            
            json_path = tmp_path / "举证质证记录.json"
            json_path.write_text(generator.generate_cross_exam_json(), encoding="utf-8")
            
            json_parser = CrossExaminationJSONParser()
            json_result = json_parser.parse(json_path)
            
            assert json_result.success is True
            print(f"  ✓ JSON 解析器: 成功")
            
            jd_path = tmp_path / "裁判要点草稿.md"
            jd_path.write_text(generator.generate_judgment_draft_md(), encoding="utf-8")
            
            jd_parser = JudgmentDraftParser()
            jd_result = jd_parser.parse(jd_path)
            
            assert jd_result.success is True
            print(f"  ✓ 裁判要点解析器: 成功")
        
    except Exception as e:
        print(f"  ✗ 解析器测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("  ✓ 所有解析器测试通过!")
    print()
    return True


def test_rules():
    """测试规则引擎"""
    print("[5/5] 测试规则引擎...")
    
    from court_evidence_checker.models import (
        Evidence, EvidenceCatalog, EvidenceType, EvidenceStatus,
        Reference, ReferenceType, CheckSession, RuleType,
    )
    from court_evidence_checker.rules import (
        RuleEngine, MissingReferenceRule, DateConflictRule,
        UnhandledObjectionRule,
    )
    
    try:
        evidence1 = Evidence(
            evidence_number="1",
            display_name="货物买卖合同",
            evidence_type=EvidenceType.DOCUMENT,
            submitter="原告",
            submission_date=datetime(2025, 3, 15),
            description="合同",
            status=EvidenceStatus.ADMITTED,
            aliases=["合同"],
            page_count=5,
        )
        
        evidence2 = Evidence(
            evidence_number="2",
            display_name="送货单",
            evidence_type=EvidenceType.DOCUMENT,
            submitter="原告",
            submission_date=datetime(2025, 3, 18),
            description="送货单",
            status=EvidenceStatus.ADMITTED,
            aliases=["收货单"],
            page_count=2,
        )
        
        catalog = EvidenceCatalog(
            case_number="test_001",
            case_name="测试案件",
        )
        catalog.add_evidence(evidence1)
        catalog.add_evidence(evidence2)
        
        ref1 = Reference(
            evidence_number="1",
            reference_type=ReferenceType.TRANSCRIPT,
            source_context="出示证据1",
            source_file="庭审笔录.md",
        )
        
        from court_evidence_checker.rules import RuleContext
        
        rules = [
            MissingReferenceRule(),
            DateConflictRule(),
            UnhandledObjectionRule(),
        ]
        
        rule_context = RuleContext(
            evidence_catalog=catalog,
            references=[ref1],
            objections=[],
        )
        
        engine = RuleEngine(rules)
        check_result = engine.run_all(context=rule_context)
        
        print(f"  ✓ 规则引擎执行: {len(check_result.results)} 个结果")
        print(f"  ✓ 总问题数: {check_result.issue_count}")
        
        for result in check_result.results:
            print(f"    - {result.rule_type.value}: {result.message[:50]}...")
        
    except Exception as e:
        print(f"  ✗ 规则引擎测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("  ✓ 规则引擎测试通过!")
    print()
    return True


def test_full_workflow():
    """测试完整工作流程"""
    print("[可选] 测试完整工作流程...")
    
    from court_evidence_checker.sample_data import generate_sample_files
    from court_evidence_checker.parsers import (
        EvidenceCSVParser, MarkdownTranscriptParser,
        CrossExaminationJSONParser, JudgmentDraftParser,
    )
    from court_evidence_checker.models import CheckSession, EvidenceCatalog
    from court_evidence_checker.rules import RuleEngine, MissingReferenceRule
    
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            
            print("  步骤 1: 生成样例数据...")
            files = generate_sample_files(tmp_path)
            print(f"    ✓ 生成 {len(files)} 个文件")
            
            print("  步骤 2: 解析文件...")
            session = CheckSession(
                session_id="full_test_001",
                created_at=datetime.now(),
            )
            
            csv_parser = EvidenceCSVParser()
            csv_result = csv_parser.parse(files["evidence_list"])
            if csv_result.success and csv_result.data:
                if "evidence_catalog" in csv_result.data:
                    catalog_data = csv_result.data["evidence_catalog"]
                    session.evidence_catalog = EvidenceCatalog.from_dict(catalog_data)
                    print(f"    ✓ 解析证据目录: {len(session.evidence_catalog.evidences)} 条证据")
            
            md_parser = MarkdownTranscriptParser()
            md_result = md_parser.parse(files["transcript"])
            if md_result.success and md_result.data:
                if "references" in md_result.data:
                    from court_evidence_checker.models import Reference
                    for ref_data in md_result.data["references"]:
                        ref = Reference.from_dict(ref_data)
                        session.references.append(ref)
                    print(f"    ✓ 解析庭审笔录: {len(session.references)} 个引用")
            
            print("  步骤 3: 运行规则引擎...")
            from court_evidence_checker.rules import RuleContext
            rules = [MissingReferenceRule()]
            
            references = []
            for ref_data in session.references:
                from court_evidence_checker.models import Reference
                if isinstance(ref_data, dict):
                    references.append(Reference.from_dict(ref_data))
                else:
                    references.append(ref_data)
            
            rule_context = RuleContext(
                evidence_catalog=session.evidence_catalog,
                references=references,
                objections=[],
            )
            
            engine = RuleEngine(rules)
            check_result = engine.run_all(context=rule_context)
            print(f"    ✓ 发现 {len(check_result.results)} 个问题")
            
            print("  步骤 4: 导出报告...")
            from court_evidence_checker.exporters import export_json_audit
            report_path = tmp_path / "审计包.json"
            session.check_result = check_result
            export_json_audit(
                output_path=report_path,
                check_result=check_result,
                check_session=session,
            )
            print(f"    ✓ 报告已导出: {report_path}")
            
    except Exception as e:
        print(f"  ✗ 完整工作流测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("  ✓ 完整工作流测试通过!")
    print()
    return True


def main():
    """主验证函数"""
    all_passed = True
    
    all_passed = test_imports() and all_passed
    all_passed = test_models() and all_passed
    all_passed = test_sample_data() and all_passed
    all_passed = test_parsers() and all_passed
    all_passed = test_rules() and all_passed
    
    print("=" * 60)
    if all_passed:
        print("[green]✓ 所有核心验证测试通过![/green]")
        print()
        print("项目验证成功！您可以使用以下命令：")
        print("  python3 -m court_evidence_checker.cli --help")
        print()
        print("或者安装后直接使用：")
        print("  evidence-checker --help")
    else:
        print("[red]✗ 部分验证测试失败![/red]")
        print("请检查错误信息并修复问题。")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
