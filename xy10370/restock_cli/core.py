from datetime import date, timedelta, datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    Store, Ingredient, SalesRecord, WeatherRecord, StoreActivity,
    GroupOrder, RestockSuggestion, ActualConsumption, DeviationRecord,
    WeatherType, ActivityType, OrderStatus
)
from .storage import (
    load_stores, load_ingredients, load_sales, load_weather, load_activities,
    load_group_orders, load_suggestions, load_actual_consumption, load_deviations,
    save_sales, save_weather, save_activities, save_group_orders,
    save_suggestions, save_actual_consumption, save_deviations, save_stores, save_ingredients
)


def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, '%Y-%m-%d').date()


def date_to_str(d: date) -> str:
    return d.strftime('%Y-%m-%d')


def init_system():
    stores = load_stores()
    if not stores:
        stores = [
            Store(store_id='S001', name='中心店', address='市中心商业街1号'),
            Store(store_id='S002', name='校园店', address='大学城校区内')
        ]
        save_stores(stores)
    
    ingredients = load_ingredients()
    if not ingredients:
        ingredients = [
            Ingredient(ingredient_id='I001', name='鸡胸肉', unit='kg'),
            Ingredient(ingredient_id='I002', name='生菜', unit='kg'),
            Ingredient(ingredient_id='I003', name='番茄', unit='kg'),
            Ingredient(ingredient_id='I004', name='土豆', unit='kg'),
            Ingredient(ingredient_id='I005', name='米饭', unit='kg')
        ]
        save_ingredients(ingredients)
    
    return stores, ingredients


def import_sales_records(records: List[SalesRecord]) -> Tuple[List[str], List[str]]:
    existing_sales = load_sales()
    existing_keys = {(s.date, s.store_id, s.ingredient_id): s for s in existing_sales}
    
    updated = []
    added = []
    
    for record in records:
        key = (record.date, record.store_id, record.ingredient_id)
        if key in existing_keys:
            existing_keys[key].quantity = record.quantity
            updated.append(f"{record.date}:{record.store_id}:{record.ingredient_id}")
        else:
            existing_keys[key] = record
            added.append(f"{record.date}:{record.store_id}:{record.ingredient_id}")
    
    save_sales(list(existing_keys.values()))
    return added, updated


def import_weather_records(records: List[WeatherRecord]) -> Tuple[List[str], List[str]]:
    existing_weather = load_weather()
    existing_keys = {(w.date, w.store_id): w for w in existing_weather}
    
    updated = []
    added = []
    
    for record in records:
        key = (record.date, record.store_id)
        if key in existing_keys:
            existing_keys[key].weather_type = record.weather_type
            existing_keys[key].temperature = record.temperature
            updated.append(f"{record.date}:{record.store_id}")
        else:
            existing_keys[key] = record
            added.append(f"{record.date}:{record.store_id}")
    
    save_weather(list(existing_keys.values()))
    return added, updated


def import_activities(activities: List[StoreActivity]) -> Tuple[List[str], List[str]]:
    existing_activities = load_activities()
    existing_keys = {(a.date, a.store_id): a for a in existing_activities}
    
    updated = []
    added = []
    
    for activity in activities:
        key = (activity.date, activity.store_id)
        if key in existing_keys:
            existing_keys[key].activity_type = activity.activity_type
            existing_keys[key].impact_factor = activity.impact_factor
            updated.append(f"{activity.date}:{activity.store_id}")
        else:
            existing_keys[key] = activity
            added.append(f"{activity.date}:{activity.store_id}")
    
    save_activities(list(existing_keys.values()))
    return added, updated


def import_group_orders(orders: List[GroupOrder]) -> Tuple[List[str], List[str]]:
    existing_orders = load_group_orders()
    existing_keys = {o.order_id: o for o in existing_orders}
    
    updated = []
    added = []
    
    for order in orders:
        key = order.order_id
        if key in existing_keys:
            if existing_keys[key].status != order.status:
                updated.append(f"{order.order_id}")
            existing_keys[key].date = order.date
            existing_keys[key].store_id = order.store_id
            existing_keys[key].ingredient_id = order.ingredient_id
            existing_keys[key].quantity = order.quantity
            existing_keys[key].status = order.status
        else:
            existing_keys[key] = order
            added.append(f"{order.order_id}")
    
    save_group_orders(list(existing_keys.values()))
    return added, updated


