from datetime import datetime, timedelta
import random
from typing import List
from sqlalchemy.orm import Session
from .models import BusReservation, Batch, RuleVersion, ComparisonResult
from . import crud


EMPLOYEE_NAMES = [
    "张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十",
    "郑十一", "王十二", "冯十三", "陈十四", "褚十五", "卫十六",
    "蒋十七", "沈十八", "韩十九", "杨二十", "朱二十一", "秦二十二"
]

DEPARTMENTS = [
    "技术研发部", "产品运营部", "市场营销部", "人力资源部",
    "财务管理部", "行政管理部", "客户服务部", "供应链管理部"
]

BUS_ROUTES = [
    "线路A: 科技园-地铁站",
    "线路B: 软件园-市区",
    "线路C: 产业园-高铁站",
    "线路D: 商务中心-机场"
]

TIME_SLOTS = [
    "07:30-08:00", "08:00-08:30", "08:30-09:00",
    "17:30-18:00", "18:00-18:30", "18:30-19:00"
]

RISK_TYPES = [
    "重复提交", "日期异常", "时段冲突", "身份验证失败",
    "权限不足", "系统超时", "数据不一致"
]


def generate_bus_reservations(
    db: Session,
    batch_no: str,
    operator: str,
    record_count: int = 10
) -> List[BusReservation]:
    base_time = datetime.now() - timedelta(days=random.randint(1, 30))
    
    reservations = []
    duplicate_employee = None
    duplicate_date = None
    duplicate_route = None
    
    for i in range(record_count):
        employee_idx = random.randint(0, len(EMPLOYEE_NAMES) - 1)
        employee_name = EMPLOYEE_NAMES[employee_idx]
        employee_id = f"EMP{10000 + employee_idx}"
        reservation_date = (base_time + timedelta(days=random.randint(1, 7))).strftime("%Y-%m-%d")
        bus_route = random.choice(BUS_ROUTES)
        time_slot = random.choice(TIME_SLOTS)
        submit_time = base_time + timedelta(minutes=random.randint(1, 1440))
        
        is_duplicate = False
        if i == record_count - 1 and duplicate_employee:
            employee_name = duplicate_employee["name"]
            employee_id = duplicate_employee["id"]
            reservation_date = duplicate_date
            bus_route = duplicate_route
            time_slot = duplicate_employee["slot"]
            is_duplicate = True
        elif i == record_count - 2:
            duplicate_employee = {
                "name": employee_name,
                "id": employee_id,
                "slot": time_slot
            }
            duplicate_date = reservation_date
            duplicate_route = bus_route
        
        raw_data = {
            "employee_id": employee_id,
            "employee_name": employee_name,
            "department": random.choice(DEPARTMENTS),
            "bus_route": bus_route,
            "reservation_date": reservation_date,
            "time_slot": time_slot,
            "submit_time": submit_time.isoformat(),
            "ip_address": f"192.168.{random.randint(1, 255)}.{random.randint(1, 255)}",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "session_id": f"sess_{random.randint(100000, 999999)}"
        }
        
        reservation = BusReservation(
            batch_no=batch_no,
            reservation_id=f"RES{batch_no}-{i + 1:04d}",
            employee_id=employee_id,
            employee_name=employee_name,
            department=random.choice(DEPARTMENTS),
            bus_route=bus_route,
            reservation_date=reservation_date,
            time_slot=time_slot,
            submit_time=submit_time,
            status="已提交",
            is_duplicate=is_duplicate,
            raw_data=raw_data
        )
        reservations.append(reservation)
        db.add(reservation)
    
    db.commit()
    for res in reservations:
        db.refresh(res)
    
    return reservations


def generate_comparison_results(
    db: Session,
    batch_no: str,
    operator: str,
    reservations: List[BusReservation],
    rule_version: str
) -> List[ComparisonResult]:
    results = []
    
    rule = crud.get_rule_version(db, rule_version)
    if not rule:
        rule = crud.create_rule_version(db, {
            "version": rule_version,
            "rule_content": {
                "check_duplicate": True,
                "check_date_conflict": True,
                "check_time_conflict": True,
                "duplicate_window_hours": 24
            },
            "description": "初始规则版本",
            "created_by": operator
        })
    
    for reservation in reservations:
        is_abnormal = reservation.is_duplicate
        risk_type = "重复提交" if is_abnormal else random.choice(RISK_TYPES) if random.random() < 0.2 else "正常"
        
        original_response = {
            "code": "0000" if not is_abnormal else "9999",
            "message": "预约成功" if not is_abnormal else "重复提交",
            "data": {
                "reservation_id": reservation.reservation_id,
                "status": "成功",
                "check_timestamp": (datetime.now() - timedelta(hours=1)).isoformat()
            }
        }
        
        replay_response = {
            "code": "0000" if not is_abnormal else "9999",
            "message": "预约成功" if not is_abnormal else "重复提交检测",
            "data": {
                "reservation_id": reservation.reservation_id,
                "status": "成功" if not is_abnormal else "异常",
                "check_timestamp": datetime.now().isoformat(),
                "rule_version": rule_version
            }
        }
        
        diff_fields = []
        before_value = ""
        after_value = ""
        correction = ""
        conclusion = ""
        
        if is_abnormal:
            diff_fields = ["message", "data.status"]
            before_value = "message: 预约成功, status: 成功"
            after_value = "message: 重复提交检测, status: 异常"
            correction = "已标记为重复提交，需人工复核"
            conclusion = f"培训环境清单异常检测：变更前【{before_value}】，变更后【{after_value}】，修正措施：{correction}，结论：确认为同一员工同一时段重复预约"
        
        result = ComparisonResult(
            batch_no=batch_no,
            record_id=reservation.reservation_id,
            risk_type=risk_type,
            is_abnormal=is_abnormal,
            is_success=True,
            original_response=original_response,
            replay_response=replay_response,
            diff_fields=diff_fields,
            before_value=before_value,
            after_value=after_value,
            correction=correction,
            conclusion=conclusion,
            operator=operator
        )
        results.append(result)
        db.add(result)
    
    db.commit()
    for res in results:
        db.refresh(res)
    
    return results


def init_default_rule(db: Session, operator: str = "system"):
    existing = crud.get_rule_version(db, "v1.0")
    if not existing:
        crud.create_rule_version(db, {
            "version": "v1.0",
            "rule_content": {
                "check_duplicate": True,
                "check_date_conflict": True,
                "check_time_conflict": True,
                "duplicate_window_hours": 24,
                "allowed_time_slots": TIME_SLOTS
            },
            "description": "初始规则版本 - 基础重复提交检测",
            "created_by": operator
        })
