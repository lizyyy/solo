#!/usr/bin/env python3
"""
匿名案例督导流转站 - 自检命令工具
用于快速验证系统核心功能
"""

import sys
import os
from datetime import datetime
from typing import Dict, Any, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Counselor, Case, StatusTransition, DesensitizedVersion, AuditLog
from config import CaseStatus, RiskLevel, settings
from services import CaseService, state_machine
from desensitization import desensitization_engine, scale_validator, risk_validator
from audit_service import AuditService


class SelfCheckResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, name: str, message: str = ""):
        self.passed.append({"name": name, "message": message})
        print(f"✓ [PASS] {name}: {message}")
    
    def add_fail(self, name: str, message: str):
        self.failed.append({"name": name, "message": message})
        print(f"✗ [FAIL] {name}: {message}")
    
    def add_warning(self, name: str, message: str):
        self.warnings.append({"name": name, "message": message})
        print(f"⚠ [WARN] {name}: {message}")
    
    def summary(self):
        total = len(self.passed) + len(self.failed)
        print("\n" + "="*60)
        print("自检结果汇总")
        print("="*60)
        print(f"总计测试项: {total}")
        print(f"通过: {len(self.passed)}")
        print(f"失败: {len(self.failed)}")
        print(f"警告: {len(self.warnings)}")
        print("="*60)
        
        if self.failed:
            print("\n失败项详情:")
            for fail in self.failed:
                print(f"  - {fail['name']}: {fail['message']}")
            return False
        
        return True


def run_all_checks():
    print("="*60)
    print(f"  {settings.APP_NAME} - 自检工具")
    print(f"  版本: {settings.APP_VERSION}")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60 + "\n")
    
    result = SelfCheckResult()
    
    check_desensitization_engine(result)
    check_scale_validator(result)
    check_risk_validator(result)
    check_state_machine(result)
    check_case_services(result)
    check_audit_service(result)
    
    success = result.summary()
    
    if success:
        print("\n✓ 所有自检通过！系统运行正常。")
        return 0
    else:
        print("\n✗ 部分自检失败，请检查系统配置。")
        return 1


def check_desensitization_engine(result: SelfCheckResult):
    print("\n--- 1. 脱敏规则引擎测试 ---")
    
    test_name = "敏感姓名检测"
    text = "来访者张三，25岁，因工作压力前来咨询"
    passed, sensitive = desensitization_engine.check_text(text)
    if not passed and len(sensitive) > 0:
        result.add_pass(test_name, f"检测到 {len(sensitive)} 处敏感信息")
    else:
        result.add_fail(test_name, "未能检测到敏感姓名")
    
    test_name = "电话号码检测"
    text = "联系电话：13812345678，有需要请联系"
    passed, sensitive = desensitization_engine.check_text(text)
    if not passed and len(sensitive) > 0:
        result.add_pass(test_name, f"检测到 {len(sensitive)} 处敏感信息")
    else:
        result.add_fail(test_name, "未能检测到电话号码")
    
    test_name = "学校名称检测"
    text = "来访者就读于北京大学，是一名大三学生"
    passed, sensitive = desensitization_engine.check_text(text)
    if not passed and len(sensitive) > 0:
        result.add_pass(test_name, f"检测到 {len(sensitive)} 处敏感信息")
    else:
        result.add_fail(test_name, "未能检测到学校名称")
    
    test_name = "邮箱地址检测"
    text = "邮箱地址是：test@example.com"
    passed, sensitive = desensitization_engine.check_text(text)
    if not passed and len(sensitive) > 0:
        result.add_pass(test_name, f"检测到 {len(sensitive)} 处敏感信息")
    else:
        result.add_fail(test_name, "未能检测到邮箱地址")
    
    test_name = "脱敏文本通过检测"
    text = "来访者因工作压力大，感到焦虑，失眠已有两周"
    passed, sensitive = desensitization_engine.check_text(text)
    if passed and len(sensitive) == 0:
        result.add_pass(test_name, "已脱敏文本通过检测")
    else:
        result.add_fail(test_name, "已脱敏文本被误判")
    
    test_name = "案例内容整体检测"
    case_data = {
        "presenting_problem": "来访者因工作压力大感到焦虑",
        "background_info": "来访者最近工作压力较大",
        "assessment_process": "经过SDS评估，分数为65分"
    }
    passed, results = desensitization_engine.check_case_content(case_data)
    if passed:
        result.add_pass(test_name, "已脱敏案例内容通过检测")
    else:
        result.add_fail(test_name, "案例内容检测失败")


