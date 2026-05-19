import math
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from app.models import QualityThreshold, QualityRecord, LabMeasurement
from app.schemas import LabMeasurementCreate

class QualityCheckEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_delta_e(self, lab1: Tuple[float, float, float], lab2: Tuple[float, float, float]) -> float:
        l1, a1, b1 = lab1
        l2, a2, b2 = lab2
        delta_l = l1 - l2
        delta_a = a1 - a2
        delta_b = b1 - b2
        return math.sqrt(delta_l**2 + delta_a**2 + delta_b**2)
    
    def get_threshold(self, product_type: str, color_name: str = "default") -> Optional[QualityThreshold]:
        threshold = self.db.query(QualityThreshold).filter(
            QualityThreshold.product_type == product_type,
            QualityThreshold.color_name == color_name,
            QualityThreshold.is_active == True
        ).first()
        
        if not threshold and color_name != "default":
            threshold = self.db.query(QualityThreshold).filter(
                QualityThreshold.product_type == product_type,
                QualityThreshold.color_name == "default",
                QualityThreshold.is_active == True
            ).first()
        
        return threshold
    
    def check_single_measurement(self, measurement: LabMeasurementCreate, threshold: QualityThreshold) -> dict:
        l_val, a_val, b_val = measurement.l_value, measurement.a_value, measurement.b_value
        
        standard_l = measurement.standard_l if measurement.standard_l else (threshold.l_min + threshold.l_max) / 2
        standard_a = measurement.standard_a if measurement.standard_a else (threshold.a_min + threshold.a_max) / 2
        standard_b = measurement.standard_b if measurement.standard_b else (threshold.b_min + threshold.b_max) / 2
        
        delta_l = l_val - standard_l
        delta_a = a_val - standard_a
        delta_b = b_val - standard_b
        delta_e = self.calculate_delta_e((l_val, a_val, b_val), (standard_l, standard_a, standard_b))
        
        is_anomaly = False
        anomaly_reasons = []
        
        if l_val < threshold.l_min:
            is_anomaly = True
            anomaly_reasons.append(f"L值低于下限: {l_val:.2f} < {threshold.l_min:.2f}")
        elif l_val > threshold.l_max:
            is_anomaly = True
            anomaly_reasons.append(f"L值高于上限: {l_val:.2f} > {threshold.l_max:.2f}")
        
        if a_val < threshold.a_min:
            is_anomaly = True
            anomaly_reasons.append(f"a值低于下限: {a_val:.2f} < {threshold.a_min:.2f}")
        elif a_val > threshold.a_max:
            is_anomaly = True
            anomaly_reasons.append(f"a值高于上限: {a_val:.2f} > {threshold.a_max:.2f}")
        
        if b_val < threshold.b_min:
            is_anomaly = True
            anomaly_reasons.append(f"b值低于下限: {b_val:.2f} < {threshold.b_min:.2f}")
        elif b_val > threshold.b_max:
            is_anomaly = True
            anomaly_reasons.append(f"b值高于上限: {b_val:.2f} > {threshold.b_max:.2f}")
        
        if delta_e > threshold.delta_e_max:
            is_anomaly = True
            anomaly_reasons.append(f"色差ΔE超过阈值: {delta_e:.2f} > {threshold.delta_e_max:.2f}")
        
        return {
            "measurement_point": measurement.measurement_point,
            "l_value": l_val,
            "a_value": a_val,
            "b_value": b_val,
            "standard_l": standard_l,
            "standard_a": standard_a,
            "standard_b": standard_b,
            "delta_l": delta_l,
            "delta_a": delta_a,
            "delta_b": delta_b,
            "delta_e": delta_e,
            "is_anomaly": is_anomaly,
            "anomaly_reason": "; ".join(anomaly_reasons) if anomaly_reasons else None
        }
    
    def check_batch_measurements(self, measurements: List[LabMeasurementCreate], product_type: str) -> dict:
        threshold = self.get_threshold(product_type)
        
        if not threshold:
            return {
                "passed": False,
                "overall_result": "未设置阈值",
                "reason": f"产品类型 {product_type} 未配置品控阈值",
                "anomaly_type": "配置缺失",
                "sample_retained": False,
                "measurement_results": []
            }
        
        measurement_results = []
        anomaly_count = 0
        anomaly_points = []
        
        for measurement in measurements:
            result = self.check_single_measurement(measurement, threshold)
            measurement_results.append(result)
            if result["is_anomaly"]:
                anomaly_count += 1
                anomaly_points.append(measurement.measurement_point)
        
        total_measurements = len(measurements)
        anomaly_rate = anomaly_count / total_measurements if total_measurements > 0 else 0
        
        if anomaly_count == 0:
            return {
                "passed": True,
                "overall_result": "合格",
                "reason": "所有测点Lab值均在阈值范围内，色差符合要求",
                "anomaly_type": None,
                "sample_retained": False,
                "measurement_results": measurement_results
            }
        elif anomaly_rate <= 0.3:
            return {
                "passed": True,
                "overall_result": "有条件放行",
                "reason": f"{anomaly_count}/{total_measurements} 个测点异常，异常率 {anomaly_rate:.1%}，在可接受范围内",
                "anomaly_type": "轻微异常",
                "sample_retained": True,
                "measurement_results": measurement_results
            }
        else:
            return {
                "passed": False,
                "overall_result": "不合格",
                "reason": f"{anomaly_count}/{total_measurements} 个测点异常，异常率 {anomaly_rate:.1%}，超过可接受范围，异常测点: {', '.join(anomaly_points)}",
                "anomaly_type": "严重异常",
                "sample_retained": True,
                "measurement_results": measurement_results
            }
