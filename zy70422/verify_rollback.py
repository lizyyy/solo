import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, Base, engine
from app.models import (
    RollbackCandidate, RollbackStatus, RollbackType,
    NightlyInspection, FinancialCloseApproval
)
from app.services import (
    create_rollback_candidate, approve_rollback_candidate,
    execute_rollback, get_rollback_comparison,
    filter_rollback_candidates, cleanup_pending_candidates,
    create_nightly_inspection, get_grayscale_inspections,
    create_financial_close, approve_financial_close,
    manually_confirm_financial_close
)
from datetime import datetime, timedelta

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    print("=" * 60)
    print("  配置回滚审批核心功能验证")
    print("=" * 60)
    
    # 1. 测试回滚候选创建
    print("\n1. 🔹 测试回滚候选创建")
    candidate = create_rollback_candidate(db, {
        'candidate_type': RollbackType.FINANCIAL.value,
        'title': '财务数据回滚 - 2024年5月结转',
        'description': '需要回滚上月错误的财务结转数据',
        'summary': '包含总账、应收、应付三个模块',
        'is_urgent': True,
        'created_by': '财务主管'
    })
    print(f"   ✅ 创建成功: ID={candidate.id}, 状态={candidate.status.value}")
    assert candidate.status == RollbackStatus.PENDING
    
    # 2. 测试审批通过
    print("\n2. 🔹 测试审批流程")
    candidate = approve_rollback_candidate(db, candidate.id, '财务总监', '数据验证通过，同意回滚', True)
    print(f"   ✅ 审批通过成功: 状态={candidate.status.value}, 审批人={candidate.approver}")
    assert candidate.status == RollbackStatus.APPROVED
    
    # 3. 测试执行回滚
    print("\n3. 🔹 测试执行回滚")
    execution = execute_rollback(db, candidate.id, '系统管理员')
    print(f"   ✅ 执行回滚成功: 状态={execution.status.value}")
    print(f"      成功数/总数: {execution.success_count}/{execution.total_count}")
    print(f"      执行时间: {execution.execution_time_ms}ms")
    print(f"      下一步建议: {execution.next_suggestion}")
    
    # 4. 测试处理前后对比
    print("\n4. 🔹 测试处理前后对比")
    comparison = get_rollback_comparison(db, candidate.id)
    print(f"   ✅ 对比获取成功:")
    print(f"      执行前: {comparison['before_state']}")
    print(f"      执行后: {comparison['after_state']}")
    
    # 5. 测试按摘要关键词过滤
    print("\n5. 🔹 测试按摘要关键词过滤查询")
    filtered = filter_rollback_candidates(db, summary_keyword='总账')
    print(f"   ✅ 按'总账'关键词过滤: 找到 {len(filtered)} 条记录")
    
    # 6. 测试灰度夜间巡检
    print("\n6. 🔹 测试灰度夜间巡检")
    inspection = create_nightly_inspection(db, {
        'is_grayscale': True,
        'region': '华东区',
        'target_type': '财务系统',
        'total_checks': 50,
        'passed_checks': 48,
        'failed_checks': 2,
        'materials': '巡检报告_v1.pdf, 灰度环境状态截图.png',
        'result_summary': '核心功能正常，仅2个非关键用例超时',
        'executed_by': '自动化测试系统'
    })
    print(f"   ✅ 灰度巡检创建成功: ID={inspection.id}, 区域={inspection.region}")
    
    grayscale_list = get_grayscale_inspections(db, '华东区')
    print(f"   ✅ 灰度巡检列表查询成功: 共 {len(grayscale_list)} 条")
    
    # 7. 测试财务结转人工确认
    print("\n7. 🔹 测试财务结转人工确认流程")
    close = create_financial_close(db, {
        'close_period': '2024-05',
        'total_amount': 1258000.50,
        'record_count': 328,
        'summary': '2024年5月财务结转数据',
        'created_by': '财务主管'
    })
    print(f"   ✅ 财务结转创建成功: ID={close.id}, 期间={close.close_period}")
    
    close = approve_financial_close(db, close.id, '财务总监', '数据复核无误', True)
    print(f"   ✅ 财务结转审批通过: 状态={close.status.value}, 审批人={close.approver}")
    
    close = manually_confirm_financial_close(db, close.id, '财务主管', '人工复核确认')
    print(f"   ✅ 人工确认成功: 已确认={close.manually_confirmed}, 确认人={close.confirmed_by}")
    assert close.status == RollbackStatus.SUCCESS
    
    # 8. 测试清理过期待审批候选
    print("\n8. 🔹 测试清理过期待审批候选")
    cleaned = cleanup_pending_candidates(db, 0)
    print(f"   ✅ 清理完成: 已清理 {cleaned} 个过期候选")
    
    print("\n" + "=" * 60)
    print("  ✅ 所有核心功能验证通过！")
    print("=" * 60)
    
finally:
    db.close()
