from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import json

from database import get_db
from models import Stall, Circuit, Generator, DrillRecord, RiskResult, ReviewComment
from risk_calculator import RiskCalculator

router = APIRouter(prefix="/api/export", tags=["export"])


def get_all_data(db: Session) -> Dict[str, Any]:
    stalls = db.query(Stall).all()
    circuits = db.query(Circuit).all()
    generators = db.query(Generator).all()
    drills = db.query(DrillRecord).all()
    risks = db.query(RiskResult).all()
    comments = db.query(ReviewComment).all()
    
    calculator = RiskCalculator(db)
    circuit_loads = {}
    for circuit in circuits:
        circuit_loads[circuit.id] = calculator.calculate_circuit_load(circuit)
    
    return {
        "stalls": stalls,
        "circuits": circuits,
        "generators": generators,
        "drills": drills,
        "risks": risks,
        "comments": comments,
        "circuit_loads": circuit_loads
    }


def stall_to_dict(stall: Stall) -> Dict:
    return {
        "id": stall.id,
        "name": stall.name,
        "location": stall.location,
        "power_required_kw": stall.power_required_kw,
        "circuit_id": stall.circuit_id,
        "is_rain_protected": stall.is_rain_protected,
        "has_rcd_protection": stall.has_rcd_protection,
        "is_critical": stall.is_critical
    }


def circuit_to_dict(circuit: Circuit, load: float = 0.0) -> Dict:
    return {
        "id": circuit.id,
        "name": circuit.name,
        "panel_name": circuit.panel_name,
        "phase": circuit.phase,
        "max_capacity_kw": circuit.max_capacity_kw,
        "current_load_kw": load,
        "load_percentage": (load / circuit.max_capacity_kw * 100) if circuit.max_capacity_kw > 0 else 0,
        "generator_id": circuit.generator_id
    }


def generator_to_dict(generator: Generator) -> Dict:
    return {
        "id": generator.id,
        "name": generator.name,
        "capacity_kw": generator.capacity_kw,
        "redundancy_threshold": generator.redundancy_threshold
    }


def risk_to_dict(risk: RiskResult) -> Dict:
    return {
        "id": risk.id,
        "risk_type": risk.risk_type.value if hasattr(risk.risk_type, 'value') else str(risk.risk_type),
        "description": risk.description,
        "severity": risk.severity.value if hasattr(risk.severity, 'value') else str(risk.severity),
        "status": risk.status.value if hasattr(risk.status, 'value') else str(risk.status),
        "circuit_id": risk.circuit_id,
        "stall_id": risk.stall_id,
        "generator_id": risk.generator_id,
        "calculated_value": risk.calculated_value,
        "threshold_value": risk.threshold_value,
        "manual_override": risk.manual_override,
        "override_reason": risk.override_reason,
        "overridden_by": risk.overridden_by,
        "created_at": risk.created_at.isoformat() if risk.created_at else None,
        "updated_at": risk.updated_at.isoformat() if risk.updated_at else None
    }


@router.get("/json")
def export_json(db: Session = Depends(get_db)):
    data = get_all_data(db)
    
    export_data = {
        "export_time": datetime.utcnow().isoformat(),
        "summary": {
            "stalls_count": len(data["stalls"]),
            "circuits_count": len(data["circuits"]),
            "generators_count": len(data["generators"]),
            "drills_count": len(data["drills"]),
            "risks_count": len(data["risks"])
        },
        "stalls": [stall_to_dict(s) for s in data["stalls"]],
        "circuits": [circuit_to_dict(c, data["circuit_loads"].get(c.id, 0)) for c in data["circuits"]],
        "generators": [generator_to_dict(g) for g in data["generators"]],
        "drills": [{
            "id": d.id,
            "drill_date": d.drill_date.isoformat() if d.drill_date else None,
            "circuits_tested": d.circuits_tested,
            "stages_tested": d.stages_tested,
            "critical_stages": d.critical_stages,
            "notes": d.notes
        } for d in data["drills"]],
        "risks": [risk_to_dict(r) for r in data["risks"]]
    }
    
    return JSONResponse(content=export_data, media_type="application/json")


