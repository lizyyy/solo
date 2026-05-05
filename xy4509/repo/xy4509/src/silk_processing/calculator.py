from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
import math
from dataclasses import dataclass

from .models import (
    CocoonBatch,
    MoistureInspection,
    CookingCurve,
    BreakageRecord,
    DeliveryRecord,
    ProcessCalculation,
    BatchProcessData,
    CocoonGrade,
    BreakageSeverity,
)


@dataclass
class GradeParams:
    """蚕茧等级参数配置"""
    grade: CocoonGrade
    base_cooking_temp: float
    base_cooking_time_min: float
    base_filature_rate: float
    moisture_optimal_min: float
    moisture_optimal_max: float
    breakage_threshold: float


GRADE_PARAMS: Dict[CocoonGrade, GradeParams] = {
    CocoonGrade.GRADE_6A: GradeParams(
        grade=CocoonGrade.GRADE_6A,
        base_cooking_temp=98.0,
        base_cooking_time_min=12.0,
        base_filature_rate=42.0,
        moisture_optimal_min=11.0,
        moisture_optimal_max=13.0,
        breakage_threshold=0.3,
    ),
    CocoonGrade.GRADE_5A: GradeParams(
        grade=CocoonGrade.GRADE_5A,
        base_cooking_temp=97.0,
        base_cooking_time_min=13.0,
        base_filature_rate=40.0,
        moisture_optimal_min=11.5,
        moisture_optimal_max=13.5,
        breakage_threshold=0.4,
    ),
    CocoonGrade.GRADE_4A: GradeParams(
        grade=CocoonGrade.GRADE_4A,
        base_cooking_temp=96.0,
        base_cooking_time_min=14.0,
        base_filature_rate=38.0,
        moisture_optimal_min=12.0,
        moisture_optimal_max=14.0,
        breakage_threshold=0.5,
    ),
    CocoonGrade.GRADE_3A: GradeParams(
        grade=CocoonGrade.GRADE_3A,
        base_cooking_temp=95.0,
        base_cooking_time_min=15.0,
        base_filature_rate=36.0,
        moisture_optimal_min=12.0,
        moisture_optimal_max=14.5,
        breakage_threshold=0.6,
    ),
    CocoonGrade.GRADE_2A: GradeParams(
        grade=CocoonGrade.GRADE_2A,
        base_cooking_temp=94.0,
        base_cooking_time_min=16.0,
        base_filature_rate=34.0,
        moisture_optimal_min=12.5,
        moisture_optimal_max=15.0,
        breakage_threshold=0.7,
    ),
    CocoonGrade.GRADE_1A: GradeParams(
        grade=CocoonGrade.GRADE_1A,
        base_cooking_temp=93.0,
        base_cooking_time_min=17.0,
        base_filature_rate=32.0,
        moisture_optimal_min=12.5,
        moisture_optimal_max=15.5,
        breakage_threshold=0.8,
    ),
    CocoonGrade.GRADE_A: GradeParams(
        grade=CocoonGrade.GRADE_A,
        base_cooking_temp=92.0,
        base_cooking_time_min=18.0,
        base_filature_rate=30.0,
        moisture_optimal_min=13.0,
        moisture_optimal_max=16.0,
        breakage_threshold=0.9,
    ),
    CocoonGrade.GRADE_B: GradeParams(
        grade=CocoonGrade.GRADE_B,
        base_cooking_temp=90.0,
        base_cooking_time_min=20.0,
        base_filature_rate=27.0,
        moisture_optimal_min=13.0,
        moisture_optimal_max=16.5,
        breakage_threshold=1.0,
    ),
    CocoonGrade.GRADE_C: GradeParams(
        grade=CocoonGrade.GRADE_C,
        base_cooking_temp=88.0,
        base_cooking_time_min=22.0,
        base_filature_rate=24.0,
        moisture_optimal_min=13.5,
        moisture_optimal_max=17.0,
        breakage_threshold=1.2,
    ),
    CocoonGrade.GRADE_D: GradeParams(
        grade=CocoonGrade.GRADE_D,
        base_cooking_temp=86.0,
        base_cooking_time_min=25.0,
        base_filature_rate=20.0,
        moisture_optimal_min=14.0,
        moisture_optimal_max=18.0,
        breakage_threshold=1.5,
    ),
}


