from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import Base, engine, init_db
from app.models import (
    Instrument, User, ResearchGroup, Reservation,
    SwipeLog, SampleRegistration, BillingRule,
    Violation, Bill, AuditLog, ImportBatch, Review
)
from app.engine.rule_engine import (
    RuleEngine, RuleType, TimeOverlapRule, NoReservationSwipeRule,
    SampleOverdueRule
)
from app.parsers.csv_parser import (
    CSVParser, parse_reservation_csv, parse_swipe_log_csv,
    parse_sample_registration_csv
)
from app.parsers.json_parser import (
    JSONParser, parse_billing_rules_json
)
from app.exports.exporter import (
    Exporter, ExportFormat, export_to_csv, export_to_json, export_to_markdown
)


@dataclass
class CheckResult:
    name: str
    success: bool = True
    message: str = ""
    duration_ms: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None


@dataclass
class SelfCheckResult:
    check_time: datetime
    total_checks: int = 0
    passed: int = 0
    failed: int = 0
    results: List[CheckResult] = field(default_factory=list)
    
    @property
    def success(self) -> bool:
        return self.failed == 0


def check_database_connection(db: Session = None) -> CheckResult:
    result = CheckResult(name="数据库连接检查")
    start_time = datetime.now()
    
    try:
        if db:
            db.execute(text("SELECT 1"))
            db.commit()
        else:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                conn.commit()
        
        result.success = True
        result.message = "数据库连接正常"
        result.details["engine"] = str(engine.url)
    except Exception as e:
        result.success = False
        result.message = "数据库连接失败"
        result.error_message = str(e)
    
    result.duration_ms = (datetime.now() - start_time).total_seconds() * 1000
    return result


def check_models(db: Session) -> CheckResult:
    result = CheckResult(name="数据模型检查")
    start_time = datetime.now()
    
    try:
        init_db()
        
        model_classes = [
            ("Instrument", Instrument),
            ("User", User),
            ("ResearchGroup", ResearchGroup),
            ("Reservation", Reservation),
            ("SwipeLog", SwipeLog),
            ("SampleRegistration", SampleRegistration),
            ("BillingRule", BillingRule),
            ("Violation", Violation),
            ("Bill", Bill),
            ("AuditLog", AuditLog),
            ("ImportBatch", ImportBatch),
            ("Review", Review),
        ]
        
        model_status = {}
        for name, model in model_classes:
            try:
                count = db.query(model).limit(1).count()
                model_status[name] = {"status": "ok", "can_query": True}
            except Exception as e:
                model_status[name] = {"status": "error", "error": str(e)}
        
        result.details["models"] = model_status
        result.success = True
        result.message = f"成功检查 {len(model_status)} 个数据模型"
    except Exception as e:
        result.success = False
        result.message = "数据模型检查失败"
        result.error_message = str(e)
    
    result.duration_ms = (datetime.now() - start_time).total_seconds() * 1000
    return result


def check_rules_engine(db: Session) -> CheckResult:
    result = CheckResult(name="规则引擎检查")
    start_time = datetime.now()
    
    try:
        engine = RuleEngine(db)
        
        rule_types = [
            RuleType.TIME_OVERLAP,
            RuleType.NO_RESERVATION_SWIPE,
            RuleType.CROSS_GROUP_USAGE,
            RuleType.SAMPLE_OVERDUE,
            RuleType.RESERVATION_NO_SHOW,
        ]
        
        rule_status = {}
        for rule_type in rule_types:
            try:
                rule_result = engine.run_rule(rule_type)
                rule_status[rule_type.value] = {
                    "status": "ok",
                    "success": rule_result.success,
                    "message": rule_result.message
                }
            except Exception as e:
                rule_status[rule_type.value] = {
                    "status": "error",
                    "error": str(e)
                }
        
        result.details["rules"] = rule_status
        result.success = True
        result.message = f"成功检查 {len(rule_status)} 个规则"
    except Exception as e:
        result.success = False
        result.message = "规则引擎检查失败"
        result.error_message = str(e)
    
    result.duration_ms = (datetime.now() - start_time).total_seconds() * 1000
    return result


