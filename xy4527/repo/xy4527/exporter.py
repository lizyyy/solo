import json
from datetime import datetime
from typing import List, Any, Dict
from database import RingRecord, RiskStatus


class Exporter:
    
    RISK_DISPLAY = {
        RiskStatus.NORMAL: ("正常", "✅"),
        RiskStatus.WARNING: ("警告", "⚠️"),
        RiskStatus.CRITICAL: ("严重", "🚨")
    }
    
    @classmethod
    def get_risk_text(cls, risk: RiskStatus) -> str:
        return cls.RISK_DISPLAY.get(risk, ("未知", "❓"))[0]
    
    @classmethod
    def get_risk_icon(cls, risk: RiskStatus) -> str:
        return cls.RISK_DISPLAY.get(risk, ("未知", "❓"))[1]
    
    @classmethod
    def export_markdown_handover(cls, records: List[RingRecord], shift_info: Dict[str, Any] = None) -> str:
        shift_info = shift_info or {}
        shift_date = shift_info.get("date", datetime.now().strftime("%Y-%m-%d"))
        shift_name = shift_info.get("shift", "白班")
        operator = shift_info.get("operator", "测量员")
        
        lines = []
        
        lines.append(f"# 盾构施工测量交班单")
        lines.append("")
        lines.append(f"**日期**: {shift_date}")
        lines.append(f"**班次**: {shift_name}")
        lines.append(f"**操作员**: {operator}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        critical_count = sum(1 for r in records if r.overall_risk == RiskStatus.CRITICAL)
        warning_count = sum(1 for r in records if r.overall_risk == RiskStatus.WARNING)
        normal_count = sum(1 for r in records if r.overall_risk == RiskStatus.NORMAL)
        
        lines.append("## 风险概览")
        lines.append("")
        lines.append(f"| 风险等级 | 数量 | 状态 |")
        lines.append(f"|----------|------|------|")
        lines.append(f"| 🚨 严重 | {critical_count} 环 | {'需立即处理' if critical_count > 0 else '无'} |")
        lines.append(f"| ⚠️ 警告 | {warning_count} 环 | {'需关注' if warning_count > 0 else '无'} |")
        lines.append(f"| ✅ 正常 | {normal_count} 环 | 正常 |")
        lines.append("")
        
        if critical_count > 0 or warning_count > 0:
            lines.append("---")
            lines.append("")
            lines.append("## 风险环详情")
            lines.append("")
            
            for record in records:
                if record.overall_risk in [RiskStatus.CRITICAL, RiskStatus.WARNING]:
                    lines.append(f"### 环号 {record.ring_number} - {cls.get_risk_icon(record.overall_risk)} {cls.get_risk_text(record.overall_risk)}")
                    lines.append("")
                    
                    lines.append("#### 风险评估")
                    lines.append("")
                    lines.append(f"| 风险类型 | 等级 | 详情 |")
                    lines.append(f"|----------|------|------|")
                    lines.append(f"| 管片错台 | {cls.get_risk_icon(record.misalignment_risk)} {cls.get_risk_text(record.misalignment_risk)} | {record.misalignment_details or '-'} |")
                    lines.append(f"| 姿态超限 | {cls.get_risk_icon(record.attitude_risk)} {cls.get_risk_text(record.attitude_risk)} | {record.attitude_details or '-'} |")
                    lines.append(f"| 注浆不足 | {cls.get_risk_icon(record.grouting_risk)} {cls.get_risk_text(record.grouting_risk)} | {record.grouting_details or '-'} |")
                    lines.append(f"| 复测缺口 | {cls.get_risk_icon(record.recheck_gap_risk)} {cls.get_risk_text(record.recheck_gap_risk)} | {record.recheck_gap_details or '-'} |")
                    lines.append("")
                    
                    if record.manual_review_note:
                        lines.append("#### 人工复核备注")
                        lines.append("")
                        lines.append(f"> {record.manual_review_note}")
                        lines.append("")
                    
                    if record.manual_override:
                        lines.append(f"**人工改判**: {cls.get_risk_icon(record.manual_override)} {cls.get_risk_text(record.manual_override)}")
                        lines.append("")
                    
                    lines.append("---")
                    lines.append("")
        
        lines.append("## 全部环号列表")
        lines.append("")
        lines.append(f"| 环号 | 整体风险 | 错台 | 姿态 | 注浆 | 复测 | 复核状态 |")
        lines.append(f"|------|----------|------|------|------|------|----------|")
        
        for record in sorted(records, key=lambda x: x.ring_number):
            has_manual_note = "已复核" if record.manual_review_note else "未复核"
            lines.append(
                f"| {record.ring_number} | "
                f"{cls.get_risk_icon(record.overall_risk)} {cls.get_risk_text(record.overall_risk)} | "
                f"{cls.get_risk_icon(record.misalignment_risk)} | "
                f"{cls.get_risk_icon(record.attitude_risk)} | "
                f"{cls.get_risk_icon(record.grouting_risk)} | "
                f"{cls.get_risk_icon(record.recheck_gap_risk)} | "
                f"{has_manual_note} |"
            )
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 交班备注")
        lines.append("")
        lines.append("___")
        lines.append("")
        lines.append("**交班人**: _______________")
        lines.append("")
        lines.append("**接班人**: _______________")
        lines.append("")
        lines.append(f"**交班时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
        return "\n".join(lines)
    
    @classmethod
    def export_json_audit(cls, records: List[RingRecord]) -> str:
        audit_data = {
            "export_time": datetime.now().isoformat(),
            "total_rings": len(records),
            "risk_summary": {
                "critical": sum(1 for r in records if r.overall_risk == RiskStatus.CRITICAL),
                "warning": sum(1 for r in records if r.overall_risk == RiskStatus.WARNING),
                "normal": sum(1 for r in records if r.overall_risk == RiskStatus.NORMAL)
            },
            "ring_details": []
        }
        
        for record in sorted(records, key=lambda x: x.ring_number):
            ring_info = {
                "ring_number": record.ring_number,
                "risks": {
                    "overall": {
                        "status": record.overall_risk.value if record.overall_risk else None,
                        "manual_override": record.manual_override.value if record.manual_override else None
                    },
                    "misalignment": {
                        "status": record.misalignment_risk.value if record.misalignment_risk else None,
                        "details": record.misalignment_details
                    },
                    "attitude": {
                        "status": record.attitude_risk.value if record.attitude_risk else None,
                        "details": record.attitude_details
                    },
                    "grouting": {
                        "status": record.grouting_risk.value if record.grouting_risk else None,
                        "details": record.grouting_details
                    },
                    "recheck_gap": {
                        "status": record.recheck_gap_risk.value if record.recheck_gap_risk else None,
                        "details": record.recheck_gap_details
                    }
                },
                "raw_data": {
                    "segment_layout": json.loads(record.segment_layout) if record.segment_layout else None,
                    "jack_stroke": json.loads(record.jack_stroke) if record.jack_stroke else None,
                    "grouting_volume": record.grouting_volume,
                    "measurement_deviation": json.loads(record.measurement_deviation) if record.measurement_deviation else None
                },
                "review": {
                    "note": record.manual_review_note,
                    "has_manual_review": record.manual_review_note is not None
                },
                "timestamps": {
                    "created_at": record.created_at.isoformat() if record.created_at else None,
                    "updated_at": record.updated_at.isoformat() if record.updated_at else None,
                    "analyzed_at": record.analyzed_at.isoformat() if record.analyzed_at else None
                }
            }
            audit_data["ring_details"].append(ring_info)
        
        return json.dumps(audit_data, ensure_ascii=False, indent=2)
