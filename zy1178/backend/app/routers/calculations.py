from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json

from app.database import get_db
from app.models import Project, Roof, Obstacle, Panel, HourlyData, Layout, CalculationResult
from app.schemas import CalculationRequest, CalculationResultResponse
from app.calculators.shading import ShadingCalculator
from app.calculators.generation import GenerationCalculator
from app.calculators.revenue import RevenueCalculator

router = APIRouter()

@router.post("/run", response_model=CalculationResultResponse)
def run_calculation(request: CalculationRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    layout = db.query(Layout).filter(Layout.id == request.layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    roofs = db.query(Roof).filter(Roof.project_id == project.id).all()
    if not roofs:
        raise HTTPException(status_code=400, detail="未找到屋顶数据")
    
    obstacles = db.query(Obstacle).filter(Obstacle.project_id == project.id).all()
    panels = db.query(Panel).filter(Panel.project_id == project.id).all()
    hourly_data = db.query(HourlyData).filter(HourlyData.project_id == project.id).order_by(HourlyData.timestamp).all()
    
    if not panels:
        raise HTTPException(status_code=400, detail="未找到组件参数")
    
    if not hourly_data:
        raise HTTPException(status_code=400, detail="未找到逐小时数据")
    
    panel = panels[0]
    roof = roofs[0]
    
    obstacles_data = []
    for obs in obstacles:
        obstacles_data.append({
            'coordinates': json.loads(obs.coordinates),
            'height': obs.height,
            'type': obs.type
        })
    
    roof_coords = json.loads(roof.coordinates)
    
    shading_calc = ShadingCalculator(
        latitude=project.latitude or 30.0,
        longitude=project.longitude or 120.0
    )
    
    panel_positions = json.loads(layout.panel_positions)
    shading_result = shading_calc.calculate_annual_shading_hours(
        panel_positions=panel_positions,
        obstacles=obstacles_data,
        panel_width=panel.width,
        panel_height=panel.height
    )
    
    shading_map = shading_calc.generate_shading_map(
        roof_coords=roof_coords,
        obstacles=obstacles_data,
        grid_size=0.5
    )
    
    gen_calc = GenerationCalculator()
    
    capacity_result = gen_calc.calculate_installable_capacity(
        roof_area=roof.area,
        panel_width=panel.width,
        panel_height=panel.height,
        panel_power=panel.power,
        spacing_ratio=0.1
    )
    
    installable_capacity = capacity_result['installable_capacity_kw']
    actual_capacity = layout.total_power / 1000
    
    hourly_data_list = []
    for hd in hourly_data:
        hourly_data_list.append({
            'timestamp': hd.timestamp.isoformat() if hd.timestamp else None,
            'global_irradiance': hd.global_irradiance,
            'direct_irradiance': hd.direct_irradiance,
            'diffuse_irradiance': hd.diffuse_irradiance,
            'temperature': hd.temperature,
            'wind_speed': hd.wind_speed,
            'electricity_price': hd.electricity_price,
            'feed_in_tariff': hd.feed_in_tariff
        })
    
    shading_loss_ratio = shading_result.get('shading_loss_ratio', 0)
    
    gen_result = gen_calc.calculate_hourly_generation(
        hourly_data=hourly_data_list,
        panel_params={
            'power': panel.power,
            'efficiency': panel.efficiency,
            'temperature_coefficient': panel.temperature_coefficient,
            'count': layout.panel_count
        },
        shading_ratios={i: shading_loss_ratio for i in range(len(hourly_data_list))},
        roof_inclination=roof.inclination
    )
    
    annual_generation = gen_result['total_kwh']
    monthly_generation = gen_result['monthly_generation']
    
    rev_calc = RevenueCalculator()
    
    rev_result = rev_calc.calculate_hourly_revenue(
        hourly_data=hourly_data_list,
        hourly_generation=gen_result['hourly_details'],
        self_consumption_ratio=0.7
    )
    
    annual_revenue = rev_result['total_revenue']
    monthly_revenue = rev_result['monthly_revenue']
    
    initial_investment = actual_capacity * request.investment_per_kw * 1000
    
    financial_result = rev_calc.calculate_financial_metrics(
        initial_investment=initial_investment,
        annual_revenue=annual_revenue,
        lifetime=panel.lifetime,
        discount_rate=request.discount_rate
    )
    
    risk_factors = rev_calc.calculate_risk_factors(
        shading_loss_ratio=shading_loss_ratio,
        installable_capacity=installable_capacity,
        actual_capacity=actual_capacity,
        annual_generation=annual_generation,
        payback_period=financial_result.get('payback_period_years'),
        location=project.location or ''
    )
    
    calculation_result = CalculationResult(
        project_id=project.id,
        layout_id=layout.id,
        shading_map=json.dumps(shading_map),
        shading_hours=shading_result.get('total_shading_hours', 0),
        shading_loss_ratio=shading_loss_ratio,
        installable_capacity=installable_capacity,
        actual_capacity=actual_capacity,
        annual_generation=annual_generation,
        monthly_generation=json.dumps(monthly_generation),
        annual_revenue=annual_revenue,
        monthly_revenue=json.dumps(monthly_revenue),
        initial_investment=initial_investment,
        payback_period=financial_result.get('payback_period_years'),
        net_present_value=financial_result.get('net_present_value'),
        internal_rate_of_return=financial_result.get('internal_rate_of_return'),
        risk_factors=json.dumps(risk_factors)
    )
    
    db.add(calculation_result)
    db.commit()
    db.refresh(calculation_result)
    
    response = CalculationResultResponse(
        id=calculation_result.id,
        project_id=calculation_result.project_id,
        layout_id=calculation_result.layout_id,
        shading_map=json.loads(calculation_result.shading_map) if calculation_result.shading_map else None,
        shading_hours=calculation_result.shading_hours,
        shading_loss_ratio=calculation_result.shading_loss_ratio,
        installable_capacity=calculation_result.installable_capacity,
        actual_capacity=calculation_result.actual_capacity,
        annual_generation=calculation_result.annual_generation,
        monthly_generation=json.loads(calculation_result.monthly_generation) if calculation_result.monthly_generation else None,
        annual_revenue=calculation_result.annual_revenue,
        monthly_revenue=json.loads(calculation_result.monthly_revenue) if calculation_result.monthly_revenue else None,
        initial_investment=calculation_result.initial_investment,
        payback_period=calculation_result.payback_period,
        net_present_value=calculation_result.net_present_value,
        internal_rate_of_return=calculation_result.internal_rate_of_return,
        risk_factors=json.loads(calculation_result.risk_factors) if calculation_result.risk_factors else None,
        created_at=calculation_result.created_at
    )
    
    return response

@router.get("/results/{result_id}", response_model=CalculationResultResponse)
def get_calculation_result(result_id: int, db: Session = Depends(get_db)):
    result = db.query(CalculationResult).filter(CalculationResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="计算结果不存在")
    
    response = CalculationResultResponse(
        id=result.id,
        project_id=result.project_id,
        layout_id=result.layout_id,
        shading_map=json.loads(result.shading_map) if result.shading_map else None,
        shading_hours=result.shading_hours,
        shading_loss_ratio=result.shading_loss_ratio,
        installable_capacity=result.installable_capacity,
        actual_capacity=result.actual_capacity,
        annual_generation=result.annual_generation,
        monthly_generation=json.loads(result.monthly_generation) if result.monthly_generation else None,
        annual_revenue=result.annual_revenue,
        monthly_revenue=json.loads(result.monthly_revenue) if result.monthly_revenue else None,
        initial_investment=result.initial_investment,
        payback_period=result.payback_period,
        net_present_value=result.net_present_value,
        internal_rate_of_return=result.internal_rate_of_return,
        risk_factors=json.loads(result.risk_factors) if result.risk_factors else None,
        created_at=result.created_at
    )
    
    return response

@router.get("/project/{project_id}/results", response_model=List[CalculationResultResponse])
def list_project_results(project_id: int, db: Session = Depends(get_db)):
    results = db.query(CalculationResult).filter(CalculationResult.project_id == project_id).all()
    
    response_list = []
    for result in results:
        response = CalculationResultResponse(
            id=result.id,
            project_id=result.project_id,
            layout_id=result.layout_id,
            shading_map=json.loads(result.shading_map) if result.shading_map else None,
            shading_hours=result.shading_hours,
            shading_loss_ratio=result.shading_loss_ratio,
            installable_capacity=result.installable_capacity,
            actual_capacity=result.actual_capacity,
            annual_generation=result.annual_generation,
            monthly_generation=json.loads(result.monthly_generation) if result.monthly_generation else None,
            annual_revenue=result.annual_revenue,
            monthly_revenue=json.loads(result.monthly_revenue) if result.monthly_revenue else None,
            initial_investment=result.initial_investment,
            payback_period=result.payback_period,
            net_present_value=result.net_present_value,
            internal_rate_of_return=result.internal_rate_of_return,
            risk_factors=json.loads(result.risk_factors) if result.risk_factors else None,
            created_at=result.created_at
        )
        response_list.append(response)
    
    return response_list
