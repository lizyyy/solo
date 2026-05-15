import random
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from database import ProcessingBatch
from schemas import DutyRecordCreate, SamplingRuleCreate, ProcessingBatchCreate
from sampling_service import create_sampling_rule, create_duty_record, batch_create_duty_records, generate_batch_id

DEPARTMENTS = [
    "支付平台部", "核心交易部", "风控系统部", "数据中台部",
    "用户中心部", "基础架构部", "运维保障部", "安全合规部"
]

DUTY_PERSONS = [
    "张伟", "王芳", "李娜", "刘强", "陈明", "杨丽", "赵强", "黄敏",
    "周杰", "吴涛", "郑磊", "孙燕", "马超", "朱婷", "胡军", "林琳"
]

INCIDENT_TYPES = [
    {"type": "系统告警", "level": "P1", "duration": 30},
    {"type": "数据库慢查询", "level": "P2", "duration": 15},
    {"type": "接口超时", "level": "P2", "duration": 20},
    {"type": "磁盘空间告警", "level": "P3", "duration": 10},
    {"type": "服务重启", "level": "P2", "duration": 25},
    {"type": "网络波动", "level": "P3", "duration": 5},
    {"type": "第三方依赖异常", "level": "P1", "duration": 45},
    {"type": "消息队列积压", "level": "P2", "duration": 35},
    {"type": "缓存穿透", "level": "P1", "duration": 40},
    {"type": "无异常", "level": "P4", "duration": 0}
]

PHONE_PREFIXES = ["138", "139", "158", "159", "186", "189", "135", "136"]


def generate_phone() -> str:
    return random.choice(PHONE_PREFIXES) + str(random.randint(10000000, 99999999))


def generate_incidents(count: int) -> List[dict]:
    incidents = []
    for i in range(count):
        incident = random.choice(INCIDENT_TYPES[:-1])
        incidents.append({
            "incident_id": f"INC-{datetime.now().strftime('%Y%m%d')}-{str(i+1).zfill(3)}",
            "type": incident["type"],
            "level": incident["level"],
            "start_time": (datetime.now() - timedelta(hours=random.randint(1, 24))).strftime("%Y-%m-%d %H:%M:%S"),
            "duration_minutes": incident["duration"] + random.randint(-5, 10),
            "description": f"{incident['type']}事件，已处理完成",
            "handler": random.choice(DUTY_PERSONS)
        })
    return incidents


def generate_duty_records_for_batch(batch_id: str, department: str, 
                                     start_date: str, end_date: str, 
                                     count: int = 30) -> List[DutyRecordCreate]:
    records = []
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    days_range = (end_dt - start_dt).days
    
    for i in range(count):
        duty_day = start_dt + timedelta(days=random.randint(0, days_range))
        duty_date_str = duty_day.strftime("%Y-%m-%d")
        
        incident_count = random.choices([0, 1, 2, 3, 4, 5], weights=[0.3, 0.25, 0.2, 0.12, 0.08, 0.05])[0]
        incidents = generate_incidents(incident_count) if incident_count > 0 else []
        
        receipt_random = random.random()
        if receipt_random < 0.7:
            receipt_status = "received"
        elif receipt_random < 0.85:
            receipt_status = "pending"
        else:
            receipt_status = "late"
        
        duty_person = random.choice(DUTY_PERSONS)
        
        raw_input = {
            "source": "部门值班日报系统",
            "submitted_at": (duty_day + timedelta(hours=random.randint(8, 20))).strftime("%Y-%m-%d %H:%M:%S"),
            "submitter": duty_person,
            "original_form_data": {
                "值班日期": duty_date_str,
                "值班人员": duty_person,
                "联系电话": generate_phone(),
                "事件总数": incident_count,
                "详细事件": [f"{inc['type']}({inc['level']})" for inc in incidents],
                "备注": "正常值班交接"
            }
        }
        
        record = DutyRecordCreate(
            batch_id=batch_id,
            duty_date=duty_date_str,
            department=department,
            duty_person=duty_person,
            phone=generate_phone(),
            incident_count=incident_count,
            incidents=incidents,
            external_receipt_status=receipt_status,
            raw_input=raw_input
        )
        records.append(record)
    
    return records


def init_demo_rules(db: Session) -> None:
    rule1 = SamplingRuleCreate(
        version="V1.0-202401",
        name="2024年Q1调用链采样规则",
        description="第一季度采样规则：基础采样率15%，事件数>=3必采",
        department="总部",
        sampling_rate=0.15,
        min_incidents=3,
        include_departments=["*"],
        exclude_departments=["安全合规部"],
        receipt_timeout_hours=48,
        created_by="系统管理员"
    )
    create_sampling_rule(db, rule1)
    
    rule2 = SamplingRuleCreate(
        version="V2.0-202404",
        name="2024年Q2调用链采样规则",
        description="第二季度优化采样规则：基础采样率提升至20%，事件数>=2必采，新增回执超时检测",
        department="总部",
        sampling_rate=0.20,
        min_incidents=2,
        include_departments=["*"],
        exclude_departments=[],
        receipt_timeout_hours=24,
        created_by="运维经理"
    )
    create_sampling_rule(db, rule2)


def init_demo_batches(db: Session) -> List[str]:
    batch_ids = []
    
    batches_config = [
        ("支付平台部", "2024-01-01", "2024-01-31", "V1.0-202401"),
        ("核心交易部", "2024-01-01", "2024-01-31", "V1.0-202401"),
        ("风控系统部", "2024-04-01", "2024-04-30", "V2.0-202404"),
        ("数据中台部", "2024-04-01", "2024-04-30", "V2.0-202404")
    ]
    
    for dept, start_date, end_date, rule_version in batches_config:
        batch_id = generate_batch_id(dept, start_date)
        batch_ids.append(batch_id)
        
        batch = ProcessingBatch(
            batch_id=batch_id,
            rule_version=rule_version,
            department=dept,
            start_date=start_date,
            end_date=end_date,
            created_by="运维自动化",
            status="processing"
        )
        db.add(batch)
        db.commit()
        
        records = generate_duty_records_for_batch(batch_id, dept, start_date, end_date, count=25)
        batch_create_duty_records(db, records)
    
    return batch_ids


def add_late_receipt_scenario(db: Session, batch_id: str, late_count: int = 5) -> None:
    from sqlalchemy import update
    from database import DutyRecord
    
    records = db.query(DutyRecord).filter(
        DutyRecord.batch_id == batch_id,
        DutyRecord.external_receipt_status == "pending"
    ).limit(late_count).all()
    
    for record in records:
        record.external_receipt_status = "late"
        record.external_receipt_time = datetime.utcnow() + timedelta(hours=72)
        record.raw_input["external_receipt_note"] = "外部系统回执超时，已标记为晚到数据"
        record.updated_at = datetime.utcnow()
    db.commit()


def init_all_demo_data(db: Session) -> dict:
    print("正在初始化演示规则...")
    init_demo_rules(db)
    print("规则初始化完成")
    
    print("正在创建演示批次和值班记录...")
    batch_ids = init_demo_batches(db)
    print(f"已创建 {len(batch_ids)} 个批次")
    
    print("正在添加外部回执晚到场景...")
    add_late_receipt_scenario(db, batch_ids[0], late_count=6)
    add_late_receipt_scenario(db, batch_ids[2], late_count=4)
    print("晚到场景数据已添加")
    
    return {
        "rule_versions": ["V1.0-202401", "V2.0-202404"],
        "batch_ids": batch_ids,
        "departments": DEPARTMENTS
    }
