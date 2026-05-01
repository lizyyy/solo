import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Counselor, Case, StatusTransition, DesensitizedVersion
from config import CaseStatus, RiskLevel
from services import CaseService, state_machine
from desensitization import desensitization_engine, scale_validator, risk_validator


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(engine)


class TestDesensitizationEngine:
    def test_check_text_with_sensitive_name(self):
        text = "来访者张三，25岁，因工作压力前来咨询"
        passed, sensitive = desensitization_engine.check_text(text)
        
        assert passed is False
        assert len(sensitive) > 0
        assert any(item["rule_name"] == "chinese_name" for item in sensitive)
    
    def test_check_text_with_phone_number(self):
        text = "联系电话：13812345678，有需要请联系"
        passed, sensitive = desensitization_engine.check_text(text)
        
        assert passed is False
        assert len(sensitive) > 0
        assert any(item["rule_name"] == "phone_number" for item in sensitive)
    
    def test_check_text_with_school(self):
        text = "来访者就读于北京大学，是一名大三学生"
        passed, sensitive = desensitization_engine.check_text(text)
        
        assert passed is False
        assert len(sensitive) > 0
        assert any(item["rule_name"] == "school_name" for item in sensitive)
    
    def test_check_text_with_email(self):
        text = "邮箱地址是：test@example.com"
        passed, sensitive = desensitization_engine.check_text(text)
        
        assert passed is False
        assert len(sensitive) > 0
        assert any(item["rule_name"] == "email" for item in sensitive)
    
    def test_check_text_clean(self):
        text = "来访者因工作压力大，感到焦虑，失眠已有两周"
        passed, sensitive = desensitization_engine.check_text(text)
        
        assert passed is True
        assert len(sensitive) == 0
    
    def test_check_case_content(self):
        case_data = {
            "presenting_problem": "来访者李四因抑郁情绪前来咨询",
            "background_info": "来访者家住北京市海淀区中关村大街1号",
            "assessment_process": "经过SDS评估，分数为65分"
        }
        
        passed, results = desensitization_engine.check_case_content(case_data)
        
        assert passed is False
        assert results["presenting_problem"]["passed"] is False
        assert results["background_info"]["passed"] is False


class TestScaleValidator:
    def test_validate_score_valid(self):
        passed, message = scale_validator.validate_score("SDS", 65)
        assert passed is True
        assert "在有效范围内" in message
    
    def test_validate_score_invalid_high(self):
        passed, message = scale_validator.validate_score("SDS", 150)
        assert passed is False
        assert "超出有效范围" in message
    
    def test_validate_score_invalid_low(self):
        passed, message = scale_validator.validate_score("SAS", -10)
        assert passed is False
        assert "超出有效范围" in message
    
    def test_validate_unknown_scale(self):
        passed, message = scale_validator.validate_score("UNKNOWN", 50)
        assert passed is False
        assert "未知的量表名称" in message
    
    def test_validate_all_scores(self):
        scores = {
            "SDS": 50,
            "SAS": 45,
            "GAD7": 15
        }
        
        passed, results = scale_validator.validate_all_scores(scores)
        
        assert passed is True
        assert results["SDS"]["passed"] is True
        assert results["SAS"]["passed"] is True
        assert results["GAD7"]["passed"] is True


class TestRiskLevelValidator:
    def test_validate_risk_match_crisis(self):
        risk_level = RiskLevel.CRISIS
        triggers = ["自杀计划", "近期自伤史"]
        
        passed, result = risk_validator.validate_risk_match(risk_level, triggers)
        
        assert passed is True
        assert len(result["matched_triggers"]) > 0
    
    def test_validate_risk_match_high(self):
        risk_level = RiskLevel.HIGH
        triggers = ["重度抑郁", "自杀意念"]
        
        passed, result = risk_validator.validate_risk_match(risk_level, triggers)
        
        assert passed is True
    
    def test_validate_risk_no_match_crisis(self):
        risk_level = RiskLevel.CRISIS
        triggers = ["轻度焦虑"]
        
        passed, result = risk_validator.validate_risk_match(risk_level, triggers)
        
        assert passed is False
        assert "必须匹配至少一个触发因素" in result["error"]
    
    def test_suggest_risk_level_crisis(self):
        triggers = ["自杀计划"]
        suggested = risk_validator.suggest_risk_level(triggers)
        
        assert suggested == RiskLevel.CRISIS
    
    def test_suggest_risk_level_high(self):
        triggers = ["重度抑郁"]
        suggested = risk_validator.suggest_risk_level(triggers)
        
        assert suggested == RiskLevel.HIGH
    
    def test_suggest_risk_level_low(self):
        triggers = ["一般心理问题"]
        suggested = risk_validator.suggest_risk_level(triggers)
        
        assert suggested == RiskLevel.LOW


