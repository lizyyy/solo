import csv
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import RiskAnomaly, Cabin, WorkTicket, SensorLog, VentilationRule
from app.config import settings


class ReportExporter:
    ANOMALY_TYPE_NAMES = {
        "voc_exceed": "VOC浓度超限",
        "ventilation_insufficient": "排风不足",
        "work_ticket_overlap": "作业票时间重叠",
        "sensor_missing": "传感器数据缺采"
    }
    
    SEVERITY_NAMES = {
        "high": "高",
        "medium": "中",
        "low": "低"
    }
    
    @staticmethod
    def export_to_markdown(
        db: Session,
        start_time: datetime = None,
        end_time: datetime = None,
        include_confirmed: bool = False
    ) -> str:
        query = db.query(RiskAnomaly)
        
        if start_time:
            query = query.filter(RiskAnomaly.start_time >= start_time)
        if end_time:
            query = query.filter(RiskAnomaly.start_time <= end_time)
        if not include_confirmed:
            query = query.filter(RiskAnomaly.is_confirmed == False)
        
        anomalies = query.order_by(
            RiskAnomaly.severity.desc(),
            RiskAnomaly.created_at.desc()
        ).all()
        
        total_high = sum(1 for a in anomalies if a.severity == "high")
        total_medium = sum(1 for a in anomalies if a.severity == "medium")
        total_low = sum(1 for a in anomalies if a.severity == "low")
        
        by_type = {}
        for a in anomalies:
            if a.anomaly_type not in by_type:
                by_type[a.anomaly_type] = 0
            by_type[a.anomaly_type] += 1
        
        report = []
        report.append("# 船厂涂装安全风险报告")
        report.append("")
        report.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**数据范围**: {start_time.strftime('%Y-%m-%d %H:%M') if start_time else '全部'} 至 {end_time.strftime('%Y-%m-%d %H:%M') if end_time else '全部'}")
        report.append("")
        report.append("## 风险摘要")
        report.append("")
        report.append("| 风险等级 | 数量 |")
        report.append("|---------|------|")
        report.append(f"| 🔴 高风险 | {total_high} |")
        report.append(f"| 🟡 中风险 | {total_medium} |")
        report.append(f"| 🟢 低风险 | {total_low} |")
        report.append(f"| **总计** | **{len(anomalies)}** |")
        report.append("")
        
        if by_type:
            report.append("## 按风险类型统计")
            report.append("")
            report.append("| 风险类型 | 数量 |")
            report.append("|---------|------|")
            for anomaly_type, count in by_type.items():
                type_name = ReportExporter.ANOMALY_TYPE_NAMES.get(anomaly_type, anomaly_type)
                report.append(f"| {type_name} | {count} |")
            report.append("")
        
        if anomalies:
            report.append("## 风险详情")
            report.append("")
            
            for idx, anomaly in enumerate(anomalies, 1):
                type_name = ReportExporter.ANOMALY_TYPE_NAMES.get(anomaly.anomaly_type, anomaly.anomaly_type)
                severity_name = ReportExporter.SEVERITY_NAMES.get(anomaly.severity, anomaly.severity)
                severity_icon = "🔴" if anomaly.severity == "high" else "🟡" if anomaly.severity == "medium" else "🟢"
                
                report.append(f"### {idx}. {severity_icon} {type_name} ({severity_name})")
                report.append("")
                report.append(f"- **舱室代码**: {anomaly.cabin_code or 'N/A'}")
                report.append(f"- **传感器ID**: {anomaly.sensor_id or 'N/A'}")
                report.append(f"- **开始时间**: {anomaly.start_time.strftime('%Y-%m-%d %H:%M:%S') if anomaly.start_time else 'N/A'}")
                report.append(f"- **结束时间**: {anomaly.end_time.strftime('%Y-%m-%d %H:%M:%S') if anomaly.end_time else 'N/A'}")
                report.append(f"- **确认状态**: {'已确认' if anomaly.is_confirmed else '未确认'}")
                report.append("")
                report.append(f"**描述**: {anomaly.description}")
                report.append("")
                
                if anomaly.details:
                    try:
                        details = json.loads(anomaly.details)
                        report.append("**详细信息**:")
                        report.append("")
                        report.append("```json")
                        report.append(json.dumps(details, ensure_ascii=False, indent=2))
                        report.append("```")
                        report.append("")
                    except:
                        report.append(f"**详细信息**: {anomaly.details}")
                        report.append("")
                
                report.append("---")
                report.append("")
        else:
            report.append("## 风险详情")
            report.append("")
            report.append("✅ 当前时间范围内未检测到风险异常。")
            report.append("")
        
        report.append("---")
        report.append("")
        report.append("*报告由船厂涂装安全管理系统自动生成*")
        
        return "\n".join(report)
    
    @staticmethod
    def export_to_csv(
        db: Session,
        start_time: datetime = None,
        end_time: datetime = None,
        include_confirmed: bool = False
    ) -> str:
        query = db.query(RiskAnomaly)
        
        if start_time:
            query = query.filter(RiskAnomaly.start_time >= start_time)
        if end_time:
            query = query.filter(RiskAnomaly.start_time <= end_time)
        if not include_confirmed:
            query = query.filter(RiskAnomaly.is_confirmed == False)
        
        anomalies = query.order_by(
            RiskAnomaly.severity.desc(),
            RiskAnomaly.created_at.desc()
        ).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        headers = [
            "序号",
            "风险类型",
            "风险等级",
            "舱室代码",
            "传感器ID",
            "开始时间",
            "结束时间",
            "描述",
            "确认状态",
            "确认人",
            "确认时间"
        ]
        writer.writerow(headers)
        
        for idx, anomaly in enumerate(anomalies, 1):
            type_name = ReportExporter.ANOMALY_TYPE_NAMES.get(anomaly.anomaly_type, anomaly.anomaly_type)
            severity_name = ReportExporter.SEVERITY_NAMES.get(anomaly.severity, anomaly.severity)
            
            row = [
                idx,
                type_name,
                severity_name,
                anomaly.cabin_code or "",
                anomaly.sensor_id or "",
                anomaly.start_time.strftime('%Y-%m-%d %H:%M:%S') if anomaly.start_time else "",
                anomaly.end_time.strftime('%Y-%m-%d %H:%M:%S') if anomaly.end_time else "",
                anomaly.description or "",
                "已确认" if anomaly.is_confirmed else "未确认",
                anomaly.confirmed_by or "",
                anomaly.confirmed_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.confirmed_at else ""
            ]
            writer.writerow(row)
        
        return output.getvalue()
    
    @staticmethod
    def export_to_json(
        db: Session,
        start_time: datetime = None,
        end_time: datetime = None,
        include_confirmed: bool = False
    ) -> Dict[str, Any]:
        query = db.query(RiskAnomaly)
        
        if start_time:
            query = query.filter(RiskAnomaly.start_time >= start_time)
        if end_time:
            query = query.filter(RiskAnomaly.start_time <= end_time)
        if not include_confirmed:
            query = query.filter(RiskAnomaly.is_confirmed == False)
        
        anomalies = query.order_by(
            RiskAnomaly.severity.desc(),
            RiskAnomaly.created_at.desc()
        ).all()
        
        total_high = sum(1 for a in anomalies if a.severity == "high")
        total_medium = sum(1 for a in anomalies if a.severity == "medium")
        total_low = sum(1 for a in anomalies if a.severity == "low")
        
        by_type = {}
        for a in anomalies:
            if a.anomaly_type not in by_type:
                by_type[a.anomaly_type] = 0
            by_type[a.anomaly_type] += 1
        
        anomaly_list = []
        for anomaly in anomalies:
            anomaly_data = {
                "id": anomaly.id,
                "anomaly_type": anomaly.anomaly_type,
                "anomaly_type_name": ReportExporter.ANOMALY_TYPE_NAMES.get(anomaly.anomaly_type, anomaly.anomaly_type),
                "severity": anomaly.severity,
                "severity_name": ReportExporter.SEVERITY_NAMES.get(anomaly.severity, anomaly.severity),
                "cabin_code": anomaly.cabin_code,
                "sensor_id": anomaly.sensor_id,
                "start_time": anomaly.start_time.isoformat() if anomaly.start_time else None,
                "end_time": anomaly.end_time.isoformat() if anomaly.end_time else None,
                "description": anomaly.description,
                "details": json.loads(anomaly.details) if anomaly.details else None,
                "is_confirmed": anomaly.is_confirmed,
                "confirmed_by": anomaly.confirmed_by,
                "confirmed_at": anomaly.confirmed_at.isoformat() if anomaly.confirmed_at else None,
                "created_at": anomaly.created_at.isoformat() if anomaly.created_at else None
            }
            anomaly_list.append(anomaly_data)
        
        return {
            "report_info": {
                "generated_at": datetime.now().isoformat(),
                "time_range": {
                    "start": start_time.isoformat() if start_time else None,
                    "end": end_time.isoformat() if end_time else None
                }
            },
            "summary": {
                "total_anomalies": len(anomalies),
                "by_severity": {
                    "high": total_high,
                    "medium": total_medium,
                    "low": total_low
                },
                "by_type": {
                    ReportExporter.ANOMALY_TYPE_NAMES.get(k, k): v for k, v in by_type.items()
                }
            },
            "anomalies": anomaly_list
        }
    
    @staticmethod
    def save_report_to_file(
        db: Session,
        format: str = "markdown",
        start_time: datetime = None,
        end_time: datetime = None,
        include_confirmed: bool = False
    ) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format == "markdown":
            content = ReportExporter.export_to_markdown(db, start_time, end_time, include_confirmed)
            filename = f"safety_report_{timestamp}.md"
        elif format == "csv":
            content = ReportExporter.export_to_csv(db, start_time, end_time, include_confirmed)
            filename = f"safety_report_{timestamp}.csv"
        elif format == "json":
            content = json.dumps(
                ReportExporter.export_to_json(db, start_time, end_time, include_confirmed),
                ensure_ascii=False,
                indent=2
            )
            filename = f"safety_report_{timestamp}.json"
        else:
            raise ValueError(f"不支持的报告格式: {format}")
        
        filepath = settings.REPORTS_DIR / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath
