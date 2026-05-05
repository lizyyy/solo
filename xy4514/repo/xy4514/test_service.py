#!/usr/bin/env python3
"""测试县档案馆闭架调阅窗口服务"""

import os
import sys
import json
from datetime import datetime

# 确保能导入 app 和 models
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, AccessRequest, SecurityClearance, PestMoldTreatment, OutboundSeal, ReviewRecord, AuditLog
from config import Config

def init_test_database():
    """初始化测试数据库"""
    print("=" * 60)
    print("初始化测试数据库...")
    print("=" * 60)
    
    with app.app_context():
        # 删除现有的测试数据库
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"已删除现有数据库: {db_path}")
        
        # 创建新的数据库表
        db.create_all()
        print("数据库表创建完成")

def create_test_data():
    """创建测试数据"""
    print("\n" + "=" * 60)
    print("创建测试数据...")
    print("=" * 60)
    
    with app.app_context():
        # 1. 创建密级授权数据
        clearances = [
            SecurityClearance(
                user_name="张三",
                user_id_card="110101199001011234",
                department="县政府办公室",
                clearance_level="秘密",
                authorized_archive_categories="文书档案",
                authorized_date_range="2010-2025",
                valid_from=datetime(2024, 1, 1).date(),
                valid_to=datetime(2024, 12, 31).date(),
                authorization_doc_no="XX-SQ-2024-001",
                authorizer="王主任",
                is_active=True
            ),
            SecurityClearance(
                user_name="李四",
                user_id_card="110101198502022345",
                department="县公安局",
                clearance_level="机密",
                authorized_archive_categories="公安档案",
                authorized_date_range="2000-2020",
                valid_from=datetime(2024, 1, 1).date(),
                authorization_doc_no="XX-SQ-2024-002",
                authorizer="李局长",
                is_active=True
            ),
            SecurityClearance(
                user_name="王五",
                user_id_card="110101198803033456",
                department="县财政局",
                clearance_level="秘密",
                authorized_archive_categories="会计档案",
                authorized_date_range="2005-2015",
                valid_from=datetime(2024, 1, 1).date(),
                valid_to=datetime(2024, 6, 30).date(),
                authorization_doc_no="XX-SQ-2024-003",
                authorizer="张局长",
                is_active=True
            )
        ]
        
        for c in clearances:
            db.session.add(c)
        db.session.commit()
        print(f"已创建 {len(clearances)} 条密级授权记录")
        
        # 2. 创建虫霉处理数据
        pest_treatments = [
            PestMoldTreatment(
                archive_no="X-WS-2020-001",
                archive_title="县政府2020年年度工作报告",
                problem_type="虫害",
                discovery_date=datetime(2024, 1, 10).date(),
                severity="轻微",
                treatment_status="已处理",
                treatment_method="磷化铝熏蒸",
                treatment_date=datetime(2024, 1, 12).date(),
                treated_by="陈技术员",
                quarantine_end_date=datetime(2024, 1, 22).date(),
                inspection_result="检查合格",
                remarks="轻微书虱，已处理完成"
            ),
            PestMoldTreatment(
                archive_no="X-GA-2015-056",
                archive_title="2015年治安案件档案",
                problem_type="霉害",
                discovery_date=datetime(2024, 1, 5).date(),
                severity="中等",
                treatment_status="已隔离",
                treatment_method="低温冷冻处理",
                treatment_date=datetime(2024, 1, 8).date(),
                treated_by="陈技术员",
                quarantine_end_date=datetime(2026, 2, 8).date(),  # 未来日期，模拟正在隔离
                inspection_result="隔离观察中",
                remarks="纸张霉变，需隔离观察"
            ),
            PestMoldTreatment(
                archive_no="X-KJ-2010-120",
                archive_title="2010年财务决算档案",
                problem_type="虫霉并发",
                discovery_date=datetime(2024, 1, 12).date(),
                severity="严重",
                treatment_status="处理中",
                treatment_method="熏蒸+干燥处理",
                treatment_date=datetime(2024, 1, 15).date(),
                treated_by="陈技术员",
                remarks="严重虫霉感染，正在处理"
            )
        ]
        
        for t in pest_treatments:
            db.session.add(t)
        db.session.commit()
        print(f"已创建 {len(pest_treatments)} 条虫霉处理记录")
        
        # 3. 创建出库封签数据
        seals = [
            OutboundSeal(
                seal_no="SEAL2024001",
                archive_no="X-WS-2020-001",
                archive_title="县政府2020年年度工作报告",
                seal_type="出库封签",
                seal_date=datetime(2024, 1, 10).date(),
                sealed_by="张管理员",
                seal_status="active"
            ),
            OutboundSeal(
                seal_no="SEAL2024002",
                archive_no="X-GA-2015-056",
                archive_title="2015年治安案件档案",
                seal_type="临时封签",
                seal_date=datetime(2024, 1, 8).date(),
                sealed_by="李管理员",
                seal_status="active"
            ),
            OutboundSeal(
                seal_no="SEAL2024003",
                archive_no="X-KJ-2010-120",
                archive_title="2010年财务决算档案",
                seal_type="出库封签",
                seal_date=datetime(2024, 1, 5).date(),
                sealed_by="王管理员",
                seal_status="已拆封",
                unseal_date=datetime(2024, 1, 10).date(),
                unsealed_by="张主管",
                unseal_reason="审计完成归还"
            )
        ]
        
        for s in seals:
            db.session.add(s)
        db.session.commit()
        print(f"已创建 {len(seals)} 条出库封签记录")
        
        # 4. 创建调阅申请数据
        requests = [
            AccessRequest(
                request_no="REQ2024001",
                request_date=datetime(2024, 1, 15).date(),
                requester_name="张三",
                requester_department="县政府办公室",
                requester_id_card="110101199001011234",
                archive_category="文书档案",
                archive_no="X-WS-2020-001",
                archive_title="县政府2020年年度工作报告",
                archive_date_range="2020-2020",
                access_reason="工作调研查阅",
                access_method="查阅",
                access_duration="1小时",
                security_level="公开",
                status="pending"
            ),
            AccessRequest(
                request_no="REQ2024002",
                request_date=datetime(2024, 1, 16).date(),
                requester_name="李四",
                requester_department="县公安局",
                requester_id_card="110101198502022345",
                archive_category="公安档案",
                archive_no="X-GA-2015-056",
                archive_title="2015年治安案件档案",
                archive_date_range="2015-2015",
                access_reason="案件复查",
                access_method="查阅",
                access_duration="2小时",
                security_level="秘密",
                status="pending"
            ),
            AccessRequest(
                request_no="REQ2024003",
                request_date=datetime(2024, 1, 17).date(),
                requester_name="王五",
                requester_department="县财政局",
                requester_id_card="110101198803033456",
                archive_category="会计档案",
                archive_no="X-KJ-2010-120",
                archive_title="2010年财务决算档案",
                archive_date_range="2010-2010",
                access_reason="审计核查",
                access_method="复制",
                access_duration="当天",
                security_level="机密",
                status="pending"
            )
        ]
        
        for r in requests:
            db.session.add(r)
        db.session.commit()
        print(f"已创建 {len(requests)} 条调阅申请记录")