def get_weather_for_date(weather_records: List[WeatherRecord], target_date: str, store_id: str) -> WeatherRecord:
    for w in weather_records:
        if w.date == target_date and w.store_id == store_id:
            return w
    return WeatherRecord(
        date=target_date,
        store_id=store_id,
        weather_type=WeatherType.SUNNY,
        temperature=20.0
    )


def get_activity_for_date(activities: List[StoreActivity], target_date: str, store_id: str) -> StoreActivity:
    for a in activities:
        if a.date == target_date and a.store_id == store_id:
            return a
    return StoreActivity(
        date=target_date,
        store_id=store_id,
        activity_type=ActivityType.NORMAL,
        impact_factor=1.0
    )


def get_group_orders_for_date(orders: List[GroupOrder], target_date: str, store_id: str) -> Dict[str, float]:
    result = defaultdict(float)
    for order in orders:
        if (order.date == target_date and 
            order.store_id == store_id and 
            order.status == OrderStatus.CONFIRMED):
            result[order.ingredient_id] += order.quantity
    return dict(result)


def get_historical_sales(
    sales_records: List[SalesRecord],
    target_date: str,
    store_id: str,
    ingredient_id: str,
    days_count: int = 14
) -> List[float]:
    target = parse_date(target_date)
    start_date = target - timedelta(days=days_count)
    
    sales = []
    for s in sales_records:
        if (s.store_id == store_id and 
            s.ingredient_id == ingredient_id):
            s_date = parse_date(s.date)
            if start_date <= s_date < target:
                sales.append(s.quantity)
    
    return sales


def calculate_baseline(sales: List[float]) -> float:
    if not sales:
        return 0.0
    return sum(sales) / len(sales)


def get_weather_impact(weather: WeatherRecord) -> Tuple[float, str]:
    if weather.weather_type == WeatherType.RAINY:
        return 0.85, f"雨天({weather.temperature}°C)：堂食减少15%"
    elif weather.weather_type == WeatherType.SNOWY:
        return 0.75, f"雪天({weather.temperature}°C)：堂食减少25%"
    elif weather.weather_type == WeatherType.CLOUDY:
        return 0.95, f"阴天({weather.temperature}°C)：影响较小"
    else:
        return 1.0, f"晴天({weather.temperature}°C)：无天气影响"


def get_activity_impact(activity: StoreActivity) -> Tuple[float, str]:
    if activity.activity_type == ActivityType.PROMOTION:
        factor = activity.impact_factor if activity.impact_factor != 1.0 else 1.3
        return factor, f"促销活动：销量增加{int((factor-1)*100)}%"
    elif activity.activity_type == ActivityType.HOLIDAY:
        factor = activity.impact_factor if activity.impact_factor != 1.0 else 1.2
        return factor, f"节假日：销量增加{int((factor-1)*100)}%"
    else:
        return 1.0, "无活动"


def generate_restock_suggestions(target_date: str) -> List[RestockSuggestion]:
    stores = load_stores()
    ingredients = load_ingredients()
    sales = load_sales()
    weather_records = load_weather()
    activities = load_activities()
    group_orders = load_group_orders()
    existing_suggestions = load_suggestions()
    
    suggestions = []
    
    for store in stores:
        for ingredient in ingredients:
            historical_sales = get_historical_sales(
                sales, target_date, store.store_id, ingredient.ingredient_id
            )
            baseline = calculate_baseline(historical_sales)
            
            weather = get_weather_for_date(weather_records, target_date, store.store_id)
            weather_factor, weather_reason = get_weather_impact(weather)
            
            activity = get_activity_for_date(activities, target_date, store.store_id)
            activity_factor, activity_reason = get_activity_impact(activity)
            
            orders = get_group_orders_for_date(group_orders, target_date, store.store_id)
            group_order_qty = orders.get(ingredient.ingredient_id, 0.0)
            
            adjusted_quantity = baseline * weather_factor * activity_factor
            suggested_quantity = adjusted_quantity + group_order_qty
            
            existing = None
            for s in existing_suggestions:
                if (s.date == target_date and 
                    s.store_id == store.store_id and 
                    s.ingredient_id == ingredient.ingredient_id):
                    existing = s
                    break
            
            adjustment_reasons = [weather_reason, activity_reason]
            if group_order_qty > 0:
                adjustment_reasons.append(f"团餐订单：+{group_order_qty}kg")
            
            suggestion = RestockSuggestion(
                date=target_date,
                store_id=store.store_id,
                ingredient_id=ingredient.ingredient_id,
                base_estimate=baseline,
                weather_adjustment=baseline * (weather_factor - 1),
                activity_adjustment=baseline * (activity_factor - 1),
                group_order_quantity=group_order_qty,
                suggested_quantity=suggested_quantity,
                adjusted_quantity=existing.adjusted_quantity if existing else None,
                adjustment_reason="; ".join(adjustment_reasons)
            )
            suggestions.append(suggestion)
    
    save_suggestions(suggestions)
    return suggestions