def get_grade_params(grade: CocoonGrade) -> GradeParams:
    """获取蚕茧等级参数"""
    return GRADE_PARAMS.get(grade, GRADE_PARAMS[CocoonGrade.GRADE_C])


def calculate_water_supplement(
    batch_weight_kg: float,
    current_moisture: float,
    target_moisture: float,
) -> Tuple[float, List[Dict[str, Any]], List[str]]:
    """
    计算补水量
    
    Args:
        batch_weight_kg: 批次总重量(kg)
        current_moisture: 当前含水率(%)
        target_moisture: 目标含水率(%)
    
    Returns:
        Tuple[补水量(kg), 异常数据列表, 警告信息列表]
    """
    anomalies = []
    warnings = []
    
    if current_moisture <= 0 or current_moisture >= 100:
        anomalies.append({
            "type": "moisture_invalid",
            "value": current_moisture,
            "message": f"当前含水率 {current_moisture}% 超出有效范围(0-100%)",
            "severity": "high",
        })
        return 0.0, anomalies, warnings
    
    if target_moisture <= 0 or target_moisture >= 100:
        anomalies.append({
            "type": "target_moisture_invalid",
            "value": target_moisture,
            "message": f"目标含水率 {target_moisture}% 超出有效范围(0-100%)",
            "severity": "high",
        })
        return 0.0, anomalies, warnings
    
    if current_moisture > target_moisture:
        warnings.append(
            f"当前含水率({current_moisture:.1f}%)高于目标含水率({target_moisture:.1f}%)，无需补水"
        )
        return 0.0, anomalies, warnings
    
    if target_moisture > 20:
        warnings.append(
            f"目标含水率({target_moisture:.1f}%)偏高，可能影响煮茧质量"
        )
    
    if target_moisture < 8:
        warnings.append(
            f"目标含水率({target_moisture:.1f}%)偏低，可能增加断头风险"
        )
    
    dry_weight = batch_weight_kg * (1 - current_moisture / 100)
    target_total_weight = dry_weight / (1 - target_moisture / 100)
    water_supplement = max(0, target_total_weight - batch_weight_kg)
    
    if water_supplement > batch_weight_kg * 0.3:
        anomalies.append({
            "type": "water_supplement_high",
            "value": water_supplement,
            "message": f"补水量({water_supplement:.2f}kg)超过批次重量的30%，请确认参数",
            "severity": "medium",
        })
    
    return water_supplement, anomalies, warnings


