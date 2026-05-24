from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_lab.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_default_retest_rules():
    from app.models import RetestRule
    db = SessionLocal()
    try:
        existing = db.query(RetestRule).first()
        if existing:
            return

        rules = [
            {
                'rule_name': '防重复提交规则',
                'rule_code': 'duplicate_submission',
                'rule_type': 'validation',
                'description': '防止同一批次号+样品编码重复提交',
                'priority': 100,
                'is_active': True
            },
            {
                'rule_name': '样品混批检测规则',
                'rule_code': 'mixed_batch',
                'rule_type': 'validation',
                'description': '检测同一批次号下是否有多种样品类型',
                'priority': 90,
                'is_active': True
            },
            {
                'rule_name': '复检窗口规则',
                'rule_code': 'retest_window',
                'rule_type': 'retest',
                'description': '7天内可申请复检',
                'priority': 80,
                'is_active': True,
                'retest_window_days': 7,
                'max_retest_count': 1
            },
            {
                'rule_name': '报告撤回规则',
                'rule_code': 'report_withdraw',
                'rule_type': 'report',
                'description': '30天内可撤回报告',
                'priority': 70,
                'is_active': True,
                'parameter_json': '{"withdraw_window_days": 30}'
            }
        ]

        for rule_data in rules:
            rule = RetestRule(
                rule_name=rule_data['rule_name'],
                rule_code=rule_data['rule_code'],
                rule_type=rule_data['rule_type'],
                description=rule_data['description'],
                priority=rule_data['priority'],
                is_active=rule_data['is_active'],
                retest_window_days=rule_data.get('retest_window_days'),
                max_retest_count=rule_data.get('max_retest_count', 1),
                parameter_json=rule_data.get('parameter_json')
            )
            db.add(rule)

        db.commit()
    finally:
        db.close()