def check_scale_validator(result: SelfCheckResult):
    print("\n--- 2. 量表分数验证器测试 ---")
    
    test_name = "有效SDS分数验证"
    passed, message = scale_validator.validate_score("SDS", 65)
    if passed:
        result.add_pass(test_name, message)
    else:
        result.add_fail(test_name, message)
    
    test_name = "超出范围SDS分数检测"
    passed, message = scale_validator.validate_score("SDS", 150)
    if not passed:
        result.add_pass(test_name, message)
    else:
        result.add_fail(test_name, "未能检测到超出范围的分数")
    
    test_name = "负分检测"
    passed, message = scale_validator.validate_score("SAS", -10)
    if not passed:
        result.add_pass(test_name, message)
    else:
        result.add_fail(test_name, "未能检测到负分")
    
    test_name = "未知量表检测"
    passed, message = scale_validator.validate_score("UNKNOWN", 50)
    if not passed:
        result.add_pass(test_name, message)
    else:
        result.add_fail(test_name, "未能检测到未知量表")
    
    test_name = "多量表批量验证"
    scores = {
        "SDS": 50,
        "SAS": 45,
        "GAD7": 15
    }
    passed, results = scale_validator.validate_all_scores(scores)
    if passed:
        result.add_pass(test_name, f"所有 {len(results)} 个量表分数验证通过")
    else:
        result.add_fail(test_name, "多量表批量验证失败")


def check_risk_validator(result: SelfCheckResult):
    print("\n--- 3. 风险等级验证器测试 ---")
    
    test_name = "危机等级验证 - 匹配"
    risk_level = RiskLevel.CRISIS
    triggers = ["自杀计划", "近期自伤史"]
    passed, r = risk_validator.validate_risk_match(risk_level, triggers)
    if passed:
        result.add_pass(test_name, f"匹配到 {len(r['matched_triggers'])} 个触发因素")
    else:
        result.add_fail(test_name, r.get("error", "验证失败"))
    
    test_name = "危机等级验证 - 不匹配"
    triggers = ["轻度焦虑"]
    passed, r = risk_validator.validate_risk_match(risk_level, triggers)
    if not passed:
        result.add_pass(test_name, "正确检测到危机等级与触发因素不匹配")
    else:
        result.add_fail(test_name, "未能检测到危机等级与触发因素不匹配")
    
    test_name = "风险等级建议 - 危机"
    triggers = ["自杀计划"]
    suggested = risk_validator.suggest_risk_level(triggers)
    if suggested == RiskLevel.CRISIS:
        result.add_pass(test_name, f"正确建议风险等级: {suggested}")
    else:
        result.add_fail(test_name, f"建议的风险等级不正确: {suggested}")
    
    test_name = "风险等级建议 - 高风险"
    triggers = ["重度抑郁"]
    suggested = risk_validator.suggest_risk_level(triggers)
    if suggested == RiskLevel.HIGH:
        result.add_pass(test_name, f"正确建议风险等级: {suggested}")
    else:
        result.add_fail(test_name, f"建议的风险等级不正确: {suggested}")
    
    test_name = "风险等级建议 - 低风险"
    triggers = ["一般心理问题"]
    suggested = risk_validator.suggest_risk_level(triggers)
    if suggested == RiskLevel.LOW:
        result.add_pass(test_name, f"正确建议风险等级: {suggested}")
    else:
        result.add_fail(test_name, f"建议的风险等级不正确: {suggested}")


def check_state_machine(result: SelfCheckResult):
    print("\n--- 4. 状态机测试 ---")
    
    test_name = "草稿 -> 待督导: 允许"
    can = state_machine.can_transition(CaseStatus.DRAFT, CaseStatus.PENDING_REVIEW)
    if can:
        result.add_pass(test_name, "状态转换允许")
    else:
        result.add_fail(test_name, "状态转换应该被允许")
    
    test_name = "草稿 -> 已归档: 允许"
    can = state_machine.can_transition(CaseStatus.DRAFT, CaseStatus.ARCHIVED)
    if can:
        result.add_pass(test_name, "状态转换允许")
    else:
        result.add_fail(test_name, "状态转换应该被允许")
    
    test_name = "草稿 -> 已督导: 不允许"
    can = state_machine.can_transition(CaseStatus.DRAFT, CaseStatus.REVIEWED)
    if not can:
        result.add_pass(test_name, "正确阻止状态转换")
    else:
        result.add_fail(test_name, "状态转换不应该被允许")
    
    test_name = "待督导 -> 危机处理中: 允许"
    can = state_machine.can_transition(CaseStatus.PENDING_REVIEW, CaseStatus.CRISIS_HANDLING)
    if can:
        result.add_pass(test_name, "状态转换允许")
    else:
        result.add_fail(test_name, "状态转换应该被允许")
    
    test_name = "已归档 -> 任何状态: 不允许"
    can = state_machine.can_transition(CaseStatus.ARCHIVED, CaseStatus.PENDING_REVIEW)
    if not can:
        result.add_pass(test_name, "正确阻止已归档案例的状态变更")
    else:
        result.add_fail(test_name, "已归档案例不应该允许状态变更")
    
    test_name = "获取有效状态转换列表"
    transitions = state_machine.get_valid_transitions(CaseStatus.PENDING_REVIEW)
    expected = [CaseStatus.NEEDS_SUPPLEMENT, CaseStatus.REVIEWED, CaseStatus.CRISIS_HANDLING, CaseStatus.ARCHIVED]
    if len(transitions) == len(expected) and all(t in transitions for t in expected):
        result.add_pass(test_name, f"获取到 {len(transitions)} 个有效状态转换")
    else:
        result.add_fail(test_name, "有效状态转换列表不正确")