def check_parsers() -> CheckResult:
    result = CheckResult(name="解析器检查")
    start_time = datetime.now()
    
    try:
        parser_status = {}
        
        reservation_csv = """reservation_code,start_time,end_time,instrument_code,user_id
RES001,2025-05-01 09:00:00,2025-05-01 11:00:00,INS001,U001
RES002,2025-05-01 14:00:00,2025-05-01 16:00:00,INS002,U002"""
        
        parse_result = parse_reservation_csv(reservation_csv)
        parser_status["reservation_csv"] = {
            "status": "ok" if parse_result.success else "error",
            "total": parse_result.total_count,
            "success_count": parse_result.success_count
        }
        
        swipe_csv = """card_number,swipe_time,instrument_code,user_id
CARD001,2025-05-01 09:05:00,INS001,U001
CARD002,2025-05-01 14:10:00,INS002,U002"""
        
        swipe_result = parse_swipe_log_csv(swipe_csv)
        parser_status["swipe_csv"] = {
            "status": "ok" if swipe_result.success else "error",
            "total": swipe_result.total_count,
            "success_count": swipe_result.success_count
        }
        
        sample_csv = """sample_code,registered_at,sample_type,user_id
SAM001,2025-05-01 10:00:00,纳米粒子,U001
SAM002,2025-05-01 15:00:00,生物样本,U002"""
        
        sample_result = parse_sample_registration_csv(sample_csv)
        parser_status["sample_csv"] = {
            "status": "ok" if sample_result.success else "error",
            "total": sample_result.total_count,
            "success_count": sample_result.success_count
        }
        
        billing_json = """{
            "rules": [
                {
                    "rule_code": "RULE001",
                    "name": "测试规则",
                    "base_hourly_rate": 100.0,
                    "is_active": true
                }
            ]
        }"""
        
        billing_result = parse_billing_rules_json(billing_json)
        parser_status["billing_json"] = {
            "status": "ok" if billing_result.success else "error",
            "total": billing_result.total_count,
            "success_count": billing_result.success_count
        }
        
        result.details["parsers"] = parser_status
        result.success = True
        result.message = f"成功检查 {len(parser_status)} 个解析器"
    except Exception as e:
        result.success = False
        result.message = "解析器检查失败"
        result.error_message = str(e)
    
    result.duration_ms = (datetime.now() - start_time).total_seconds() * 1000
    return result


def check_exports() -> CheckResult:
    result = CheckResult(name="导出器检查")
    start_time = datetime.now()
    
    try:
        test_data = [
            {"id": 1, "name": "测试1", "value": 100.0},
            {"id": 2, "name": "测试2", "value": 200.0},
        ]
        
        export_status = {}
        
        csv_result = export_to_csv(test_data, fields=["id", "name", "value"])
        export_status["csv"] = {
            "status": "ok" if csv_result.success else "error",
            "record_count": csv_result.record_count,
            "content_length": len(csv_result.content) if csv_result.content else 0
        }
        
        json_result = export_to_json(test_data)
        export_status["json"] = {
            "status": "ok" if json_result.success else "error",
            "record_count": json_result.record_count,
            "content_length": len(json_result.content) if json_result.content else 0
        }
        
        md_result = export_to_markdown(test_data, title="测试报告")
        export_status["markdown"] = {
            "status": "ok" if md_result.success else "error",
            "record_count": md_result.record_count,
            "content_length": len(md_result.content) if md_result.content else 0
        }
        
        result.details["exports"] = export_status
        result.success = True
        result.message = f"成功检查 {len(export_status)} 个导出格式"
    except Exception as e:
        result.success = False
        result.message = "导出器检查失败"
        result.error_message = str(e)
    
    result.duration_ms = (datetime.now() - start_time).total_seconds() * 1000
    return result


def run_self_check(db: Session) -> SelfCheckResult:
    check_time = datetime.now()
    result = SelfCheckResult(check_time=check_time)
    
    checks = [
        ("数据库连接", check_database_connection, [db]),
        ("数据模型", check_models, [db]),
        ("规则引擎", check_rules_engine, [db]),
        ("解析器", check_parsers, []),
        ("导出器", check_exports, []),
    ]
    
    for name, check_func, args in checks:
        try:
            check_result = check_func(*args)
            result.results.append(check_result)
            
            if check_result.success:
                result.passed += 1
            else:
                result.failed += 1
        except Exception as e:
            result.results.append(CheckResult(
                name=name,
                success=False,
                message=f"检查执行异常: {str(e)}",
                error_message=str(e)
            ))
            result.failed += 1
        
        result.total_checks += 1
    
    return result
