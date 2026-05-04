from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from models import Point, TemperatureRecord, DeviceLog, RiskRecord, ReviewRecord
from sqlalchemy import desc, func

class RiskAnalyzer:
    HIGH_TEMP_THRESHOLD = 70.0
    MEDIUM_TEMP_THRESHOLD = 55.0
    TEMP_RISE_THRESHOLD = 15.0
    CONTINUOUS_HIGH_DAYS = 3
    
    @staticmethod
    def analyze_temperature_trend(temperatures: List[Dict[str, Any]]) -> str:
        if len(temperatures) < 2:
            return "数据不足"
        
        values = [t['temperature'] for t in temperatures if t['temperature'] is not None]
        if len(values) < 2:
            return "数据不足"
        
        first = values[0]
        last = values[-1]
        diff = last - first
        avg_diff = diff / len(values)
        
        if avg_diff > 5:
            return "持续上升"
        elif avg_diff < -5:
            return "持续下降"
        elif abs(avg_diff) < 2:
            return "平稳"
        else:
            return "波动"
    
    @staticmethod
    def calculate_risk_level(temperature: float, temp_rise: Optional[float] = None, 
                              is_alert: bool = False, is_duplicate: bool = False) -> str:
        if temperature >= RiskAnalyzer.HIGH_TEMP_THRESHOLD:
            return "high"
        
        if temp_rise and temp_rise >= RiskAnalyzer.TEMP_RISE_THRESHOLD:
            return "high"
        
        if is_alert:
            return "high"
        
        if is_duplicate:
            return "medium"
        
        if temperature >= RiskAnalyzer.MEDIUM_TEMP_THRESHOLD:
            return "medium"
        
        return "low"
    
    @staticmethod
    def detect_temperature_rise(db, point_id: int, current_temp: float, days: int = 7) -> Optional[Dict[str, Any]]:
        seven_days_ago = datetime.utcnow() - timedelta(days=days)
        
        historical_records = db.session.query(
            TemperatureRecord
        ).filter(
            TemperatureRecord.point_id == point_id,
            TemperatureRecord.record_time < seven_days_ago
        ).order_by(
            desc(TemperatureRecord.record_time)
        ).limit(10).all()
        
        if not historical_records:
            return None
        
        avg_historical = sum(r.temperature for r in historical_records) / len(historical_records)
        temp_rise = current_temp - avg_historical
        
        if temp_rise >= RiskAnalyzer.TEMP_RISE_THRESHOLD:
            return {
                'risk_type': 'temperature_rise',
                'risk_level': 'high' if temp_rise >= 20 else 'medium',
                'description': f'温度突变检测：当前温度 {current_temp:.1f}°C，历史平均 {avg_historical:.1f}°C，上升 {temp_rise:.1f}°C',
                'temperature_value': current_temp,
                'temperature_trend': f'较历史上升 {temp_rise:.1f}°C'
            }
        
        return None
    
    @staticmethod
    def detect_continuous_high_temp(db, point_id: int, current_temp: float, days: int = CONTINUOUS_HIGH_DAYS) -> Optional[Dict[str, Any]]:
        if current_temp < RiskAnalyzer.MEDIUM_TEMP_THRESHOLD:
            return None
        
        days_ago = datetime.utcnow() - timedelta(days=days)
        
        recent_records = db.session.query(
            TemperatureRecord
        ).filter(
            TemperatureRecord.point_id == point_id,
            TemperatureRecord.record_time >= days_ago
        ).all()
        
        high_temp_count = sum(1 for r in recent_records if r.temperature >= RiskAnalyzer.MEDIUM_TEMP_THRESHOLD)
        very_high_count = sum(1 for r in recent_records if r.temperature >= RiskAnalyzer.HIGH_TEMP_THRESHOLD)
        
        if very_high_count >= 2:
            return {
                'risk_type': 'continuous_high_temp',
                'risk_level': 'high',
                'description': f'连续高温检测：近{days}天内有{very_high_count}次温度超过{RiskAnalyzer.HIGH_TEMP_THRESHOLD}°C，当前温度{current_temp:.1f}°C',
                'temperature_value': current_temp,
                'temperature_trend': f'近{days}天{very_high_count}次高温'
            }
        
        if high_temp_count >= days:
            return {
                'risk_type': 'continuous_high_temp',
                'risk_level': 'medium',
                'description': f'连续高温检测：近{days}天内有{high_temp_count}次温度超过{RiskAnalyzer.MEDIUM_TEMP_THRESHOLD}°C，当前温度{current_temp:.1f}°C',
                'temperature_value': current_temp,
                'temperature_trend': f'近{days}天{high_temp_count}次较高温'
            }
        
        return None
    
    @staticmethod
    def detect_unclosed_alerts(db, batch_id: int) -> List[Dict[str, Any]]:
        unclosed_logs = db.session.query(
            DeviceLog
        ).filter(
            DeviceLog.batch_id == batch_id,
            DeviceLog.is_alert == True,
            DeviceLog.is_closed == False
        ).all()
        
        results = []
        for log in unclosed_logs:
            point = db.session.query(Point).filter(
                Point.batch_id == log.batch_id,
                Point.point_code == log.device_code
            ).first()
            
            if point:
                results.append({
                    'point_id': point.id,
                    'risk_type': 'unclosed_alert',
                    'risk_level': 'high',
                    'description': f'设备告警未闭环：{log.device_name} ({log.device_code}) - {log.message}',
                    'related_log_id': log.id,
                    'temperature_value': None,
                    'temperature_trend': None
                })
        
        return results
    
    @staticmethod
    def detect_duplicate_points(db, batch_id: int) -> List[Dict[str, Any]]:
        duplicate_codes = db.session.query(
            Point.point_code,
            func.count(Point.id).label('count')
        ).filter(
            Point.batch_id == batch_id
        ).group_by(
            Point.point_code
        ).having(
            func.count(Point.id) > 1
        ).all()
        
        results = []
        for code, count in duplicate_codes:
            points = db.session.query(Point).filter(
                Point.batch_id == batch_id,
                Point.point_code == code
            ).all()
            
            for point in points:
                results.append({
                    'point_id': point.id,
                    'risk_type': 'duplicate_point',
                    'risk_level': 'medium',
                    'description': f'重复点位检测：点位代码 {code} 在本次巡检中出现 {count} 次',
                    'temperature_value': None,
                    'temperature_trend': None
                })
        
        return results
    
    @staticmethod
    def analyze_point(db, point_id: int, current_temp: float) -> List[Dict[str, Any]]:
        risks = []
        
        temp_rise_risk = RiskAnalyzer.detect_temperature_rise(db, point_id, current_temp)
        if temp_rise_risk:
            temp_rise_risk['point_id'] = point_id
            risks.append(temp_rise_risk)
        
        continuous_risk = RiskAnalyzer.detect_continuous_high_temp(db, point_id, current_temp)
        if continuous_risk:
            continuous_risk['point_id'] = point_id
            risks.append(continuous_risk)
        
        if current_temp >= RiskAnalyzer.HIGH_TEMP_THRESHOLD:
            risks.append({
                'point_id': point_id,
                'risk_type': 'high_temperature',
                'risk_level': 'high',
                'description': f'高温异常：当前温度 {current_temp:.1f}°C 超过阈值 {RiskAnalyzer.HIGH_TEMP_THRESHOLD}°C',
                'temperature_value': current_temp,
                'temperature_trend': '高温'
            })
        elif current_temp >= RiskAnalyzer.MEDIUM_TEMP_THRESHOLD:
            risks.append({
                'point_id': point_id,
                'risk_type': 'medium_temperature',
                'risk_level': 'medium',
                'description': f'温度异常：当前温度 {current_temp:.1f}°C 超过预警阈值 {RiskAnalyzer.MEDIUM_TEMP_THRESHOLD}°C',
                'temperature_value': current_temp,
                'temperature_trend': '较高温'
            })
        
        return risks
    
    @staticmethod
    def run_full_analysis(db, batch_id: int) -> Dict[str, Any]:
        existing_risks = db.session.query(RiskRecord).filter(
            RiskRecord.point_id.in_(
                db.session.query(Point.id).filter(Point.batch_id == batch_id)
            )
        ).all()
        
        for risk in existing_risks:
            db.session.delete(risk)
        db.session.commit()
        
        all_risks = []
        stats = {
            'total_points_analyzed': 0,
            'high_risk_count': 0,
            'medium_risk_count': 0,
            'low_risk_count': 0,
            'risk_types': {}
        }
        
        points = db.session.query(Point).filter(Point.batch_id == batch_id).all()
        stats['total_points_analyzed'] = len(points)
        
        for point in points:
            latest_temp = db.session.query(TemperatureRecord).filter(
                TemperatureRecord.point_id == point.id
            ).order_by(desc(TemperatureRecord.record_time)).first()
            
            if latest_temp:
                point_risks = RiskAnalyzer.analyze_point(db, point.id, latest_temp.temperature)
                all_risks.extend(point_risks)
        
        unclosed_alerts = RiskAnalyzer.detect_unclosed_alerts(db, batch_id)
        all_risks.extend(unclosed_alerts)
        
        duplicate_points = RiskAnalyzer.detect_duplicate_points(db, batch_id)
        all_risks.extend(duplicate_points)
        
        for risk_data in all_risks:
            risk = RiskRecord(
                point_id=risk_data['point_id'],
                risk_type=risk_data['risk_type'],
                risk_level=risk_data['risk_level'],
                description=risk_data.get('description'),
                temperature_value=risk_data.get('temperature_value'),
                temperature_trend=risk_data.get('temperature_trend'),
                related_log_id=risk_data.get('related_log_id')
            )
            db.session.add(risk)
            
            if risk_data['risk_level'] == 'high':
                stats['high_risk_count'] += 1
            elif risk_data['risk_level'] == 'medium':
                stats['medium_risk_count'] += 1
            else:
                stats['low_risk_count'] += 1
            
            risk_type = risk_data['risk_type']
            stats['risk_types'][risk_type] = stats['risk_types'].get(risk_type, 0) + 1
        
        db.session.commit()
        
        return {
            'risks_created': len(all_risks),
            'statistics': stats
        }
