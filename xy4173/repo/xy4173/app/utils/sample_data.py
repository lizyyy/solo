from datetime import datetime, timedelta, time
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import (
    Instrument, User, ResearchGroup, Reservation,
    SwipeLog, SampleRegistration, BillingRule,
    Violation, Bill, AuditLog
)
from app.utils.code_generator import (
    generate_reservation_code, generate_sample_code,
    generate_violation_code, generate_bill_code,
    generate_audit_code
)


class SampleDataGenerator:
    
    def __init__(self, db: Session):
        self.db = db
        self.research_groups: List[ResearchGroup] = []
        self.instruments: List[Instrument] = []
        self.users: List[User] = []
        self.reservations: List[Reservation] = []
        self.swipe_logs: List[SwipeLog] = []
        self.samples: List[SampleRegistration] = []
        self.billing_rules: List[BillingRule] = []
        self.violations: List[Violation] = []
        self.bills: List[Bill] = []
    
    def create_research_groups(self, count: int = 3) -> List[ResearchGroup]:
        group_data = [
            ("G001", "纳米材料课题组", "张教授", "化学与分子工程学院"),
            ("G002", "生物成像课题组", "李教授", "生命科学学院"),
            ("G003", "微电子课题组", "王教授", "信息科学技术学院"),
        ]
        
        for code, name, pi, dept in group_data[:count]:
            group = ResearchGroup(
                group_code=code,
                name=name,
                principal_investigator=pi,
                department=dept,
                is_active=True
            )
            self.db.add(group)
            self.research_groups.append(group)
        
        self.db.commit()
        return self.research_groups
    
    def create_instruments(self, count: int = 5) -> List[Instrument]:
        instrument_data = [
            ("INS001", "透射电子显微镜", "TEM-2010", "南楼B201", 200.0, 300.0, 8),
            ("INS002", "扫描电子显微镜", "SEM-4500", "南楼B202", 150.0, 225.0, 8),
            ("INS003", "X射线衍射仪", "XRD-6100", "北楼A105", 100.0, 150.0, 4),
            ("INS004", "共聚焦激光显微镜", "LSM-880", "北楼A106", 180.0, 270.0, 8),
            ("INS005", "核磁共振波谱仪", "NMR-500", "中楼C301", 300.0, 450.0, 12),
        ]
        
        for code, name, model, location, rate, overtime_rate, max_hours in instrument_data[:count]:
            instrument = Instrument(
                instrument_code=code,
                name=name,
                model=model,
                location=location,
                hourly_rate=rate,
                overtime_rate=overtime_rate,
                max_reservation_hours=max_hours,
                is_active=True
            )
            self.db.add(instrument)
            self.instruments.append(instrument)
        
        self.db.commit()
        return self.instruments
    
    def create_users(self, count: int = 10) -> List[User]:
        if not self.research_groups:
            self.create_research_groups(3)
        
        user_data = [
            ("U001", "张三", "CARD001", "student", "zhangsan@edu.cn", "13800000001", 0),
            ("U002", "李四", "CARD002", "student", "lisi@edu.cn", "13800000002", 0),
            ("U003", "王五", "CARD003", "student", "wangwu@edu.cn", "13800000003", 1),
            ("U004", "赵六", "CARD004", "student", "zhaoliu@edu.cn", "13800000004", 1),
            ("U005", "钱七", "CARD005", "student", "qianqi@edu.cn", "13800000005", 2),
            ("U006", "孙八", "CARD006", "student", "sunba@edu.cn", "13800000006", 2),
            ("U007", "张教授", "CARD007", "faculty", "zhangprof@edu.cn", "13900000001", 0),
            ("U008", "李教授", "CARD008", "faculty", "liprof@edu.cn", "13900000002", 1),
            ("U009", "王教授", "CARD009", "faculty", "wangprof@edu.cn", "13900000003", 2),
            ("U010", "管理员", "CARD010", "admin", "admin@edu.cn", "13900000000", None),
        ]
        
        for uid, name, card, role, email, phone, group_idx in user_data[:count]:
            group_id = None
            if group_idx is not None and group_idx < len(self.research_groups):
                group_id = self.research_groups[group_idx].id
            
            user = User(
                user_id=uid,
                name=name,
                card_number=card,
                role=role,
                email=email,
                phone=phone,
                research_group_id=group_id,
                is_active=True
            )
            self.db.add(user)
            self.users.append(user)
        
        self.db.commit()
        return self.users
    
    def create_reservations(self, count: int = 10) -> List[Reservation]:
        if not self.instruments:
            self.create_instruments(5)
        if not self.users:
            self.create_users(10)
        
        now = datetime.now()
        
        for i in range(count):
            start_time = now - timedelta(days=i % 5, hours=i % 3)
            duration = timedelta(hours=2 + (i % 4))
            end_time = start_time + duration
            
            instrument = self.instruments[i % len(self.instruments)]
            user = self.users[i % len(self.users)]
            
            reservation = Reservation(
                reservation_code=generate_reservation_code(),
                instrument_id=instrument.id,
                user_id=user.id,
                research_group_id=user.research_group_id,
                start_time=start_time,
                end_time=end_time,
                purpose=f"样品测试 - 第{i+1}批",
                status="completed" if i < 5 else "pending",
                is_approved=True,
                is_cancelled=False
            )
            self.db.add(reservation)
            self.reservations.append(reservation)
        
        self.db.commit()
        return self.reservations
    
    def create_swipe_logs(self, count: int = 15) -> List[SwipeLog]:
        if not self.reservations:
            self.create_reservations(10)
        if not self.users:
            self.create_users(10)
        
        now = datetime.now()
        
        for i in range(count):
            reservation = self.reservations[i % len(self.reservations)] if i < len(self.reservations) else None
            user = self.users[i % len(self.users)]
            
            if reservation:
                swipe_time = reservation.start_time + timedelta(minutes=5 + (i % 10))
                instrument_id = reservation.instrument_id
            else:
                swipe_time = now - timedelta(hours=i)
                instrument_id = self.instruments[i % len(self.instruments)].id if self.instruments else None
            
            is_manual = i >= count - 2
            is_matched = reservation is not None and not is_manual
            
            swipe_log = SwipeLog(
                swipe_code=f"SWP{now.strftime('%Y%m%d')}{i:04d}",
                card_number=user.card_number,
                swipe_time=swipe_time,
                instrument_id=instrument_id,
                user_id=user.id,
                reservation_id=reservation.id if reservation and is_matched else None,
                swipe_type="enter",
                device_id=f"DEV{(i % 5) + 1:03d}",
                is_matched=is_matched,
                match_status="matched" if is_matched else ("unmatched" if not is_manual else "manual"),
                is_manual_release=is_manual,
                manual_release_reason="设备维护 - 管理员放行" if is_manual else None
            )
            self.db.add(swipe_log)
            self.swipe_logs.append(swipe_log)
        
        self.db.commit()
        return self.swipe_logs
    
    def create_samples(self, count: int = 8) -> List[SampleRegistration]:
        if not self.users:
            self.create_users(10)
        
        now = datetime.now()
        sample_types = ["纳米粒子", "生物样本", "半导体晶片", "聚合物", "金属试样"]
        
        for i in range(count):
            user = self.users[i % len(self.users)]
            registered_at = now - timedelta(days=i % 7)
            is_overdue = i >= count - 2
            
            max_hours = 72
            if is_overdue:
                max_hours = 24
            
            expected_pickup = registered_at + timedelta(hours=max_hours - 12) if not is_overdue else None
            
            sample = SampleRegistration(
                sample_code=generate_sample_code(),
                user_id=user.id,
                sample_type=sample_types[i % len(sample_types)],
                description=f"第{i+1}批测试样品",
                registered_at=registered_at,
                expected_pickup_at=expected_pickup,
                actual_pickup_at=None if i < count - 3 else (registered_at + timedelta(hours=48)),
                max_storage_hours=max_hours,
                is_overdue=is_overdue,
                status="in_storage" if i < count - 3 else "picked_up",
                notes="无特殊要求"
            )
            self.db.add(sample)
            self.samples.append(sample)
        
        self.db.commit()
        return self.samples
    
    def create_billing_rules(self, count: int = 3) -> List[BillingRule]:
        if not self.instruments:
            self.create_instruments(5)
        if not self.research_groups:
            self.create_research_groups(3)
        
        rule_data = [
            ("RULE001", "基础计费规则", None, None, 100.0, 1.5, 8, 1.0, time(22, 0), time(6, 0), 1.5, 1.0, None, 0),
            ("RULE002", "纳米材料组折扣", None, 0, 0.0, 1.5, 8, 1.0, time(22, 0), time(6, 0), 1.5, 0.8, "课题组协议折扣", 10),
            ("RULE003", "TEM特殊费率", 0, None, 180.0, 2.0, 4, 1.5, time(20, 0), time(8, 0), 2.0, 1.0, None, 5),
        ]
        
        for code, name, ins_idx, group_idx, rate, overtime_mult, overtime_start, night_mult, night_start, night_end, weekend_mult, discount, discount_reason, priority in rule_data[:count]:
            instrument_id = None
            if ins_idx is not None and self.instruments:
                instrument_id = self.instruments[ins_idx].id
            
            research_group_id = None
            if group_idx is not None and self.research_groups:
                research_group_id = self.research_groups[group_idx].id
            
            rule = BillingRule(
                rule_code=code,
                name=name,
                instrument_id=instrument_id,
                research_group_id=research_group_id,
                base_hourly_rate=rate,
                overtime_rate_multiplier=overtime_mult,
                overtime_start_hours=overtime_start,
                night_rate_multiplier=night_mult,
                night_start_time=night_start,
                night_end_time=night_end,
                weekend_rate_multiplier=weekend_mult,
                discount_rate=discount,
                discount_reason=discount_reason,
                priority=priority,
                is_active=True
            )
            self.db.add(rule)
            self.billing_rules.append(rule)
        
        self.db.commit()
        return self.billing_rules
    
    def create_violations(self, count: int = 3) -> List[Violation]:
        if not self.reservations:
            self.create_reservations(10)
        if not self.swipe_logs:
            self.create_swipe_logs(15)
        if not self.users:
            self.create_users(10)
        
        now = datetime.now()
        
        violation_types = [
            ("no_reservation_swipe", "无预约刷卡", "high"),
            ("time_overlap", "时段重叠", "medium"),
            ("sample_overdue", "样品逾期", "low"),
        ]
        
        for i in range(count):
            vtype, desc, severity = violation_types[i % len(violation_types)]
            
            violation = Violation(
                violation_code=generate_violation_code(),
                violation_type=vtype,
                user_id=self.users[i % len(self.users)].id,
                reservation_id=self.reservations[i % len(self.reservations)].id if self.reservations else None,
                swipe_log_id=self.swipe_logs[i % len(self.swipe_logs)].id if self.swipe_logs else None,
                detected_at=now - timedelta(hours=i * 24),
                severity=severity,
                description=desc,
                details=f"自动检测到{desc}违规行为",
                suggested_fine_amount=100.0 * (i + 1),
                status="pending",
                is_resolved=False
            )
            self.db.add(violation)
            self.violations.append(violation)
        
        self.db.commit()
        return self.violations
    
    def create_bills(self, count: int = 5) -> List[Bill]:
        if not self.reservations:
            self.create_reservations(10)
        if not self.users:
            self.create_users(10)
        
        now = datetime.now()
        
        for i in range(count):
            reservation = self.reservations[i % len(self.reservations)]
            user = self.users[i % len(self.users)]
            
            base_hours = 3.0
            base_amount = base_hours * 100.0
            overtime_hours = 1.0 if i % 2 == 0 else 0.0
            overtime_amount = overtime_hours * 150.0
            discount = 50.0 if i == 0 else 0.0
            
            bill = Bill(
                bill_code=generate_bill_code(),
                user_id=user.id,
                reservation_id=reservation.id,
                instrument_id=reservation.instrument_id,
                research_group_id=user.research_group_id,
                bill_date=now - timedelta(days=i),
                base_duration_hours=base_hours,
                base_amount=base_amount,
                overtime_duration_hours=overtime_hours,
                overtime_amount=overtime_amount,
                night_duration_hours=0.0,
                night_amount=0.0,
                discount_amount=discount,
                discount_reason="首次使用优惠" if discount > 0 else None,
                total_amount=base_amount + overtime_amount - discount,
                status="pending" if i < 2 else ("approved" if i < 4 else "paid"),
                is_waived=False,
                is_paid=i >= 4,
                paid_at=now - timedelta(days=i) if i >= 4 else None,
                payment_method="转账" if i >= 4 else None
            )
            self.db.add(bill)
            self.bills.append(bill)
        
        self.db.commit()
        return self.bills
    
    def create_all(self, 
                   group_count: int = 3,
                   instrument_count: int = 5,
                   user_count: int = 10,
                   reservation_count: int = 10,
                   swipe_count: int = 15,
                   sample_count: int = 8,
                   rule_count: int = 3,
                   violation_count: int = 3,
                   bill_count: int = 5) -> dict:
        
        self.create_research_groups(group_count)
        self.create_instruments(instrument_count)
        self.create_users(user_count)
        self.create_reservations(reservation_count)
        self.create_swipe_logs(swipe_count)
        self.create_samples(sample_count)
        self.create_billing_rules(rule_count)
        self.create_violations(violation_count)
        self.create_bills(bill_count)
        
        return {
            "research_groups": len(self.research_groups),
            "instruments": len(self.instruments),
            "users": len(self.users),
            "reservations": len(self.reservations),
            "swipe_logs": len(self.swipe_logs),
            "samples": len(self.samples),
            "billing_rules": len(self.billing_rules),
            "violations": len(self.violations),
            "bills": len(self.bills),
        }