class TestStateMachine:
    def test_can_transition_draft_to_pending(self):
        can = state_machine.can_transition(CaseStatus.DRAFT, CaseStatus.PENDING_REVIEW)
        assert can is True
    
    def test_can_transition_draft_to_archived(self):
        can = state_machine.can_transition(CaseStatus.DRAFT, CaseStatus.ARCHIVED)
        assert can is True
    
    def test_cannot_transition_draft_to_reviewed(self):
        can = state_machine.can_transition(CaseStatus.DRAFT, CaseStatus.REVIEWED)
        assert can is False
    
    def test_can_transition_pending_to_needs_supplement(self):
        can = state_machine.can_transition(CaseStatus.PENDING_REVIEW, CaseStatus.NEEDS_SUPPLEMENT)
        assert can is True
    
    def test_can_transition_pending_to_crisis(self):
        can = state_machine.can_transition(CaseStatus.PENDING_REVIEW, CaseStatus.CRISIS_HANDLING)
        assert can is True
    
    def test_get_valid_transitions(self):
        transitions = state_machine.get_valid_transitions(CaseStatus.PENDING_REVIEW)
        
        assert CaseStatus.NEEDS_SUPPLEMENT in transitions
        assert CaseStatus.REVIEWED in transitions
        assert CaseStatus.CRISIS_HANDLING in transitions
        assert CaseStatus.ARCHIVED in transitions


