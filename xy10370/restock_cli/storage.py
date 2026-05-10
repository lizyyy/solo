import json
import os
from dataclasses import asdict
from typing import List, Dict, Any, Optional, Type
from .models import (
    Store, Ingredient, SalesRecord, WeatherRecord, StoreActivity,
    GroupOrder, RestockSuggestion, ActualConsumption, DeviationRecord,
    WeatherType, ActivityType, OrderStatus
)


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def _enum_to_value(obj):
    if isinstance(obj, dict):
        return {k: _enum_to_value(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_enum_to_value(item) for item in obj]
    elif hasattr(obj, 'value'):
        return obj.value
    return obj


def save_to_json(filename: str, data: List[Any]) -> None:
    ensure_data_dir()
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump([_enum_to_value(asdict(item)) for item in data], f, ensure_ascii=False, indent=2)


def load_from_json(filename: str, cls: Type) -> List[Any]:
    ensure_data_dir()
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    result = []
    for item in data:
        if cls == WeatherRecord and 'weather_type' in item:
            item['weather_type'] = WeatherType(item['weather_type'])
        elif cls == StoreActivity and 'activity_type' in item:
            item['activity_type'] = ActivityType(item['activity_type'])
        elif cls == GroupOrder and 'status' in item:
            item['status'] = OrderStatus(item['status'])
        result.append(cls(**item))
    
    return result


def save_stores(stores: List[Store]) -> None:
    save_to_json('stores.json', stores)


def load_stores() -> List[Store]:
    return load_from_json('stores.json', Store)


def save_ingredients(ingredients: List[Ingredient]) -> None:
    save_to_json('ingredients.json', ingredients)


def load_ingredients() -> List[Ingredient]:
    return load_from_json('ingredients.json', Ingredient)


def save_sales(sales: List[SalesRecord]) -> None:
    save_to_json('sales.json', sales)


def load_sales() -> List[SalesRecord]:
    return load_from_json('sales.json', SalesRecord)


def save_weather(weather: List[WeatherRecord]) -> None:
    save_to_json('weather.json', weather)


def load_weather() -> List[WeatherRecord]:
    return load_from_json('weather.json', WeatherRecord)


def save_activities(activities: List[StoreActivity]) -> None:
    save_to_json('activities.json', activities)


def load_activities() -> List[StoreActivity]:
    return load_from_json('activities.json', StoreActivity)


def save_group_orders(orders: List[GroupOrder]) -> None:
    save_to_json('group_orders.json', orders)


def load_group_orders() -> List[GroupOrder]:
    return load_from_json('group_orders.json', GroupOrder)


def save_suggestions(suggestions: List[RestockSuggestion]) -> None:
    save_to_json('suggestions.json', suggestions)


def load_suggestions() -> List[RestockSuggestion]:
    return load_from_json('suggestions.json', RestockSuggestion)


def save_actual_consumption(consumptions: List[ActualConsumption]) -> None:
    save_to_json('actual_consumption.json', consumptions)


def load_actual_consumption() -> List[ActualConsumption]:
    return load_from_json('actual_consumption.json', ActualConsumption)


def save_deviations(deviations: List[DeviationRecord]) -> None:
    save_to_json('deviations.json', deviations)


def load_deviations() -> List[DeviationRecord]:
    return load_from_json('deviations.json', DeviationRecord)
