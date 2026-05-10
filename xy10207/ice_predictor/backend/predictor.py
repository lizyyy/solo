from datetime import datetime, timedelta, date
from collections import defaultdict
from sqlalchemy import and_, func
from .models import db, SalesRecord, Location, WeatherFeature, IcePrediction

def analyze_location_history(location_id, target_date):
    week_ago = target_date - timedelta(days=7)
    
    recent_sales = SalesRecord.query.filter(
        and_(
            SalesRecord.location_id == location_id,
            SalesRecord.date >= week_ago,
            SalesRecord.date <= target_date
        )
    ).all()
    
    if not recent_sales:
        return {
            'avg_hourly_sales': 10.0,
            'peak_hours': [12, 13, 14, 15, 16],
            'is_weekend_pattern': target_date.weekday() >= 5
        }
    
    hourly_sales = defaultdict(list)
    for s in recent_sales:
        if s.time_hour is not None:
            hourly_sales[s.time_hour].append(s.sales_volume)
    
    if not hourly_sales:
        return {
            'avg_hourly_sales': 10.0,
            'peak_hours': [12, 13, 14, 15, 16],
            'is_weekend_pattern': target_date.weekday() >= 5
        }
    
    avg_hourly = sum(sum(v) for v in hourly_sales.values()) / sum(len(v) for v in hourly_sales.values())
    
    hour_avgs = {h: sum(v) / len(v) for h, v in hourly_sales.items()}
    sorted_hours = sorted(hour_avgs.items(), key=lambda x: x[1], reverse=True)
    peak_hours = [h for h, _ in sorted_hours[:5]]
    
    return {
        'avg_hourly_sales': avg_hourly,
        'peak_hours': peak_hours,
        'is_weekend_pattern': target_date.weekday() >= 5
    }

def calculate_urgency(location, history, weather_data, current_hour):
    reason_parts = []
    urgency = 0.0
    
    base_ice_consumption_rate = history['avg_hourly_sales'] * 0.3
    if location.is_outdoor:
        base_ice_consumption_rate *= 1.5
        reason_parts.append("户外点位冰耗较高(×1.5)")
    
    temp_factor = 1.0
    if weather_data['temperature'] >= 35.0:
        temp_factor = 2.0
        reason_parts.append(f"高温{weather_data['temperature']}°C，冰耗翻倍")
    elif weather_data['temperature'] >= 32.0:
        temp_factor = 1.6
        reason_parts.append(f"高温{weather_data['temperature']}°C，冰耗×1.6")
    elif weather_data['temperature'] >= 28.0:
        temp_factor = 1.3
        reason_parts.append(f"温暖天气{weather_data['temperature']}°C，冰耗×1.3")
    
    time_factor = 1.0
    if 11 <= current_hour <= 17:
        time_factor = 1.4
        reason_parts.append(f"午间高峰时段({current_hour}时)，冰耗×1.4")
    elif current_hour in history['peak_hours']:
        time_factor = 1.3
        reason_parts.append("历史高峰时段")
    
    weekend_factor = 1.2 if history['is_weekend_pattern'] else 1.0
    if weekend_factor > 1:
        reason_parts.append("周末需求增加")
    
    adjusted_rate = base_ice_consumption_rate * temp_factor * time_factor * weekend_factor
    
    urgency += weather_data['heat_score'] * 0.5
    
    if current_hour in history['peak_hours']:
        urgency += 15.0
    
    if weather_data['temperature'] >= 35.0:
        urgency += 30.0
    elif weather_data['temperature'] >= 32.0:
        urgency += 20.0
    
    urgency += location.priority * 5
    
    if urgency >= 70:
        priority_level = 'critical'
    elif urgency >= 50:
        priority_level = 'high'
    elif urgency >= 30:
        priority_level = 'medium'
    else:
        priority_level = 'low'
    
    capacity = location.capacity or 100.0
    current_ice = capacity * 0.3
    hours_to_depletion = current_ice / adjusted_rate if adjusted_rate > 0 else 999
    
    recommended_refill = max(0, capacity - current_ice) if hours_to_depletion < 4 else 0
    
    if recommended_refill > 0:
        reason_parts.append(f"预计{hours_to_depletion:.1f}小时后缺冰，建议补冰{recommended_refill:.0f}单位")
    
    if not reason_parts:
        reason_parts.append("当前需求稳定，冰量充足")
    
    return {
        'urgency_score': round(urgency, 2),
        'priority_level': priority_level,
        'predicted_depletion_hours': round(hours_to_depletion, 2),
        'ice_remaining': round(current_ice, 2),
        'recommended_refill': round(recommended_refill, 2),
        'prediction_reason': "；".join(reason_parts),
        'adjusted_ice_rate': round(adjusted_rate, 2)
    }

