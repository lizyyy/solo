#!/usr/bin/env python3
"""测试理赔对账服务测试脚本"""

import sys
import json
from datetime import datetime, timedelta

from models import ClaimApplication, ClaimItem, Material, Policy, PolicyCoverage, MaterialType, ClaimStatus, ReviewAction, ReviewRequest
from data_import import DataImporter
from rules_engine import RulesEngine
from reconciliation import ReconciliationService
from report_generator import ReportGenerator


def generate_sample_policy() -> Policy:
    return Policy(
        policy_id="P001",
        policy_number="POL-2024-001",
        insured_name="张三",
        id_number="310101199001011234",
        effective_date=datetime.now() - timedelta(days=180),
        expiry_date=datetime.now() + timedelta(days=180),
        coverages=[
            PolicyCoverage(
                coverage_type="住院医疗",
                limit_amount=50000,
                used_amount=10000,
                deductible=100,
                ratio=0.9
            ),
            PolicyCoverage(
                coverage_type="门诊医疗",
                limit_amount=10000,
                used_amount=2000,
                deductible=50,
                ratio=0.8
            )
        ],
        total_limit=60000,
        remaining_limit=48000.0
    )


def generate_normal_claim() -> ClaimApplication:
    return ClaimApplication(
        claim_id="C001",
        claim_number="CLM-2024-001",
        policy_id="P001",
        applicant_name="张三",
        applicant_id="310101199001011234",
        claim_date=datetime.now(),
        materials=[
            Material(
                material_id="M001",
                material_type=MaterialType.INVOICE,
                name="发票-20240101",
                upload_time=datetime.now(),
                is_valid=True
            ),
            Material(
                material_id="M002",
                material_type=MaterialType.ID_CARD,
                name="身份证",
                upload_time=datetime.now(),
                is_valid=True
            ),
            Material(
                material_id="M003",
                material_type=MaterialType.BANK_CARD,
                name="银行卡",
                upload_time=datetime.now(),
                is_valid=True
            ),
            Material(
                material_id="M004",
                material_type=MaterialType.DIAGNOSIS,
                name="诊断证明",
                upload_time=datetime.now(),
                is_valid=True
            ),
        ],
        claim_items=[
            ClaimItem(
                item_id="I001",
                expense_type="住院医疗",
                expense_date=datetime.now() - timedelta(days=5),
                invoice_number="发票-20240101",
                invoice_amount=15000,
                claimed_amount=13400,
                hospital="上海市第一人民医院",
                diagnosis="急性支气管炎"
            )
        ],
        total_claimed_amount=13400.0,
        status=ClaimStatus.PENDING
    )


def generate_missing_invoice_claim() -> ClaimApplication:
    return ClaimApplication(
        claim_id="C002",
        claim_number="CLM-2024-002",
        policy_id="P001",
        applicant_name="张三",
        applicant_id="310101199001011234",
        claim_date=datetime.now(),
        materials=[
            Material(
                material_id="M001",
                material_type=MaterialType.ID_CARD,
                name="身份证",
                upload_time=datetime.now(),
                is_valid=True
            ),
        ],
        claim_items=[
            ClaimItem(
                item_id="I001",
                expense_type="住院医疗",
                expense_date=datetime.now() - timedelta(days=5),
                invoice_number="发票-20240102",
                invoice_amount=8000,
                claimed_amount=7200,
                hospital="上海市第一人民医院",
                diagnosis="急性肠胃炎"
            )
        ],
        total_claimed_amount=7200.0,
        status=ClaimStatus.PENDING
    )


def generate_amount_exceeded_claim() -> ClaimApplication:
    return ClaimApplication(
        claim_id="C003",
        claim_number="CLM-2024-003",
        policy_id="P001",
        applicant_name="张三",
        applicant_id="310101199001011234",
        claim_date=datetime.now(),
        materials=[
            Material(
                material_id="M001",
                material_type=MaterialType.INVOICE,
                name="发票-20240103",
                upload_time=datetime.now(),
                is_valid=True
            ),
            Material(
                material_id="M002",
                material_type=MaterialType.ID_CARD,
                name="身份证",
                upload_time=datetime.now(),
                is_valid=True
            ),
            Material(
                material_id="M003",
                material_type=MaterialType.BANK_CARD,
                name="银行卡",
                upload_time=datetime.now(),
                is_valid=True
            ),
            Material(
                material_id="M004",
                material_type=MaterialType.DIAGNOSIS,
                name="诊断证明",
                upload_time=datetime.now(),
                is_valid=True
            ),
        ],
        claim_items=[
            ClaimItem(
                item_id="I001",
                expense_type="住院医疗",
                expense_date=datetime.now() - timedelta(days=5),
                invoice_number="发票-20240103",
                invoice_amount=55000,
                claimed_amount=49500,
                hospital="上海市第一人民医院",
                diagnosis="骨折"
            )
        ],
        total_claimed_amount=49500.0,
        status=ClaimStatus.PENDING
    )


def test_data_import():
    print("=" * 60)
    print("测试 1: 数据导入模块")
    print("=" * 60)
    
    importer = DataImporter()
    
    claim = generate_normal_claim()
    policy = generate_sample_policy()
    
    importer.imported_claims[claim.claim_id] = claim
    importer.imported_policies[policy.policy_id] = policy
    
    retrieved_claim = importer.get_claim(claim.claim_id)
    retrieved_policy = importer.get_policy(policy.policy_id)
    
    print(f"✓ 导入理赔记录: {retrieved_claim.claim_number}")
    print(f"✓ 导入保单: {retrieved_policy.policy_number}")
    print(f"✓ 材料数量: {len(retrieved_claim.materials)}")
    print(f"✓ 费用项目数: {len(retrieved_claim.claim_items)}")
    print()


