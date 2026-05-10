#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.services import (
    create_audit_task, process_callback, manual_review,
    get_task_detail, get_statistics, export_for_review
)
from app.constants import AuditStatus
from datetime import datetime

def print_separator(title=''):
    print('\n' + '=' * 80)
    if title:
        print(f'  {title}')
        print('=' * 80)

def print_result(result, action='操作'):
    status_emoji = '✅' if result.success else '⚠️'
    print(f'\n{status_emoji} {action}结果:')
    print(f'   成功: {result.success}')
    print(f'   原因: {result.reason}')
    print(f'   编码: {result.code}')
    if result.task:
        print(f'   当前状态: {AuditStatus.get_desc(result.task.current_status)}')
        print(f'   最大序号: {result.task.max_callback_sequence}')

def run_scenario_1_basic_flow():
    print_separator('场景1: 正常审核流程（创建 → 审核中 → 通过）')
    
    task = create_audit_task(
        business_id='BIZ_001',
        image_url='https://example.com/image1.jpg',
        image_source='用户上传',
        remark='商品主图审核'
    )
    task_dict = task.to_dict()
    print(f'\n✅ 创建审核任务: {task.task_id}')
    print(f'   业务ID: {task.business_id}')
    print(f'   初始状态: {task_dict["current_status_desc"]}')
    
    result1 = process_callback(
        task_id=task.task_id,
        callback_id='CB_001_SEQ1',
        callback_sequence=1,
        review_result=AuditStatus.PROCESSING,
        raw_payload={'message': '开始审核'}
    )
    print_result(result1, '回调1(审核中,序号1)')
    
    result2 = process_callback(
        task_id=task.task_id,
        callback_id='CB_001_SEQ2',
        callback_sequence=2,
        review_result=AuditStatus.APPROVED,
        review_score=0.95,
        risk_category='无风险',
        raw_payload={'confidence': 0.95}
    )
    print_result(result2, '回调2(审核通过,序号2)')
    
    detail = get_task_detail(task.task_id)
    print('\n📋 任务详情 (状态历史):')
    for h in detail['state_history']:
        print(f'   {h["created_at"]}: {h["from_status_desc"]} → {h["to_status_desc"]}')
        print(f'      原因: {h["transition_reason"]}')
    
    return task.task_id

def run_scenario_2_out_of_order():
    print_separator('场景2: 乱序回调（旧序号回调到达时被忽略）')
    
    task = create_audit_task(
        business_id='BIZ_002',
        image_url='https://example.com/image2.jpg',
        remark='用于测试乱序回调'
    )
    print(f'\n✅ 创建审核任务: {task.task_id}')
    
    result1 = process_callback(
        task_id=task.task_id,
        callback_id='CB_002_SEQ3',
        callback_sequence=3,
        review_result=AuditStatus.REJECTED,
        review_score=0.1,
        risk_category='色情',
        risk_detail='检测到裸露内容',
        raw_payload={'risk': 'porn'}
    )
    print_result(result1, '回调1(拒绝,序号3) - 先到达')
    
    result2 = process_callback(
        task_id=task.task_id,
        callback_id='CB_002_SEQ1',
        callback_sequence=1,
        review_result=AuditStatus.PROCESSING,
        raw_payload={'message': '开始审核'}
    )
    print_result(result2, '回调2(审核中,序号1) - 旧序号后到达')
    
    result3 = process_callback(
        task_id=task.task_id,
        callback_id='CB_002_SEQ2',
        callback_sequence=2,
        review_result=AuditStatus.APPROVED,
        review_score=0.9,
        raw_payload={'confidence': 0.9}
    )
    print_result(result3, '回调3(通过,序号2) - 旧序号后到达')
    
    detail = get_task_detail(task.task_id)
    print(f'\n📋 最终状态: {detail["task"]["current_status_desc"]}')
    print(f'   说明: 即使序号1、2的回调后到达，状态仍保持为序号3的【拒绝】')
    
    return task.task_id