def run_prediction_for_import(import_id):
    from .models import DataImport
    
    import_obj = DataImport.query.get(import_id)
    if not import_obj:
        return {'error': '导入记录不存在'}
    
    locations = Location.query.all()
    if not locations:
        return {'error': '没有点位数据'}
    
    target_date = date.today()
    current_hour = datetime.now().hour
    
    predictions_made = 0
    
    for location in locations:
        weather = WeatherFeature.query.filter(
            and_(
                WeatherFeature.location_id == location.id,
                WeatherFeature.date <= target_date
            )
        ).order_by(WeatherFeature.date.desc()).first()
        
        if weather:
            weather_data = {
                'temperature': weather.temperature or 25.0,
                'humidity': weather.humidity or 60.0,
                'heat_score': weather.heat_score or 0.0,
                'temp_category': weather.temp_category or 'mild'
            }
        else:
            weather_data = {
                'temperature': 25.0,
                'humidity': 60.0,
                'heat_score': 0.0,
                'temp_category': 'mild'
            }
        
        history = analyze_location_history(location.id, target_date)
        result = calculate_urgency(location, history, weather_data, current_hour)
        
        existing = IcePrediction.query.filter(
            and_(
                IcePrediction.import_id == import_id,
                IcePrediction.location_id == location.id,
                IcePrediction.prediction_date == target_date,
                IcePrediction.prediction_hour == current_hour
            )
        ).first()
        
        if existing:
            existing.predicted_depletion_hours = result['predicted_depletion_hours']
            existing.ice_remaining = result['ice_remaining']
            existing.recommended_refill = result['recommended_refill']
            existing.urgency_score = result['urgency_score']
            existing.priority_level = result['priority_level']
            existing.prediction_reason = result['prediction_reason']
        else:
            pred = IcePrediction(
                import_id=import_id,
                location_id=location.id,
                prediction_date=target_date,
                prediction_hour=current_hour,
                predicted_depletion_hours=result['predicted_depletion_hours'],
                ice_remaining=result['ice_remaining'],
                recommended_refill=result['recommended_refill'],
                urgency_score=result['urgency_score'],
                priority_level=result['priority_level'],
                prediction_reason=result['prediction_reason']
            )
            db.session.add(pred)
        
        predictions_made += 1
    
    import_obj.status = 'predicted'
    db.session.commit()
    
    return {
        'success': True,
        'predictions_count': predictions_made
    }

def generate_route_suggestions(import_id, limit=10):
    predictions = IcePrediction.query.filter(
        IcePrediction.import_id == import_id
    ).order_by(IcePrediction.urgency_score.desc()).limit(limit).all()
    
    if not predictions:
        return {'route': [], 'total_ice': 0}
    
    critical = []
    high = []
    medium = []
    low = []
    
    for p in predictions:
        item = {
            'location_name': p.location.name,
            'location_id': p.location.location_id,
            'priority_level': p.priority_level,
            'urgency_score': p.urgency_score,
            'recommended_refill': p.recommended_refill,
            'prediction_reason': p.prediction_reason,
            'review_status': p.review_status
        }
        
        if p.priority_level == 'critical':
            critical.append(item)
        elif p.priority_level == 'high':
            high.append(item)
        elif p.priority_level == 'medium':
            medium.append(item)
        else:
            low.append(item)
    
    ordered_route = critical + high + medium + low
    total_ice = sum(p['recommended_refill'] for p in ordered_route)
    
    route_explanation = []
    if critical:
        route_explanation.append(f"应急优先级：{len(critical)}个点位需立即处理")
    if high:
        route_explanation.append(f"高优先级：{len(high)}个点位应优先安排")
    if medium:
        route_explanation.append(f"中优先级：{len(medium)}个点位可纳入日常路线")
    
    return {
        'route': ordered_route,
        'total_ice_required': round(total_ice, 2),
        'summary': route_explanation,
        'breakdown': {
            'critical': len(critical),
            'high': len(high),
            'medium': len(medium),
            'low': len(low)
        }
    }

def review_prediction(prediction_id, review_status, review_note=''):
    pred = IcePrediction.query.get(prediction_id)
    if not pred:
        return {'error': '预测记录不存在'}
    
    valid_statuses = ['approved', 'rejected', 'adjusted', 'pending']
    if review_status not in valid_statuses:
        return {'error': f'无效的复核状态，可选值: {valid_statuses}'}
    
    pred.human_reviewed = True
    pred.review_status = review_status
    pred.review_note = review_note
    pred.reviewed_at = datetime.utcnow()
    db.session.commit()
    
    return {'success': True}
