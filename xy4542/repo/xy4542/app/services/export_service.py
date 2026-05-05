from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import json
import os

from app.config import EXPORT_DIR
from app.models.models import (
    TellerPayment, SortingLog, BundleTag, ATMPlan, ErrorRemark, Bundle, RiskAlert, AuditLog, ReviewRecord
)


class ExportService:
    @staticmethod
    def generate_handover_report(db: Session, business_date: str) -> str:
        teller_payments = db.query(TellerPayment).filter(
            TellerPayment.business_date == business_date
        ).all()
        
        sorting_logs = db.query(SortingLog).filter(
            SortingLog.business_date == business_date
        ).all()
        
        atm_plans = db.query(ATMPlan).filter(
            ATMPlan.business_date == business_date
        ).all()
        
        risk_alerts = db.query(RiskAlert).filter(
            RiskAlert.business_date == business_date
        ).all()
        
        bundles = db.query(Bundle).filter(
            Bundle.business_date == business_date
        ).all()
        
        report_parts = []
        
        report_parts.append(f"# 现金中心交接单 - {business_date}")
        report_parts.append("\n**生成时间:** " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        report_parts.append("\n---\n")
        
        report_parts.append("## 一、柜员缴款汇总")
        report_parts.append("\n| 柜员号 | 柜员姓名 | 扎把数 | 金额(元) |")
        report_parts.append("|--------|----------|--------|----------|")
        
        teller_summary = {}
        for tp in teller_payments:
            key = (tp.teller_no, tp.teller_name)
            if key not in teller_summary:
                teller_summary[key] = {"count": 0, "amount": 0}
            teller_summary[key]["count"] += 1
            teller_summary[key]["amount"] += tp.amount
        
        for (no, name), data in teller_summary.items():
            report_parts.append(f"| {no} | {name} | {data['count']} | {data['amount']:,.2f} |")
        
        teller_total = sum(t["amount"] for t in teller_summary.values())
        teller_count = sum(t["count"] for t in teller_summary.values())
        report_parts.append(f"| **合计** | - | **{teller_count}** | **{teller_total:,.2f}** |")
        
        report_parts.append("\n---\n")
        report_parts.append("## 二、扎把明细")
        report_parts.append("\n| 扎把编号 | 面额 | 金额(元) | 来源 | 状态 |")
        report_parts.append("|----------|------|----------|------|------|")
        
        for bundle in bundles:
            status_text = "待复核" if bundle.status == "pending" else "已通过" if bundle.status == "verified" else "已驳回"
            report_parts.append(f"| {bundle.bundle_no} | {bundle.denomination} | {bundle.amount or 0:,.2f} | {bundle.source or '-'} | {status_text} |")
        
        report_parts.append("\n---\n")
        report_parts.append("## 三、ATM加钞计划")
        report_parts.append("\n| ATM编号 | 钞箱 | 面额 | 计划金额(元) | 扎把编号 |")
        report_parts.append("|---------|------|------|--------------|----------|")
        
        for plan in atm_plans:
            report_parts.append(f"| {plan.atm_no} | {plan.box_no} | {plan.denomination} | {plan.plan_amount:,.2f} | {plan.bundle_nos or '-'} |")
        
        atm_total = sum(p.plan_amount for p in atm_plans)
        report_parts.append(f"| **合计** | - | - | **{atm_total:,.2f}** | - |")
        
        report_parts.append("\n---\n")
        report_parts.append("## 四、风险预警")
        
        pending_alerts = [a for a in risk_alerts if not a.is_reviewed]
        reviewed_alerts = [a for a in risk_alerts if a.is_reviewed]
        
        if pending_alerts:
            report_parts.append(f"\n### 待复核风险 ({len(pending_alerts)} 项)")
            report_parts.append("\n| 风险编码 | 类型 | 严重程度 | 描述 |")
            report_parts.append("|----------|------|----------|------|")
            for alert in pending_alerts:
                risk_name = {
                    "DUPLICATE_BUNDLE": "重复入库",
                    "TELLER_AMOUNT_MISMATCH": "柜员金额不平",
                    "SERIAL_GAP": "冠字号断档",
                    "ATM_PLAN_MISMATCH": "ATM计划不匹配",
                    "BUNDLE_AMOUNT_MISMATCH": "扎把金额不一致"
                }.get(alert.alert_type, alert.alert_type)
                report_parts.append(f"| {alert.alert_code} | {risk_name} | {alert.severity} | {alert.description} |")
        else:
            report_parts.append("\n*暂无待复核风险*")
        
        if reviewed_alerts:
            report_parts.append(f"\n### 已复核风险 ({len(reviewed_alerts)} 项)")
            report_parts.append("\n| 风险编码 | 类型 | 复核人 | 备注 |")
            report_parts.append("|----------|------|--------|------|")
            for alert in reviewed_alerts:
                risk_name = {
                    "DUPLICATE_BUNDLE": "重复入库",
                    "TELLER_AMOUNT_MISMATCH": "柜员金额不平",
                    "SERIAL_GAP": "冠字号断档",
                    "ATM_PLAN_MISMATCH": "ATM计划不匹配",
                    "BUNDLE_AMOUNT_MISMATCH": "扎把金额不一致"
                }.get(alert.alert_type, alert.alert_type)
                report_parts.append(f"| {alert.alert_code} | {risk_name} | {alert.reviewed_by or '-'} | {alert.review_remark or '-'} |")
        
        report_parts.append("\n---\n")
        report_parts.append("## 五、交接签字")
        report_parts.append("\n| 岗位 | 签字 | 日期 |")
        report_parts.append("|------|------|------|")
        report_parts.append("| 现金中心主管 | ____________ | |")
        report_parts.append("| 柜员代表 | ____________ | |")
        report_parts.append("| ATM管理员 | ____________ | |")
        
        report_parts.append("\n---\n")
        report_parts.append("*本交接单由系统自动生成，如有疑问请联系系统管理员*")
        
        return "\n".join(report_parts)

    @staticmethod
    def generate_audit_json(db: Session, business_date: str) -> str:
        result = {
            "business_date": business_date,
            "generated_at": datetime.now().isoformat(),
            "data": {},
            "risks": [],
            "audit_logs": []
        }
        
        teller_payments = db.query(TellerPayment).filter(
            TellerPayment.business_date == business_date
        ).all()
        
        result["data"]["teller_payments"] = [{
            "teller_no": tp.teller_no,
            "teller_name": tp.teller_name,
            "bundle_no": tp.bundle_no,
            "denomination": tp.denomination,
            "amount": tp.amount,
            "source_file": tp.source_file
        } for tp in teller_payments]
        
        sorting_logs = db.query(SortingLog).filter(
            SortingLog.business_date == business_date
        ).all()
        
        result["data"]["sorting_logs"] = [{
            "machine_no": sl.machine_no,
            "operator": sl.operator,
            "serial_number": sl.serial_number,
            "denomination": sl.denomination,
            "bundle_no": sl.bundle_no,
            "sort_result": sl.sort_result
        } for sl in sorting_logs]
        
        bundle_tags = db.query(BundleTag).filter(
            BundleTag.business_date == business_date
        ).all()
        
        result["data"]["bundle_tags"] = [{
            "bundle_no": bt.bundle_no,
            "denomination": bt.denomination,
            "amount": bt.amount,
            "start_serial": bt.start_serial,
            "end_serial": bt.end_serial,
            "operator": bt.operator
        } for bt in bundle_tags]
        
        atm_plans = db.query(ATMPlan).filter(
            ATMPlan.business_date == business_date
        ).all()
        
        result["data"]["atm_plans"] = [{
            "atm_no": ap.atm_no,
            "atm_location": ap.atm_location,
            "box_no": ap.box_no,
            "denomination": ap.denomination,
            "plan_amount": ap.plan_amount,
            "bundle_nos": ap.bundle_nos.split(",") if ap.bundle_nos else []
        } for ap in atm_plans]
        
        bundles = db.query(Bundle).filter(
            Bundle.business_date == business_date
        ).all()
        
        result["data"]["bundles"] = [{
            "bundle_no": b.bundle_no,
            "denomination": b.denomination,
            "quantity": b.quantity,
            "amount": b.amount,
            "teller_no": b.teller_no,
            "source": b.source,
            "status": b.status,
            "is_duplicate": b.is_duplicate
        } for b in bundles]
        
        risk_alerts = db.query(RiskAlert).filter(
            RiskAlert.business_date == business_date
        ).all()
        
        result["risks"] = [{
            "id": ra.id,
            "alert_type": ra.alert_type,
            "alert_code": ra.alert_code,
            "severity": ra.severity,
            "reference_id": ra.reference_id,
            "description": ra.description,
            "expected_value": ra.expected_value,
            "actual_value": ra.actual_value,
            "is_reviewed": ra.is_reviewed,
            "reviewed_by": ra.reviewed_by,
            "review_remark": ra.review_remark
        } for ra in risk_alerts]
        
        audit_logs = db.query(AuditLog).filter(
            AuditLog.business_date == business_date
        ).order_by(AuditLog.created_at).all()
        
        result["audit_logs"] = [{
            "operation_type": al.operation_type,
            "operator": al.operator,
            "details": al.details,
            "created_at": al.created_at.isoformat() if al.created_at else None
        } for al in audit_logs]
        
        result["summary"] = {
            "teller_count": len(set(tp.teller_no for tp in teller_payments)),
            "total_bundles": len(bundles),
            "total_amount": sum(b.amount or 0 for b in bundles),
            "risk_count": len(risk_alerts),
            "pending_risks": len([r for r in risk_alerts if not r.is_reviewed]),
            "reviewed_risks": len([r for r in risk_alerts if r.is_reviewed])
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2)

    @staticmethod
    def save_handover_report(db: Session, business_date: str) -> str:
        content = ExportService.generate_handover_report(db, business_date)
        filename = f"handover_{business_date}_{datetime.now().strftime('%Y%m%d%H%M%S')}.md"
        filepath = os.path.join(EXPORT_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath

    @staticmethod
    def save_audit_json(db: Session, business_date: str) -> str:
        content = ExportService.generate_audit_json(db, business_date)
        filename = f"audit_{business_date}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        filepath = os.path.join(EXPORT_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath
