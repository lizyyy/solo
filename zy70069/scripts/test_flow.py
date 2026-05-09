#!/usr/bin/env python3
"""测试毕业资格预审完整流程"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import PreReviewStatus
from app.services.pre_review_service import PreReviewEngine


def print_separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_initial_calculation(engine, db):
    print_separator("步骤 1: 初次计算所有学生的毕业资格")
    
    from app.models import Student
    students = db.query(Student).all()
    
    for student in students:
        pre_review, missing_items = engine.calculate_pre_review(student.id, operator="test")
        status_emoji = "✅" if pre_review.is_eligible else "❌"
        print(f"\n{student.name} ({student.student_id}):")
        print(f"  状态: {status_emoji} {pre_review.status}")
        print(f"  是否合格: {pre_review.is_eligible}")
        if missing_items:
            print(f"  缺项数量: {len(missing_items)}")
            for item in missing_items:
                print(f"    - [{item.error_code}] {item.message}")


def test_manual_review(engine, db):
    print_separator("步骤 2: 人工复核 - 手动通过一个不符合资格的学生")
    
    from app.models import Student, PreReview
    
    ineligible_student = db.query(Student).filter(Student.name == "李四").first()
    if not ineligible_student:
        print("未找到学生 '李四'")
        return
    
    pre_review = db.query(PreReview).filter(
        PreReview.student_id == ineligible_student.id
    ).order_by(PreReview.created_at.desc()).first()
    
    if pre_review:
        print(f"\n复核前状态: {pre_review.status}")
        
        result = engine.manual_review(
            pre_review_id=pre_review.id,
            new_status=PreReviewStatus.MANUALLY_APPROVED.value,
            reason="特殊情况：学分虽不足但有其他优秀表现，经学院审议通过",
            operator="审核员-张老师"
        )
        
        print(f"复核后状态: {result.status}")
        print(f"是否合格: {result.is_eligible}")


def test_batch_recalculation(engine, db):
    print_separator("步骤 3: 批量重算（模拟规则变更或数据更新后）")
    
    from app.models import Student
    students = db.query(Student).all()
    
    print(f"\n将重算 {len(students)} 个学生的资格...")
    
    results = []
    for student in students:
        try:
            pre_review, _ = engine.calculate_pre_review(
                student.id,
                force_recalculate=True,
                operator="batch_job"
            )
            results.append((student.name, pre_review.status, pre_review.is_eligible))
        except Exception as e:
            print(f"  ❌ {student.name}: 计算失败 - {str(e)}")
    
    print(f"\n重算结果汇总:")
    eligible = sum(1 for _, _, e in results if e)
    ineligible = len(results) - eligible
    print(f"  合格: {eligible} 人")
    print(f"  不合格: {ineligible} 人")


def test_status_protection(engine, db):
    print_separator("步骤 4: 验证人工复核状态保护")
    
    from app.models import Student, PreReview
    
    approved_student = db.query(Student).filter(Student.name == "李四").first()
    if not approved_student:
        print("未找到学生")
        return
    
    pre_review = db.query(PreReview).filter(
        PreReview.student_id == approved_student.id
    ).order_by(PreReview.created_at.desc()).first()
    
    if pre_review:
        print(f"\n重算前状态: {pre_review.status}")
        print("尝试不使用 force_recalculate 重算...")
        
        result, _ = engine.calculate_pre_review(
            approved_student.id,
            force_recalculate=False,
            operator="test"
        )
        
        print(f"重算后状态: {result.status}")
        print(f"状态未被覆盖: {'是' if result.status == PreReviewStatus.MANUALLY_APPROVED.value else '否'}")


def test_history_record(engine, db):
    print_separator("步骤 5: 查看历史记录")
    
    from app.models import Student, HistoryRecord
    
    student = db.query(Student).filter(Student.name == "李四").first()
    if not student:
        print("未找到学生")
        return
    
    history = db.query(HistoryRecord).filter(
        HistoryRecord.student_id == student.id
    ).order_by(HistoryRecord.created_at.desc()).limit(10).all()
    
    print(f"\n{student.name} 的历史记录:")
    for record in history:
        print(f"\n  [{record.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {record.record_type}")
        print(f"    操作人: {record.operator}")
        print(f"    原因: {record.change_reason}")
        if record.after_data:
            print(f"    变更后: {record.after_data}")


def test_report_generation(engine, db):
    print_separator("步骤 6: 生成预审报告")
    
    report = engine.generate_report_summary()
    
    print(f"\n报告摘要:")
    print(f"  学生总数: {report['total_students']}")
    print(f"  合格: {report['eligible_count']} 人")
    print(f"  不合格: {report['ineligible_count']} 人")
    print(f"  待处理: {report['pending_count']} 人")
    print(f"  人工通过: {report['manually_approved_count']} 人")
    print(f"  人工驳回: {report['manually_rejected_count']} 人")
    
    print(f"\n缺项按类别分布:")
    for category, count in report['missing_items_by_category'].items():
        if count > 0:
            print(f"  {category}: {count} 项")
    
    if report['top_missing_items']:
        print(f"\n最常见的缺项 (Top 10):")
        for item in report['top_missing_items']:
            print(f"  [{item['category']}] {item['message']}: {item['count']} 人")


def main():
    print("毕业资格预审系统 - 完整流程测试")
    print("=" * 60)
    
    db = SessionLocal()
    engine = PreReviewEngine(db)
    
    try:
        test_initial_calculation(engine, db)
        test_manual_review(engine, db)
        test_batch_recalculation(engine, db)
        test_status_protection(engine, db)
        test_history_record(engine, db)
        test_report_generation(engine, db)
        
        print("\n" + "=" * 60)
        print("测试完成！")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    main()