class TestCaseService:
    def test_create_case(self, db_session):
        counselor = Counselor(
            name="张咨询师",
            employee_id="C001",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑",
            "background_info": "来访者最近工作压力较大，睡眠质量不好",
            "sds_score": 50,
            "sas_score": 45
        }
        
        case = service.create_case(counselor.id, case_data)
        
        assert case.id is not None
        assert case.case_number.startswith("CASE-")
        assert case.status == CaseStatus.DRAFT
        assert case.risk_level == RiskLevel.LOW
        assert case.presenting_problem == "来访者因工作压力大感到焦虑"
    
    def test_submit_case_success(self, db_session):
        counselor = Counselor(
            name="李咨询师",
            employee_id="C002",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑",
            "background_info": "来访者最近工作压力较大",
            "sds_score": 50
        }
        
        case = service.create_case(counselor.id, case_data)
        
        result = service.submit_for_review(case.id, counselor.id)
        
        assert result["success"] is True
        assert result["case"].status == CaseStatus.PENDING_REVIEW
    
    def test_submit_case_with_sensitive_info(self, db_session):
        counselor = Counselor(
            name="王咨询师",
            employee_id="C003",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者张三因工作压力大感到焦虑",
            "background_info": "来访者家住北京市海淀区",
            "sds_score": 50
        }
        
        case = service.create_case(counselor.id, case_data)
        
        result = service.submit_for_review(case.id, counselor.id)
        
        assert result["success"] is False
        assert result["error_type"] == "desensitization_failed"
    
    def test_submit_case_with_invalid_scale(self, db_session):
        counselor = Counselor(
            name="赵咨询师",
            employee_id="C004",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑",
            "sds_score": 150
        }
        
        case = service.create_case(counselor.id, case_data)
        
        result = service.submit_for_review(case.id, counselor.id)
        
        assert result["success"] is False
        assert result["error_type"] == "scale_validation_failed"
    
    def test_request_supplement(self, db_session):
        counselor = Counselor(
            name="刘咨询师",
            employee_id="C005",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        supervisor = Counselor(
            name="陈督导",
            employee_id="S001",
            department="督导组",
            qualification="资深督导"
        )
        db_session.add(supervisor)
        db_session.commit()
        db_session.refresh(supervisor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑"
        }
        
        case = service.create_case(counselor.id, case_data)
        
        case.status = CaseStatus.PENDING_REVIEW
        db_session.commit()
        
        result = service.request_supplement(
            case.id,
            supervisor.id,
            "需要补充更多背景信息",
            ["家庭背景", "既往病史"]
        )
        
        assert result["success"] is True
        assert result["case"].status == CaseStatus.NEEDS_SUPPLEMENT
    
    def test_complete_review(self, db_session):
        counselor = Counselor(
            name="周咨询师",
            employee_id="C006",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        supervisor = Counselor(
            name="吴督导",
            employee_id="S002",
            department="督导组"
        )
        db_session.add(supervisor)
        db_session.commit()
        db_session.refresh(supervisor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑"
        }
        
        case = service.create_case(counselor.id, case_data)
        
        case.status = CaseStatus.PENDING_REVIEW
        db_session.commit()
        
        result = service.complete_review(
            case.id,
            supervisor.id,
            {
                "overall_assessment": "案例处理得当，评估全面",
                "strengths": "建立了良好的咨询关系",
                "areas_for_improvement": "可以进一步探索家庭因素"
            }
        )
        
        assert result["success"] is True
        assert result["case"].status == CaseStatus.REVIEWED
    
    def test_escalate_crisis(self, db_session):
        counselor = Counselor(
            name="孙咨询师",
            employee_id="C007",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者有自杀意念"
        }
        
        case = service.create_case(counselor.id, case_data)
        
        case.status = CaseStatus.PENDING_REVIEW
        db_session.commit()
        
        result = service.escalate_crisis(
            case.id,
            counselor.id,
            {
                "trigger_event": "来访者表示有自杀计划",
                "immediate_actions_taken": "已启动安全计划，通知紧急联系人",
                "safety_plan_activated": 1,
                "emergency_contacts_informed": 1
            }
        )
        
        assert result["success"] is True
        assert result["case"].status == CaseStatus.CRISIS_HANDLING
        assert result["case"].risk_level == RiskLevel.CRISIS
    
    def test_archive_case(self, db_session):
        counselor = Counselor(
            name="钱咨询师",
            employee_id="C008",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑"
        }
        
        case = service.create_case(counselor.id, case_data)
        
        case.status = CaseStatus.REVIEWED
        db_session.commit()
        
        result = service.archive_case(
            case.id,
            counselor.id,
            "案例已完成督导，咨询目标达成"
        )
        
        assert result["success"] is True
        assert result["case"].status == CaseStatus.ARCHIVED
    
    def test_get_case_history(self, db_session):
        counselor = Counselor(
            name="冯咨询师",
            employee_id="C009",
            department="心理咨询部"
        )
        db_session.add(counselor)
        db_session.commit()
        db_session.refresh(counselor)
        
        service = CaseService(db_session)
        
        case_data = {
            "presenting_problem": "来访者因工作压力大感到焦虑"
        }
        
        case = service.create_case(counselor.id, case_data)
        
        transition = StatusTransition(
            case_id=case.id,
            from_status=CaseStatus.DRAFT,
            to_status=CaseStatus.PENDING_REVIEW,
            transitioned_by=counselor.id,
            reason="提交督导"
        )
        db_session.add(transition)
        
        desensitized = DesensitizedVersion(
            case_id=case.id,
            version_number=1,
            presenting_problem=case.presenting_problem,
            desensitization_check_passed=1,
            created_by=counselor.id
        )
        db_session.add(desensitized)
        db_session.commit()
        
        history = service.get_case_history(case.id)
        
        assert history["case"].id == case.id
        assert len(history["status_transitions"]) == 1
        assert len(history["desensitized_versions"]) == 1