def adjust_suggestion(target_date: str, store_id: str, ingredient_id: str, new_quantity: float, reason: str) -> bool:
    suggestions = load_suggestions()
    
    for suggestion in suggestions:
        if (suggestion.date == target_date and 
            suggestion.store_id == store_id and 
            suggestion.ingredient_id == ingredient_id):
            suggestion.adjusted_quantity = new_quantity
            if reason:
                suggestion.adjustment_reason = reason
            save_suggestions(suggestions)
            return True
    
    return False


def record_actual_consumption(consumptions: List[ActualConsumption]) -> Tuple[List[str], List[str]]:
    existing = load_actual_consumption()
    existing_keys = {(c.date, c.store_id, c.ingredient_id): c for c in existing}
    
    updated = []
    added = []
    
    for consumption in consumptions:
        key = (consumption.date, consumption.store_id, consumption.ingredient_id)
        if key in existing_keys:
            existing_keys[key].actual_quantity = consumption.actual_quantity
            existing_keys[key].deviation_reason = consumption.deviation_reason
            updated.append(f"{consumption.date}:{consumption.store_id}:{consumption.ingredient_id}")
        else:
            existing_keys[key] = consumption
            added.append(f"{consumption.date}:{consumption.store_id}:{consumption.ingredient_id}")
    
    save_actual_consumption(list(existing_keys.values()))
    
    generate_deviation_records()
    
    return added, updated


def generate_deviation_records() -> List[DeviationRecord]:
    suggestions = load_suggestions()
    consumptions = load_actual_consumption()
    existing_deviations = load_deviations()
    
    dev_dict = {(d.date, d.store_id, d.ingredient_id): d for d in existing_deviations}
    cons_dict = {(c.date, c.store_id, c.ingredient_id): c for c in consumptions}
    
    for suggestion in suggestions:
        key = (suggestion.date, suggestion.store_id, suggestion.ingredient_id)
        if key in cons_dict:
            cons = cons_dict[key]
            suggested = suggestion.adjusted_quantity if suggestion.adjusted_quantity is not None else suggestion.suggested_quantity
            deviation = cons.actual_quantity - suggested
            
            if key in dev_dict:
                dev_dict[key].suggested_quantity = suggested
                dev_dict[key].actual_quantity = cons.actual_quantity
                dev_dict[key].deviation = deviation
                dev_dict[key].deviation_reason = cons.deviation_reason
            else:
                dev_dict[key] = DeviationRecord(
                    date=suggestion.date,
                    store_id=suggestion.store_id,
                    ingredient_id=suggestion.ingredient_id,
                    suggested_quantity=suggested,
                    actual_quantity=cons.actual_quantity,
                    deviation=deviation,
                    deviation_reason=cons.deviation_reason
                )
    
    save_deviations(list(dev_dict.values()))
    return list(dev_dict.values())


def get_previous_deviation(target_date: str, store_id: str, ingredient_id: str) -> Optional[DeviationRecord]:
    target = parse_date(target_date)
    prev_date = date_to_str(target - timedelta(days=1))
    
    deviations = load_deviations()
    for d in deviations:
        if d.date == prev_date and d.store_id == store_id and d.ingredient_id == ingredient_id:
            return d
    return None