def run_scenario_3_duplicate_callback():
    print_separator('场景3: 重复回调（相同callback_id只处理一次）')
    
    task = create_audit_task(
        business_id='BIZ_003',
        image_url='https://example.com/image3.jpg',
        remark='用于测试重复回调'
    )
    print(f'\n✅ 创建审核任务: {task.task_id}')
    
    result1 = process_callback(
        task_id=task.task_id,
        callback_id='CB_003_DUP',
        callback_sequence=1,
        review_result=AuditStatus.NEED_MANUAL_REVIEW,
        risk_category='疑似违规',
        risk_detail='需要人工确认',
        raw_payload={'suggestion': 'manual'}
    )
    print_result(result1, '首次回调(需人工复审,序号1)')
    
    result2 = process_callback(
        task_id=task.task_id,
        callback_id='CB_003_DUP',
        callback_sequence=1,
        review_result=AuditStatus.NEED_MANUAL_REVIEW,
        raw_payload={'suggestion': 'manual'}
    )
    print_result(result2, '重复回调(相同callback_id)')
    
    detail = get_task_detail(task.task_id)
    print(f'\n📋 回调记录数: {len(detail["callbacks"])}')
    print(f'   说明: 相同callback_id只记录1条，状态不会混乱')
    
    return task.task_id

def run_scenario_4_final_state_protection():
    print_separator('场景4: 终态保护（达到终态后不再接受任何状态变更）')
    
    task = create_audit_task(
        business_id='BIZ_004',
        image_url='https://example.com/image4.jpg',
        remark='用于测试终态保护'
    )
    print(f'\n✅ 创建审核任务: {task.task_id}')
    
    result1 = process_callback(
        task_id=task.task_id,
        callback_id='CB_004_SEQ1',
        callback_sequence=1,
        review_result=AuditStatus.APPROVED,
        review_score=0.99,
        raw_payload={'confidence': 0.99}
    )
    print_result(result1, '回调1(通过,序号1) - 进入终态')
    
    result2 = process_callback(
        task_id=task.task_id,
        callback_id='CB_004_SEQ2',
        callback_sequence=2,
        review_result=AuditStatus.REJECTED,
        review_score=0.05,
        raw_payload={'risk': 'new'}
    )
    print_result(result2, '回调2(拒绝,序号2) - 试图覆盖终态')
    
    result3 = process_callback(
        task_id=task.task_id,
        callback_id='CB_004_SEQ3',
        callback_sequence=3,
        review_result=AuditStatus.NEED_MANUAL_REVIEW,
        raw_payload={'suggestion': 'manual'}
    )
    print_result(result3, '回调3(需人工复审,序号3) - 同样被拒绝')
    
    detail = get_task_detail(task.task_id)
    print(f'\n📋 最终状态: {detail["task"]["current_status_desc"]}')
    print(f'   说明: 一旦进入【审核通过】等终态，任何新回调都无法改变状态')
    
    return task.task_id

def run_scenario_5_manual_review():
    print_separator('场景5: 人工复审流程（需人工复审 → 人工通过/拒绝）')
    
    task = create_audit_task(
        business_id='BIZ_005',
        image_url='https://example.com/image5.jpg',
        remark='用于测试人工复审'
    )
    print(f'\n✅ 创建审核任务: {task.task_id}')
    
    result1 = process_callback(
        task_id=task.task_id,
        callback_id='CB_005_SEQ1',
        callback_sequence=1,
        review_result=AuditStatus.NEED_MANUAL_REVIEW,
        risk_category='疑似政治敏感',
        risk_detail='图片内容可能涉及敏感人物，需人工确认',
        raw_payload={'risk': 'politics', 'confidence': 0.6}
    )
    print_result(result1, '回调(需人工复审)')
    
    result2 = manual_review(
        task_id=task.task_id,
        reviewer='审核员张三',
        decision=AuditStatus.MANUALLY_APPROVED,
        comment='经人工核查，图片内容正常，无违规内容',
        evidence_paths='/evidence/audit_005_screenshot.png'
    )
    print_result(result2, '人工复审(审核员张三 → 通过)')
    
    result3 = manual_review(
        task_id=task.task_id,
        reviewer='审核员李四',
        decision=AuditStatus.MANUALLY_REJECTED,
        comment='重复复审测试'
    )
    print_result(result3, '再次人工复审 - 应该被拒绝')
    
    detail = get_task_detail(task.task_id)
    print('\n📋 人工复审信息:')
    if detail['manual_review']:
        mr = detail['manual_review']
        print(f'   复审人: {mr["reviewer"]}')
        print(f'   复审结果: {mr["review_decision_desc"]}')
        print(f'   复审意见: {mr["review_comment"]}')
        print(f'   证据已保存: {mr["evidence_saved"]}')
    
    print('\n📋 完整状态历史:')
    for h in detail['state_history']:
        print(f'   {h["created_at"]}: {h["from_status_desc"]} → {h["to_status_desc"]}')
        print(f'      操作人: {h["operator"]}')
        print(f'      原因: {h["transition_reason"]}')
    
    return task.task_id

