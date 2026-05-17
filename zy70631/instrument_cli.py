#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import click
import json
import os
from datetime import datetime, timedelta
from collections import defaultdict
from tabulate import tabulate
import copy

DATA_DIR = os.path.expanduser("~/.instrument_cli")
DATA_FILE = os.path.join(DATA_DIR, "data.json")

class DataStore:
    def __init__(self):
        self.data = {
            "instruments": {},
            "groups": {},
            "reservations": {},
            "risk_reports": {},
            "penalties": {},
            "cancellations": {}
        }
        self._load()
    
    def _load(self):
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
    
    def _save(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
    
    def get(self, key):
        return self.data.get(key, {})
    
    def set(self, key, value):
        self.data[key] = value
        self._save()

db = DataStore()

class Validator:
    @staticmethod
    def validate_time_format(time_str):
        try:
            datetime.strptime(time_str, "%Y-%m-%d %H:%M")
            return True
        except ValueError:
            return False
    
    @staticmethod
    def validate_instrument_id(instr_id):
        instruments = db.get("instruments")
        return instr_id in instruments
    
    @staticmethod
    def validate_group_id(group_id):
        groups = db.get("groups")
        return group_id in groups
    
    @staticmethod
    def validate_risk_level(level):
        return level in ["low", "medium", "high", "critical"]

class ReservationManager:
    @staticmethod
    def check_conflict(instr_id, start_time, end_time, exclude_id=None):
        reservations = db.get("reservations")
        start = datetime.strptime(start_time, "%Y-%m-%d %H:%M")
        end = datetime.strptime(end_time, "%Y-%m-%d %H:%M")
        
        for res_id, res in reservations.items():
            if exclude_id and res_id == exclude_id:
                continue
            if res["instrument_id"] != instr_id:
                continue
            if res["status"] in ["cancelled", "completed"]:
                continue
                
            res_start = datetime.strptime(res["start_time"], "%Y-%m-%d %H:%M")
            res_end = datetime.strptime(res["end_time"], "%Y-%m-%d %H:%M")
            
            if (start < res_end and end > res_start):
                return True, res_id
        return False, None
    
    @staticmethod
    def calculate_duration(start_time, end_time):
        start = datetime.strptime(start_time, "%Y-%m-%d %H:%M")
        end = datetime.strptime(end_time, "%Y-%m-%d %H:%M")
        return (end - start).total_seconds() / 3600
    
    @staticmethod
    def check_overtime(res_id, actual_end_time):
        reservations = db.get("reservations")
        res = reservations.get(res_id)
        if not res:
            return 0
        
        scheduled_end = datetime.strptime(res["end_time"], "%Y-%m-%d %H:%M")
        actual_end = datetime.strptime(actual_end_time, "%Y-%m-%d %H:%M")
        
        overtime_hours = (actual_end - scheduled_end).total_seconds() / 3600
        return max(0, overtime_hours)

class PenaltyCalculator:
    @staticmethod
    def calculate_overtime_penalty(group_id, overtime_hours):
        if overtime_hours <= 0:
            return 0
        
        base_penalty = 50
        hourly_rate = 100
        penalty = base_penalty + (hourly_rate * overtime_hours)
        
        penalties = db.get("penalties")
        group_penalties = [p for p in penalties.values() if p["group_id"] == group_id]
        if len(group_penalties) >= 3:
            penalty *= 2
        
        return penalty
    
    @staticmethod
    def calculate_cancellation_penalty(group_id, hours_before_start):
        if hours_before_start >= 24:
            return 0
        elif hours_before_start >= 12:
            return 30
        elif hours_before_start >= 6:
            return 50
        else:
            return 100

class RiskManager:
    @staticmethod
    def assess_sample_risk(sample_type, risk_level, has_previous_contamination):
        risk_score = 0
        
        risk_weights = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        risk_score += risk_weights.get(risk_level, 1)
        
        if sample_type in ["biological", "radioactive"]:
            risk_score += 2
        if has_previous_contamination:
            risk_score += 3
        
        if risk_score >= 6:
            return "requires_approval"
        elif risk_score >= 4:
            return "supervision_required"
        else:
            return "normal"

class Reporter:
    @staticmethod
    def generate_report(reservation_id, actual_end_time=None, sample_risk_report=None):
        reservations = db.get("reservations")
        res = reservations.get(reservation_id)
        if not res:
            return None
        
        report = {
            "report_id": f"RPT_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "reservation_id": reservation_id,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "instrument_id": res["instrument_id"],
            "group_id": res["group_id"],
            "scheduled_start": res["start_time"],
            "scheduled_end": res["end_time"],
            "scheduled_duration_hours": ReservationManager.calculate_duration(res["start_time"], res["end_time"]),
            "actual_end_time": actual_end_time,
            "overtime_hours": 0,
            "overtime_penalty": 0,
            "sample_risk_assessment": sample_risk_report or {},
            "status": "draft"
        }
        
        if actual_end_time:
            overtime = ReservationManager.check_overtime(reservation_id, actual_end_time)
            report["overtime_hours"] = round(overtime, 2)
            report["overtime_penalty"] = PenaltyCalculator.calculate_overtime_penalty(res["group_id"], overtime)
            report["status"] = "final"
        
        return report
    
    @staticmethod
    def export_json(data, filepath):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath
    
    @staticmethod
    def format_human_readable(data, data_type):
        if data_type == "reservations":
            headers = ["ID", "仪器", "课题组", "开始时间", "结束时间", "状态"]
            rows = []
            for rid, r in data.items():
                rows.append([
                    rid, r["instrument_id"], r["group_id"],
                    r["start_time"], r["end_time"], r["status"]
                ])
            return tabulate(rows, headers=headers, tablefmt="grid")
        
        elif data_type == "penalties":
            headers = ["ID", "预约ID", "课题组", "类型", "金额", "时间"]
            rows = []
            for pid, p in data.items():
                rows.append([
                    pid, p.get("reservation_id", ""), p["group_id"],
                    p["type"], p["amount"], p["created_at"]
                ])
            return tabulate(rows, headers=headers, tablefmt="grid")
        
        elif data_type == "risks":
            headers = ["ID", "预约ID", "样本类型", "风险等级", "评估结果"]
            rows = []
            for rid, r in data.items():
                rows.append([
                    rid, r.get("reservation_id", ""), r.get("sample_type", ""),
                    r.get("risk_level", ""), r.get("assessment", "")
                ])
            return tabulate(rows, headers=headers, tablefmt="grid")
        
        return str(data)

@click.group()
def cli():
    """实验室仪器预约样本风险超时处罚排查系统"""
    pass

@cli.group()
def instrument():
    """仪器管理"""
    pass

@instrument.command(name="add")
@click.argument("instrument_id")
@click.argument("name")
@click.option("--location", default="", help="仪器位置")
@click.option("--max-hours", type=float, default=8.0, help="最大预约时长(小时)")
def add_instrument(instrument_id, name, location, max_hours):
    """添加仪器"""
    instruments = db.get("instruments")
    instruments[instrument_id] = {
        "name": name,
        "location": location,
        "max_hours_per_reservation": max_hours,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    db.set("instruments", instruments)
    click.echo(f"✓ 仪器 '{name}' ({instrument_id}) 已添加")

@instrument.command(name="list")
def list_instruments():
    """列出所有仪器"""
    instruments = db.get("instruments")
    if not instruments:
        click.echo("没有仪器数据")
        return
    headers = ["ID", "名称", "位置", "最大预约时长"]
    rows = [[k, v["name"], v["location"], v["max_hours_per_reservation"]] 
            for k, v in instruments.items()]
    click.echo(tabulate(rows, headers=headers, tablefmt="grid"))

@cli.group()
def group():
    """课题组管理"""
    pass

@group.command(name="add")
@click.argument("group_id")
@click.argument("name")
@click.option("--contact", default="", help="联系人")
def add_group(group_id, name, contact):
    """添加课题组"""
    groups = db.get("groups")
    groups[group_id] = {
        "name": name,
        "contact": contact,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    db.set("groups", groups)
    click.echo(f"✓ 课题组 '{name}' ({group_id}) 已添加")

@group.command(name="list")
def list_groups():
    """列出所有课题组"""
    groups = db.get("groups")
    if not groups:
        click.echo("没有课题组数据")
        return
    headers = ["ID", "名称", "联系人"]
    rows = [[k, v["name"], v["contact"]] for k, v in groups.items()]
    click.echo(tabulate(rows, headers=headers, tablefmt="grid"))

@cli.group()
def reserve():
    """预约管理"""
    pass

@reserve.command(name="create")
@click.argument("reservation_id")
@click.argument("instrument_id")
@click.argument("group_id")
@click.argument("start_time")
@click.argument("end_time")
@click.option("--force", is_flag=True, help="强制创建（忽略验证）")
def create_reservation(reservation_id, instrument_id, group_id, start_time, end_time, force):
    """创建预约
    
    参数:
    reservation_id: 预约ID
    instrument_id: 仪器ID
    group_id: 课题组ID
    start_time: 开始时间 (格式: YYYY-MM-DD HH:MM)
    end_time: 结束时间 (格式: YYYY-MM-DD HH:MM)
    """
    errors = []
    
    if not force:
        if not Validator.validate_time_format(start_time):
            errors.append(f"开始时间格式错误: {start_time}")
        if not Validator.validate_time_format(end_time):
            errors.append(f"结束时间格式错误: {end_time}")
        if not Validator.validate_instrument_id(instrument_id):
            errors.append(f"仪器不存在: {instrument_id}")
        if not Validator.validate_group_id(group_id):
            errors.append(f"课题组不存在: {group_id}")
        
        if not errors and Validator.validate_time_format(start_time) and Validator.validate_time_format(end_time):
            start = datetime.strptime(start_time, "%Y-%m-%d %H:%M")
            end = datetime.strptime(end_time, "%Y-%m-%d %H:%M")
            if end <= start:
                errors.append(f"结束时间必须晚于开始时间: 开始={start_time}, 结束={end_time}")
        
        if errors:
            click.echo("✗ 验证失败:")
            for e in errors:
                click.echo(f"  - {e}")
            return
        
        has_conflict, conflict_id = ReservationManager.check_conflict(instrument_id, start_time, end_time)
        if has_conflict:
            click.echo(f"✗ 时段冲突: 与预约 {conflict_id} 重叠")
            return
    
    reservations = db.get("reservations")
    if reservation_id in reservations:
        click.echo(f"✗ 预约ID已存在: {reservation_id}")
        return
    
    reservations[reservation_id] = {
        "instrument_id": instrument_id,
        "group_id": group_id,
        "start_time": start_time,
        "end_time": end_time,
        "status": "reserved",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    db.set("reservations", reservations)
    click.echo(f"✓ 预约 {reservation_id} 已创建，时段已锁定")

@reserve.command(name="list")
@click.option("--instrument", help="按仪器筛选")
@click.option("--group", help="按课题组筛选")
@click.option("--status", help="按状态筛选")
def list_reservations(instrument, group, status):
    """列出预约"""
    reservations = db.get("reservations")
    filtered = {}
    for rid, r in reservations.items():
        if instrument and r["instrument_id"] != instrument:
            continue
        if group and r["group_id"] != group:
            continue
        if status and r["status"] != status:
            continue
        filtered[rid] = r
    
    if not filtered:
        click.echo("没有匹配的预约")
        return
    click.echo(Reporter.format_human_readable(filtered, "reservations"))

@reserve.command(name="cancel")
@click.argument("reservation_id")
@click.option("--reason", default="", help="取消原因")
def cancel_reservation(reservation_id, reason):
    """取消预约"""
    reservations = db.get("reservations")
    if reservation_id not in reservations:
        click.echo(f"✗ 预约不存在: {reservation_id}")
        return
    
    res = reservations[reservation_id]
    if res["status"] in ["cancelled", "completed"]:
        click.echo(f"✗ 预约状态不允许取消: {res['status']}")
        return
    
    start_time = datetime.strptime(res["start_time"], "%Y-%m-%d %H:%M")
    now = datetime.now()
    hours_before_start = (start_time - now).total_seconds() / 3600
    
    penalty_amount = PenaltyCalculator.calculate_cancellation_penalty(res["group_id"], hours_before_start)
    
    res["status"] = "cancelled"
    db.set("reservations", reservations)
    
    cancellations = db.get("cancellations")
    cancel_id = f"CAN_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    cancellations[cancel_id] = {
        "reservation_id": reservation_id,
        "group_id": res["group_id"],
        "reason": reason,
        "hours_before_start": round(hours_before_start, 2),
        "penalty_amount": penalty_amount,
        "cancelled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    db.set("cancellations", cancellations)
    
    if penalty_amount > 0:
        penalties = db.get("penalties")
        penalty_id = f"PEN_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        penalties[penalty_id] = {
            "reservation_id": reservation_id,
            "group_id": res["group_id"],
            "type": "late_cancellation",
            "amount": penalty_amount,
            "reason": f"提前{round(hours_before_start, 1)}小时取消",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        db.set("penalties", penalties)
        click.echo(f"! 产生取消费用: ¥{penalty_amount}")
    
    click.echo(f"✓ 预约 {reservation_id} 已取消，时段已释放")

@cli.group()
def risk():
    """样本风险管理"""
    pass

@risk.command(name="report")
@click.argument("report_id")
@click.argument("reservation_id")
@click.argument("sample_type")
@click.argument("risk_level")
@click.option("--previous-contamination", is_flag=True, help="是否有前科污染")
@click.option("--notes", default="", help="备注")
def report_risk(report_id, reservation_id, sample_type, risk_level, previous_contamination, notes):
    """申报样本风险"""
    if not Validator.validate_risk_level(risk_level):
        click.echo(f"✗ 风险等级错误，有效值: low, medium, high, critical")
        return
    
    assessment = RiskManager.assess_sample_risk(sample_type, risk_level, previous_contamination)
    
    risk_reports = db.get("risk_reports")
    risk_reports[report_id] = {
        "reservation_id": reservation_id,
        "sample_type": sample_type,
        "risk_level": risk_level,
        "has_previous_contamination": previous_contamination,
        "assessment": assessment,
        "notes": notes,
        "reported_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    db.set("risk_reports", risk_reports)
    
    click.echo(f"✓ 风险报告 {report_id} 已提交")
    click.echo(f"  评估结果: {assessment}")
    if assessment == "requires_approval":
        click.echo("  ! 需要管理员审批")
    elif assessment == "supervision_required":
        click.echo("  ! 需要专人监督")

@risk.command(name="list")
def list_risks():
    """列出风险报告"""
    risk_reports = db.get("risk_reports")
    if not risk_reports:
        click.echo("没有风险报告")
        return
    click.echo(Reporter.format_human_readable(risk_reports, "risks"))

@cli.group()
def penalty():
    """处罚管理"""
    pass

@penalty.command(name="record-overtime")
@click.argument("reservation_id")
@click.argument("actual_end_time")
def record_overtime(reservation_id, actual_end_time):
    """记录超时并计算处罚"""
    reservations = db.get("reservations")
    if reservation_id not in reservations:
        click.echo(f"✗ 预约不存在: {reservation_id}")
        return
    
    res = reservations[reservation_id]
    if res["status"] == "completed":
        click.echo(f"✗ 预约已完成")
        return
    
    overtime = ReservationManager.check_overtime(reservation_id, actual_end_time)
    if overtime <= 0:
        click.echo("✓ 无超时")
        res["status"] = "completed"
        db.set("reservations", reservations)
        return
    
    penalty_amount = PenaltyCalculator.calculate_overtime_penalty(res["group_id"], overtime)
    
    penalties = db.get("penalties")
    penalty_id = f"PEN_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    penalties[penalty_id] = {
        "reservation_id": reservation_id,
        "group_id": res["group_id"],
        "type": "overtime",
        "amount": penalty_amount,
        "overtime_hours": round(overtime, 2),
        "reason": f"超时{round(overtime, 2)}小时",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    db.set("penalties", penalties)
    
    res["status"] = "completed"
    res["actual_end_time"] = actual_end_time
    db.set("reservations", reservations)
    
    click.echo(f"✓ 超时记录已保存")
    click.echo(f"  超时时长: {round(overtime, 2)}小时")
    click.echo(f"  处罚金额: ¥{penalty_amount}")

@penalty.command(name="list")
@click.option("--group", help="按课题组筛选")
def list_penalties(group):
    """列出处罚"""
    penalties = db.get("penalties")
    filtered = {}
    for pid, p in penalties.items():
        if group and p["group_id"] != group:
            continue
        filtered[pid] = p
    
    if not filtered:
        click.echo("没有处罚记录")
        return
    click.echo(Reporter.format_human_readable(filtered, "penalties"))

@cli.group()
def report():
    """报告导出"""
    pass

@report.command(name="usage")
@click.argument("reservation_id")
@click.option("--actual-end", help="实际结束时间")
@click.option("--output", "-o", help="输出文件路径")
@click.option("--format", "fmt", type=click.Choice(['json', 'both']), default='both', help="输出格式")
def usage_report(reservation_id, actual_end, output, fmt):
    """生成使用报告"""
    risk_reports = db.get("risk_reports")
    sample_risk = next((r for r in risk_reports.values() if r.get("reservation_id") == reservation_id), None)
    
    report_data = Reporter.generate_report(reservation_id, actual_end, sample_risk)
    if not report_data:
        click.echo("✗ 预约不存在")
        return
    
    if fmt in ['json', 'both']:
        if output:
            Reporter.export_json(report_data, output)
            click.echo(f"✓ JSON报告已导出到: {output}")
        else:
            click.echo(json.dumps(report_data, ensure_ascii=False, indent=2))
    
    if fmt in ['both']:
        click.echo("\n" + "="*50)
        click.echo("使用报告 (人类可读)")
        click.echo("="*50)
        for key, value in report_data.items():
            if isinstance(value, dict):
                click.echo(f"{key}:")
                for k, v in value.items():
                    click.echo(f"  {k}: {v}")
            else:
                click.echo(f"{key}: {value}")

@report.command(name="summary")
@click.option("--output", "-o", help="输出文件路径")
def summary_report(output):
    """生成汇总报告"""
    reservations = db.get("reservations")
    penalties = db.get("penalties")
    risk_reports = db.get("risk_reports")
    cancellations = db.get("cancellations")
    
    summary = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_reservations": len(reservations),
        "status_breakdown": defaultdict(int),
        "total_penalties": len(penalties),
        "total_penalty_amount": sum(p["amount"] for p in penalties.values()),
        "total_risk_reports": len(risk_reports),
        "total_cancellations": len(cancellations)
    }
    
    for r in reservations.values():
        summary["status_breakdown"][r["status"]] += 1
    summary["status_breakdown"] = dict(summary["status_breakdown"])
    
    if output:
        Reporter.export_json(summary, output)
        click.echo(f"✓ 汇总报告已导出到: {output}")
    
    click.echo("\n" + "="*50)
    click.echo("系统汇总报告")
    click.echo("="*50)
    for key, value in summary.items():
        if isinstance(value, dict):
            click.echo(f"{key}:")
            for k, v in value.items():
                click.echo(f"  {k}: {v}")
        else:
            click.echo(f"{key}: {value}")

@cli.command()
@click.option("--output", "-o", help="输出文件路径")
def troubleshoot(output):
    """排查冲突、超时和风险问题"""
    reservations = db.get("reservations")
    penalties = db.get("penalties")
    risk_reports = db.get("risk_reports")
    instruments = db.get("instruments")
    groups = db.get("groups")
    
    issues = {
        "time_conflicts": [],
        "overtime_issues": [],
        "high_risk_cases": [],
        "frequent_penalty_groups": [],
        "dirty_data_issues": []
    }
    for rid, res in reservations.items():
        if res["instrument_id"] not in instruments:
            issues["dirty_data_issues"].append({
                "reservation_id": rid,
                "issue_type": "invalid_instrument",
                "message": f"仪器不存在: {res['instrument_id']}"
            })
        
        if res["group_id"] not in groups:
            issues["dirty_data_issues"].append({
                "reservation_id": rid,
                "issue_type": "invalid_group",
                "message": f"课题组不存在: {res['group_id']}"
            })
        
        if Validator.validate_time_format(res["start_time"]) and Validator.validate_time_format(res["end_time"]):
            start = datetime.strptime(res["start_time"], "%Y-%m-%d %H:%M")
            end = datetime.strptime(res["end_time"], "%Y-%m-%d %H:%M")
            if end <= start:
                issues["dirty_data_issues"].append({
                    "reservation_id": rid,
                    "issue_type": "invalid_time_order",
                    "message": f"时段倒置: 开始={res['start_time']}, 结束={res['end_time']}"
                })
        else:
            if not Validator.validate_time_format(res["start_time"]):
                issues["dirty_data_issues"].append({
                    "reservation_id": rid,
                    "issue_type": "invalid_time_format",
                    "message": f"开始时间格式错误: {res['start_time']}"
                })
            if not Validator.validate_time_format(res["end_time"]):
                issues["dirty_data_issues"].append({
                    "reservation_id": rid,
                    "issue_type": "invalid_time_format",
                    "message": f"结束时间格式错误: {res['end_time']}"
                })
    
    res_list = list(reservations.items())
    for i, (rid1, res1) in enumerate(res_list):
        if res1["status"] in ["cancelled", "completed"]:
            continue
        for j in range(i + 1, len(res_list)):
            rid2, res2 = res_list[j]
            if res2["status"] in ["cancelled", "completed"]:
                continue
            if res1["instrument_id"] != res2["instrument_id"]:
                continue
            
            if Validator.validate_time_format(res1["start_time"]) and Validator.validate_time_format(res1["end_time"]) and \
               Validator.validate_time_format(res2["start_time"]) and Validator.validate_time_format(res2["end_time"]):
                start1 = datetime.strptime(res1["start_time"], "%Y-%m-%d %H:%M")
                end1 = datetime.strptime(res1["end_time"], "%Y-%m-%d %H:%M")
                start2 = datetime.strptime(res2["start_time"], "%Y-%m-%d %H:%M")
                end2 = datetime.strptime(res2["end_time"], "%Y-%m-%d %H:%M")
                
                if start1 < end2 and end1 > start2:
                    issues["time_conflicts"].append({
                        "reservation1": rid1,
                        "reservation2": rid2,
                        "instrument": res1["instrument_id"]
                    })
    
    for pid, p in penalties.items():
        if p["type"] == "overtime" and p.get("overtime_hours", 0) > 2:
            issues["overtime_issues"].append({
                "penalty_id": pid,
                "reservation_id": p["reservation_id"],
                "group_id": p["group_id"],
                "overtime_hours": p["overtime_hours"],
                "amount": p["amount"]
            })
    
    for rid, r in risk_reports.items():
        if r["assessment"] in ["requires_approval", "supervision_required"]:
            issues["high_risk_cases"].append({
                "report_id": rid,
                "reservation_id": r["reservation_id"],
                "risk_level": r["risk_level"],
                "assessment": r["assessment"]
            })
    
    group_penalty_counts = defaultdict(int)
    for p in penalties.values():
        group_penalty_counts[p["group_id"]] += 1
    for gid, count in group_penalty_counts.items():
        if count >= 3:
            issues["frequent_penalty_groups"].append({
                "group_id": gid,
                "penalty_count": count
            })
    
    if output:
        Reporter.export_json(issues, output)
        click.echo(f"✓ 排查报告已导出到: {output}")
    
    click.echo("\n" + "="*60)
    click.echo("问题排查报告")
    click.echo("="*60)
    
    click.echo(f"\n1. 脏数据问题 ({len(issues['dirty_data_issues'])}个):")
    if issues["dirty_data_issues"]:
        for d in issues["dirty_data_issues"]:
            click.echo(f"  - 预约 {d['reservation_id']}: {d['message']}")
    else:
        click.echo("  ✓ 无脏数据")
    
    click.echo(f"\n2. 时段冲突 ({len(issues['time_conflicts'])}个):")
    if issues["time_conflicts"]:
        for c in issues["time_conflicts"]:
            click.echo(f"  - 预约 {c['reservation1']} 与 {c['reservation2']} 在仪器 {c['instrument']} 上冲突")
    else:
        click.echo("  ✓ 无冲突")
    
    click.echo(f"\n3. 严重超时 ({len(issues['overtime_issues'])}个):")
    if issues["overtime_issues"]:
        for o in issues["overtime_issues"]:
            click.echo(f"  - 预约 {o['reservation_id']} 超时 {o['overtime_hours']}小时, 处罚 ¥{o['amount']}")
    else:
        click.echo("  ✓ 无严重超时")
    
    click.echo(f"\n4. 高风险样本 ({len(issues['high_risk_cases'])}个):")
    if issues["high_risk_cases"]:
        for r in issues["high_risk_cases"]:
            click.echo(f"  - 报告 {r['report_id']}: {r['risk_level']} - {r['assessment']}")
    else:
        click.echo("  ✓ 无高风险")
    
    click.echo(f"\n5. 高频处罚课题组 ({len(issues['frequent_penalty_groups'])}个):")
    if issues["frequent_penalty_groups"]:
        for g in issues["frequent_penalty_groups"]:
            click.echo(f"  - {g['group_id']}: {g['penalty_count']}次处罚")
    else:
        click.echo("  ✓ 无高频处罚")

@cli.command()
@click.option("--scenario", type=click.Choice(['normal', 'dirty', 'conflict', 'empty']), 
              required=True, help="加载样例场景")
def load_sample(scenario):
    """加载样例数据
    
    场景:
    normal: 正常输入
    dirty: 脏数据
    conflict: 边界冲突
    empty: 空结果
    """
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    
    global db
    db = DataStore()
    
    instruments = {
        "TEM-001": {"name": "透射电镜", "location": "A楼301", "max_hours_per_reservation": 8.0, "created_at": "2024-01-01 00:00:00"},
        "SEM-001": {"name": "扫描电镜", "location": "A楼302", "max_hours_per_reservation": 6.0, "created_at": "2024-01-01 00:00:00"},
        "AFM-001": {"name": "原子力显微镜", "location": "B楼105", "max_hours_per_reservation": 4.0, "created_at": "2024-01-01 00:00:00"}
    }
    db.set("instruments", instruments)
    
    groups = {
        "GROUP-A": {"name": "纳米材料组", "contact": "张教授", "created_at": "2024-01-01 00:00:00"},
        "GROUP-B": {"name": "生物物理组", "contact": "李教授", "created_at": "2024-01-01 00:00:00"},
        "GROUP-C": {"name": "量子器件组", "contact": "王教授", "created_at": "2024-01-01 00:00:00"}
    }
    db.set("groups", groups)
    
    if scenario == "normal":
        reservations = {
            "RES-001": {
                "instrument_id": "TEM-001", "group_id": "GROUP-A",
                "start_time": "2024-06-01 09:00", "end_time": "2024-06-01 12:00",
                "status": "reserved", "created_at": "2024-05-20 10:00:00"
            },
            "RES-002": {
                "instrument_id": "SEM-001", "group_id": "GROUP-B",
                "start_time": "2024-06-01 14:00", "end_time": "2024-06-01 17:00",
                "status": "reserved", "created_at": "2024-05-21 11:00:00"
            }
        }
        db.set("reservations", reservations)
        
        risks = {
            "RISK-001": {
                "reservation_id": "RES-001", "sample_type": "semiconductor",
                "risk_level": "medium", "has_previous_contamination": False,
                "assessment": "normal", "notes": "标准样品",
                "reported_at": "2024-05-25 10:00:00"
            }
        }
        db.set("risk_reports", risks)
        
    elif scenario == "dirty":
        reservations = {
            "RES-DIRTY-1": {
                "instrument_id": "INVALID-INST", "group_id": "GROUP-A",
                "start_time": "2024/06/01 9点", "end_time": "2024-06-01 12:00",
                "status": "reserved", "created_at": "2024-05-20 10:00:00"
            },
            "RES-DIRTY-2": {
                "instrument_id": "TEM-001", "group_id": "INVALID-GROUP",
                "start_time": "2024-06-01 09:00", "end_time": "2024-06-01 08:00",
                "status": "reserved", "created_at": "2024-05-20 10:00:00"
            }
        }
        db.set("reservations", reservations)
        
    elif scenario == "conflict":
        reservations = {
            "RES-CONF-1": {
                "instrument_id": "TEM-001", "group_id": "GROUP-A",
                "start_time": "2024-06-01 09:00", "end_time": "2024-06-01 12:00",
                "status": "reserved", "created_at": "2024-05-20 10:00:00"
            },
            "RES-CONF-2": {
                "instrument_id": "TEM-001", "group_id": "GROUP-B",
                "start_time": "2024-06-01 11:00", "end_time": "2024-06-01 14:00",
                "status": "reserved", "created_at": "2024-05-21 10:00:00"
            },
            "RES-CONF-3": {
                "instrument_id": "TEM-001", "group_id": "GROUP-C",
                "start_time": "2024-06-01 08:59", "end_time": "2024-06-01 09:01",
                "status": "reserved", "created_at": "2024-05-22 10:00:00"
            }
        }
        db.set("reservations", reservations)
        
        penalties = {
            "PEN-001": {
                "reservation_id": "RES-CONF-1", "group_id": "GROUP-A",
                "type": "overtime", "amount": 250, "overtime_hours": 2.0,
                "reason": "超时2小时", "created_at": "2024-05-25 10:00:00"
            },
            "PEN-002": {
                "reservation_id": "RES-CONF-1", "group_id": "GROUP-A",
                "type": "overtime", "amount": 150, "overtime_hours": 1.0,
                "reason": "超时1小时", "created_at": "2024-05-26 10:00:00"
            },
            "PEN-003": {
                "reservation_id": "RES-CONF-2", "group_id": "GROUP-A",
                "type": "late_cancellation", "amount": 100,
                "reason": "提前2小时取消", "created_at": "2024-05-27 10:00:00"
            }
        }
        db.set("penalties", penalties)
        
        risks = {
            "RISK-HIGH-1": {
                "reservation_id": "RES-CONF-1", "sample_type": "biological",
                "risk_level": "high", "has_previous_contamination": True,
                "assessment": "requires_approval", "notes": "致病性生物样本",
                "reported_at": "2024-05-25 10:00:00"
            }
        }
        db.set("risk_reports", risks)
    
    elif scenario == "empty":
        pass
    
    click.echo(f"✓ 已加载 {scenario} 场景样例数据")

@cli.command()
def reset():
    """重置所有数据"""
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
        click.echo("✓ 所有数据已重置")
    else:
        click.echo("✓ 数据目录为空")

if __name__ == "__main__":
    cli()

