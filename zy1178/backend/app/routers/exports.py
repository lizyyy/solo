from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
from datetime import datetime

from app.database import get_db
from app.models import Project, Layout, CalculationResult, Roof, Panel, Obstacle
from app.schemas import ExportRequest, ExportFormat

router = APIRouter()

@router.post("/report")
def export_report(request: ExportRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    results = []
    for layout_id in request.layout_ids:
        result = db.query(CalculationResult).filter(
            CalculationResult.project_id == project.id,
            CalculationResult.layout_id == layout_id
        ).order_by(CalculationResult.created_at.desc()).first()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"方案 {layout_id} 未找到计算结果")
        
        layout = db.query(Layout).filter(Layout.id == layout_id).first()
        results.append({
            'layout': layout,
            'result': result
        })
    
    roof = db.query(Roof).filter(Roof.project_id == project.id).first()
    panel = db.query(Panel).filter(Panel.project_id == project.id).first()
    obstacles = db.query(Obstacle).filter(Obstacle.project_id == project.id).all()
    
    if request.format == ExportFormat.json:
        return generate_json_report(project, results, roof, panel, obstacles)
    else:
        return generate_markdown_report(project, results, roof, panel, obstacles, request.include_charts)

def generate_json_report(project: Project, results: List[Dict], roof, panel, obstacles):
    report_data = {
        'project': {
            'id': project.id,
            'name': project.name,
            'description': project.description,
            'location': project.location,
            'latitude': project.latitude,
            'longitude': project.longitude,
            'created_at': project.created_at.isoformat() if project.created_at else None
        },
        'roof': None,
        'panel': None,
        'obstacles': [],
        'layouts': [],
        'generated_at': datetime.now().isoformat()
    }
    
    if roof:
        report_data['roof'] = {
            'name': roof.name,
            'area': roof.area,
            'inclination': roof.inclination,
            'azimuth': roof.azimuth
        }
    
    if panel:
        report_data['panel'] = {
            'model': panel.model,
            'power': panel.power,
            'efficiency': panel.efficiency,
            'width': panel.width,
            'height': panel.height,
            'temperature_coefficient': panel.temperature_coefficient,
            'lifetime': panel.lifetime
        }
    
    for obs in obstacles:
        report_data['obstacles'].append({
            'name': obs.name,
            'height': obs.height,
            'type': obs.type
        })
    
    for item in results:
        layout = item['layout']
        result = item['result']
        layout_data = {
            'layout_id': layout.id,
            'layout_name': layout.name,
            'panel_count': layout.panel_count,
            'total_power': layout.total_power,
            'calculation': {
                'shading_hours': result.shading_hours,
                'shading_loss_ratio': result.shading_loss_ratio,
                'installable_capacity': result.installable_capacity,
                'actual_capacity': result.actual_capacity,
                'annual_generation': result.annual_generation,
                'monthly_generation': json.loads(result.monthly_generation) if result.monthly_generation else None,
                'annual_revenue': result.annual_revenue,
                'monthly_revenue': json.loads(result.monthly_revenue) if result.monthly_revenue else None,
                'initial_investment': result.initial_investment,
                'payback_period': result.payback_period,
                'net_present_value': result.net_present_value,
                'internal_rate_of_return': result.internal_rate_of_return,
                'risk_factors': json.loads(result.risk_factors) if result.risk_factors else None
            }
        }
        report_data['layouts'].append(layout_data)
    
    return JSONResponse(content=report_data)

