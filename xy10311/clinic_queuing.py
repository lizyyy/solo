#!/usr/bin/env python3
import argparse
import csv
import json
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any
from enum import Enum


class AppointmentStatus(Enum):
    SCHEDULED = "已预约"
    CHECKED_IN = "已签到"
    CALLED = "已叫号"
    SEEN = "已就诊"
    NO_SHOW = "爽约"
    CANCELLED = "已取消"


class WaitlistStatus(Enum):
    PENDING = "候补中"
    PROMOTED = "已补位"
    REJECTED = "已拒绝"


class AnomalyType(Enum):
    LATE = "迟到"
    DUPLICATE_ID = "重复身份证"
    DOCTOR_UNAVAILABLE = "医生停诊"
    DEPT_MISMATCH = "科室不匹配"
    DATA_MISSING = "数据缺失"
    STATE_CONFLICT = "状态冲突"
    RULE_BLOCKED = "规则拦截"


@dataclass
class Doctor:
    id: str
    name: str
    department: str
    available: bool = True


@dataclass
class Appointment:
    id: str
    patient_name: str
    patient_id: str
    doctor_id: str
    department: str
    appointment_time: str
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    check_in_time: Optional[str] = None
    call_time: Optional[str] = None
    queue_number: Optional[int] = None
    anomalies: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class WaitlistEntry:
    id: str
    patient_name: str
    patient_id: str
    department: str
    register_time: str
    preferred_doctor_id: Optional[str] = None
    status: WaitlistStatus = WaitlistStatus.PENDING
    promoted_appointment_id: Optional[str] = None
    promotion_reason: Optional[str] = None
    promotion_time: Optional[str] = None
    anomalies: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class CallLog:
    id: str
    appointment_id: str
    patient_name: str
    department: str
    doctor_id: str
    call_time: str
    queue_number: int


