#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.models import Project
from app.services.import_service import DataImportService
from app.services.auto_check_engine import AutoCheckEngine
from app.services.review_service import ReviewService
from app.services.report_service import ReportService
from app.schemas.schemas import ReviewRecordCreate, ReviewAction, FinalStatus


def main():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    
    try:
        print("=" * 60)
        print("装修监理对账服务 - 完整流程测试")
        print("=" * 60)
        
        print("\n1. 创建测试项目...")
        project = Project(
            project_name="阳光花园A栋1001室装修工程",
            project_address="阳光花园A栋1001室",
            customer_name="李先生",
            total_amount=103000
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        print(f"   ✓ 项目创建成功: {project.project_name} (ID: {project.id})")
        
        print("\n2. 导入节点CSV...")
        import_service = DataImportService(db)
        with open("data/sample_nodes.csv", "rb") as f:
            content = f.read()
        result = import_service.import_nodes_csv(project.id, content, "sample_nodes.csv")
        print(f"   ✓ {result.message}")
        if result.errors:
            for err in result.errors[:3]:
                print(f"   ⚠ {err}")
        
        print("\n3. 导入照片JSON...")
        with open("data/sample_photos.json", "rb") as f:
            content = f.read()
        result = import_service.import_photos_json(project.id, content, "sample_photos.json")
        print(f"   ✓ {result.message}")
        if result.errors:
            for err in result.errors[:3]:
                print(f"   ⚠ {err}")
        
        print("\n4. 导入整改单...")
        with open("data/sample_rectifications.csv", "rb") as f:
            content = f.read()
        result = import_service.import_rectification_orders(project.id, content, "sample_rectifications.csv")
        print(f"   ✓ {result.message}")
        if result.errors:
            for err in result.errors[:3]:
                print(f"   ⚠ {err}")
        
        print("\n5. 运行自动对账...")
        auto_engine = AutoCheckEngine(db)
        recon_result = auto_engine.run_auto_reconciliation(project.id)
        print(f"   ✓ 对账完成，批次号: {recon_result.batch_no}")
        print(f"   - 总节点数: {recon_result.total_nodes}")
        print(f"   - 已完成: {recon_result.completed_nodes}")
        print(f"   - 缺照片: {recon_result.missing_photo_nodes}")
        print(f"   - 逾期: {recon_result.overdue_nodes}")
        print(f"   - 返工次数: {recon_result.rework_count}")
        print(f"   - 扣款金额: {recon_result.total_fine_amount}元")
        print(f"   - 应付金额: {recon_result.payable_amount}元")
        
        print("\n6. 查看对账明细...")
        details = recon_result.details
        for i, detail in enumerate(details[:5], 1):
            print(f"\n   明细 {i}: {detail.node_name}")
            print(f"      照片: {detail.actual_photos}/{detail.required_photos} ({detail.photo_status})")
            print(f"      逾期: {'是' if detail.is_overdue else '否'} ({detail.overdue_days}天)")
            print(f"      返工: {detail.rework_count}次")
            print(f"      扣款: {detail.fine_amount}元")
            print(f"      状态: {detail.final_status}")
            print(f"      说明: {detail.difference_explanation}")
        
        if len(details) > 5:
            print(f"\n   ... 还有 {len(details) - 5} 条明细")
        
        print("\n7. 人工复核 - 放行一条记录...")
        review_service = ReviewService(db)
        detail_to_approve = [d for d in details if d.final_status == "need_material"][0]
        review = ReviewRecordCreate(
            reconciliation_detail_id=detail_to_approve.id,
            reviewer="监理王总监",
            review_action=ReviewAction.APPROVE,
            review_comment="照片虽不全，但关键节点已确认，业主已签字同意",
            final_status=FinalStatus.APPROVED
        )
        review_result = review_service.add_review(review)
        print(f"   ✓ 复核完成: {detail_to_approve.node_name} → 已放行")
        print(f"   复核意见: {review.review_comment}")
        
        print("\n8. 人工复核 - 退回一条记录...")
        rejected_details = [d for d in details if d.is_overdue and d.overdue_days > 0]
        if rejected_details:
            detail_to_reject = rejected_details[0]
        else:
            detail_to_reject = details[1]
        review = ReviewRecordCreate(
            reconciliation_detail_id=detail_to_reject.id,
            reviewer="监理王总监",
            review_action=ReviewAction.REJECT,
            review_comment="逾期完成，且整改不到位，需重新验收",
            final_status=FinalStatus.REJECTED
        )
        review_result = review_service.add_review(review)
        print(f"   ✓ 复核完成: {detail_to_reject.node_name} → 已退回")
        print(f"   复核意见: {review.review_comment}")
        
        print("\n9. 人工复核 - 要求补材料...")
        detail_to_request = [d for d in details if d.photo_status == "missing"][0]
        review = ReviewRecordCreate(
            reconciliation_detail_id=detail_to_request.id,
            reviewer="监理王总监",
            review_action=ReviewAction.REQUEST_MATERIAL,
            review_comment="缺少关键验收照片，请补充施工前、中、后全过程照片",
            final_status=FinalStatus.NEED_MATERIAL,
            difference_source="照片核对时发现完全缺失，无法确认施工质量"
        )
        review_result = review_service.add_review(review)
        print(f"   ✓ 复核完成: {detail_to_request.node_name} → 需补材料")
        print(f"   复核意见: {review.review_comment}")
        
        print("\n10. 查看复核后的汇总数据...")
        from app.services.review_service import RecalculateService
        recalc_service = RecalculateService(db)
        summary = recalc_service.get_summary(recon_result.id)
        print(f"   - 总节点数: {summary.total_nodes}")
        print(f"   - 已放行: {summary.approved_count}")
        print(f"   - 已退回: {summary.rejected_count}")
        print(f"   - 需补材料: {summary.need_material_count}")
        print(f"   - 待处理: {summary.pending_count}")
        print(f"   - 完成率: {summary.completed_rate}%")
        print(f"   - 应付金额: {summary.payable_amount}元")
        
        print("\n11. 生成审计轨迹（单条明细追溯）...")
        report_service = ReportService(db)
        audit_trail = report_service.get_detail_audit_trail(detail_to_approve.id)
        print(f"   节点: {audit_trail['detail']['node_name']}")
        print(f"   最终状态: {audit_trail['detail']['final_status']}")
        print(f"   可解释说明: {audit_trail['explanation']}")
        print(f"   复核记录数: {len(audit_trail['review_history'])}")
        if audit_trail['review_history']:
            for r in audit_trail['review_history']:
                print(f"      - {r['reviewer']}: {r['review_comment']}")
        
        print("\n12. 生成Excel报告...")
        output = report_service.generate_excel_report(recon_result.id)
        report_path = f"data/对账报告_{recon_result.id}.xlsx"
        with open(report_path, "wb") as f:
            f.write(output.getvalue())
        print(f"   ✓ 报告已生成: {report_path}")
        
        print("\n" + "=" * 60)
        print("测试完成！所有流程已验证通过。")
        print("=" * 60)
        
        return recon_result.id
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    result_id = main()
    print(f"\n对账结果ID: {result_id}")
    print(f"启动服务后可访问: http://localhost:8000/docs 查看API文档")