def calculate_cooking_params(
    grade: CocoonGrade,
    current_moisture: float,
    historical_curves: List[CookingCurve] = None,
) -> Tuple[Dict[str, float], List[Dict[str, Any]], List[str]]:
    """
    计算煮茧参数建议
    
    Args:
        grade: 蚕茧等级
        current_moisture: 当前含水率(%)
        historical_curves: 历史温度曲线数据
    
    Returns:
        Tuple[参数字典, 异常数据列表, 警告信息列表]
    """
    anomalies = []
    warnings = []
    
    params = get_grade_params(grade)
    
    if current_moisture < params.moisture_optimal_min:
        moisture_diff = params.moisture_optimal_min - current_moisture
        temp_adjust = moisture_diff * 0.3
        time_adjust = moisture_diff * 0.8
        warnings.append(
            f"含水率({current_moisture:.1f}%)低于最优范围({params.moisture_optimal_min:.1f}%-{params.moisture_optimal_max:.1f}%)，建议适当延长煮茧时间"
        )
    elif current_moisture > params.moisture_optimal_max:
        moisture_diff = current_moisture - params.moisture_optimal_max
        temp_adjust = -moisture_diff * 0.2
        time_adjust = -moisture_diff * 0.5
        warnings.append(
            f"含水率({current_moisture:.1f}%)高于最优范围({params.moisture_optimal_min:.1f}%-{params.moisture_optimal_max:.1f}%)，建议适当缩短煮茧时间"
        )
    else:
        temp_adjust = 0.0
        time_adjust = 0.0
    
    recommended_temp = params.base_cooking_temp + temp_adjust
    recommended_time = params.base_cooking_time_min + time_adjust
    
    if historical_curves and len(historical_curves) > 0:
        avg_temp = sum(c.max_temperature or 0 for c in historical_curves) / len(historical_curves)
        avg_time = sum(c.total_cooking_time_min or 0 for c in historical_curves) / len(historical_curves)
        
        if avg_temp > 0:
            recommended_temp = (recommended_temp + avg_temp) / 2
        if avg_time > 0:
            recommended_time = (recommended_time + avg_time) / 2
    
    soaking_time = max(20, 30 + (12 - current_moisture) * 2)
    steam_pressure = 0.15 + (recommended_temp - 90) * 0.005
    
    if recommended_temp > 100:
        anomalies.append({
            "type": "temperature_too_high",
            "value": recommended_temp,
            "message": f"建议煮茧温度({recommended_temp:.1f}℃)超过100℃，请检查参数",
            "severity": "high",
        })
    
    if recommended_temp < 80:
        anomalies.append({
            "type": "temperature_too_low",
            "value": recommended_temp,
            "message": f"建议煮茧温度({recommended_temp:.1f}℃)低于80℃，可能影响煮茧效果",
            "severity": "medium",
        })
    
    if recommended_time > 30:
        warnings.append(
            f"建议煮茧时间({recommended_time:.1f}分钟)较长，请确认是否合适"
        )
    
    return {
        "recommended_cooking_temp": round(recommended_temp, 1),
        "recommended_cooking_time_min": round(recommended_time, 1),
        "soaking_time_min": round(soaking_time, 1),
        "steam_pressure": round(steam_pressure, 3),
    }, anomalies, warnings


def estimate_filature_rate(
    grade: CocoonGrade,
    current_moisture: float,
    batch_weight_kg: float,
    historical_deliveries: List[DeliveryRecord] = None,
) -> Tuple[float, float, List[Dict[str, Any]], List[str]]:
    """
    预估出丝率
    
    Args:
        grade: 蚕茧等级
        current_moisture: 当前含水率(%)
        batch_weight_kg: 批次重量(kg)
        historical_deliveries: 历史交货记录
    
    Returns:
        Tuple[预估出丝率(%), 预估产丝量(kg), 异常数据列表, 警告信息列表]
    """
    anomalies = []
    warnings = []
    
    params = get_grade_params(grade)
    
    if current_moisture < params.moisture_optimal_min:
        moisture_factor = 0.95
        warnings.append(
            f"含水率偏低，可能导致出丝率下降约5%"
        )
    elif current_moisture > params.moisture_optimal_max:
        moisture_factor = 0.97
        warnings.append(
            f"含水率偏高，可能导致出丝率下降约3%"
        )
    else:
        moisture_factor = 1.0
    
    estimated_rate = params.base_filature_rate * moisture_factor
    
    if historical_deliveries and len(historical_deliveries) > 0:
        valid_rates = [
            d.filature_rate for d in historical_deliveries 
            if d.filature_rate and d.filature_rate > 0
        ]
        if valid_rates:
            avg_historical_rate = sum(valid_rates) / len(valid_rates)
            estimated_rate = (estimated_rate + avg_historical_rate) * 0.5
    
    if estimated_rate < 15:
        anomalies.append({
            "type": "filature_rate_too_low",
            "value": estimated_rate,
            "message": f"预估出丝率({estimated_rate:.1f}%)过低，请检查参数",
            "severity": "high",
        })
    
    if estimated_rate > 50:
        anomalies.append({
            "type": "filature_rate_too_high",
            "value": estimated_rate,
            "message": f"预估出丝率({estimated_rate:.1f}%)过高，请检查参数",
            "severity": "high",
        })
    
    estimated_silk_output = batch_weight_kg * estimated_rate / 100
    
    return round(estimated_rate, 2), round(estimated_silk_output, 2), anomalies, warnings