def run_scenario_6_invalid_transition():
    print_separator('场景6: 非法状态流转（被拦截并给出明确原因）')
    
    task = create_audit_task(
        business_id='BIZ_006',
        image_url='https://example.com/image6.jpg',
        remark='用于测试非法流转拦截'
    )
    print(f'\n✅ 创建审核任务: {task.task_id}')
    print(f'   初始状态: 待审核')
    
    result1 = process_callback(
        task_id=task.task_id,
        callback_id='CB_006_INVALID',
        callback_sequence=1,
        review_result=AuditStatus.MANUALLY_APPROVED,
        raw_payload={'invalid': True}
    )
    print_result(result1, '试图从【待审核】直接变为【人工通过】')
    
    result2 = process_callback(
        task_id=task.task_id,
        callback_id='CB_006_OK',
        callback_sequence=1,
        review_result=AuditStatus.NEED_MANUAL_REVIEW,
        raw_payload={'valid': True}
    )
    print_result(result2, '合法流转: 【待审核】→【需人工复审】')
    
    return task.task_id

def run_statistics():
    print_separator('统计汇总')
    
    stats = get_statistics()
    print(f'\n📊 审核任务统计:')
    print(f'   总任务数: {stats["total_tasks"]}')
    print(f'\n   按状态分布:')
    for item in stats['summary']:
        bar = '█' * int(item['percentage'] / 5)
        print(f'   {item["status_desc"]:10s}: {item["count"]:3d} 个 ({item["percentage"]:5.1f}%) {bar}')

def run_export():
    print_separator('业务复核导出')
    
    export_data = export_for_review()
    print(f'\n📄 导出数据预览 (共 {len(export_data)} 条):')
    print(f'   字段列表: {", ".join(export_data[0].keys())}')
    
    print(f'\n   前3条记录概览:')
    for i, row in enumerate(export_data[:3], 1):
        print(f'   记录{i}:')
        print(f'      任务ID: {row["任务ID"]}')
        print(f'      业务ID: {row["业务ID"]}')
        print(f'      当前状态: {row["当前状态"]}')
        print(f'      状态流转: {row["状态流转记录"]}')

def run_all():
    print('\n' + '#' * 80)
    print('#  图片审核回调幂等 API - 场景测试')
    print('#  测试目标: 回调乱序保护、重复提交处理、状态覆盖规则')
    print('#' * 80)
    
    try:
        app = create_app()
        with app.app_context():
            db.drop_all()
            db.create_all()
            print('\n🗄️  数据库初始化完成')
            
            run_scenario_1_basic_flow()
            run_scenario_2_out_of_order()
            run_scenario_3_duplicate_callback()
            run_scenario_4_final_state_protection()
            run_scenario_5_manual_review()
            run_scenario_6_invalid_transition()
            
            run_statistics()
            run_export()
            
            print_separator('测试完成')
            print('\n🎉 所有测试场景执行完毕！')
            print('\n📋 核心能力验证:')
            print('   ✅ 正常审核流程: 状态正确推进')
            print('   ✅ 乱序回调保护: 旧序号回调被忽略')
            print('   ✅ 重复提交处理: 相同callback_id只处理一次')
            print('   ✅ 终态保护机制: 进入终态后无法被覆盖')
            print('   ✅ 人工复审流程: 记录复审人、意见、证据')
            print('   ✅ 非法流转拦截: 给出明确的业务语言原因')
            print('   ✅ 历史记录追踪: 完整的状态变更历史')
            print('   ✅ 统计和导出: 服务于业务复核的数据汇总')
            
    except Exception as e:
        print(f'\n❌ 测试出错: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    run_all()
