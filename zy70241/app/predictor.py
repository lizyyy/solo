from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from app.models import Filter, WaterQualityRecord, WaterVolumeRecord, Complaint

class FilterLifePredictor:
    def __init__(self, db: Session):
        self.db = db
        self.quality_weights = {
            'turbidity': 0.25,
            'ph': 0.20,
            'residual_chlorine': 0.20,
            'conductivity': 0.15,
            'total_dissolved_solids': 0.15,
            'color': 0.05
        }
        
        self.quality_thresholds = {
            'turbidity': {'warning': 5.0, 'critical': 10.0},
            'ph': {'low_warning': 6.0, 'high_warning': 8.5, 'low_critical': 5.5, 'high_critical': 9.0},
            'residual_chlorine': {'warning': 0.3, 'critical': 0.1},
            'conductivity': {'warning': 800, 'critical': 1200},
            'total_dissolved_solids': {'warning': 500, 'critical': 1000},
            'color': {'warning': 15, 'critical': 30}
        }
        
        self.complaint_weights = {
            'low': 0.05,
            'medium': 0.10,
            'high': 0.20,
            'critical': 0.35
        }
    
    def predict(self, filter_id: str) -> Dict:
        filter_obj = self.db.query(Filter).filter(Filter.filter_id == filter_id).first()
        if not filter_obj:
            return {'error': '滤芯不存在'}
        
        water_quality_data = self._get_recent_water_quality(filter_id)
        water_volume_data = self._get_water_volume_data(filter_id)
        complaints = self._get_recent_complaints(filter_id)
        
        age_score, age_days, max_days = self._calculate_age_score(filter_obj)
        volume_score, used_liters, max_liters = self._calculate_volume_score(filter_obj, water_volume_data)
        quality_score, quality_factors = self._calculate_quality_score(water_quality_data)
        complaint_score, complaint_factors = self._calculate_complaint_score(complaints)
        
        overall_health_score = self._calculate_overall_health(
            age_score, volume_score, quality_score, complaint_score
        )
        
        predicted_remaining_days = self._predict_remaining_days(
            filter_obj, overall_health_score, water_volume_data
        )
        predicted_remaining_liters = self._predict_remaining_liters(
            filter_obj, overall_health_score, water_volume_data
        )
        
        risk_level = self._determine_risk_level(overall_health_score, complaints)
        recommendation = self._generate_recommendation(
            risk_level, predicted_remaining_days, complaints
        )
        
        explanation = self._generate_explanation(
            filter_obj, age_days, max_days, used_liters, max_liters,
            quality_factors, complaint_factors, overall_health_score,
            predicted_remaining_days
        )
        
        confidence = self._calculate_confidence(
            water_quality_data, water_volume_data, complaints
        )
        
        return {
            'filter_id': filter_id,
            'prediction_date': datetime.utcnow(),
            'predicted_remaining_days': max(0, predicted_remaining_days),
            'predicted_remaining_liters': max(0, predicted_remaining_liters),
            'health_score': round(overall_health_score, 2),
            'risk_level': risk_level,
            'recommendation': recommendation,
            'explanation': explanation,
            'confidence': round(confidence, 2),
            'factors': {
                'age': {
                    'score': age_score,
                    'used_days': age_days,
                    'max_days': max_days,
                    'usage_percentage': round((age_days / max_days * 100), 2) if max_days > 0 else 0
                },
                'volume': {
                    'score': volume_score,
                    'used_liters': used_liters,
                    'max_liters': max_liters,
                    'usage_percentage': round((used_liters / max_liters * 100), 2) if max_liters > 0 else 0
                },
                'quality': {
                    'score': quality_score,
                    'factors': quality_factors
                },
                'complaints': {
                    'score': complaint_score,
                    'factors': complaint_factors
                }
            }
        }
    
    def _get_recent_water_quality(self, filter_id: str, days: int = 30) -> List:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        return self.db.query(WaterQualityRecord).filter(
            WaterQualityRecord.filter_id == filter_id,
            WaterQualityRecord.record_date >= cutoff_date,
            WaterQualityRecord.is_valid == True
        ).order_by(WaterQualityRecord.record_date.desc()).all()
    
    def _get_water_volume_data(self, filter_id: str) -> List:
        return self.db.query(WaterVolumeRecord).filter(
            WaterVolumeRecord.filter_id == filter_id,
            WaterVolumeRecord.is_valid == True
        ).order_by(WaterVolumeRecord.record_date.desc()).all()
    
    def _get_recent_complaints(self, filter_id: str, days: int = 90) -> List:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        return self.db.query(Complaint).filter(
            Complaint.filter_id == filter_id,
            Complaint.complaint_date >= cutoff_date
        ).order_by(Complaint.complaint_date.desc()).all()
    
    def _calculate_age_score(self, filter_obj: Filter) -> Tuple[float, int, int]:
        age_days = (datetime.utcnow() - filter_obj.install_date).days
        max_days = filter_obj.max_lifespan_days
        
        if age_days >= max_days:
            return 0.0, age_days, max_days
        
        usage_ratio = age_days / max_days
        score = max(0.0, 1.0 - usage_ratio)
        
        return score, age_days, max_days
    
    def _calculate_volume_score(self, filter_obj: Filter, volume_data: List) -> Tuple[float, float, float]:
        if not volume_data:
            return 1.0, 0.0, filter_obj.max_lifespan_liters
        
        latest_record = volume_data[0]
        used_liters = latest_record.cumulative_volume_liters
        max_liters = filter_obj.max_lifespan_liters
        
        if used_liters >= max_liters:
            return 0.0, used_liters, max_liters
        
        usage_ratio = used_liters / max_liters
        score = max(0.0, 1.0 - usage_ratio)
        
        return score, used_liters, max_liters
    
    def _calculate_quality_score(self, quality_data: List) -> Tuple[float, Dict]:
        if not quality_data:
            return 1.0, {'message': '无水质数据，使用默认满分'}
        
        factor_scores = {}
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for param, weight in self.quality_weights.items():
            param_values = [getattr(r, param) for r in quality_data if hasattr(r, param) and getattr(r, param) is not None]
            
            if not param_values:
                continue
            
            avg_value = sum(param_values) / len(param_values)
            param_score = self._calculate_param_score(param, avg_value)
            
            factor_scores[param] = {
                'average_value': round(avg_value, 4),
                'score': round(param_score, 4),
                'weight': weight,
                'status': self._get_param_status(param, avg_value)
            }
            
            total_weighted_score += param_score * weight
            total_weight += weight
        
        if total_weight == 0:
            return 1.0, {'message': '无有效水质参数数据'}
        
        overall_score = total_weighted_score / total_weight
        return overall_score, factor_scores
    
    def _calculate_param_score(self, param: str, value: float) -> float:
        if param == 'ph':
            if 6.5 <= value <= 8.0:
                return 1.0
            elif 6.0 <= value <= 8.5:
                return 0.7
            elif 5.5 <= value <= 9.0:
                return 0.4
            else:
                return 0.0
        elif param == 'residual_chlorine':
            if value >= 0.5:
                return 1.0
            elif value >= 0.3:
                return 0.7
            elif value >= 0.1:
                return 0.4
            else:
                return 0.0
        elif param in ['turbidity', 'conductivity', 'total_dissolved_solids', 'color']:
            thresholds = self.quality_thresholds[param]
            if value <= thresholds['warning'] * 0.5:
                return 1.0
            elif value <= thresholds['warning']:
                return 0.7
            elif value <= thresholds['critical']:
                return 0.4
            else:
                return 0.0
        
        return 0.5
    
    def _get_param_status(self, param: str, value: float) -> str:
        if param == 'ph':
            if 6.5 <= value <= 8.0:
                return 'excellent'
            elif 6.0 <= value <= 8.5:
                return 'good'
            elif 5.5 <= value <= 9.0:
                return 'warning'
            else:
                return 'critical'
        elif param == 'residual_chlorine':
            if value >= 0.5:
                return 'excellent'
            elif value >= 0.3:
                return 'good'
            elif value >= 0.1:
                return 'warning'
            else:
                return 'critical'
        elif param in ['turbidity', 'conductivity', 'total_dissolved_solids', 'color']:
            thresholds = self.quality_thresholds[param]
            if value <= thresholds['warning'] * 0.5:
                return 'excellent'
            elif value <= thresholds['warning']:
                return 'good'
            elif value <= thresholds['critical']:
                return 'warning'
            else:
                return 'critical'
        
        return 'unknown'
    
    def _calculate_complaint_score(self, complaints: List) -> Tuple[float, Dict]:
        if not complaints:
            return 1.0, {'message': '无投诉记录', 'count': 0}
        
        total_penalty = 0.0
        complaint_types = {}
        
        for complaint in complaints:
            severity = complaint.severity.lower()
            penalty = self.complaint_weights.get(severity, 0.05)
            
            if complaint.status == 'open':
                penalty *= 1.5
            
            total_penalty += penalty
            
            ctype = complaint.complaint_type
            if ctype not in complaint_types:
                complaint_types[ctype] = {'count': 0, 'total_severity': 0}
            complaint_types[ctype]['count'] += 1
            complaint_types[ctype]['total_severity'] += self.complaint_weights.get(severity, 0.05)
        
        score = max(0.0, 1.0 - min(total_penalty, 1.0))
        
        factors = {
            'count': len(complaints),
            'open_count': sum(1 for c in complaints if c.status == 'open'),
            'total_penalty': round(total_penalty, 4),
            'types': complaint_types
        }
        
        return score, factors
    
    def _calculate_overall_health(self, age_score: float, volume_score: float, 
                                  quality_score: float, complaint_score: float) -> float:
        weights = {
            'age': 0.25,
            'volume': 0.30,
            'quality': 0.30,
            'complaints': 0.15
        }
        
        total_score = (
            age_score * weights['age'] +
            volume_score * weights['volume'] +
            quality_score * weights['quality'] +
            complaint_score * weights['complaints']
        )
        
        return total_score * 100
    
    def _predict_remaining_days(self, filter_obj: Filter, health_score: float, 
                                volume_data: List) -> int:
        age_days = (datetime.utcnow() - filter_obj.install_date).days
        max_days = filter_obj.max_lifespan_days
        
        avg_daily_volume = self._calculate_avg_daily_volume(volume_data)
        
        if health_score >= 80:
            multiplier = 1.2
        elif health_score >= 60:
            multiplier = 1.0
        elif health_score >= 40:
            multiplier = 0.7
        elif health_score >= 20:
            multiplier = 0.4
        else:
            multiplier = 0.1
        
        remaining_by_age = max(0, max_days - age_days)
        
        if avg_daily_volume > 0 and filter_obj.max_lifespan_liters > 0:
            used_liters = volume_data[0].cumulative_volume_liters if volume_data else 0
            remaining_liters = max(0, filter_obj.max_lifespan_liters - used_liters)
            remaining_by_volume = int(remaining_liters / avg_daily_volume)
        else:
            remaining_by_volume = remaining_by_age
        
        remaining_days = int(min(remaining_by_age, remaining_by_volume) * multiplier)
        
        return remaining_days
    
    def _predict_remaining_liters(self, filter_obj: Filter, health_score: float,
                                  volume_data: List) -> float:
        used_liters = volume_data[0].cumulative_volume_liters if volume_data else 0
        max_liters = filter_obj.max_lifespan_liters
        
        if health_score >= 80:
            multiplier = 1.2
        elif health_score >= 60:
            multiplier = 1.0
        elif health_score >= 40:
            multiplier = 0.7
        elif health_score >= 20:
            multiplier = 0.4
        else:
            multiplier = 0.1
        
        remaining = max(0, (max_liters - used_liters) * multiplier)
        return round(remaining, 2)
    
    def _calculate_avg_daily_volume(self, volume_data: List) -> float:
        if not volume_data:
            return 0.0
        
        recent_data = volume_data[:7]
        if len(recent_data) < 2:
            return recent_data[0].daily_volume_liters if recent_data else 0.0
        
        total_volume = sum(r.daily_volume_liters for r in recent_data)
        return total_volume / len(recent_data)
    
    def _determine_risk_level(self, health_score: float, complaints: List) -> str:
        open_critical = sum(1 for c in complaints if c.status == 'open' and c.severity.lower() == 'critical')
        
        if health_score < 20 or open_critical > 0:
            return 'critical'
        elif health_score < 40:
            return 'high'
        elif health_score < 60:
            return 'medium'
        elif health_score < 80:
            return 'low'
        else:
            return 'normal'
    
    def _generate_recommendation(self, risk_level: str, remaining_days: int, 
                                complaints: List) -> str:
        open_complaints = sum(1 for c in complaints if c.status == 'open')
        
        if risk_level == 'critical':
            return '立即更换滤芯，存在严重安全隐患'
        elif risk_level == 'high':
            if remaining_days <= 7:
                return '紧急更换滤芯，寿命即将耗尽'
            return '建议本周内更换滤芯'
        elif risk_level == 'medium':
            if open_complaints > 0:
                return '建议检查滤芯状态并处理投诉'
            return '建议两周内安排更换计划'
        elif risk_level == 'low':
            return '继续监控，按计划更换'
        else:
            return '滤芯状态良好，正常使用'
    
    def _generate_explanation(self, filter_obj: Filter, age_days: int, max_days: int,
                             used_liters: float, max_liters: float,
                             quality_factors: Dict, complaint_factors: Dict,
                             health_score: float, remaining_days: int) -> str:
        parts = []
        
        parts.append(f"滤芯 {filter_obj.filter_id} 已使用 {age_days} 天（最大 {max_days} 天），"
                    f"累计处理水量 {used_liters:,.0f} 升（最大 {max_liters:,.0f} 升）。")
        
        if 'message' not in quality_factors:
            quality_issues = []
            for param, data in quality_factors.items():
                if data['status'] in ['warning', 'critical']:
                    quality_issues.append(f"{param}({data['status']})")
            if quality_issues:
                parts.append(f"水质指标存在问题：{', '.join(quality_issues)}。")
            else:
                parts.append("所有水质指标均在正常范围内。")
        
        if complaint_factors.get('count', 0) > 0:
            parts.append(f"过去90天收到 {complaint_factors['count']} 起投诉，"
                        f"其中 {complaint_factors.get('open_count', 0)} 起尚未解决。")
        
        if health_score >= 80:
            health_desc = "健康状况良好"
        elif health_score >= 60:
            health_desc = "健康状况一般"
        elif health_score >= 40:
            health_desc = "健康状况较差"
        else:
            health_desc = "健康状况危险"
        
        parts.append(f"综合健康评分为 {health_score:.1f} 分，{health_desc}。")
        parts.append(f"预测剩余寿命约 {remaining_days} 天。")
        
        return ' '.join(parts)
    
    def _calculate_confidence(self, quality_data: List, volume_data: List, 
                             complaints: List) -> float:
        confidence = 0.0
        factors = 0
        
        if quality_data:
            days_covered = min(len(quality_data), 30)
            confidence += (days_covered / 30) * 0.4
            factors += 1
        
        if volume_data:
            days_covered = min(len(volume_data), 7)
            confidence += (days_covered / 7) * 0.4
            factors += 1
        
        if factors == 0:
            return 0.3
        
        confidence += 0.2
        return confidence