def test_evaluation_logic():
    """测试状态评估逻辑"""
    print("\n" + "=" * 60)
    print("测试状态评估逻辑...")
    print("=" * 60)
    
    with app.app_context():
        from app import evaluate_request_status
        
        # 测试 REQ2024001 - 张三的申请
        # 公开密级，应该可以调阅，但有有效封签
        req1 = AccessRequest.query.filter_by(request_no="REQ2024001").first()
        eval1 = evaluate_request_status(req1)
        print(f"\n【测试1】申请单号: {req1.request_no}")
        print(f"  调阅人: {req1.requester_name}")
        print(f"  密级: {req1.security_level}")
        print(f"  评估状态: {eval1['status_description']}")
        print(f"  可以调阅: {eval1['can_access']}")
        print(f"  需补充授权: {eval1['needs_authorization']}")
        print(f"  需隔离处理: {eval1['needs_quarantine']}")
        print(f"  需主管复核: {eval1['needs_supervisor']}")
        if eval1['issues']:
            print(f"  问题列表:")
            for issue in eval1['issues']:
                print(f"    - {issue}")
        
        # 测试 REQ2024002 - 李四的申请
        # 秘密密级，李四有机密授权，但档案在隔离中，且有有效封签
        req2 = AccessRequest.query.filter_by(request_no="REQ2024002").first()
        eval2 = evaluate_request_status(req2)
        print(f"\n【测试2】申请单号: {req2.request_no}")
        print(f"  调阅人: {req2.requester_name}")
        print(f"  密级: {req2.security_level}")
        print(f"  评估状态: {eval2['status_description']}")
        print(f"  可以调阅: {eval2['can_access']}")
        print(f"  需补充授权: {eval2['needs_authorization']}")
        print(f"  需隔离处理: {eval2['needs_quarantine']}")
        print(f"  需主管复核: {eval2['needs_supervisor']}")
        if eval2['issues']:
            print(f"  问题列表:")
            for issue in eval2['issues']:
                print(f"    - {issue}")
        
        # 测试 REQ2024003 - 王五的申请
        # 机密密级，王五只有秘密授权，档案在处理中
        req3 = AccessRequest.query.filter_by(request_no="REQ2024003").first()
        eval3 = evaluate_request_status(req3)
        print(f"\n【测试3】申请单号: {req3.request_no}")
        print(f"  调阅人: {req3.requester_name}")
        print(f"  密级: {req3.security_level}")
        print(f"  评估状态: {eval3['status_description']}")
        print(f"  可以调阅: {eval3['can_access']}")
        print(f"  需补充授权: {eval3['needs_authorization']}")
        print(f"  需隔离处理: {eval3['needs_quarantine']}")
        print(f"  需主管复核: {eval3['needs_supervisor']}")
        if eval3['issues']:
            print(f"  问题列表:")
            for issue in eval3['issues']:
                print(f"    - {issue}")

