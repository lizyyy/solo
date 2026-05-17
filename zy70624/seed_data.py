#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

sys.path.insert(0, '.')

from app.database import SessionLocal, engine, Base
from app.models import (
    CustomerDemand, AuntProfile, TrialSchedule, Deposit, Review, Conversion,
    CustomerDemandStatus, AuntStatus, TrialScheduleStatus, DepositStatus,
    ReviewStatus, ConversionStatus
)


def seed_data():
    db = SessionLocal()
    
    print("开始造数...")
    
    customer_demands = [
        {
            "customer_name": "张三",
            "customer_phone": "13800138001",
            "address": "北京市朝阳区望京SOHO",
            "service_type": "住家保姆",
            "required_skills": "做饭,打扫,照顾老人",
            "salary_expectation": 6000.0,
            "work_time": "住家，月休4天",
            "remarks": "需要有健康证",
            "status": CustomerDemandStatus.TRIAL_SCHEDULED
        },
        {
            "customer_name": "李四",
            "customer_phone": "13800138002",
            "address": "上海市浦东新区陆家嘴",
            "service_type": "月嫂",
            "required_skills": "产妇护理,新生儿护理",
            "salary_expectation": 12000.0,
            "work_time": "24小时住家",
            "remarks": "预产期2024年3月",
            "status": CustomerDemandStatus.PENDING
        },
        {
            "customer_name": "王五",
            "customer_phone": "13800138003",
            "address": "广州市天河区珠江新城",
            "service_type": "育儿嫂",
            "required_skills": "婴幼儿护理,早教",
            "salary_expectation": 8000.0,
            "work_time": "早8晚6",
            "remarks": "宝宝6个月大",
            "status": CustomerDemandStatus.COMPLETED
        }
    ]
    
    for data in customer_demands:
        demand = CustomerDemand(**data)
        db.add(demand)
    db.commit()
    
    aunt_profiles = [
        {
            "name": "王阿姨",
            "phone": "13900139001",
            "id_card": "110101198001011234",
            "age": 44,
            "experience_years": 8,
            "skills": "做饭,打扫,照顾老人",
            "certificates": "健康证,家政服务证",
            "address": "河北省石家庄市",
            "remarks": "做事认真负责",
            "status": AuntStatus.ON_TRIAL
        },
        {
            "name": "李阿姨",
            "phone": "13900139002",
            "id_card": "310101198502025678",
            "age": 39,
            "experience_years": 5,
            "skills": "产妇护理,新生儿护理,催乳",
            "certificates": "健康证,月嫂证,催乳师证",
            "address": "江苏省苏州市",
            "remarks": "金牌月嫂",
            "status": AuntStatus.AVAILABLE
        },
        {
            "name": "张阿姨",
            "phone": "13900139003",
            "id_card": "440101198803039012",
            "age": 36,
            "experience_years": 6,
            "skills": "婴幼儿护理,早教,辅食制作",
            "certificates": "健康证,育儿嫂证",
            "address": "湖南省长沙市",
            "remarks": "喜欢小孩",
            "status": AuntStatus.WORKING
        }
    ]
    
    for data in aunt_profiles:
        aunt = AuntProfile(**data)
        db.add(aunt)
    db.commit()
    
    demands = db.query(CustomerDemand).all()
    aunts = db.query(AuntProfile).all()
    
    base_date = datetime.now()
    
    trial_schedules = [
        {
            "demand_id": demands[0].id,
            "aunt_id": aunts[0].id,
            "trial_start_time": base_date + timedelta(days=1),
            "trial_end_time": base_date + timedelta(days=3),
            "trial_address": demands[0].address,
            "trial_fee": 300.0,
            "status": TrialScheduleStatus.SCHEDULED,
            "created_by": "admin",
            "remarks": "第一次试工"
        },
        {
            "demand_id": demands[2].id,
            "aunt_id": aunts[2].id,
            "trial_start_time": base_date - timedelta(days=10),
            "trial_end_time": base_date - timedelta(days=7),
            "trial_address": demands[2].address,
            "trial_fee": 400.0,
            "status": TrialScheduleStatus.COMPLETED,
            "created_by": "admin",
            "remarks": "已完成试工"
        }
    ]
    
    for data in trial_schedules:
        schedule = TrialSchedule(**data)
        db.add(schedule)
    db.commit()
    
    schedules = db.query(TrialSchedule).all()
    
    deposits = [
        {
            "trial_schedule_id": schedules[0].id,
            "amount": 500.0,
            "payment_method": "微信",
            "transaction_id": "WX202401010001",
            "status": DepositStatus.PENDING,
            "created_by": "admin",
            "remarks": "试工押金"
        },
        {
            "trial_schedule_id": schedules[1].id,
            "amount": 500.0,
            "payment_method": "支付宝",
            "transaction_id": "ZFB202401010002",
            "paid_at": base_date - timedelta(days=11),
            "status": DepositStatus.PAID,
            "created_by": "admin",
            "remarks": "试工押金"
        }
    ]
    
    for data in deposits:
        deposit = Deposit(**data)
        db.add(deposit)
    db.commit()
    
    reviews = [
        {
            "trial_schedule_id": schedules[1].id,
            "reviewer": "王五",
            "overall_rating": 5,
            "skill_rating": 5,
            "attitude_rating": 5,
            "punctuality_rating": 4,
            "hygiene_rating": 5,
            "communication_rating": 5,
            "comment": "阿姨非常专业，照顾宝宝很有经验，做的辅食也很好吃",
            "suggestion": "希望能够按时转正",
            "status": ReviewStatus.APPROVED,
            "reviewed_by": "主管",
            "review_comment": "评价真实，同意转正",
            "reviewed_at": base_date - timedelta(days=6)
        }
    ]
    
    for data in reviews:
        review = Review(**data)
        db.add(review)
    db.commit()
    
    conversions = [
        {
            "trial_schedule_id": schedules[1].id,
            "status": ConversionStatus.ELIGIBLE,
            "contract_start_date": base_date - timedelta(days=5),
            "contract_end_date": base_date + timedelta(days=360),
            "contract_salary": 8500.0,
            "contract_remarks": "月休4天，法定节假日休息",
            "conclusion": "符合转正条件，同意签订合同",
            "decided_by": "经理",
            "decided_at": base_date - timedelta(days=5)
        }
    ]
    
    for data in conversions:
        conversion = Conversion(**data)
        db.add(conversion)
    db.commit()
    
    print("造数完成！")
    print(f"客户需求: {len(demands)} 条")
    print(f"阿姨档案: {len(aunts)} 条")
    print(f"试工排期: {len(schedules)} 条")
    print(f"押金记录: {len(deposits)} 条")
    print(f"评价记录: {len(reviews)} 条")
    print(f"转正记录: {len(conversions)} 条")
    
    db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_data()