def test_rules_engine():
    print("=" * 60)
    print("测试 2: 规则引擎")
    print("=" * 60)
    
    engine = RulesEngine()
    
    policy = generate_sample_policy()
    
    print("测试正常案例:")
    normal_claim = generate_normal_claim()
    issues = engine.validate_claim(normal_claim, policy)
    print(f"  发现问题数: {len(issues)}")
    for issue in issues:
        print(f"  - {issue.issue_type.value}: {issue.message}")
    
    print("\n缺发票案例:")
    missing_inv_claim = generate_missing_invoice_claim()
    issues = engine.validate_claim(missing_inv_claim, policy)
    print(f"  发现问题数: {len(issues)}")
    for issue in issues:
        print(f"  - {issue.issue_type.value}: {issue.message}")
    
    print("\n金额超限案例:")
    amount_claim = generate_amount_exceeded_claim()
    issues = engine.validate_claim(amount_claim, policy)
    print(f"  发现问题数: {len(issues)}")
    for issue in issues:
        print(f"  - {issue.issue_type.value}: {issue.message}")
    
    print()


def test_reconciliation_service():
    print("=" * 60)
    print("测试 3: 对账服务")
    print("=" * 60)
    
    service = ReconciliationService()
    policy = generate_sample_policy()
    
    claim1 = generate_normal_claim()
    result1 = service.process_claim(claim1, policy)
    print(f"案例1 - 正常案例:")
    print(f"  状态: {result1.status.value}")
    print(f"  问题数: {len(result1.issues)}")
    print(f"  申报金额: {result1.total_claimed_amount}")
    print(f"  系统计算金额: {result1.system_calculated_amount}")
    
    claim2 = generate_missing_invoice_claim()
    result2 = service.process_claim(claim2, policy)
    print(f"\n案例2 - 缺发票:")
    print(f"  状态: {result2.status.value}")
    print(f"  问题数: {len(result2.issues)}")
    
    claim3 = generate_amount_exceeded_claim()
    result3 = service.process_claim(claim3, policy)
    print(f"\n案例3 - 金额超限:")
    print(f"  状态: {result3.status.value}")
    print(f"  问题数: {len(result3.issues)}")
    
    print(f"\n汇总统计:")
    summary = service.get_summary()
    print(f"  总件数: {summary.total_claims}")
    print(f"  已通过: {summary.approved_count}")
    print(f"  待补材料: {summary.supplement_count}")
    print(f"  待复核: {summary.pending_count}")
    
    print()
    return service.clear_all()


def test_review_process():
    print("=" * 60)
    print("测试 4: 复核流程")
    print("=" * 60)
    
    service = ReconciliationService()
    policy = generate_sample_policy()
    
    claim = generate_missing_invoice_claim()
    result = service.process_claim(claim, policy)
    
    print(f"复核前状态: {result.status.value}")
    
    review_request = ReviewRequest(
        claim_id=claim.claim_id,
        action=ReviewAction.REQUEST_SUPPLEMENT,
        reviewer="李四",
        notes="请补充发票原件",
        resolved_issues=[]
    )
    
    reviewed_result = service.process_review(review_request)
    
    print(f"复核后状态: {reviewed_result.status.value}")
    print(f"复核人: {reviewed_result.reviewed_by}")
    print(f"复核备注: {reviewed_result.reviewer_notes}")
    
    print()
    service.clear_all()


def test_report_generation():
    print("=" * 60)
    print("测试 5: 报告生成")
    print("=" * 60)
    
    service = ReconciliationService()
    generator = ReportGenerator()
    policy = generate_sample_policy()
    
    claim1 = generate_normal_claim()
    claim2 = generate_missing_invoice_claim()
    claim3 = generate_amount_exceeded_claim()
    
    service.process_claim(claim1, policy)
    service.process_claim(claim2, policy)
    service.process_claim(claim3, policy)
    
    result = service.get_result(claim1.claim_id)
    detail_report = generator.generate_detail_report_text(result)
    print("明细报告预览:")
    print("\n".join(detail_report.split("\n")[:15]))
    print("...\n")
    
    summary = service.get_summary()
    summary_report = generator.generate_summary_report_text(summary)
    print("汇总报告预览:")
    print("\n".join(summary_report.split("\n")[:20]))
    print("...\n")
    
    justification = service.generate_justification_text(claim2.claim_id)
    print("理赔说明预览:")
    print(justification)
    
    print()
    service.clear_all()


def test_issue_explanation():
    print("=" * 60)
    print("测试 6: 问题解释")
    print("=" * 60)
    
    service = ReconciliationService()
    policy = generate_sample_policy()
    
    claim = generate_amount_exceeded_claim()
    service.process_claim(claim, policy)
    
    from models import IssueType
    explanation = service.get_issue_explanation(claim.claim_id, IssueType.AMOUNT_EXCEEDED)
    
    if explanation:
        print(f"问题类型: {explanation['type']}")
        print(f"严重程度: {explanation['severity']}")
        print(f"问题描述: {explanation['message']}")
        print(f"影响描述: {explanation['impact']['description']}")
        print(f"金额影响: {explanation['impact']['financial_impact']:,.2f} 元")
    
    print()
    service.clear_all()


def main():
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 15 + "理赔对账服务 - 功能测试" + " " * 17 + "║")
    print("╚" + "=" * 58 + "╝")
    print("\n")
    
    try:
        test_data_import()
        test_rules_engine()
        test_reconciliation_service()
        test_review_process()
        test_report_generation()
        test_issue_explanation()
        
        print("=" * 60)
        print("✓ 所有测试完成!")
        print("=" * 60)
        print("\n提示: 运行 'python main.py' 启动API服务")
        print("然后访问 http://localhost:8000/docs 查看API文档")
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