def generate_sample_data(db: Session, **kwargs) -> dict:
    generator = SampleDataGenerator(db)
    return generator.create_all(**kwargs)


def create_sample_instruments(db: Session, count: int = 5) -> List[Instrument]:
    generator = SampleDataGenerator(db)
    return generator.create_instruments(count)


def create_sample_users(db: Session, count: int = 10) -> List[User]:
    generator = SampleDataGenerator(db)
    return generator.create_users(count)


def create_sample_research_groups(db: Session, count: int = 3) -> List[ResearchGroup]:
    generator = SampleDataGenerator(db)
    return generator.create_research_groups(count)


def create_sample_reservations(db: Session, count: int = 10) -> List[Reservation]:
    generator = SampleDataGenerator(db)
    return generator.create_reservations(count)


def create_sample_swipe_logs(db: Session, count: int = 15) -> List[SwipeLog]:
    generator = SampleDataGenerator(db)
    return generator.create_swipe_logs(count)


def create_sample_samples(db: Session, count: int = 8) -> List[SampleRegistration]:
    generator = SampleDataGenerator(db)
    return generator.create_samples(count)


def create_sample_billing_rules(db: Session, count: int = 3) -> List[BillingRule]:
    generator = SampleDataGenerator(db)
    return generator.create_billing_rules(count)


def create_sample_violations(db: Session, count: int = 3) -> List[Violation]:
    generator = SampleDataGenerator(db)
    return generator.create_violations(count)
