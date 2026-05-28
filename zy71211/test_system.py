import sys
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import (
    Customer, LoanApplication, CustomerDocument, CancellationReason,
    ApplicationStatus
)
from services import (
    ApplicationStateMachine, CancellationService, DocumentValidator,
    SpecialCaseDetector, FollowupService, CancellationListService
)


def run_tests():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    print("=" * 60)
    print("消费贷批量撤件系统 - 核心功能测试")
    print("=" * 60)

    passed = 0
    failed = 0

    try:
        print("\n1. 测试客户创建...")
        customer = Customer(
            id_card="310101199001011234",
            name="张三",
            phone="13800138000"
        )
        session.add(customer)
        session.commit()
        session.refresh(customer)
        assert customer.id is not None
        print("   ✓ 客户创建成功")
        passed += 1

        print("\n2. 测试贷款申请创建...")
        application = LoanApplication(
            application_no="TEST202401010001",
            customer_id=customer.id,
            loan_amount=100000,
            loan_term=12,
            status=ApplicationStatus.SUBMITTED
        )
        session.add(application)
        session.commit()
        session.refresh(application)
        assert application.id is not None
        assert application.status == ApplicationStatus.SUBMITTED
        print("   ✓ 贷款申请创建成功")
        passed += 1

        print("\n3. 测试状态机流转 (已提交 → 审批中)...")
        success, msg = ApplicationStateMachine.transition(
            session, application, ApplicationStatus.REVIEWING, "操作员A"
        )
        assert success
        assert application.status == ApplicationStatus.REVIEWING
        print("   ✓ 状态流转成功")
        passed += 1

        print("\n4. 测试无效状态流转...")
        application.status = ApplicationStatus.CANCELLED
        session.commit()
        success, msg = ApplicationStateMachine.transition(
            session, application, ApplicationStatus.LOANED, "操作员A"
        )
        assert not success
        print("   ✓ 无效状态流转被正确拦截")
        passed += 1

        application.status = ApplicationStatus.REVIEWING
        session.commit()

        print("\n5. 测试添加客户资料...")
        doc = CustomerDocument(
            application_id=application.id,
            doc_type="身份证",
            doc_no="310101199001011234",
            issue_date=date.today() - timedelta(days=365),
            expiry_date=date.today() + timedelta(days=365)
        )
        session.add(doc)
        session.commit()
        print("   ✓ 客户资料添加成功")
        passed += 1

        print("\n6. 测试资料有效期校验（未过期）...")
        is_valid, warnings = DocumentValidator.check_doc_expiry(session, application.id)
        assert is_valid
        assert len(warnings) == 0
        print("   ✓ 未过期资料校验通过")
        passed += 1

        print("\n7. 测试资料有效期校验（已过期）...")
        doc.expiry_date = date.today() - timedelta(days=1)
        session.commit()
        is_valid, warnings = DocumentValidator.check_doc_expiry(session, application.id)
        assert not is_valid
        assert len(warnings) > 0
        print(f"   ✓ 过期资料检测成功: {warnings[0]}")
        passed += 1

        doc.expiry_date = date.today() + timedelta(days=365)
        session.commit()

        print("\n8. 测试撤件幂等性...")
        cancel1, warnings1 = CancellationService.create_cancellation(
            session, application, CancellationReason.CUSTOMER_REGRET, "客户不需要了", "操作员A"
        )
        cancel2, warnings2 = CancellationService.create_cancellation(
            session, application, CancellationReason.CUSTOMER_REGRET, "客户不需要了", "操作员A"
        )
        assert cancel1.id == cancel2.id
        assert "幂等校验" in warnings2[0]
        print("   ✓ 撤件幂等性校验通过")
        passed += 1

        session.delete(cancel1)
        application.status = ApplicationStatus.REVIEWING
        session.commit()

        print("\n9. 测试审批中撤件检测...")
        warnings = SpecialCaseDetector.detect(session, application)
        assert any("审批中撤件" in w for w in warnings)
        print(f"   ✓ 审批中撤件检测成功: {warnings[0]}")
        passed += 1

        print("\n10. 测试同客户重复申请检测...")
        app2 = LoanApplication(
            application_no="TEST202401010002",
            customer_id=customer.id,
            loan_amount=50000,
            status=ApplicationStatus.SUBMITTED
        )
        session.add(app2)
        session.commit()
        warnings = SpecialCaseDetector.detect(session, application)
        assert any("重复申请" in w for w in warnings)
        print(f"   ✓ 重复申请检测成功: {[w for w in warnings if '重复申请' in w][0]}")
        passed += 1

        print("\n11. 测试回访留痕...")
        followup1 = FollowupService.add_followup(
            session, application.id, "电话回访", "客户表示再考虑一下", "客服A"
        )
        assert followup1.version == 1
        assert followup1.is_original
        print("   ✓ 初始回访记录创建成功")

        followup2 = FollowupService.add_followup(
            session, application.id, "电话回访", "客户最终确认撤件", "客服A", followup1.id
        )
        assert followup2.version == 2
        assert not followup2.is_original
        assert followup2.parent_id == followup1.id
        print("   ✓ 回访修正记录创建成功，版本号正确递增，原始记录未覆盖")
        passed += 1

        print("\n12. 测试待复核标记...")
        doc.expiry_date = date.today() - timedelta(days=1)
        session.commit()
        application.status = ApplicationStatus.REVIEWING
        cancel, warnings = CancellationService.create_cancellation(
            session, application, CancellationReason.DOC_EXPIRED, "身份证过期", "操作员A"
        )
        session.refresh(application)
        assert application.review_status == "待复核"
        print("   ✓ 存在风险时自动标记为待复核")
        passed += 1

        print("\n13. 测试撤件分类统计...")
        app3 = LoanApplication(
            application_no="TEST202401010003",
            customer_id=customer.id,
            loan_amount=80000,
            status=ApplicationStatus.REVIEWING
        )
        session.add(app3)
        session.commit()
        CancellationService.create_cancellation(
            session, app3, CancellationReason.RISK_REJECTED, "风控评分不足", "风控员B"
        )

        app4 = LoanApplication(
            application_no="TEST202401010004",
            customer_id=customer.id,
            loan_amount=60000,
            status=ApplicationStatus.REVIEWING
        )
        session.add(app4)
        session.commit()
        CancellationService.create_cancellation(
            session, app4, CancellationReason.CUSTOMER_REGRET, "找到更低利率", "操作员B"
        )

        cancel_list = CancellationListService.generate_daily_list(session, date.today(), "管理员")
        assert cancel_list.total_count >= 3
        assert cancel_list.customer_regret_count >= 1
        assert cancel_list.risk_rejected_count >= 1
        assert cancel_list.doc_expired_count >= 1
        print(f"   ✓ 撤件清单生成成功: 总计{cancel_list.total_count}件")
        print(f"     - 客户反悔: {cancel_list.customer_regret_count}件")
        print(f"     - 资料过期: {cancel_list.doc_expired_count}件")
        print(f"     - 风控拒绝: {cancel_list.risk_rejected_count}件")
        passed += 1

        print("\n14. 测试清单导出数据完整性...")
        items = CancellationListService.get_list_data(session, cancel_list.id)
        assert len(items) == cancel_list.total_count
        for item in items:
            assert item["customer_name"] is not None
            assert item["application_no"] is not None
            assert item["cancellation_reason"] is not None
        print("   ✓ 清单数据完整，所有字段齐全")
        passed += 1

        print("\n15. 测试特殊场景汇总...")
        app5 = LoanApplication(
            application_no="TEST202401010005",
            customer_id=customer.id,
            loan_amount=200000,
            status=ApplicationStatus.LOANED
        )
        session.add(app5)
        session.commit()
        doc2 = CustomerDocument(
            application_id=app5.id,
            doc_type="收入证明",
            expiry_date=date.today() - timedelta(days=10)
        )
        session.add(doc2)
        session.commit()

        warnings = SpecialCaseDetector.detect(session, app5)
        assert any("资料已过期但已放款" in w for w in warnings)
        print(f"   ✓ 资料过期仍放款检测成功")
        passed += 1

        print("\n" + "=" * 60)
        print(f"测试完成: {passed} 项通过, {failed} 项失败")
        print("=" * 60)

        print("\n核心功能验证总结:")
        print("  ✓ 申请状态机 - 状态流转正确，无效流转被拦截")
        print("  ✓ 撤件幂等性 - 相同申请+原因不会重复创建")
        print("  ✓ 资料有效期 - 自动检测过期，生成人读提示")
        print("  ✓ 回访留痕 - 修正不覆盖原始，版本递增")
        print("  ✓ 特殊场景 - 审批中撤件、过期放款、重复申请均检测")
        print("  ✓ 待复核 - 异常记录自动标记，不硬塞正常结果")
        print("  ✓ 清单导出 - 三类撤件分开统计，数据完整")

        return passed == 15

    except Exception as e:
        print(f"\n   ✗ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        session.close()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)