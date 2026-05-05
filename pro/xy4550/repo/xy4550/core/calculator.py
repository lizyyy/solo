"""
岩土三轴试验核心计算模块
包含：峰值强度、残余强度、孔压异常检测、破坏时刻识别、校准过期风险评估
"""
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta
from config import TEST_CONFIG


class TriaxialTestCalculator:
    """三轴试验计算器"""
    
    def __init__(self):
        self.config = TEST_CONFIG
    
    def calculate_peak_strength(self, strain_data: List[float], 
                                  stress_data: List[float]) -> Dict[str, Any]:
        """
        计算峰值强度
        
        参数:
            strain_data: 应变数据列表 (%)
            stress_data: 偏应力数据列表 (kPa)
            
        返回:
            包含峰值强度信息的字典
        """
        if not strain_data or not stress_data:
            return {"error": "数据为空"}
        
        if len(strain_data) != len(stress_data):
            return {"error": "应变和应力数据长度不一致"}
        
        strain_array = np.array(strain_data)
        stress_array = np.array(stress_data)
        
        # 找到偏应力最大值
        max_stress_idx = np.argmax(stress_array)
        peak_stress = stress_array[max_stress_idx]
        peak_strain = strain_array[max_stress_idx]
        
        # 检查是否存在多峰值
        stress_diff = np.diff(stress_array)
        peaks = []
        for i in range(1, len(stress_diff)):
            if stress_diff[i-1] > 0 and stress_diff[i] < 0:
                peaks.append({
                    "strain": strain_array[i],
                    "stress": stress_array[i],
                    "index": i
                })
        
        return {
            "peak_stress_kPa": float(peak_stress),
            "peak_strain_percent": float(peak_strain),
            "peak_index": int(max_stress_idx),
            "multiple_peaks": len(peaks) > 1,
            "all_peaks": peaks,
            "method": "最大偏应力法"
        }
    
    def calculate_residual_strength(self, strain_data: List[float], 
                                      stress_data: List[float],
                                      peak_index: int) -> Dict[str, Any]:
        """
        计算残余强度
        
        参数:
            strain_data: 应变数据列表 (%)
            stress_data: 偏应力数据列表 (kPa)
            peak_index: 峰值点索引
            
        返回:
            包含残余强度信息的字典
        """
        if not strain_data or not stress_data:
            return {"error": "数据为空"}
        
        if peak_index >= len(stress_data):
            return {"error": "峰值索引超出范围"}
        
        strain_array = np.array(strain_data)
        stress_array = np.array(stress_data)
        
        # 取峰值后的点
        post_peak_strain = strain_array[peak_index:]
        post_peak_stress = stress_array[peak_index:]
        
        if len(post_peak_stress) < self.config["residual_min_points"]:
            return {
                "error": f"峰值后数据点不足（需要至少{self.config['residual_min_points']}个点）",
                "available_points": len(post_peak_stress)
            }
        
        # 计算残余强度：峰值后稳定段的平均值
        # 方法：取最后几个点的平均值，或者找到应力变化率小于阈值的段
        
        # 计算应力变化率
        if len(post_peak_stress) > 1:
            stress_change_rate = np.abs(np.diff(post_peak_stress))
            # 找到变化率最小的连续段
            window_size = min(10, len(post_peak_stress) - 1)
            min_change_idx = 0
            min_change = float('inf')
            
            for i in range(len(stress_change_rate) - window_size + 1):
                window_change = np.mean(stress_change_rate[i:i+window_size])
                if window_change < min_change:
                    min_change = window_change
                    min_change_idx = i
            
            # 取稳定段的平均值作为残余强度
            stable_start_idx = peak_index + min_change_idx
            stable_end_idx = peak_index + min_change_idx + window_size
            residual_stress = np.mean(stress_array[stable_start_idx:stable_end_idx])
            residual_strain = np.mean(strain_array[stable_start_idx:stable_end_idx])
        else:
            residual_stress = post_peak_stress[-1]
            residual_strain = post_peak_strain[-1]
        
        # 也可以取最后几个点的平均值作为备用
        last_n_points = min(15, len(post_peak_stress))
        residual_stress_alt = np.mean(post_peak_stress[-last_n_points:])
        residual_strain_alt = np.mean(post_peak_strain[-last_n_points:])
        
        return {
            "residual_stress_kPa": float(residual_stress),
            "residual_strain_percent": float(residual_strain),
            "residual_stress_alt_kPa": float(residual_stress_alt),
            "residual_strain_alt_percent": float(residual_strain_alt),
            "stable_segment_start_index": int(peak_index + min_change_idx) if 'min_change_idx' in dir() else peak_index,
            "method": "稳定段平均值法",
            "alt_method": "末段平均值法"
        }
    
    def detect_pore_pressure_anomaly(self, time_data: List[float],
                                        pore_pressure_data: List[float],
                                        confining_pressure: float = 0.0) -> Dict[str, Any]:
        """
        检测孔压异常
        
        参数:
            time_data: 时间数据列表 (s)
            pore_pressure_data: 孔压数据列表 (kPa)
            confining_pressure: 围压 (kPa)
            
        返回:
            包含孔压异常信息的字典
        """
        if not time_data or not pore_pressure_data:
            return {"error": "数据为空"}
        
        time_array = np.array(time_data)
        pore_pressure_array = np.array(pore_pressure_data)
        
        # 检测孔压异常
        anomalies = []
        
        # 1. 孔压突变检测（相邻点变化超过阈值）
        threshold = self.config["pore_pressure_anomaly_threshold"]
        for i in range(1, len(pore_pressure_array)):
            change = abs(pore_pressure_array[i] - pore_pressure_array[i-1])
            if change > threshold:
                anomalies.append({
                    "type": "突变异常",
                    "time_s": float(time_array[i]),
                    "pore_pressure_kPa": float(pore_pressure_array[i]),
                    "change_kPa": float(change),
                    "index": i,
                    "severity": "高" if change > threshold * 2 else "中"
                })
        
        # 2. 孔压超过围压检测
        if confining_pressure > 0:
            for i, (t, pp) in enumerate(zip(time_array, pore_pressure_array)):
                if pp > confining_pressure * 1.1:  # 允许10%的误差
                    anomalies.append({
                        "type": "超围压异常",
                        "time_s": float(t),
                        "pore_pressure_kPa": float(pp),
                        "confining_pressure_kPa": float(confining_pressure),
                        "ratio": float(pp / confining_pressure),
                        "index": i,
                        "severity": "高"
                    })
        
        # 3. 孔压负值检测
        for i, (t, pp) in enumerate(zip(time_array, pore_pressure_array)):
            if pp < -10:  # 允许小范围负值
                anomalies.append({
                    "type": "负值异常",
                    "time_s": float(t),
                    "pore_pressure_kPa": float(pp),
                    "index": i,
                    "severity": "中"
                })
        
        # 统计分析
        has_anomalies = len(anomalies) > 0
        high_severity = [a for a in anomalies if a["severity"] == "高"]
        
        return {
            "has_anomalies": has_anomalies,
            "anomaly_count": len(anomalies),
            "high_severity_count": len(high_severity),
            "anomalies": anomalies,
            "threshold_kPa": threshold,
            "analysis_method": "突变检测+超围压检测+负值检测"
        }
    
    def identify_failure_point(self, strain_data: List[float],
                                 stress_data: List[float],
                                 pore_pressure_data: Optional[List[float]] = None) -> Dict[str, Any]:
        """
        识别破坏时刻
        
        参数:
            strain_data: 应变数据列表 (%)
            stress_data: 偏应力数据列表 (kPa)
            pore_pressure_data: 孔压数据列表 (kPa)，可选
            
        返回:
            包含破坏时刻信息的字典
        """
        if not strain_data or not stress_data:
            return {"error": "数据为空"}
        
        strain_array = np.array(strain_data)
        stress_array = np.array(stress_data)
        
        # 方法1：峰值点法
        peak_result = self.calculate_peak_strength(strain_data, stress_data)
        if "error" in peak_result:
            return peak_result
        
        peak_index = peak_result["peak_index"]
        
        # 方法2：应力降法（峰值后应力下降到峰值的某个比例）
        failure_criteria = []
        
        # 标准1：峰值点
        failure_criteria.append({
            "criterion": "峰值点",
            "strain_percent": peak_result["peak_strain_percent"],
            "stress_kPa": peak_result["peak_stress_kPa"],
            "index": peak_index,
            "description": "偏应力达到最大值的点"
        })
        
        # 标准2：峰值后应力下降5%的点
        target_stress_5 = peak_result["peak_stress_kPa"] * 0.95
        found_5 = False
        for i in range(peak_index, len(stress_array)):
            if stress_array[i] <= target_stress_5:
                failure_criteria.append({
                    "criterion": "应力下降5%",
                    "strain_percent": float(strain_array[i]),
                    "stress_kPa": float(stress_array[i]),
                    "index": i,
                    "description": "峰值后应力下降到峰值的95%"
                })
                found_5 = True
                break
        
        if not found_5:
            failure_criteria.append({
                "criterion": "应力下降5%",
                "status": "未找到",
                "description": "试验结束时应力仍未下降到峰值的95%"
            })
        
        # 标准3：破坏应变阈值（通常15%）
        threshold_strain = self.config["failure_strain_threshold"]
        for i, strain in enumerate(strain_array):
            if strain >= threshold_strain:
                failure_criteria.append({
                    "criterion": f"应变达到{threshold_strain}%",
                    "strain_percent": float(strain),
                    "stress_kPa": float(stress_array[i]),
                    "index": i,
                    "description": f"轴向应变达到{threshold_strain}%"
                })
                break
        
        # 如果有孔压数据，考虑孔压变化
        if pore_pressure_data and len(pore_pressure_data) == len(strain_data):
            pp_array = np.array(pore_pressure_data)
            # 孔压峰值点
            pp_peak_idx = np.argmax(pp_array)
            failure_criteria.append({
                "criterion": "孔压峰值",
                "strain_percent": float(strain_array[pp_peak_idx]),
                "stress_kPa": float(stress_array[pp_peak_idx]),
                "pore_pressure_kPa": float(pp_array[pp_peak_idx]),
                "index": int(pp_peak_idx),
                "description": "孔隙水压力达到最大值的点"
            })
        
        # 推荐破坏点（通常取峰值点或应力下降5%的点）
        recommended_failure = None
        for fc in failure_criteria:
            if fc["criterion"] == "应力下降5%" and "status" not in fc:
                recommended_failure = fc
                break
        
        if not recommended_failure:
            for fc in failure_criteria:
                if fc["criterion"] == "峰值点":
                    recommended_failure = fc
                    break
        
        return {
            "failure_criteria": failure_criteria,
            "recommended_failure": recommended_failure,
            "peak_strain_percent": peak_result["peak_strain_percent"],
            "peak_stress_kPa": peak_result["peak_stress_kPa"],
            "methods_used": ["峰值点法", "应力降法", "应变阈值法"] + 
                            (["孔压峰值法"] if pore_pressure_data else [])
        }
    
    def check_calibration_risk(self, calibration_date: str,
                                 validity_days: int = None,
                                 test_date: str = None) -> Dict[str, Any]:
        """
        检查校准过期风险
        
        参数:
            calibration_date: 校准日期 (YYYY-MM-DD)
            validity_days: 有效天数，默认使用配置值
            test_date: 试验日期 (YYYY-MM-DD)，默认使用今天
            
        返回:
            包含校准风险信息的字典
        """
        if validity_days is None:
            validity_days = self.config["calibration_validity_days"]
        
        try:
            cal_date = datetime.strptime(calibration_date, "%Y-%m-%d")
            if test_date:
                test_dt = datetime.strptime(test_date, "%Y-%m-%d")
            else:
                test_dt = datetime.now()
            
            # 计算有效期截止日期
            expiry_date = cal_date + timedelta(days=validity_days)
            
            # 计算距离过期还有多少天
            days_until_expiry = (expiry_date - test_dt).days
            
            # 风险评估
            if days_until_expiry < 0:
                risk_level = "高风险"
                risk_description = "仪器校准已过期，需要重新校准"
                status = "已过期"
            elif days_until_expiry <= 30:
                risk_level = "中风险"
                risk_description = f"仪器校准将在{days_until_expiry}天后过期，建议提前安排校准"
                status = "即将过期"
            elif days_until_expiry <= 90:
                risk_level = "低风险"
                risk_description = f"仪器校准将在{days_until_expiry}天后过期，请注意有效期"
                status = "正常（即将到期）"
            else:
                risk_level = "无风险"
                risk_description = f"仪器校准正常，有效期至{expiry_date.strftime('%Y-%m-%d')}"
                status = "正常"
            
            return {
                "calibration_date": calibration_date,
                "expiry_date": expiry_date.strftime("%Y-%m-%d"),
                "test_date": test_dt.strftime("%Y-%m-%d"),
                "days_until_expiry": days_until_expiry,
                "validity_days": validity_days,
                "risk_level": risk_level,
                "risk_description": risk_description,
                "status": status,
                "is_expired": days_until_expiry < 0,
                "is_soon_expired": 0 <= days_until_expiry <= 30
            }
            
        except ValueError as e:
            return {
                "error": f"日期格式错误: {str(e)}",
                "expected_format": "YYYY-MM-DD"
            }
    
    def check_saturation(self, b_value: float,
                          threshold: float = None) -> Dict[str, Any]:
        """
        检查饱和度
        
        参数:
            b_value: 孔压系数B值
            threshold: 饱和度阈值，默认使用配置值
            
        返回:
            包含饱和度检查结果的字典
        """
        if threshold is None:
            threshold = self.config["saturation_b_value_threshold"]
        
        is_saturated = b_value >= threshold
        
        if is_saturated:
            status = "已饱和"
            description = f"B值为{b_value:.3f}，达到阈值{threshold}，饱和度合格"
        else:
            status = "未饱和"
            description = f"B值为{b_value:.3f}，未达到阈值{threshold}，饱和度不合格"
        
        return {
            "b_value": float(b_value),
            "threshold": float(threshold),
            "is_saturated": is_saturated,
            "status": status,
            "description": description,
            "difference": float(b_value - threshold)
        }