def check_case_services(result: SelfCheckResult):
    print("\n--- 5. 案例服务测试 (使用内存数据库) ---")
    
    try:
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        Base.metadata.create_all(engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = TestingSessionLocal()
        
        test_name = "创建咨询师"
        counselor = Counselor(
            name="张咨询师",
            employee_id="C001",
            department="心理咨询部"
        )
        db.add(counselor)
        db.commit()
        db.refresh(counselor)
        if counselor.id is not None:
            result.add_pass(test_name, f"咨询师ID: {counselor.id}, 姓名: {counselor.name}")
        else:
            result.add_fail(test_name, "咨询师创建失败")
        
        test_name = "创建案例草稿"
        service = CaseService(db)
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑",
            "background_info": "来访者最近工作压力较大，睡眠质量不好",
            "sds_score": 50,
            "sas_score": 45
        }
        case = service.create_case(counselor.id, case_data)
        if case.id is not None and case.status == CaseStatus.DRAFT:
            result.add_pass(test_name, f"案例编号: {case.case_number}, 状态: {case.status}")
        else:
            result.add_fail(test_name, "案例创建失败")
        
        test_name = "提交案例 - 脱敏通过"
        submit_result = service.submit_for_review(case.id, counselor.id)
        if submit_result["success"] and submit_result["case"].status == CaseStatus.PENDING_REVIEW:
            result.add_pass(test_name, f"案例状态更新为: {submit_result['case'].status}")
        else:
            result.add_fail(test_name, submit_result.get("error", "提交失败"))
        
        test_name = "创建含敏感信息的案例"
        sensitive_case_data = {
            "presenting_problem": "来访者张三因工作压力大感到焦虑",
            "sds_score": 50
        }
        sensitive_case = service.create_case(counselor.id, sensitive_case_data)
        
        test_name = "提交案例 - 脱敏拦截"
        submit_result = service.submit_for_review(sensitive_case.id, counselor.id)
        if not submit_result["success"] and submit_result["error_type"] == "desensitization_failed":
            result.add_pass(test_name, "正确拦截含敏感信息的案例")
        else:
            result.add_fail(test_name, "未能拦截含敏感信息的案例")
        
        test_name = "创建含无效分数的案例"
        invalid_scale_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑",
            "sds_score": 150
        }
        invalid_scale_case = service.create_case(counselor.id, invalid_scale_data)
        
        test_name = "提交案例 - 量表分数校验拦截"
        submit_result = service.submit_for_review(invalid_scale_case.id, counselor.id)
        if not submit_result["success"] and submit_result["error_type"] == "scale_validation_failed":
            result.add_pass(test_name, "正确拦截无效量表分数")
        else:
            result.add_fail(test_name, "未能拦截无效量表分数")
        
        test_name = "要求补充资料"
        supervisor = Counselor(
            name="陈督导",
            employee_id="S001",
            department="督导组",
            qualification="资深督导"
        )
        db.add(supervisor)
        db.commit()
        db.refresh(supervisor)
        
        supplement_case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑"
        }
        supplement_case = service.create_case(supervisor.id, supplement_case_data)
        supplement_case.status = CaseStatus.PENDING_REVIEW
        db.commit()
        
        supplement_result = service.request_supplement(
            supplement_case.id,
            supervisor.id,
            "需要补充更多背景信息",
            ["家庭背景", "既往病史"]
        )
        if supplement_result["success"] and supplement_result["case"].status == CaseStatus.NEEDS_SUPPLEMENT:
            result.add_pass(test_name, f"案例状态更新为: {supplement_result['case'].status}")
        else:
            result.add_fail(test_name, supplement_result.get("error", "要求补充资料失败"))
        
        test_name = "完成督导"
        review_case = service.create_case(supervisor.id, {"presenting_problem": "测试案例"})
        review_case.status = CaseStatus.PENDING_REVIEW
        db.commit()
        
        review_result = service.complete_review(
            review_case.id,
            supervisor.id,
            {
                "overall_assessment": "案例处理得当",
                "strengths": "建立了良好的咨询关系"
            }
        )
        if review_result["success"] and review_result["case"].status == CaseStatus.REVIEWED:
            result.add_pass(test_name, f"案例状态更新为: {review_result['case'].status}")
        else:
            result.add_fail(test_name, review_result.get("error", "完成督导失败"))
        
        test_name = "危机升级"
        crisis_case = service.create_case(counselor.id, {"presenting_problem": "来访者有自杀意念"})
        crisis_case.status = CaseStatus.PENDING_REVIEW
        db.commit()
        
        crisis_result = service.escalate_crisis(
            crisis_case.id,
            counselor.id,
            {
                "trigger_event": "来访者表示有自杀计划",
                "immediate_actions_taken": "已启动安全计划",
                "safety_plan_activated": 1,
                "emergency_contacts_informed": 1
            }
        )
        if crisis_result["success"] and crisis_result["case"].status == CaseStatus.CRISIS_HANDLING:
            result.add_pass(test_name, f"案例状态更新为: {crisis_result['case'].status}, 风险等级: {crisis_result['case'].risk_level}")
        else:
            result.add_fail(test_name, crisis_result.get("error", "危机升级失败"))
        
        test_name = "归档案例"
        archive_case = service.create_case(counselor.id, {"presenting_problem": "测试归档案例"})
        archive_case.status = CaseStatus.REVIEWED
        db.commit()
        
        archive_result = service.archive_case(
            archive_case.id,
            counselor.id,
            "案例已完成督导"
        )
        if archive_result["success"] and archive_result["case"].status == CaseStatus.ARCHIVED:
            result.add_pass(test_name, f"案例状态更新为: {archive_result['case'].status}")
        else:
            result.add_fail(test_name, archive_result.get("error", "归档失败"))
        
        test_name = "获取案例历史"
        transition = StatusTransition(
            case_id=case.id,
            from_status=CaseStatus.DRAFT,
            to_status=CaseStatus.PENDING_REVIEW,
            transitioned_by=counselor.id,
            reason="提交督导"
        )
        db.add(transition)
        
        desensitized = DesensitizedVersion(
            case_id=case.id,
            version_number=1,
            presenting_problem=case.presenting_problem,
            desensitization_check_passed=1,
            created_by=counselor.id
        )
        db.add(desensitized)
        db.commit()
        
        history = service.get_case_history(case.id)
        if history["case"].id == case.id and len(history["status_transitions"]) > 0:
            result.add_pass(test_name, f"获取到 {len(history['status_transitions'])} 条状态流转记录, {len(history['desensitized_versions'])} 条脱敏版本")
        else:
            result.add_fail(test_name, "获取案例历史失败")
        
        db.close()
        Base.metadata.drop_all(engine)
        
    except Exception as e:
        result.add_fail("案例服务测试", str(e))


