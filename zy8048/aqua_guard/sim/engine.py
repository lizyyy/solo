"""模拟和规则引擎模块 - 模拟未来 24 小时水质和投喂变化"""

from datetime import datetime, timedelta
from typing import Any, Dict, List

DO_NIGHT_DROP = 1.5
DO_TEMP_EFFECT = 0.1
AMMONIA_BASE_INCREASE = 0.005
AMMONIA_FEED_FACTOR = 0.02
FEED_ADJUST_THRESHOLD_DO = 4.0
FEED_ADJUST_THRESHOLD_AMMONIA = 0.15


def simulate_24h(merged_data: Dict[str, Any]) -> Dict[str, Any]:
    """模拟未来 24 小时水质和投喂变化"""
    ponds = merged_data['ponds']
    forecast = merged_data['forecast']
    now = merged_data.get('generated_at', datetime.now())
    start_hour = now.hour

    simulation_results = {}

    for pond_id, pond_data in ponds.items():
        thresholds = pond_data['thresholds']
        feed_plan = pond_data['feed_plan']
        water_history = pond_data['water_quality']

        last_do = _get_last_valid(water_history, 'dissolved_oxygen', 8.0)
        last_ammonia = _get_last_valid(water_history, 'ammonia_nitrogen', 0.05)
        last_temp = _get_last_valid(water_history, 'temperature', 25.0)

        hourly_results = []

        for hour_offset in range(24):
            current_hour = (start_hour + hour_offset) % 24
            current_ts = now + timedelta(hours=hour_offset)

            weather = _get_weather_for_hour(forecast, current_ts, current_hour)

            do_value = _simulate_do(
                last_do, current_hour, last_temp, weather, thresholds
            )
            ammonia_value = _simulate_ammonia(
                last_ammonia, current_hour, feed_plan, hour_offset
            )
            temp_value = _simulate_temp(last_temp, weather)
            adjusted_feed = _simulate_feed(
                do_value, ammonia_value, feed_plan, current_hour
            )

            risk_level = _calculate_risk(do_value, ammonia_value, thresholds)

            hourly_results.append({
                'hour_offset': hour_offset,
                'timestamp': current_ts,
                'dissolved_oxygen': round(do_value, 2),
                'ammonia_nitrogen': round(ammonia_value, 4),
                'temperature': round(temp_value, 1),
                'feed_amount': adjusted_feed,
                'risk_level': risk_level,
                'weather': weather,
            })

            last_do = do_value
            last_ammonia = ammonia_value
            last_temp = temp_value

        simulation_results[pond_id] = {
            'pond_id': pond_id,
            'hourly_results': hourly_results,
            'thresholds': thresholds,
            'feed_plan': feed_plan,
        }

    return {
        'simulation_results': simulation_results,
        'start_time': now,
        'end_time': now + timedelta(hours=24),
    }


def _get_last_valid(
    records: List[Dict[str, Any]], field: str, default: float
) -> float:
    """获取最后有效值"""
    for record in reversed(records):
        val = record.get(field)
        if val is not None:
            return val
    return default


def _get_weather_for_hour(
    forecast: Dict[str, Any], ts: datetime, hour: int
) -> Dict[str, Any]:
    """获取指定小时的天气数据"""
    forecast_list = forecast.get('forecast', [])
    if not forecast_list:
        return {'temp': 25, 'wind_speed': 5, 'cloud_cover': 50}

    for item in forecast_list:
        item_hour = item.get('hour', 0)
        if item_hour == hour or abs(item_hour - hour) < 2:
            return {
                'temp': item.get('temp', 25),
                'wind_speed': item.get('wind_speed', 5),
                'cloud_cover': item.get('cloud_cover', 50),
            }

    return {
        'temp': forecast_list[0].get('temp', 25),
        'wind_speed': forecast_list[0].get('wind_speed', 5),
        'cloud_cover': forecast_list[0].get('cloud_cover', 50),
    }


def _simulate_do(
    prev_do: float,
    hour: int,
    temp: float,
    weather: Dict[str, Any],
    thresholds: Dict[str, float]
) -> float:
    """模拟溶氧变化"""
    if 0 <= hour < 6:
        do_change = -DO_NIGHT_DROP * (1 + (30 - temp) * DO_TEMP_EFFECT / 10)
    elif 6 <= hour < 12:
        do_change = 1.5 + weather.get('wind_speed', 5) * 0.1
    elif 12 <= hour < 18:
        do_change = 0.5 - weather.get('cloud_cover', 50) * 0.01
    else:
        do_change = -0.3

    new_do = prev_do + do_change
    do_min = thresholds.get('do_min', 5.0)
    do_max = thresholds.get('do_max', 15.0)
    return max(do_min, min(do_max, new_do))


def _simulate_ammonia(
    prev_ammonia: float,
    hour: int,
    feed_plan: Dict[str, Any],
    hour_offset: int
) -> float:
    """模拟氨氮变化"""
    change = AMMONIA_BASE_INCREASE

    feed_times = feed_plan.get('feed_times', [])
    for ft in feed_times:
        feed_hour = ft.get('hour', 8)
        if hour == feed_hour:
            amount = ft.get('amount', 100)
            change += amount * AMMONIA_FEED_FACTOR / 1000

    if hour >= 18 or hour < 6:
        change += 0.003

    new_ammonia = prev_ammonia + change
    return max(0, min(2.0, new_ammonia))


def _simulate_temp(prev_temp: float, weather: Dict[str, Any]) -> float:
    """模拟温度变化"""
    target_temp = weather.get('temp', 25)
    return prev_temp + (target_temp - prev_temp) * 0.1


def _simulate_feed(
    do_value: float,
    ammonia_value: float,
    feed_plan: Dict[str, Any],
    hour: int
) -> float:
    """模拟调整后的投喂量"""
    base_amount = feed_plan.get('base_amount', 100)
    feed_times = feed_plan.get('feed_times', [])

    for ft in feed_times:
        if hour == ft.get('hour', 8):
            amount = ft.get('amount', base_amount)

            if do_value < FEED_ADJUST_THRESHOLD_DO:
                amount *= 0.5
            elif do_value < FEED_ADJUST_THRESHOLD_DO + 1:
                amount *= 0.75

            if ammonia_value > FEED_ADJUST_THRESHOLD_AMMONIA:
                amount *= 0.6

            return round(amount, 1)

    return 0.0


def _calculate_risk(
    do_value: float,
    ammonia_value: float,
    thresholds: Dict[str, float]
) -> str:
    """计算风险等级"""
    do_min = thresholds.get('do_min', 5.0)
    ammonia_max = thresholds.get('ammonia_max', 0.1)

    if do_value < do_min * 0.7 or ammonia_value > ammonia_max * 3:
        return 'critical'
    elif do_value < do_min * 0.85 or ammonia_value > ammonia_max * 2:
        return 'high'
    elif do_value < do_min or ammonia_value > ammonia_max:
        return 'medium'
    elif do_value < do_min + 1 or ammonia_value > ammonia_max * 0.8:
        return 'low'
    return 'normal'