@router.get("/markdown")
def export_markdown(db: Session = Depends(get_db)):
    data = get_all_data(db)
    
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    md = f"""# 音乐节电力系统风险评估报告

**生成时间**: {now}

---

## 目录
1. [系统概览](#系统概览)
2. [风险统计](#风险统计)
3. [风险详情](#风险详情)
4. [发电机配置](#发电机配置)
5. [回路负载情况](#回路负载情况)
6. [摊位清单](#摊位清单)
7. [停电演练记录](#停电演练记录)

---

## 系统概览

| 类别 | 数量 |
|------|------|
| 发电机 | {len(data["generators"])} |
| 回路 | {len(data["circuits"])} |
| 摊位 | {len(data["stalls"])} |
| 演练记录 | {len(data["drills"])} |
| 风险项 | {len(data["risks"])} |

---

## 风险统计

"""
    
    critical_risks = [r for r in data["risks"] if r.severity.value == "critical"]
    high_risks = [r for r in data["risks"] if r.severity.value == "high"]
    medium_risks = [r for r in data["risks"] if r.severity.value == "medium"]
    low_risks = [r for r in data["risks"] if r.severity.value == "low"]
    open_risks = [r for r in data["risks"] if r.status.value == "open"]
    resolved_risks = [r for r in data["risks"] if r.status.value == "resolved"]
    
    md += f"""### 按严重程度

| 严重程度 | 数量 |
|----------|------|
| 🔴 严重 (Critical) | {len(critical_risks)} |
| 🟠 高危 (High) | {len(high_risks)} |
| 🟡 中危 (Medium) | {len(medium_risks)} |
| 🟢 低危 (Low) | {len(low_risks)} |

### 按状态

| 状态 | 数量 |
|------|------|
| 🔓 待处理 | {len(open_risks)} |
| ✅ 已解决 | {len(resolved_risks)} |

---

## 风险详情

"""
    
    if data["risks"]:
        for idx, risk in enumerate(data["risks"], 1):
            severity_icon = "🔴" if risk.severity.value == "critical" else \
                           "🟠" if risk.severity.value == "high" else \
                           "🟡" if risk.severity.value == "medium" else "🟢"
            status_badge = "🟡 待处理" if risk.status.value == "open" else \
                          "✅ 已解决" if risk.status.value == "resolved" else \
                          "⚠️ 人工覆盖" if risk.status.value == "manual_override" else "❌ 已忽略"
            
            md += f"""### {idx}. {severity_icon} [{risk.risk_type.value}]

**状态**: {status_badge}

**描述**: {risk.description}

"""
            if risk.calculated_value is not None:
                md += f"**计算值**: {risk.calculated_value:.4f}\n"
            if risk.threshold_value is not None:
                md += f"**阈值**: {risk.threshold_value:.4f}\n"
            
            if risk.manual_override:
                md += f"\n**人工覆盖**: ✅\n"
                md += f"**覆盖人**: {risk.overridden_by}\n"
                md += f"**覆盖原因**: {risk.override_reason}\n"
            
            md += "\n---\n\n"
    else:
        md += "✅ 暂无发现的风险项。\n\n---\n\n"
    
    md += """## 发电机配置

"""
    
    if data["generators"]:
        for gen in data["generators"]:
            md += f"""### {gen.name}

- **额定容量**: {gen.capacity_kw} kW
- **冗余阈值**: {gen.redundancy_threshold * 100:.0f}%

"""
    else:
        md += "暂无发电机配置。\n"
    
    md += "\n---\n\n"
    
    md += """## 回路负载情况

| 回路名称 | 配电箱 | 相别 | 额定容量(kW) | 当前负载(kW) | 负载率 |
|----------|--------|------|-------------|-------------|--------|
"""
    
    for circuit in data["circuits"]:
        load = data["circuit_loads"].get(circuit.id, 0)
        capacity = circuit.max_capacity_kw
        load_pct = (load / capacity * 100) if capacity > 0 else 0
        status = "🔴" if load_pct > 90 else "🟠" if load_pct > 80 else "🟢"
        md += f"| {circuit.name} | {circuit.panel_name or '-'} | {circuit.phase or '-'} | {capacity:.2f} | {load:.2f} | {status} {load_pct:.1f}% |\n"
    
    md += "\n---\n\n"
    
    md += """## 摊位清单

| 摊位名称 | 位置 | 需求功率(kW) | 雨棚保护 | 漏保(RCD) | 关键负载 |
|----------|------|-------------|----------|-----------|----------|
"""
    
    for stall in data["stalls"]:
        rain_icon = "✅" if stall.is_rain_protected else "❌"
        rcd_icon = "✅" if stall.has_rcd_protection else "❌"
        critical_icon = "✅" if stall.is_critical else "-"
        md += f"| {stall.name} | {stall.location or '-'} | {stall.power_required_kw:.2f} | {rain_icon} | {rcd_icon} | {critical_icon} |\n"
    
    md += "\n---\n\n"
    
    md += """## 停电演练记录

"""
    
    if data["drills"]:
        for drill in data["drills"]:
            drill_date = drill.drill_date.strftime("%Y-%m-%d") if drill.drill_date else "未知"
            md += f"""### {drill_date} 演练记录

- **测试回路**: {drill.circuits_tested or '无记录'}
- **测试舞台**: {drill.stages_tested or '无记录'}
- **关键舞台**: {drill.critical_stages or '无记录'}
- **备注**: {drill.notes or '无'}

"""
    else:
        md += "暂无停电演练记录。\n"
    
    md += "\n---\n\n"
    md += f"""## 备注

本报告由音乐节电力管理系统自动生成。
- 报告生成时间: {now}
- 如有疑问，请联系电力负责人。

"""
    
    return PlainTextResponse(content=md, media_type="text/markdown")


