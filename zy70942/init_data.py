import sys
from datetime import datetime, timedelta

sys.path.insert(0, '.')

from app.database import SessionLocal, engine, Base
from app import models
from app.models import PenaltyRule, WeatherExemption

Base.metadata.create_all(bind=engine)
print("数据库表创建完成")


def init_penalty_rules():
    db = SessionLocal()

    rules = [
        {
            'rule_code': 'DELAY_001',
            'rule_name': '晚点扣罚-轻微',
            'rule_type': 'delay',
            'penalty_type': 'delay',
            'calculation_method': 'percentage',
            'percentage': 5.0,
            'min_penalty': 50,
            'max_penalty': 200,
            'threshold_hours': 4,
            'priority': 1,
            'description': '晚点4小时以上扣罚运费5%，最低50元，最高200元'
        },
        {
            'rule_code': 'DELAY_002',
            'rule_name': '晚点扣罚-一般',
            'rule_type': 'delay',
            'penalty_type': 'delay',
            'calculation_method': 'percentage',
            'percentage': 10.0,
            'min_penalty': 100,
            'max_penalty': 500,
            'threshold_hours': 12,
            'priority': 2,
            'description': '晚点12小时以上扣罚运费10%，最低100元，最高500元'
        },
        {
            'rule_code': 'DELAY_003',
            'rule_name': '晚点扣罚-严重',
            'rule_type': 'delay',
            'penalty_type': 'delay',
            'calculation_method': 'percentage',
            'percentage': 20.0,
            'min_penalty': 200,
            'max_penalty': 1000,
            'threshold_hours': 24,
            'priority': 3,
            'description': '晚点24小时以上扣罚运费20%，最低200元，最高1000元'
        },
        {
            'rule_code': 'DAMAGE_001',
            'rule_name': '破损扣罚-轻微',
            'rule_type': 'damage',
            'penalty_type': 'damage',
            'calculation_method': 'percentage',
            'percentage': 5.0,
            'min_penalty': 100,
            'conditions': {'severity': 'minor'},
            'priority': 1,
            'description': '轻微破损扣罚声明价值5%，最低100元'
        },
        {
            'rule_code': 'DAMAGE_002',
            'rule_name': '破损扣罚-一般',
            'rule_type': 'damage',
            'penalty_type': 'damage',
            'calculation_method': 'percentage',
            'percentage': 15.0,
            'min_penalty': 300,
            'conditions': {'severity': 'moderate'},
            'priority': 2,
            'description': '一般破损扣罚声明价值15%，最低300元'
        },
        {
            'rule_code': 'DAMAGE_003',
            'rule_name': '破损扣罚-严重',
            'rule_type': 'damage',
            'penalty_type': 'damage',
            'calculation_method': 'percentage',
            'percentage': 30.0,
            'min_penalty': 500,
            'conditions': {'severity': 'serious'},
            'priority': 3,
            'description': '严重破损扣罚声明价值30%，最低500元'
        },
        {
            'rule_code': 'TRANSFER_001',
            'rule_name': '中转超时扣罚',
            'rule_type': 'transfer',
            'penalty_type': 'transfer',
            'calculation_method': 'fixed',
            'base_value': 200,
            'threshold_hours': 24,
            'priority': 1,
            'description': '中转超时24小时以上扣罚200元'
        }
    ]

    for rule_data in rules:
        existing = db.query(PenaltyRule).filter(
            PenaltyRule.rule_code == rule_data['rule_code']
        ).first()

        if existing:
            print(f"更新规则: {rule_data['rule_code']}")
            for key, value in rule_data.items():
                setattr(existing, key, value)
        else:
            print(f"创建规则: {rule_data['rule_code']}")
            rule = PenaltyRule(**rule_data)
            db.add(rule)

    db.commit()
    print("扣罚规则初始化完成")


def init_weather_exemptions():
    db = SessionLocal()

    exemptions = [
        {
            'city': '广州',
            'start_time': datetime.now() - timedelta(days=5),
            'end_time': datetime.now() - timedelta(days=2),
            'weather_type': '暴雨',
            'severity': '橙色预警',
            'description': '广州地区暴雨橙色预警，影响物流运输',
            'affected_routes': ['GZ-BJ', 'GZ-SH', 'GZ-SZ']
        },
        {
            'city': '上海',
            'start_time': datetime.now() - timedelta(days=10),
            'end_time': datetime.now() - timedelta(days=8),
            'weather_type': '台风',
            'severity': '红色预警',
            'description': '上海地区台风红色预警，物流暂停',
            'affected_routes': ['SH-GZ', 'SH-BJ']
        }
    ]

    for exempt_data in exemptions:
        existing = db.query(WeatherExemption).filter(
            WeatherExemption.city == exempt_data['city'],
            WeatherExemption.start_time == exempt_data['start_time']
        ).first()

        if not existing:
            print(f"创建天气豁免: {exempt_data['city']} - {exempt_data['weather_type']}")
            exemption = WeatherExemption(**exempt_data)
            db.add(exemption)

    db.commit()
    print("天气豁免初始化完成")


if __name__ == '__main__':
    print("开始初始化基础数据...")
    init_penalty_rules()
    init_weather_exemptions()
    print("初始化完成")