def generate_markdown_report(project: Project, results: List[Dict], roof, panel, obstacles, include_charts: bool):
    lines = []
    
    lines.append(f'# 屋顶光伏排布和收益分析报告')
    lines.append(f'')
    lines.append(f'**项目名称**: {project.name}')
    if project.location:
        lines.append(f'**位置**: {project.location}')
    lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    lines.append(f'')
    
    lines.append(f'## 一、项目基本信息')
    lines.append(f'')
    
    if roof:
        lines.append(f'### 1.1 屋顶信息')
        lines.append(f'')
        lines.append(f'| 参数 | 值 |')
        lines.append(f'|------|-----|')
        lines.append(f'| 名称 | {roof.name} |')
        lines.append(f'| 面积 | {roof.area:.2f} ㎡ |')
        lines.append(f'| 倾角 | {roof.inclination}° |')
        lines.append(f'| 方位角 | {roof.azimuth}° |')
        lines.append(f'')
    
    if panel:
        lines.append(f'### 1.2 光伏组件参数')
        lines.append(f'')
        lines.append(f'| 参数 | 值 |')
        lines.append(f'|------|-----|')
        lines.append(f'| 型号 | {panel.model} |')
        lines.append(f'| 功率 | {panel.power} W |')
        lines.append(f'| 效率 | {panel.efficiency*100:.1f}% |')
        lines.append(f'| 尺寸 | {panel.width}m x {panel.height}m |')
        lines.append(f'| 温度系数 | {panel.temperature_coefficient} %/°C |')
        lines.append(f'| 设计寿命 | {panel.lifetime} 年 |')
        lines.append(f'')
    
    if obstacles:
        lines.append(f'### 1.3 障碍物信息')
        lines.append(f'')
        lines.append(f'| 名称 | 高度 | 类型 |')
        lines.append(f'|------|------|------|')
        for obs in obstacles:
            lines.append(f'| {obs.name} | {obs.height}m | {obs.type} |')
        lines.append(f'')
    
    lines.append(f'## 二、方案对比分析')
    lines.append(f'')
    
    if len(results) > 1:
        lines.append(f'### 2.1 关键指标对比')
        lines.append(f'')
        headers = ['指标']
        for item in results:
            headers.append(item['layout'].name)
        lines.append(f'| {" | ".join(headers)} |')
        lines.append(f'|{"------|" * len(headers)}')
        
        metrics = [
            ('组件数量', lambda r: f"{r['layout'].panel_count} 块"),
            ('总装机容量', lambda r: f"{r['layout'].total_power/1000:.2f} kW"),
            ('年发电量', lambda r: f"{r['result'].annual_generation:.2f} kWh"),
            ('年收益', lambda r: f"{r['result'].annual_revenue:.2f} 元"),
            ('初始投资', lambda r: f"{r['result'].initial_investment:.2f} 元" if r['result'].initial_investment else 'N/A'),
            ('投资回收期', lambda r: f"{r['result'].payback_period:.1f} 年" if r['result'].payback_period else 'N/A'),
            ('遮阴损失率', lambda r: f"{r['result'].shading_loss_ratio*100:.1f}%"),
        ]
        
        for metric_name, metric_func in metrics:
            row = [metric_name]
            for item in results:
                row.append(metric_func(item))
            lines.append(f'| {" | ".join(row)} |')
        lines.append(f'')
    
    for i, item in enumerate(results, 1):
        layout = item['layout']
        result = item['result']
        
        lines.append(f'---')
        lines.append(f'')
        lines.append(f'## 方案 {i}: {layout.name}')
        lines.append(f'')
        
        lines.append(f'### 排布信息')
        lines.append(f'')
        lines.append(f'- **组件数量**: {layout.panel_count} 块')
        lines.append(f'- **总装机容量**: {layout.total_power / 1000:.2f} kW')
        lines.append(f'')
        
        lines.append(f'### 遮阴分析')
        lines.append(f'')
        lines.append(f'- **年遮阴小时数**: {result.shading_hours:.0f} 小时')
        lines.append(f'- **遮阴损失率**: {result.shading_loss_ratio * 100:.1f}%')
        lines.append(f'')
        
        lines.append(f'### 容量分析')
        lines.append(f'')
        lines.append(f'- **理论可安装容量**: {result.installable_capacity:.2f} kW')
        lines.append(f'- **实际装机容量**: {result.actual_capacity:.2f} kW')
        lines.append(f'- **面积利用率**: {result.actual_capacity / result.installable_capacity * 100:.1f}%')
        lines.append(f'')
        
        lines.append(f'### 发电量分析')
        lines.append(f'')
        lines.append(f'- **年发电量**: {result.annual_generation:.2f} kWh')
        lines.append(f'- **单位容量发电量**: {result.annual_generation / result.actual_capacity:.0f} kWh/kWp/年')
        lines.append(f'')
        
        if result.monthly_generation:
            monthly_gen = json.loads(result.monthly_generation)
            lines.append(f'**月度发电量**:')
            lines.append(f'')
            months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
            lines.append(f'| 月份 | 发电量 (kWh) |')
            lines.append(f'|------|--------------|')
            for j, (month, gen) in enumerate(zip(months, monthly_gen)):
                lines.append(f'| {month} | {gen:.2f} |')
            lines.append(f'')
        
        lines.append(f'### 收益分析')
        lines.append(f'')
        lines.append(f'- **年收益**: {result.annual_revenue:.2f} 元')
        lines.append(f'')
        
        if result.monthly_revenue:
            monthly_rev = json.loads(result.monthly_revenue)
            lines.append(f'**月度收益**:')
            lines.append(f'')
            months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
            lines.append(f'| 月份 | 收益 (元) |')
            lines.append(f'|------|-----------|')
            for j, (month, rev) in enumerate(zip(months, monthly_rev)):
                lines.append(f'| {month} | {rev:.2f} |')
            lines.append(f'')
        
        lines.append(f'### 财务指标')
        lines.append(f'')
        lines.append(f'- **初始投资**: {result.initial_investment:.2f} 元' if result.initial_investment else '- **初始投资**: N/A')
        lines.append(f'- **投资回收期**: {result.payback_period:.1f} 年' if result.payback_period else '- **投资回收期**: N/A')
        lines.append(f'- **净现值 (NPV)**: {result.net_present_value:.2f} 元' if result.net_present_value else '- **净现值 (NPV)**: N/A')
        lines.append(f'- **内部收益率 (IRR)**: {result.internal_rate_of_return*100:.2f}%' if result.internal_rate_of_return else '- **内部收益率 (IRR)**: N/A')
        lines.append(f'')
        
        if result.risk_factors:
            risks = json.loads(result.risk_factors)
            if risks:
                lines.append(f'### 风险提示')
                lines.append(f'')
                for risk in risks:
                    severity_icon = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(risk.get('severity', 'low'), '⚪')
                    lines.append(f'{severity_icon} **{risk.get("type", "unknown")}** ({risk.get("severity", "low")})')
                    lines.append(f'')
                    lines.append(f'  - 描述: {risk.get("description", "")}')
                    if risk.get('suggestion'):
                        lines.append(f'  - 建议: {risk.get("suggestion")}')
                    lines.append(f'')
    
    lines.append(f'---')
    lines.append(f'')
    lines.append(f'*报告由屋顶光伏排布和收益模拟工具自动生成*')
    
    return PlainTextResponse(content='\n'.join(lines), media_type='text/markdown')