def assess_breakage_risk(
    grade: CocoonGrade,
    current_moisture: float,
    historical_breakages: List[BreakageRecord] = None,
    cooking_temp: float = None,
    cooking_time: float = None,
) -> Tuple[str, float, List[str], List[Dict[str, Any]], List[str]]:
    """
    评估断头风险
    
    Args:
        grade: 蚕茧等级
        current_moisture: 当前含水率(%)
        historical_breakages: 历史断头记录
        cooking_temp: 煮茧温度(℃)
        cooking_time: 煮茧时间(分钟)
    
    Returns:
        Tuple[风险等级, 预估每小时断头数, 风险因素列表, 异常数据列表, 警告信息列表]
    """
    anomalies = []
    warnings = []
    risk_factors = []
    
    params = get_grade_params(grade)
    
    base_breakage = params.breakage_threshold
    risk_score = 0.0
    
    if current_moisture < params.moisture_optimal_min:
        moisture_diff = params.moisture_optimal_min - current_moisture
        risk_score += moisture_diff * 0.1
        risk_factors.append(f"含水率偏低({current_moisture:.1f}%)，可能增加断头")
    
    if current_moisture > params.moisture_optimal_max:
        moisture_diff = current_moisture - params.moisture_optimal_max
        risk_score += moisture_diff * 0.05
        risk_factors.append(f"含水率偏高({current_moisture:.1f}%)，可能影响解舒")
    
    if cooking_temp:
        if cooking_temp > 100:
            risk_score += 0.3
            risk_factors.append("煮茧温度过高，可能导致茧层过熟")
        elif cooking_temp < 85:
            risk_score += 0.2
            risk_factors.append("煮茧温度过低，可能导致茧层未解舒")
    
    if cooking_time:
        if cooking_time > 25:
            risk_score += 0.15
            risk_factors.append("煮茧时间过长，可能导致茧层过烂")
        elif cooking_time < 10:
            risk_score += 0.25
            risk_factors.append("煮茧时间过短，可能导致茧层未解舒")
    
    estimated_breakage = base_breakage + risk_score
    
    if historical_breakages and len(historical_breakages) > 0:
        valid_records = [
            b for b in historical_breakages 
            if b.breakage_per_hour and b.breakage_per_hour > 0
        ]
        if valid_records:
            avg_historical = sum(b.breakage_per_hour for b in valid_records) / len(valid_records)
            estimated_breakage = (estimated_breakage + avg_historical) * 0.5
            
            if avg_historical > params.breakage_threshold * 1.5:
                risk_factors.append("历史断头记录偏高，建议检查缫丝工艺")
    
    if estimated_breakage < 0.3:
        risk_level = "低"
    elif estimated_breakage < 0.8:
        risk_level = "中"
    elif estimated_breakage < 1.5:
        risk_level = "较高"
    else:
        risk_level = "高"
        warnings.append(f"断头风险等级为高({risk_level})，建议重点关注")
    
    if estimated_breakage > 2.0:
        anomalies.append({
            "type": "breakage_risk_extreme",
            "value": estimated_breakage,
            "message": f"预估每小时断头数({estimated_breakage:.2f})过高，请仔细检查工艺参数",
            "severity": "high",
        })
    
    return risk_level, round(estimated_breakage, 2), risk_factors, anomalies, warnings