def test_review_function():
    """测试复核功能"""
    print("\n" + "=" * 60)
    print("测试复核功能...")
    print("=" * 60)
    
    with app.app_context():
        req = AccessRequest.query.filter_by(request_no="REQ2024001").first()
        
        # 创建复核记录
        review = ReviewRecord(
            request_id=req.id,
            review_result="通过",
            reviewer="李管理员",
            review_remark="申请人授权齐全，档案状态正常，同意调阅",
            needs_supervisor_review=False
        )
        
        db.session.add(review)
        
        # 更新申请状态
        status_map = {
            '通过': 'approved',
            '拒绝': 'rejected',
            '需补充授权': 'needs_authorization',
            '需先隔离处理': 'needs_quarantine',
            '要主管复核': 'needs_supervisor'
        }
        req.status = status_map.get('通过', 'pending')
        
        db.session.commit()
        
        print(f"\n申请单号: {req.request_no}")
        print(f"复核结果: 通过")
        print(f"复核人: 李管理员")
        print(f"复核备注: 申请人授权齐全，档案状态正常，同意调阅")
        print(f"更新后状态: {req.status}")
        
        # 验证复核记录
        saved_review = ReviewRecord.query.filter_by(request_id=req.id).first()
        print(f"\n验证复核记录:")
        print(f"  复核结果: {saved_review.review_result}")
        print(f"  复核人: {saved_review.reviewer}")
        print(f"  复核备注: {saved_review.review_remark}")

def test_audit_log():
    """测试审计日志"""
    print("\n" + "=" * 60)
    print("测试审计日志...")
    print("=" * 60)
    
    with app.app_context():
        from app import log_audit
        
        # 记录审计日志
        log_audit(
            action_type="测试",
            module="调阅申请",
            operator="测试用户",
            related_record_id=1,
            related_record_no="REQ2024001",
            action_details="测试审计日志功能",
            ip_address="127.0.0.1"
        )
        
        # 验证审计日志
        logs = AuditLog.query.all()
        print(f"\n审计日志记录数: {len(logs)}")
        for log in logs:
            print(f"\n  日志ID: {log.id}")
            print(f"  操作类型: {log.action_type}")
            print(f"  模块: {log.module}")
            print(f"  操作人: {log.operator}")
            print(f"  详情: {log.action_details}")
            print(f"  IP地址: {log.ip_address}")
            print(f"  时间: {log.created_at}")

def test_export_audit():
    """测试审计日志导出"""
    print("\n" + "=" * 60)
    print("测试审计日志导出...")
    print("=" * 60)
    
    with app.app_context():
        logs = AuditLog.query.order_by(AuditLog.created_at.desc()).all()
        
        export_data = {
            'export_info': {
                'export_time': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'export_criteria': {
                    'start_date': None,
                    'end_date': None,
                    'module': None,
                    'action_type': None
                },
                'total_records': len(logs)
            },
            'audit_logs': [log.to_dict() for log in logs]
        }
        
        filename = os.path.join(app.config['EXPORT_FOLDER'], f'audit_export_{datetime.now().strftime("%Y%m%d%H%M%S")}.json')
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n审计日志已导出到: {filename}")
        print(f"导出记录数: {len(logs)}")
        
        # 显示导出的JSON内容
        print(f"\n导出的JSON内容预览:")
        print(json.dumps(export_data, ensure_ascii=False, indent=2)[:500] + "...")

def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("县档案馆闭架调阅窗口服务 - 测试套件")
    print("=" * 60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # 1. 初始化测试数据库
        init_test_database()
        
        # 2. 创建测试数据
        create_test_data()
        
        # 3. 测试状态评估逻辑
        test_evaluation_logic()
        
        # 4. 测试复核功能
        test_review_function()
        
        # 5. 测试审计日志
        test_audit_log()
        
        # 6. 测试审计日志导出
        test_export_audit()
        
        print("\n" + "=" * 60)
        print("测试完成!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