@dataclass
class ClinicSystem:
    date: str
    doctors: Dict[str, Doctor] = field(default_factory=dict)
    appointments: Dict[str, Appointment] = field(default_factory=dict)
    waitlist: Dict[str, WaitlistEntry] = field(default_factory=dict)
    call_logs: List[CallLog] = field(default_factory=list)
    used_check_in_records: Set[str] = field(default_factory=set)
    queue_counter: int = 0

    def add_doctor(self, doctor: Doctor):
        self.doctors[doctor.id] = doctor

    def add_appointment(self, appt: Appointment):
        self.appointments[appt.id] = appt

    def add_waitlist_entry(self, entry: WaitlistEntry):
        self.waitlist[entry.id] = entry

    def get_next_queue_number(self) -> int:
        self.queue_counter += 1
        return self.queue_counter

    def process_check_in(self, record: Dict[str, Any]) -> Dict[str, Any]:
        record_id = f"{record.get('patient_id', '')}_{record.get('check_in_time', '')}"
        
        if record_id in self.used_check_in_records:
            return {
                "success": False,
                "anomaly_type": AnomalyType.STATE_CONFLICT.value,
                "message": "签到记录已处理，不重复释放名额",
                "raw_input": record
            }
        
        required_fields = ['patient_id', 'check_in_time', 'appointment_id']
        missing = [f for f in required_fields if not record.get(f)]
        if missing:
            return {
                "success": False,
                "anomaly_type": AnomalyType.DATA_MISSING.value,
                "message": f"缺失必要字段: {', '.join(missing)}",
                "raw_input": record
            }
        
        appt = self.appointments.get(record['appointment_id'])
        if not appt:
            return {
                "success": False,
                "anomaly_type": AnomalyType.DATA_MISSING.value,
                "message": "未找到对应预约记录",
                "raw_input": record
            }
        
        if appt.status != AppointmentStatus.SCHEDULED:
            anomaly = {
                "success": False,
                "anomaly_type": AnomalyType.STATE_CONFLICT.value,
                "message": f"预约状态异常: {appt.status.value}",
                "raw_input": record
            }
            appt.anomalies.append(anomaly)
            return anomaly
        
        existing_appts = [a for a in self.appointments.values() 
                         if a.patient_id == record['patient_id'] and a.id != appt.id]
        if existing_appts:
            anomaly = {
                "success": False,
                "anomaly_type": AnomalyType.DUPLICATE_ID.value,
                "message": f"身份证号重复，已存在预约: {existing_appts[0].id}",
                "raw_input": record
            }
            appt.anomalies.append(anomaly)
            self.used_check_in_records.add(record_id)
            return anomaly
        
        doctor = self.doctors.get(appt.doctor_id)
        if doctor and not doctor.available:
            anomaly = {
                "success": False,
                "anomaly_type": AnomalyType.DOCTOR_UNAVAILABLE.value,
                "message": f"医生 {doctor.name} 已停诊",
                "raw_input": record
            }
            appt.anomalies.append(anomaly)
            appt.status = AppointmentStatus.CANCELLED
            self.used_check_in_records.add(record_id)
            return anomaly
        
        try:
            appt_time = datetime.strptime(appt.appointment_time, "%H:%M")
            check_in_time = datetime.strptime(record['check_in_time'], "%H:%M")
            grace_period = timedelta(minutes=15)
            
            if check_in_time > appt_time + grace_period:
                anomaly = {
                    "success": False,
                    "anomaly_type": AnomalyType.LATE.value,
                    "message": f"迟到超过15分钟（预约时间: {appt.appointment_time}, 签到时间: {record['check_in_time']}）",
                    "raw_input": record
                }
                appt.anomalies.append(anomaly)
                appt.status = AppointmentStatus.NO_SHOW
                self.used_check_in_records.add(record_id)
                return anomaly
        except ValueError:
            pass
        
        appt.status = AppointmentStatus.CHECKED_IN
        appt.check_in_time = record['check_in_time']
        appt.queue_number = self.get_next_queue_number()
        self.used_check_in_records.add(record_id)
        
        return {
            "success": True,
            "message": "签到成功",
            "appointment_id": appt.id,
            "queue_number": appt.queue_number
        }

    def release_no_show_slots(self, current_time: str) -> List[Dict[str, Any]]:
        released = []
        
        for appt in self.appointments.values():
            if appt.status != AppointmentStatus.SCHEDULED:
                continue
            
            try:
                appt_time = datetime.strptime(appt.appointment_time, "%H:%M")
                curr_time = datetime.strptime(current_time, "%H:%M")
                no_show_threshold = timedelta(minutes=30)
                
                if curr_time > appt_time + no_show_threshold:
                    appt.status = AppointmentStatus.NO_SHOW
                    released.append({
                        "appointment_id": appt.id,
                        "patient_name": appt.patient_name,
                        "department": appt.department,
                        "doctor_id": appt.doctor_id,
                        "reason": f"超过预约时间30分钟未签到（当前时间: {current_time}）"
                    })
            except ValueError:
                continue
        
        return released

    def promote_waitlist(self) -> List[Dict[str, Any]]:
        promoted = []
        
        appt_list = list(self.appointments.values())
        for appt in appt_list:
            if appt.status != AppointmentStatus.NO_SHOW and appt.status != AppointmentStatus.CANCELLED:
                continue
            
            if hasattr(appt, '_waitlist_processed'):
                continue
            
            waitlist_candidates = sorted(
                [e for e in self.waitlist.values() 
                 if e.status == WaitlistStatus.PENDING and e.department == appt.department],
                key=lambda e: e.register_time
            )
            
            if not waitlist_candidates:
                appt._waitlist_processed = True
                continue
            
            candidate = waitlist_candidates[0]
            
            doctor = self.doctors.get(appt.doctor_id)
            if doctor and not doctor.available:
                candidate.anomalies.append({
                    "anomaly_type": AnomalyType.DOCTOR_UNAVAILABLE.value,
                    "message": f"目标医生 {doctor.name} 已停诊",
                    "appointment_id": appt.id
                })
                appt._waitlist_processed = True
                continue
            
            if candidate.patient_id in [a.patient_id for a in self.appointments.values() 
                                       if a.status in [AppointmentStatus.CHECKED_IN, AppointmentStatus.CALLED, AppointmentStatus.SEEN]]:
                candidate.anomalies.append({
                    "anomaly_type": AnomalyType.STATE_CONFLICT.value,
                    "message": "患者已在其他队列中",
                    "appointment_id": appt.id
                })
                appt._waitlist_processed = True
                continue
            
            candidate.status = WaitlistStatus.PROMOTED
            candidate.promoted_appointment_id = appt.id
            candidate.promotion_reason = f"补位爽约/取消号源（原预约: {appt.id}）"
            candidate.promotion_time = datetime.now().strftime("%H:%M:%S")
            
            new_appt = Appointment(
                id=f"WL_{candidate.id}",
                patient_name=candidate.patient_name,
                patient_id=candidate.patient_id,
                doctor_id=appt.doctor_id,
                department=appt.department,
                appointment_time=appt.appointment_time,
                status=AppointmentStatus.CHECKED_IN,
                check_in_time=candidate.promotion_time,
                queue_number=self.get_next_queue_number()
            )
            self.appointments[new_appt.id] = new_appt
            
            appt._waitlist_processed = True
            
            promoted.append({
                "waitlist_id": candidate.id,
                "patient_name": candidate.patient_name,
                "department": candidate.department,
                "new_queue_number": new_appt.queue_number,
                "promotion_reason": candidate.promotion_reason,
                "replaced_appointment_id": appt.id
            })
        
        return promoted

    def call_next_patient(self, department: Optional[str] = None, 
                          doctor_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        candidates = [a for a in self.appointments.values() 
                     if a.status == AppointmentStatus.CHECKED_IN and a.queue_number is not None]
        
        if department:
            candidates = [a for a in candidates if a.department == department]
        if doctor_id:
            candidates = [a for a in candidates if a.doctor_id == doctor_id]
        
        if not candidates:
            return None
        
        candidates.sort(key=lambda a: a.queue_number)
        next_patient = candidates[0]
        
        next_patient.status = AppointmentStatus.CALLED
        next_patient.call_time = datetime.now().strftime("%H:%M:%S")
        
        call_log = CallLog(
            id=f"CALL_{len(self.call_logs) + 1}",
            appointment_id=next_patient.id,
            patient_name=next_patient.patient_name,
            department=next_patient.department,
            doctor_id=next_patient.doctor_id,
            call_time=next_patient.call_time,
            queue_number=next_patient.queue_number
        )
        self.call_logs.append(call_log)
        
        return {
            "call_id": call_log.id,
            "queue_number": next_patient.queue_number,
            "patient_name": next_patient.patient_name,
            "department": next_patient.department,
            "doctor_id": next_patient.doctor_id,
            "call_time": next_patient.call_time
        }

    def get_current_queue(self, department: Optional[str] = None) -> List[Dict[str, Any]]:
        queue = [a for a in self.appointments.values() 
                if a.status in [AppointmentStatus.CHECKED_IN, AppointmentStatus.CALLED] 
                and a.queue_number is not None]
        
        if department:
            queue = [a for a in queue if a.department == department]
        
        queue.sort(key=lambda a: a.queue_number)
        
        return [{
            "queue_number": a.queue_number,
            "patient_name": a.patient_name,
            "department": a.department,
            "doctor_id": a.doctor_id,
            "status": a.status.value,
            "check_in_time": a.check_in_time
        } for a in queue]

    def generate_report(self) -> Dict[str, Any]:
        total_appointments = len(self.appointments)
        checked_in = len([a for a in self.appointments.values() 
                         if a.status == AppointmentStatus.CHECKED_IN])
        called = len([a for a in self.appointments.values() 
                     if a.status == AppointmentStatus.CALLED])
        no_show = len([a for a in self.appointments.values() 
                      if a.status == AppointmentStatus.NO_SHOW])
        cancelled = len([a for a in self.appointments.values() 
                        if a.status == AppointmentStatus.CANCELLED])
        
        waitlist_pending = len([e for e in self.waitlist.values() 
                               if e.status == WaitlistStatus.PENDING])
        waitlist_promoted = len([e for e in self.waitlist.values() 
                                if e.status == WaitlistStatus.PROMOTED])
        
        all_anomalies = []
        for appt in self.appointments.values():
            for anomaly in appt.anomalies:
                all_anomalies.append({
                    "source": "appointment",
                    "id": appt.id,
                    **anomaly
                })
        for entry in self.waitlist.values():
            for anomaly in entry.anomalies:
                all_anomalies.append({
                    "source": "waitlist",
                    "id": entry.id,
                    **anomaly
                })
        
        return {
            "date": self.date,
            "summary": {
                "total_appointments": total_appointments,
                "checked_in": checked_in,
                "called": called,
                "no_show": no_show,
                "cancelled": cancelled,
                "waitlist_pending": waitlist_pending,
                "waitlist_promoted": waitlist_promoted,
                "total_anomalies": len(all_anomalies)
            },
            "call_logs": [asdict(log) for log in self.call_logs],
            "promotions": [{
                "waitlist_id": e.id,
                "patient_name": e.patient_name,
                "department": e.department,
                "promoted_appointment_id": e.promoted_appointment_id,
                "promotion_reason": e.promotion_reason,
                "promotion_time": e.promotion_time
            } for e in self.waitlist.values() if e.status == WaitlistStatus.PROMOTED],
            "anomalies": all_anomalies,
            "current_queue": self.get_current_queue()
        }


def load_doctors_from_csv(file_path: str, system: ClinicSystem):
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            doctor = Doctor(
                id=row['id'],
                name=row['name'],
                department=row['department'],
                available=row.get('available', 'true').lower() == 'true'
            )
            system.add_doctor(doctor)


def load_appointments_from_csv(file_path: str, system: ClinicSystem):
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            appt = Appointment(
                id=row['id'],
                patient_name=row['patient_name'],
                patient_id=row['patient_id'],
                doctor_id=row['doctor_id'],
                department=row['department'],
                appointment_time=row['appointment_time']
            )
            system.add_appointment(appt)


def load_waitlist_from_csv(file_path: str, system: ClinicSystem):
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry = WaitlistEntry(
                id=row['id'],
                patient_name=row['patient_name'],
                patient_id=row['patient_id'],
                department=row['department'],
                preferred_doctor_id=row.get('preferred_doctor_id'),
                register_time=row['register_time']
            )
            system.add_waitlist_entry(entry)


def load_check_in_records_from_csv(file_path: str) -> List[Dict[str, Any]]:
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(dict(row))
    return records


def save_system_state(system: ClinicSystem, file_path: str):
    state = {
        'date': system.date,
        'queue_counter': system.queue_counter,
        'used_check_in_records': list(system.used_check_in_records),
        'doctors': {k: asdict(v) for k, v in system.doctors.items()},
        'appointments': {},
        'waitlist': {},
        'call_logs': [asdict(log) for log in system.call_logs]
    }
    
    for k, v in system.appointments.items():
        appt_dict = asdict(v)
        appt_dict['status'] = v.status.value
        state['appointments'][k] = appt_dict
    
    for k, v in system.waitlist.items():
        entry_dict = asdict(v)
        entry_dict['status'] = v.status.value
        state['waitlist'][k] = entry_dict
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def load_system_state(file_path: str) -> ClinicSystem:
    with open(file_path, 'r', encoding='utf-8') as f:
        state = json.load(f)
    
    system = ClinicSystem(date=state['date'])
    system.queue_counter = state['queue_counter']
    system.used_check_in_records = set(state['used_check_in_records'])
    
    for k, v in state['doctors'].items():
        system.doctors[k] = Doctor(**v)
    
    for k, v in state['appointments'].items():
        v['status'] = AppointmentStatus(v['status'])
        system.appointments[k] = Appointment(**v)
    
    for k, v in state['waitlist'].items():
        v['status'] = WaitlistStatus(v['status'])
        system.waitlist[k] = WaitlistEntry(**v)
    
    for log in state['call_logs']:
        system.call_logs.append(CallLog(**log))
    
    return system


def print_table(data: List[Dict[str, Any]], headers: List[str]):
    if not data:
        print("(无数据)")
        return
    
    col_widths = [len(h) for h in headers]
    for row in data:
        for i, h in enumerate(headers):
            val = str(row.get(h, ''))
            col_widths[i] = max(col_widths[i], len(val))
    
    format_str = ' | '.join(f'{{:<{w}}}' for w in col_widths)
    print(format_str.format(*headers))
    print('-+-'.join('-' * w for w in col_widths))
    
    for row in data:
        values = [str(row.get(h, '')) for h in headers]
        print(format_str.format(*values))


def main():
    parser = argparse.ArgumentParser(description='门诊叫号爽约补位 CLI')
    parser.add_argument('--date', default=datetime.now().strftime('%Y-%m-%d'),
                       help='门诊日期 (YYYY-MM-DD)')
    parser.add_argument('--state-file', default='clinic_state.json',
                       help='状态文件路径')
    
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    init_parser = subparsers.add_parser('init', help='初始化门诊系统')
    init_parser.add_argument('--doctors', required=True, help='医生信息CSV')
    init_parser.add_argument('--appointments', required=True, help='预约表CSV')
    init_parser.add_argument('--waitlist', required=True, help='候补表CSV')
    
    checkin_parser = subparsers.add_parser('checkin', help='处理签到')
    checkin_parser.add_argument('--file', required=True, help='签到记录CSV')
    
    release_parser = subparsers.add_parser('release', help='释放爽约号源')
    release_parser.add_argument('--current-time', required=True, help='当前时间 (HH:MM)')
    
    promote_parser = subparsers.add_parser('promote', help='候补补位')
    
    call_parser = subparsers.add_parser('call', help='叫号')
    call_parser.add_argument('--department', help='指定科室')
    call_parser.add_argument('--doctor', help='指定医生ID')
    
    queue_parser = subparsers.add_parser('queue', help='查看当前队列')
    queue_parser.add_argument('--department', help='指定科室')
    
    logs_parser = subparsers.add_parser('logs', help='查看叫号日志')
    
    report_parser = subparsers.add_parser('report', help='生成复盘报告')
    report_parser.add_argument('--output', help='输出文件路径 (JSON)')
    
    args = parser.parse_args()
    
    if args.command == 'init':
        system = ClinicSystem(date=args.date)
        load_doctors_from_csv(args.doctors, system)
        load_appointments_from_csv(args.appointments, system)
        load_waitlist_from_csv(args.waitlist, system)
        save_system_state(system, args.state_file)
        print(f"✓ 系统初始化完成")
        print(f"  - 日期: {system.date}")
        print(f"  - 医生: {len(system.doctors)} 人")
        print(f"  - 预约: {len(system.appointments)} 个")
        print(f"  - 候补: {len(system.waitlist)} 人")
        return
    
    try:
        system = load_system_state(args.state_file)
    except FileNotFoundError:
        print(f"✗ 状态文件不存在: {args.state_file}")
        print("请先运行 'init' 命令初始化系统")
        sys.exit(1)
    
    if args.command == 'checkin':
        records = load_check_in_records_from_csv(args.file)
        print(f"处理 {len(records)} 条签到记录...\n")
        
        success_count = 0
        anomalies = []
        
        for record in records:
            result = system.process_check_in(record)
            if result['success']:
                success_count += 1
                print(f"✓ 签到成功: {result['appointment_id']} -> 队列号 {result['queue_number']}")
            else:
                anomalies.append(result)
                print(f"✗ [{result['anomaly_type']}] {result['message']}")
                print(f"  原始输入: {result['raw_input']}")
        
        save_system_state(system, args.state_file)
        print(f"\n签到处理完成: 成功 {success_count}, 异常 {len(anomalies)}")
    
    elif args.command == 'release':
        released = system.release_no_show_slots(args.current_time)
        save_system_state(system, args.state_file)
        
        if released:
            print(f"✓ 释放 {len(released)} 个爽约号源:\n")
            print_table(released, ['appointment_id', 'patient_name', 'department', 'reason'])
        else:
            print("未发现需要释放的号源")
    
    elif args.command == 'promote':
        promoted = system.promote_waitlist()
        save_system_state(system, args.state_file)
        
        if promoted:
            print(f"✓ 补位 {len(promoted)} 名候补患者:\n")
            print_table(promoted, ['waitlist_id', 'patient_name', 'department', 
                                  'new_queue_number', 'promotion_reason'])
        else:
            print("无可补位的患者或无可用号源")
    
    elif args.command == 'call':
        result = system.call_next_patient(args.department, args.doctor)
        save_system_state(system, args.state_file)
        
        if result:
            print(f"✓ 叫号成功!\n")
            print(f"  队列号: {result['queue_number']}")
            print(f"  患者: {result['patient_name']}")
            print(f"  科室: {result['department']}")
            print(f"  医生ID: {result['doctor_id']}")
            print(f"  叫号时间: {result['call_time']}")
        else:
            print("当前队列中无待叫号患者")
    
    elif args.command == 'queue':
        queue = system.get_current_queue(args.department)
        dept_filter = f" (科室: {args.department})" if args.department else ""
        print(f"当前队列{dept_filter}:\n")
        print_table(queue, ['queue_number', 'patient_name', 'department', 
                           'doctor_id', 'status', 'check_in_time'])
    
    elif args.command == 'logs':
        logs = [asdict(log) for log in system.call_logs]
        print("叫号日志:\n")
        print_table(logs, ['id', 'queue_number', 'patient_name', 'department', 
                          'doctor_id', 'call_time'])
    
    elif args.command == 'report':
        report = system.generate_report()
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print(f"✓ 报告已保存到: {args.output}")
        
        print("\n" + "="*60)
        print(f"门诊复盘报告 - {report['date']}")
        print("="*60)
        
        print("\n【汇总统计】")
        summary = report['summary']
        print(f"  总预约数: {summary['total_appointments']}")
        print(f"  已签到: {summary['checked_in']}")
        print(f"  已叫号: {summary['called']}")
        print(f"  爽约: {summary['no_show']}")
        print(f"  取消: {summary['cancelled']}")
        print(f"  候补充位: {summary['waitlist_promoted']}")
        print(f"  候补待处理: {summary['waitlist_pending']}")
        print(f"  异常记录: {summary['total_anomalies']}")
        
        if report['promotions']:
            print("\n【补位记录】")
            print_table(report['promotions'], ['waitlist_id', 'patient_name', 'department',
                                             'promoted_appointment_id', 'promotion_reason'])
        
        if report['anomalies']:
            print("\n【异常记录】")
            print_table(report['anomalies'], ['source', 'id', 'anomaly_type', 'message'])
        
        print("\n" + "="*60)


if __name__ == '__main__':
    main()
