import csv
import io
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import (
    WorkSession, SettlementRecord, AnomalyRecord,
    Machinery, PlotContract
)


class ExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def export_settlements_csv(self, machine_id: Optional[str] = None,
                                start_date: Optional[datetime] = None,
                                end_date: Optional[datetime] = None) -> str:
        query = self.db.query(SettlementRecord).join(
            WorkSession, SettlementRecord.work_session_id == WorkSession.session_id
        )
        
        if machine_id:
            query = query.filter(SettlementRecord.machine_id == machine_id)
        
        if start_date:
            query = query.filter(WorkSession.start_time >= start_date)
        
        if end_date:
            query = query.filter(WorkSession.end_time <= end_date)
        
        settlements = query.order_by(WorkSession.start_time).all()
        
        if not settlements:
            return ""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "结算编号", "机器编号", "地块编号", "作业时段编号",
            "作业开始时间", "作业结束时间", "总面积(亩)",
            "夜间作业面积(亩)", "空驶扣减面积(亩)", "计费面积(亩)",
            "每亩价格(元)", "夜间补贴(元)", "空驶扣减(元)",
            "结算金额(元)", "状态"
        ])
        
        for s in settlements:
            work_session = self.db.query(WorkSession).filter(
                WorkSession.session_id == s.work_session_id
            ).first()
            
            writer.writerow([
                s.settlement_id,
                s.machine_id,
                s.plot_id or "",
                s.work_session_id,
                work_session.start_time.isoformat() if work_session else "",
                work_session.end_time.isoformat() if work_session else "",
                f"{s.total_area_mu:.4f}" if s.total_area_mu else "0",
                f"{s.night_area_mu:.4f}" if s.night_area_mu else "0",
                f"{s.empty_deduction_area_mu:.4f}" if s.empty_deduction_area_mu else "0",
                f"{s.billable_area_mu:.4f}" if s.billable_area_mu else "0",
                f"{s.price_per_mu:.2f}" if s.price_per_mu else "0",
                f"{s.night_surcharge:.2f}" if s.night_surcharge else "0",
                f"{s.empty_driving_deduction:.2f}" if s.empty_driving_deduction else "0",
                f"{s.total_amount:.2f}" if s.total_amount else "0",
                s.status or "pending"
            ])
        
        return output.getvalue()
    
    def export_anomalies_csv(self, machine_id: Optional[str] = None,
                              resolved: Optional[bool] = None) -> str:
        query = self.db.query(AnomalyRecord)
        
        if machine_id:
            query = query.filter(AnomalyRecord.machine_id == machine_id)
        
        if resolved is not None:
            query = query.filter(AnomalyRecord.resolved == resolved)
        
        anomalies = query.order_by(AnomalyRecord.detected_at).all()
        
        if not anomalies:
            return ""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "异常编号", "作业时段编号", "机器编号", "地块编号",
            "异常类型", "严重程度", "描述", "详细信息",
            "检测时间", "是否已解决", "解决时间", "解决备注"
        ])
        
        for a in anomalies:
            writer.writerow([
                a.anomaly_id,
                a.work_session_id or "",
                a.machine_id or "",
                a.plot_id or "",
                a.anomaly_type or "",
                a.severity or "",
                a.description or "",
                a.details or "",
                a.detected_at.isoformat() if a.detected_at else "",
                "是" if a.resolved else "否",
                a.resolved_at.isoformat() if a.resolved_at else "",
                a.resolution_notes or ""
            ])
        
        return output.getvalue()
    
    def export_settlements_markdown(self, machine_id: Optional[str] = None,
                                      start_date: Optional[datetime] = None,
                                      end_date: Optional[datetime] = None) -> str:
        query = self.db.query(SettlementRecord).join(
            WorkSession, SettlementRecord.work_session_id == WorkSession.session_id
        )
        
        if machine_id:
            query = query.filter(SettlementRecord.machine_id == machine_id)
        
        if start_date:
            query = query.filter(WorkSession.start_time >= start_date)
        
        if end_date:
            query = query.filter(WorkSession.end_time <= end_date)
        
        settlements = query.order_by(WorkSession.start_time).all()
        
        if not settlements:
            return "# 结算记录\n\n暂无结算记录。\n"
        
        machines = {}
        for s in settlements:
            if s.machine_id not in machines:
                machines[s.machine_id] = []
            machines[s.machine_id].append(s)
        
        total_summary = {
            "total_area": sum(s.total_area_mu or 0 for s in settlements),
            "night_area": sum(s.night_area_mu or 0 for s in settlements),
            "billable_area": sum(s.billable_area_mu or 0 for s in settlements),
            "total_amount": sum(s.total_amount or 0 for s in settlements),
            "night_surcharge": sum(s.night_surcharge or 0 for s in settlements),
            "empty_deduction": sum(s.empty_driving_deduction or 0 for s in settlements)
        }
        
        md_lines = []
        md_lines.append("# 农机作业结算报告")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"**结算记录数**: {len(settlements)}")
        md_lines.append("")
        
        md_lines.append("## 汇总统计")
        md_lines.append("")
        md_lines.append("| 指标 | 数值 |")
        md_lines.append("|------|------|")
        md_lines.append(f"| 总面积 | {total_summary['total_area']:.2f} 亩 |")
        md_lines.append(f"| 夜间作业面积 | {total_summary['night_area']:.2f} 亩 |")
        md_lines.append(f"| 计费面积 | {total_summary['billable_area']:.2f} 亩 |")
        md_lines.append(f"| 夜间补贴 | {total_summary['night_surcharge']:.2f} 元 |")
        md_lines.append(f"| 空驶扣减 | {total_summary['empty_deduction']:.2f} 元 |")
        md_lines.append(f"| **结算总额** | **{total_summary['total_amount']:.2f} 元** |")
        md_lines.append("")
        
        for mach_id, mach_settlements in machines.items():
            machine = self.db.query(Machinery).filter(
                Machinery.machine_id == mach_id
            ).first()
            
            mach_summary = {
                "total_area": sum(s.total_area_mu or 0 for s in mach_settlements),
                "total_amount": sum(s.total_amount or 0 for s in mach_settlements)
            }
            
            md_lines.append(f"## 机器: {mach_id}")
            if machine:
                md_lines.append(f"")
                md_lines.append(f"- **类型**: {machine.machine_type or '未知'}")
                md_lines.append(f"- **名称**: {machine.machine_name or '-'}")
                md_lines.append(f"- **驾驶员**: {machine.driver_name or '-'}")
            md_lines.append(f"- **作业次数**: {len(mach_settlements)} 次")
            md_lines.append(f"- **总面积**: {mach_summary['total_area']:.2f} 亩")
            md_lines.append(f"- **总金额**: {mach_summary['total_amount']:.2f} 元")
            md_lines.append("")
            
            md_lines.append("### 详细记录")
            md_lines.append("")
            md_lines.append("| 结算编号 | 地块 | 作业时间 | 面积(亩) | 夜间面积(亩) | 金额(元) | 状态 |")
            md_lines.append("|----------|------|----------|----------|--------------|----------|------|")
            
            for s in mach_settlements:
                work_session = self.db.query(WorkSession).filter(
                    WorkSession.session_id == s.work_session_id
                ).first()
                
                time_str = ""
                if work_session:
                    time_str = f"{work_session.start_time.strftime('%m-%d %H:%M')} - {work_session.end_time.strftime('%m-%d %H:%M')}"
                
                md_lines.append(
                    f"| {s.settlement_id} | {s.plot_id or '-'} | {time_str} | "
                    f"{s.total_area_mu:.2f if s.total_area_mu else 0} | "
                    f"{s.night_area_mu:.2f if s.night_area_mu else 0} | "
                    f"{s.total_amount:.2f if s.total_amount else 0} | "
                    f"{s.status or '待复核'} |"
                )
            
            md_lines.append("")
        
        return "\n".join(md_lines)
    
    def export_anomalies_markdown(self, machine_id: Optional[str] = None,
                                    resolved: Optional[bool] = None) -> str:
        query = self.db.query(AnomalyRecord)
        
        if machine_id:
            query = query.filter(AnomalyRecord.machine_id == machine_id)
        
        if resolved is not None:
            query = query.filter(AnomalyRecord.resolved == resolved)
        
        anomalies = query.order_by(AnomalyRecord.severity, AnomalyRecord.detected_at).all()
        
        if not anomalies:
            return "# 异常记录\n\n暂无异常记录。\n"
        
        severity_counts = {
            "high": 0,
            "medium": 0,
            "low": 0
        }
        
        type_counts = {}
        
        for a in anomalies:
            if a.severity in severity_counts:
                severity_counts[a.severity] += 1
            
            if a.anomaly_type:
                if a.anomaly_type not in type_counts:
                    type_counts[a.anomaly_type] = 0
                type_counts[a.anomaly_type] += 1
        
        md_lines = []
        md_lines.append("# 作业异常报告")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"**异常总数**: {len(anomalies)}")
        md_lines.append("")
        
        md_lines.append("## 异常统计")
        md_lines.append("")
        md_lines.append("### 按严重程度")
        md_lines.append("")
        md_lines.append("| 严重程度 | 数量 |")
        md_lines.append("|----------|------|")
        md_lines.append(f"| 高 | {severity_counts['high']} |")
        md_lines.append(f"| 中 | {severity_counts['medium']} |")
        md_lines.append(f"| 低 | {severity_counts['low']} |")
        md_lines.append("")
        
        if type_counts:
            md_lines.append("### 按异常类型")
            md_lines.append("")
            md_lines.append("| 异常类型 | 数量 |")
            md_lines.append("|----------|------|")
            for typ, count in type_counts.items():
                md_lines.append(f"| {typ} | {count} |")
            md_lines.append("")
        
        md_lines.append("## 异常详情")
        md_lines.append("")
        
        for a in anomalies:
            severity_label = {
                "high": "🔴 高",
                "medium": "🟡 中",
                "low": "🟢 低"
            }.get(a.severity, a.severity or "未知")
            
            resolved_label = "✅ 已解决" if a.resolved else "⏳ 待处理"
            
            md_lines.append(f"### {a.anomaly_id}")
            md_lines.append("")
            md_lines.append(f"- **异常类型**: {a.anomaly_type or '未知'}")
            md_lines.append(f"- **严重程度**: {severity_label}")
            md_lines.append(f"- **状态**: {resolved_label}")
            md_lines.append(f"- **涉及机器**: {a.machine_id or '-'}")
            md_lines.append(f"- **涉及地块**: {a.plot_id or '-'}")
            md_lines.append(f"- **作业时段**: {a.work_session_id or '-'}")
            md_lines.append(f"- **检测时间**: {a.detected_at.strftime('%Y-%m-%d %H:%M:%S') if a.detected_at else '-'}")
            md_lines.append("")
            md_lines.append(f"**描述**: {a.description or '无描述'}")
            md_lines.append("")
            if a.details:
                md_lines.append(f"**详细信息**: {a.details}")
                md_lines.append("")
            
            if a.resolved:
                md_lines.append(f"**解决时间**: {a.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if a.resolved_at else '-'}")
                if a.resolution_notes:
                    md_lines.append(f"**解决备注**: {a.resolution_notes}")
                md_lines.append("")
        
        return "\n".join(md_lines)