def calculate_process_params(
    batch_data: BatchProcessData,
    target_moisture: float = None,
) -> ProcessCalculation:
    """
    综合计算工艺参数
    
    Args:
        batch_data: 批次工艺数据
        target_moisture: 目标含水率(%)，如不指定则使用等级最优值
    
    Returns:
        ProcessCalculation: 工艺计算结果
    """
    batch = batch_data.batch
    grade = batch.grade
    params = get_grade_params(grade)
    
    if target_moisture is None:
        target_moisture = (params.moisture_optimal_min + params.moisture_optimal_max) / 2
    
    current_moisture = 12.0
    if batch_data.moisture_inspections:
        latest_inspection = max(
            batch_data.moisture_inspections,
            key=lambda x: x.inspection_date
        )
        if latest_inspection.moisture_content:
            current_moisture = latest_inspection.moisture_content
    
    all_anomalies = []
    all_warnings = []
    
    water_supplement, anomalies, warnings = calculate_water_supplement(
        batch.total_weight_kg,
        current_moisture,
        target_moisture,
    )
    all_anomalies.extend(anomalies)
    all_warnings.extend(warnings)
    
    cooking_params, anomalies, warnings = calculate_cooking_params(
        grade,
        current_moisture,
        batch_data.cooking_curves,
    )
    all_anomalies.extend(anomalies)
    all_warnings.extend(warnings)
    
    estimated_rate, estimated_silk, anomalies, warnings = estimate_filature_rate(
        grade,
        current_moisture,
        batch.total_weight_kg,
        batch_data.delivery_records,
    )
    all_anomalies.extend(anomalies)
    all_warnings.extend(warnings)
    
    risk_level, estimated_breakage, risk_factors, anomalies, warnings = assess_breakage_risk(
        grade,
        current_moisture,
        batch_data.breakage_records,
        cooking_params["recommended_cooking_temp"],
        cooking_params["recommended_cooking_time_min"],
    )
    all_anomalies.extend(anomalies)
    all_warnings.extend(warnings)
    
    calculation_id = f"CALC-{batch.batch_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    return ProcessCalculation(
        calculation_id=calculation_id,
        batch_id=batch.batch_id,
        target_moisture=round(target_moisture, 2),
        current_moisture=round(current_moisture, 2),
        water_supplement_kg=round(water_supplement, 2),
        recommended_cooking_temp=cooking_params["recommended_cooking_temp"],
        recommended_cooking_time_min=cooking_params["recommended_cooking_time_min"],
        soaking_time_min=cooking_params["soaking_time_min"],
        steam_pressure=cooking_params["steam_pressure"],
        estimated_filature_rate=estimated_rate,
        estimated_silk_output_kg=estimated_silk,
        breakage_risk_level=risk_level,
        estimated_breakage_per_hour=estimated_breakage,
        risk_factors=risk_factors,
        anomalies=all_anomalies,
        warnings=all_warnings,
    )


def merge_batches(
    batches: List[CocoonBatch],
    moisture_inspections: List[MoistureInspection] = None,
) -> Tuple[CocoonBatch, float]:
    """
    合并多个蚕茧批次
    
    Args:
        batches: 要合并的批次列表
        moisture_inspections: 含水率抽检记录
    
    Returns:
        Tuple[合并后的批次, 加权平均含水率(%)]
    """
    if not batches:
        raise ValueError("至少需要一个批次进行合并")
    
    if len(batches) == 1:
        batch = batches[0]
        avg_moisture = 12.0
        if moisture_inspections:
            batch_inspections = [
                m for m in moisture_inspections 
                if m.batch_id == batch.batch_id and m.moisture_content
            ]
            if batch_inspections:
                avg_moisture = sum(m.moisture_content for m in batch_inspections) / len(batch_inspections)
        return batch, round(avg_moisture, 2)
    
    total_weight = sum(b.total_weight_kg for b in batches)
    
    batch_weights = [b.total_weight_kg for b in batches]
    avg_grade = max(batches, key=lambda b: batch_weights[batches.index(b)]).grade
    
    avg_moisture = 12.0
    if moisture_inspections:
        moisture_values = []
        moisture_weights = []
        
        for batch in batches:
            batch_inspections = [
                m for m in moisture_inspections 
                if m.batch_id == batch.batch_id and m.moisture_content
            ]
            if batch_inspections:
                batch_moisture = sum(m.moisture_content for m in batch_inspections) / len(batch_inspections)
                moisture_values.append(batch_moisture)
                moisture_weights.append(batch.total_weight_kg)
        
        if moisture_values:
            weighted_sum = sum(m * w for m, w in zip(moisture_values, moisture_weights))
            avg_moisture = weighted_sum / sum(moisture_weights)
    
    earliest_date = min(b.purchase_date for b in batches)
    sources = sorted(set(b.source for b in batches))
    
    merged_batch = CocoonBatch(
        batch_id=f"MERGED-{'-'.join(b.batch_id for b in batches[:3])}",
        source="、".join(sources),
        purchase_date=earliest_date,
        total_weight_kg=round(total_weight, 2),
        grade=avg_grade,
        supplier=f"合并批次({len(batches)}批)",
        notes=f"合并自 {len(batches)} 个批次: {', '.join(b.batch_id for b in batches)}",
    )
    
    return merged_batch, round(avg_moisture, 2)