@router.get("/risks/json")
def export_risks_json(db: Session = Depends(get_db)):
    risks = db.query(RiskResult).all()
    return JSONResponse(
        content={"risks": [risk_to_dict(r) for r in risks]},
        media_type="application/json"
    )


@router.get("/risks/markdown")
def export_risks_markdown(db: Session = Depends(get_db)):
    risks = db.query(RiskResult).all()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    md = f"""# 风险评估报告

**生成时间**: {now}

---

## 风险统计

| 严重程度 | 数量 |
|----------|------|
"""
    
    by_severity = {}
    for risk in risks:
        sev = risk.severity.value
        by_severity[sev] = by_severity.get(sev, 0) + 1
    
    for sev, count in by_severity.items():
        icon = "🔴" if sev == "critical" else "🟠" if sev == "high" else "🟡" if sev == "medium" else "🟢"
        md += f"| {icon} {sev} | {count} |\n"
    
    md += "\n---\n\n## 风险详情\n\n"
    
    for idx, risk in enumerate(risks, 1):
        severity_name = risk.severity.value
        icon = "🔴" if severity_name == "critical" else "🟠" if severity_name == "high" else "🟡" if severity_name == "medium" else "🟢"
        
        md += f"""### {idx}. {icon} [{risk.risk_type.value}]

**严重程度**: {severity_name}
**状态**: {risk.status.value}
**描述**: {risk.description}

"""
        if risk.calculated_value is not None and risk.threshold_value is not None:
            md += f"- **计算值**: {risk.calculated_value:.4f}\n"
            md += f"- **阈值**: {risk.threshold_value:.4f}\n"
        
        if risk.manual_override:
            md += f"- **人工覆盖**: 是 (by {risk.overridden_by})\n"
            md += f"- **覆盖原因**: {risk.override_reason}\n"
        
        md += "\n---\n\n"
    
    return PlainTextResponse(content=md, media_type="text/markdown")
