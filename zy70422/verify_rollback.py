import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, Base, engine
from app.models import (
    RollbackCandidate, RollbackStatus, RollbackType,
    NightlyInspection, FinancialCloseApproval
)
from app.services import (
    BusinessRuleError,
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

def assert_equal(actual, expected, msg=""):
    assert actual == expected, f"{msg} - 期望: {expected}, 实际: {actual}"
    print(f"   ✅ {msg}")

def assert_not_none(value, msg=""):
    assert value is not None, f"{msg} - 值为 None"
    print(f"   ✅ {msg}")

def assert_in(item, container, msg=""):
    assert item in container, f"{msg} - {item} 不在 {container} 中"
    print(f"   ✅ {msg}")

def assert_raises(func, expected_exception, msg=""):
    try:
        func()
        assert False, f"{msg} - 期望抛出异常 {expected_exception}，但未抛出"
    except expected_exception:
        print(f"   ✅ {msg}")
    except Exception as e:
        assert False, f"{msg} - 期望抛出 {expected_exception}，实际抛出 {type(e)}: {e}"

try:
    print("=" * 70)
    print("  配置回滚审批 - 完整闭环验证")
    print("=" * 70)
    
    # 第一部分：回滚候选核心流程验证
    print("\n📋 第一部分：回滚候选核心流程验证")
    
    # 1. 测试创建回滚候选
    print("\n1. 🔹 回滚候选创建验证")
    candidate = create_rollback_candidate(db, {
        'candidate_type': RollbackType.FINANCIAL.value,
        'title': '财务数据回滚 - 2024年5月结转',
        'description': '需要回滚上月错误的财务结转数据',
        'summary': '包含总账、应收、应付三个模块',
        'is_urgent': True,
        'created_by': '财务主管'
    })
    assert_equal(candidate.status, RollbackStatus.PENDING, "新建候选状态为 pending")
    assert_equal(candidate.title, '财务数据回滚 - 2024年5月结转', "标题正确")
    
    # 2. 测试状态机 - PENDING 状态才能审批
    print("\n2. 🔹 状态机边界验证 - 重复审批异常")
    candidate = approve_rollback_candidate(db, candidate.id, '财务总监', '验证通过', True)
    assert_equal(candidate.status, RollbackStatus.APPROVED, "审批后状态为 approved")
    
    def approve_again():
        approve_rollback_candidate(db, candidate.id, '财务总监', '重复审批', True)
    assert_raises(approve_again, BusinessRuleError, "已审批候选再次审批抛出异常")
    
    # 3. 测试全部成功路径（确定性）
    print("\n3. 🔹 全部成功路径验证（确定性）")
    candidate_full = create_rollback_candidate(db, {
        'candidate_type': RollbackType.GRAYSCALE.value,
        'title': '灰度环境配置回滚',
        'description': '灰度环境配置需要回滚',
        'summary': '灰度配置',
        'materials': '[full_success]',
        'created_by': '运维工程师'
    })
    candidate_full = approve_rollback_candidate(db, candidate_full.id, '技术总监', '同意', True)
    execution_full = execute_rollback(db, candidate_full.id, '自动化系统')
    assert_equal(execution_full.status, RollbackStatus.SUCCESS, "[full_success] 标记触发全部成功")
    assert_equal(execution_full.success_count, 50, "全部成功时成功数为 50")
    assert_equal(execution_full.total_count, 50, "全部成功时总数为 50")
    assert_not_none(execution_full.execution_time_ms, "执行时间不为空")
    assert_equal(execution_full.failed_records, None, "全部成功时失败记录为空")
    assert_equal(execution_full.next_suggestion, "回滚全部成功，建议进行验证检查", "下一步建议正确")
    
    # 4. 测试全部失败路径（确定性）
    print("\n4. 🔹 全部失败路径验证（确定性）")
    candidate_fail = create_rollback_candidate(db, {
        'candidate_type': RollbackType.INSPECTION.value,
        'title': '巡检数据回滚 - 全失败场景',
        'summary': '全失败测试',
        'materials': '[full_failure]',
        'created_by': '测试工程师'
    })
    candidate_fail = approve_rollback_candidate(db, candidate_fail.id, '审批人', '同意', True)
    execution_fail = execute_rollback(db, candidate_fail.id, '测试执行器')
    assert_equal(execution_fail.status, RollbackStatus.FAILED, "[full_failure] 标记触发全部失败")
    assert_equal(execution_fail.success_count, 0, "全部失败时成功数为 0")
    assert_equal(execution_fail.total_count, 50, "全部失败时总数为 50")
    assert_not_none(execution_fail.failed_records, "失败时记录失败记录")
    assert_equal(execution_fail.next_suggestion, "建议检查环境配置后重新执行", "失败建议正确")
    
    # 5. 测试部分成功路径（确定性，只成功一半）
    print("\n5. 🔹 部分成功路径验证（确定性 - 只成功一半）")
    candidate_partial = create_rollback_candidate(db, {
        'candidate_type': RollbackType.GENERAL.value,
        'title': '通用配置回滚 - 部分成功场景',
        'summary': '部分成功测试',
        'materials': '[partial_success]',
        'created_by': '开发工程师'
    })
    candidate_partial = approve_rollback_candidate(db, candidate_partial.id, '审批人', '同意', True)
    execution_partial = execute_rollback(db, candidate_partial.id, '测试执行器')
    assert_equal(execution_partial.status, RollbackStatus.PARTIAL_SUCCESS, "[partial_success] 标记触发部分成功")
    assert_equal(execution_partial.success_count, 25, "部分成功时成功数为 25（一半）")
    assert_equal(execution_partial.total_count, 50, "部分成功时总数为 50")
    assert_equal(execution_partial.next_suggestion, "建议先处理失败记录，然后重新执行剩余部分", "部分成功建议正确")
    
    # 6. 测试 force_mode 参数覆盖
    print("\n6. 🔹 force_mode 参数覆盖验证")
    candidate_force = create_rollback_candidate(db, {
        'candidate_type': RollbackType.FINANCIAL.value,
        'title': 'force_mode 覆盖测试',
        'summary': 'force_mode 测试',
        'materials': '[full_success]',
        'created_by': '测试工程师'
    })
    candidate_force = approve_rollback_candidate(db, candidate_force.id, '审批人', '同意', True)
    execution_force = execute_rollback(db, candidate_force.id, '测试执行器', 'partial_success')
    assert_equal(execution_force.status, RollbackStatus.PARTIAL_SUCCESS, "force_mode=partial_success 覆盖 materials 标记")
    
    # 7. 测试状态机 - 非 APPROVED 不能执行
    print("\n7. 🔹 状态机边界验证 - 非审批状态不能执行")
    candidate_pending = create_rollback_candidate(db, {
        'candidate_type': RollbackType.FINANCIAL.value,
        'title': '待审批测试',
        'summary': '待审批',
        'created_by': '测试'
    })
    def execute_pending():
        execute_rollback(db, candidate_pending.id, '执行器')
    assert_raises(execute_pending, BusinessRuleError, "待审批候选直接执行抛出异常")
    
    # 8. 测试处理前后对比
    print("\n8. 🔹 处理前后对比验证")
    comparison = get_rollback_comparison(db, candidate_full.id)
    assert_equal(comparison['candidate_id'], candidate_full.id, "候选ID正确")
    assert_not_none(comparison['before_state'], "执行前状态不为空")
    assert_not_none(comparison['after_state'], "执行后状态不为空")
    assert_equal(comparison['status'], 'success', "对比中的状态正确")
    assert_equal(comparison['success_count'], 50, "对比中的成功数正确")
    assert_equal(comparison['total_count'], 50, "对比中的总数正确")
    
    # 9. 测试按摘要关键词过滤
    print("\n9. 🔹 按摘要关键词过滤查询验证")
    # 先创建一个包含'总账'关键词的候选用于测试过滤
    create_rollback_candidate(db, {
        'candidate_type': RollbackType.FINANCIAL.value,
        'title': '总账系统配置回滚',
        'summary': '总账模块配置异常，需要回滚到上一版本',
        'created_by': '财务系统管理员'
    })
    filtered = filter_rollback_candidates(db, summary_keyword='总账')
    assert len(filtered) >= 1, "按'总账'关键词过滤至少找到1条"
    print(f"   ✅ 按'总账'关键词过滤: 找到 {len(filtered)} 条记录")
    filtered_none = filter_rollback_candidates(db, summary_keyword='不存在的关键词')
    assert_equal(len(filtered_none), 0, "不存在的关键词过滤结果为空")
    
    # 第二部分：灰度夜间巡检验证
    print("\n" + "=" * 70)
    print("\n📋 第二部分：灰度夜间巡检验证")
    
    print("\n10. 🔹 灰度巡检材料存储")
    inspection = create_nightly_inspection(db, {
        'is_grayscale': True,
        'region': '华南区',
        'target_type': '财务系统',
        'total_checks': 100,
        'passed_checks': 85,
        'failed_checks': 15,
        'materials': '巡检报告_v2.pdf,灰度环境配置快照.json,对比截图.png',
        'result_summary': '核心功能正常，部分边缘场景超时',
        'executed_by': '夜间巡检系统'
    })
    assert_equal(inspection.is_grayscale, True, "灰度标记正确")
    assert_equal(inspection.failed_checks, 15, "失败检查数正确")
    assert_not_none(inspection.materials, "材料字段已存储")
    
    grayscale_list = get_grayscale_inspections(db, '华南区')
    assert len(grayscale_list) >= 1, "按区域查询灰度巡检成功"
    
    # 第三部分：财务结转人工确认验证
    print("\n" + "=" * 70)
    print("\n📋 第三部分：财务结转人工确认验证")
    
    print("\n11. 🔹 财务结转按文件摘要过滤验证")
    close1 = create_financial_close(db, {
        'close_period': '2024-05',
        'total_amount': 1258000.50,
        'record_count': 328,
        'summary': '2024年5月财务结转 - 总账模块',
        'file_path': '/data/finance/202405_close_gl.xlsx',
        'created_by': '财务主管'
    })
    close2 = create_financial_close(db, {
        'close_period': '2024-05',
        'total_amount': 856000.25,
        'record_count': 156,
        'summary': '2024年5月财务结转 - 应收模块',
        'file_path': '/data/finance/202405_close_ar.xlsx',
        'created_by': '财务主管'
    })
    
    from sqlalchemy.orm import Session
    from app.models import FinancialCloseApproval
    
    # 按摘要关键词过滤
    query = db.query(FinancialCloseApproval)
    query = query.filter(FinancialCloseApproval.summary.ilike('%总账%'))
    results = query.all()
    assert len(results) >= 1, "按摘要'总账'关键词过滤成功"
    
    # 按文件路径关键词过滤
    query2 = db.query(FinancialCloseApproval)
    query2 = query2.filter(FinancialCloseApproval.file_path.ilike('%_ar.xlsx%'))
    results2 = query2.all()
    assert len(results2) >= 1, "按文件路径'_ar.xlsx'关键词过滤成功"
    
    print("\n12. 🔹 财务结转完整流程验证")
    close3 = create_financial_close(db, {
        'close_period': '2024-04',
        'total_amount': 2156000.80,
        'record_count': 512,
        'summary': '2024年4月财务结转 - 完整流程测试',
        'file_path': '/data/finance/202404_full_test.xlsx',
        'created_by': '财务主管'
    })
    assert_equal(close3.status, RollbackStatus.PENDING, "新建财务结转状态为 pending")
    
    close3 = approve_financial_close(db, close3.id, '财务总监', '数据复核无误', True)
    assert_equal(close3.status, RollbackStatus.APPROVED, "审批后状态为 approved")
    
    close3 = manually_confirm_financial_close(db, close3.id, '财务主管', '人工复核确认')
    assert_equal(close3.status, RollbackStatus.SUCCESS, "人工确认后状态为 success")
    assert_equal(close3.manually_confirmed, True, "人工确认标记为 True")
    assert_equal(close3.confirmed_by, '财务主管', "确认人记录正确")
    
    # 13. 测试清理过期待审批候选
    print("\n13. 🔹 清理过期待审批候选验证")
    cleaned = cleanup_pending_candidates(db, 0)
    assert isinstance(cleaned, int), "清理返回整数"
    print(f"   ✅ 清理返回整数")
    
    print("\n" + "=" * 70)
    print("  ✅ 所有测试通过！配置回滚审批闭环验证成功")
    print("=" * 70)
    print("\n📊 验证结果统计：")
    print(f"   - 回滚候选状态机：全部验证通过")
    print(f"   - 全部成功路径：✅ 50/50 记录成功")
    print(f"   - 全部失败路径：✅ 0/50 记录成功")
    print(f"   - 部分成功路径：✅ 25/50 记录成功（只成功一半）")
    print(f"   - 摘要过滤查询：✅ 支持按关键词搜索")
    print(f"   - 灰度巡检材料：✅ 材料字段正确存储")
    print(f"   - 财务结转过滤：✅ 支持文件摘要和路径过滤")
    print(f"   - 人工确认流程：✅ 完整闭环")
    
except AssertionError as e:
    print(f"\n❌ 验证失败: {e}")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ 发生错误: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    db.close()
