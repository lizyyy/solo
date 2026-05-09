#!/usr/bin/env python3
from datetime import datetime, timedelta, date
import json
import os
from sqlalchemy import text
from models import init_db, SessionLocal, Department, Employee
from services import PettyCashService

def run_demo():
    print("=" * 60)
    print("备用金借还结清 API - 功能演示")
    print("=" * 60)
    print()
    
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'petty_cash.db')
    if os.path.exists(db_path):
        os.remove(db_path)
        print("已清除旧数据库，开始全新演示...")
        print()
    
    init_db()
    db = SessionLocal()
    
    try:
        print("【步骤 1】创建部门（带初始备用金 50000 元）")
        print("-" * 60)
        dept_result = PettyCashService.create_department(db, "研发部", initial_balance=50000.0)
        print(f"部门创建结果: {json.dumps(dept_result, ensure_ascii=False, indent=2)}")
        dept_id = dept_result['data']['id']
        print()
        
        print("【步骤 2】创建员工（张三，工号 E001）")
        print("-" * 60)
        emp_result = PettyCashService.create_employee(db, "张三", "E001", dept_id)
        print(f"员工创建结果: {json.dumps(emp_result, ensure_ascii=False, indent=2)}")
        emp_id = emp_result['data']['id']
        print()
        
        print("【步骤 3】创建借款单（借款 3000 元，用于差旅，30天后归还）")
        print("-" * 60)
        expected_date = (date.today() + timedelta(days=30))
        loan_result = PettyCashService.create_loan(
            db, emp_id, 3000.0, "出差北京参加技术会议", expected_date
        )
        print(f"借款单创建结果: {json.dumps(loan_result, ensure_ascii=False, indent=2)}")
        loan_id = loan_result['data']['id']
        print()
        
        print("【步骤 4】审批借款单（王经理审批通过）")
        print("-" * 60)
        print("注意：审批通过后，部门可用余额会减少（冻结借款金额）")
        approve_result = PettyCashService.approve_loan(
            db, loan_id, approver_name="王经理", approve=True, comment="出差申请合理"
        )
        print(f"借款审批结果: {json.dumps(approve_result, ensure_ascii=False, indent=2)}")
        print()
        
        print("【步骤 5】查看借款详情（包含审批历史）")
        print("-" * 60)
        loan_detail = PettyCashService.get_loan_details(db, loan_id)
        print(f"借款详情: {json.dumps(loan_detail, ensure_ascii=False, indent=2)}")
        print()
        
        print("【步骤 6】创建冲账凭证（部分冲账 2000 元：1500 报销 + 500 现金归还）")
        print("-" * 60)
        offset_result = PettyCashService.create_offset(
            db,
            loan_id=loan_id,
            offset_amount=2000.0,
            expense_amount=1500.0,
            cash_return_amount=500.0,
            description="火车票 800 + 住宿 600 + 餐饮 100，退回现金 500"
        )
        print(f"冲账凭证创建结果: {json.dumps(offset_result, ensure_ascii=False, indent=2)}")
        offset_id = offset_result['data']['id']
        print()
        
        print("【步骤 7】审批冲账凭证")
        print("-" * 60)
        print("注意：审批通过后，会释放冻结金额，费用部分扣减部门余额")
        offset_approve = PettyCashService.approve_offset(
            db, offset_id, approver_name="财务李主管", approve=True, comment="票据齐全，同意冲账"
        )
        print(f"冲账审批结果: {json.dumps(offset_approve, ensure_ascii=False, indent=2)}")
        print()
        
        print("【步骤 8】查看部门对账报表")
        print("-" * 60)
        report = PettyCashService.get_department_report(db)
        print(f"部门报表: {json.dumps(report, ensure_ascii=False, indent=2)}")
        print()
        
        print("【步骤 9】测试边界情况 - 尝试创建金额为负数的借款单")
        print("-" * 60)
        bad_loan = PettyCashService.create_loan(
            db, emp_id, -100.0, "错误测试", date.today() + timedelta(days=10)
        )
        print(f"边界数据测试结果: {json.dumps(bad_loan, ensure_ascii=False, indent=2)}")
        print("说明：边界数据不会静默吞掉，会进入异常记录表")
        print()
        
        print("【步骤 10】查看异常记录列表（边界数据被捕获的地方）")
        print("-" * 60)
        from models import ExceptionRecord
        exceptions = db.query(ExceptionRecord).all()
        print(f"异常记录数量: {len(exceptions)}")
        for exc in exceptions:
            snapshot = json.loads(exc.data_snapshot) if exc.data_snapshot else None
            print(f"  ID: {exc.id}")
            print(f"    错误类型: [{exc.error_code}] {exc.source_type}")
            print(f"    错误信息: {exc.error_message}")
            print(f"    数据快照: {snapshot}")
        print()
        
        print("【步骤 11】查看待处理任务列表")
        print("-" * 60)
        from models import PendingTask
        tasks = db.query(PendingTask).all()
        print(f"待处理任务数量: {len(tasks)}")
        for t in tasks:
            status = "已完成" if t.is_completed else "待处理"
            print(f"  - [{t.priority.upper()}] {status}: {t.description}")
        print()
        
        print("【步骤 12】查看审批历史（借款单）")
        print("-" * 60)
        from models import ApprovalHistory
        approvals = db.query(ApprovalHistory).filter(ApprovalHistory.loan_id == loan_id).all()
        print(f"借款单审批历史数量: {len(approvals)}")
        for a in approvals:
            print(f"  - {a.approver_name} 在 {a.created_at.strftime('%Y-%m-%d %H:%M:%S')} 执行了 {a.action}")
            print(f"    备注: {a.comment}")
        print()
        
        print("【步骤 13】完成剩余借款的结清")
        print("-" * 60)
        offset_result2 = PettyCashService.create_offset(
            db,
            loan_id=loan_id,
            offset_amount=1000.0,
            expense_amount=800.0,
            cash_return_amount=200.0,
            description="市内交通及杂费报销，退回剩余现金"
        )
        print(f"第二次冲账创建: {offset_result2['success']}")
        
        if offset_result2['success']:
            offset_approve2 = PettyCashService.approve_offset(
                db, offset_result2['data']['id'], approver_name="财务李主管", approve=True
            )
            print(f"第二次冲账审批结果: {json.dumps(offset_approve2, ensure_ascii=False, indent=2)}")
        print()
        
        print("【步骤 14】再次查看借款详情（已结清状态）")
        print("-" * 60)
        loan_detail2 = PettyCashService.get_loan_details(db, loan_id)
        print(f"借款单状态: {loan_detail2['data']['status']}")
        print(f"剩余金额: {loan_detail2['data']['remaining_amount']}")
        print(f"累计冲账记录数: {len(loan_detail2['data']['offsets'])}")
        print()
        
        print("=" * 60)
        print("演示完成！")
        print("=" * 60)
        print()
        print("普通用户确认功能可用的方法：")
        print("1. 安装依赖: pip3 install -r requirements.txt")
        print("2. 运行演示: python3 demo_usage.py")
        print("   (每次运行都会创建新数据库，可反复执行)")
        print("3. 看到所有步骤都返回 success=true")
        print("4. 启动 API 服务: python3 app.py")
        print("5. 浏览器访问: http://localhost:5000/health")
        print("   应该返回 {\"status\": \"ok\", \"service\": \"备用金借还结清 API\"}")
        print()
        print("关键业务规则已实现：")
        print("✓ 借款审批后冻结部门余额（不影响当前余额，但减少可用余额）")
        print("✓ 冲账审批后释放冻结金额，费用部分扣减当前余额")
        print("✓ 现金归还部分不影响部门余额（只是解冻）")
        print("✓ 支持部分冲账（多次冲账直到结清）")
        print("✓ 边界数据进入异常记录表，可查询")
        print("✓ 审批历史永久保存")
        print("✓ 逾期检测和提醒")
        print("✓ 对账报表和 CSV 导出（业务复核专用格式）")
        print()
        
    finally:
        db.close()

if __name__ == "__main__":
    run_demo()