def check_audit_service(result: SelfCheckResult):
    print("\n--- 6. 审计日志服务测试 ---")
    
    try:
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        Base.metadata.create_all(engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = TestingSessionLocal()
        
        audit_service = AuditService(db)
        
        test_name = "记录审计日志"
        log = audit_service.log_action(
            action="测试操作",
            action_type="test",
            counselor_id=1,
            old_value={"status": "old"},
            new_value={"status": "new"}
        )
        if log.id is not None:
            result.add_pass(test_name, f"日志ID: {log.id}")
        else:
            result.add_fail(test_name, "审计日志记录失败")
        
        test_name = "查询审计日志"
        logs = audit_service.get_all_audit_logs(limit=10)
        if len(logs) > 0:
            result.add_pass(test_name, f"查询到 {len(logs)} 条审计日志")
        else:
            result.add_fail(test_name, "查询审计日志失败")
        
        test_name = "导出审计包"
        package = audit_service.export_audit_package()
        if "export_metadata" in package and "audit_logs" in package:
            result.add_pass(test_name, f"导出审计包包含 {len(package['audit_logs'])} 条记录")
        else:
            result.add_fail(test_name, "导出审计包失败")
        
        db.close()
        Base.metadata.drop_all(engine)
        
    except Exception as e:
        result.add_fail("审计服务测试", str(e))


if __name__ == "__main__":
    sys.exit(run_all_checks())
