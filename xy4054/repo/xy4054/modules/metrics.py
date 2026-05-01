import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict

from config.settings import NUTRITION_ITEMS, CHRONIC_DISEASES
from models.schemas import (
    NutritionAnalysis,
    WasteAnalysis,
    ChronicAnalysis,
    DailySummary
)
from models.enums import NutritionType, ChronicDisease


def calculate_waste_rate(planned: float, actual: float, waste: float) -> float:
    if planned <= 0 and actual <= 0:
        return 0.0
    if actual > 0:
        return (waste / actual * 100) if actual > 0 else 0.0
    return (waste / planned * 100) if planned > 0 else 0.0


def calculate_nutrition_deviation(actual: float, reference: float) -> float:
    if reference <= 0:
        return 0.0
    return ((actual - reference) / reference) * 100


def detect_persistent_under_serve(under_serve_counts: pd.Series, 
                                   total_days: int, 
                                   threshold_ratio: float = 0.6) -> bool:
    if total_days == 0:
        return False
    avg_under = under_serve_counts.mean() if len(under_serve_counts) > 0 else 0
    return avg_under >= threshold_ratio


class NutritionCalculator:
    def __init__(self, dish_info: pd.DataFrame):
        self.dish_info = dish_info.copy()
        self._dish_nutrition_cache: Dict[str, Dict[str, float]] = {}
        self._build_nutrition_cache()
    
    def _build_nutrition_cache(self):
        for _, row in self.dish_info.iterrows():
            dish_code = row['dish_code']
            self._dish_nutrition_cache[dish_code] = {
                'energy_per_100g': row.get('energy_per_100g', 0.0),
                'protein_per_100g': row.get('protein_per_100g', 0.0),
                'fat_per_100g': row.get('fat_per_100g', 0.0),
                'carbs_per_100g': row.get('carbs_per_100g', 0.0),
                'sodium_per_100g': row.get('sodium_per_100g', 0.0),
                'fiber_per_100g': row.get('fiber_per_100g', 0.0)
            }
    
    def calculate_nutrition_for_weight(self, dish_code: str, weight_grams: float) -> Dict[str, float]:
        if dish_code not in self._dish_nutrition_cache:
            return {
                '能量': 0.0, '蛋白质': 0.0, '脂肪': 0.0,
                '碳水化合物': 0.0, '钠': 0.0, '膳食纤维': 0.0
            }
        
        nutrition = self._dish_nutrition_cache[dish_code]
        factor = weight_grams / 100.0
        
        return {
            '能量': nutrition['energy_per_100g'] * factor,
            '蛋白质': nutrition['protein_per_100g'] * factor,
            '脂肪': nutrition['fat_per_100g'] * factor,
            '碳水化合物': nutrition['carbs_per_100g'] * factor,
            '钠': nutrition['sodium_per_100g'] * factor,
            '膳食纤维': nutrition['fiber_per_100g'] * factor
        }
    
    def calculate_meal_nutrition(self, serving_records: pd.DataFrame) -> Dict[str, float]:
        total_nutrition = {
            '能量': 0.0, '蛋白质': 0.0, '脂肪': 0.0,
            '碳水化合物': 0.0, '钠': 0.0, '膳食纤维': 0.0
        }
        
        for _, row in serving_records.iterrows():
            dish_code = row.get('dish_code', '')
            weight = row.get('actual_weight', 0.0) - row.get('waste_weight', 0.0)
            if weight <= 0:
                weight = row.get('actual_weight', 0.0)
            
            dish_nutrition = self.calculate_nutrition_for_weight(dish_code, weight)
            for key in total_nutrition:
                total_nutrition[key] += dish_nutrition.get(key, 0.0)
        
        return total_nutrition
    
    def analyze_elderly_nutrition(self, elderly_id: str, 
                                   all_servings: pd.DataFrame,
                                   elderly_info: pd.DataFrame,
                                   period_start: date,
                                   period_end: date) -> NutritionAnalysis:
        mask = (
            (all_servings['elderly_id'] == elderly_id) &
            (all_servings['date'] >= period_start) &
            (all_servings['date'] <= period_end)
        )
        elderly_servings = all_servings[mask].copy()
        
        chronic_diseases = []
        if not elderly_info.empty and elderly_id in elderly_info['elderly_id'].values:
            diseases = elderly_info[elderly_info['elderly_id'] == elderly_id]['chronic_diseases'].iloc[0]
            if isinstance(diseases, str):
                chronic_diseases = [d.strip() for d in diseases.split(',')]
            elif isinstance(diseases, list):
                chronic_diseases = diseases
        
        total_days = (period_end - period_start).days + 1
        
        daily_nutrition = defaultdict(lambda: {
            '能量': 0.0, '蛋白质': 0.0, '脂肪': 0.0,
            '碳水化合物': 0.0, '钠': 0.0, '膳食纤维': 0.0
        })
        
        for _, row in elderly_servings.iterrows():
            meal_date = row['date']
            dish_code = row.get('dish_code', '')
            
            consumed_weight = row.get('actual_weight', 0.0)
            if 'waste_weight' in row.index and pd.notna(row['waste_weight']):
                consumed_weight = max(0, consumed_weight - row['waste_weight'])
            
            if consumed_weight > 0:
                dish_nutrition = self.calculate_nutrition_for_weight(dish_code, consumed_weight)
                for key in daily_nutrition[meal_date]:
                    daily_nutrition[meal_date][key] += dish_nutrition.get(key, 0.0)
        
        nutrition_days = len(daily_nutrition)
        avg_daily = {
            '能量': 0.0, '蛋白质': 0.0, '脂肪': 0.0,
            '碳水化合物': 0.0, '钠': 0.0, '膳食纤维': 0.0
        }
        
        if nutrition_days > 0:
            for day_nutrition in daily_nutrition.values():
                for key in avg_daily:
                    avg_daily[key] += day_nutrition[key]
            for key in avg_daily:
                avg_daily[key] /= nutrition_days
        
        daily_ref = {
            nut: NutritionType.get_daily_reference(nut)
            for nut in NutritionType.list()
        }
        
        deviation = {}
        for nut in avg_daily:
            ref = daily_ref.get(nut, 0)
            if ref > 0:
                deviation[nut] = calculate_nutrition_deviation(avg_daily[nut], ref)
            else:
                deviation[nut] = 0.0
        
        alerts = []
        alert_thresholds = {
            '钠': {'high': 120, 'low': 50, 'critical_high': 150},
            '蛋白质': {'high': 150, 'low': 70, 'critical_high': 200},
            '能量': {'high': 130, 'low': 70, 'critical_high': 150}
        }
        
        for nut, thresholds in alert_thresholds.items():
            dev = deviation.get(nut, 0)
            if dev >= thresholds.get('critical_high', 150):
                alerts.append({
                    'nutrition': nut,
                    'level': '严重超标',
                    'deviation': dev,
                    'message': f"{nut}严重超标{dev:.1f}%，需立即调整配餐"
                })
            elif dev >= thresholds.get('high', 120):
                alerts.append({
                    'nutrition': nut,
                    'level': '超标',
                    'deviation': dev,
                    'message': f"{nut}超标{dev:.1f}%，建议减少摄入"
                })
            elif dev <= thresholds.get('low', 50):
                alerts.append({
                    'nutrition': nut,
                    'level': '摄入不足',
                    'deviation': dev,
                    'message': f"{nut}摄入不足({dev:.1f}%)，建议增加"
                })
        
        return NutritionAnalysis(
            elderly_id=elderly_id,
            chronic_diseases=chronic_diseases,
            period_start=period_start,
            period_end=period_end,
            total_days=nutrition_days,
            avg_daily_nutrition=avg_daily,
            daily_reference=daily_ref,
            deviation_percent=deviation,
            alerts=alerts
        )


class WasteAnalyzer:
    def __init__(self, dish_info: pd.DataFrame):
        self.dish_info = dish_info
    
    def analyze_dish_waste(self, dish_code: str,
                           all_orders: pd.DataFrame,
                           all_servings: pd.DataFrame,
                           all_wastes: pd.DataFrame,
                           elderly_info: pd.DataFrame,
                           period_start: date,
                           period_end: date) -> WasteAnalysis:
        dish_name = ''
        dish_category = ''
        if not self.dish_info.empty:
            dish_mask = self.dish_info['dish_code'] == dish_code
            if dish_mask.any():
                dish_row = self.dish_info[dish_mask].iloc[0]
                dish_name = dish_row.get('dish_name', '')
                dish_category = dish_row.get('dish_category', '')
        
        order_mask = (
            (all_orders['dish_code'] == dish_code) &
            (all_orders['date'] >= period_start) &
            (all_orders['date'] <= period_end)
        )
        dish_orders = all_orders[order_mask]
        
        serving_mask = (
            (all_servings['dish_code'] == dish_code) &
            (all_servings['date'] >= period_start) &
            (all_servings['date'] <= period_end)
        )
        dish_servings = all_servings[serving_mask]
        
        waste_mask = (
            (all_wastes['dish_code'] == dish_code) &
            (all_wastes['date'] >= period_start) &
            (all_wastes['date'] <= period_end)
        )
        dish_wastes = all_wastes[waste_mask]
        
        total_planned = dish_orders['planned_weight'].sum() if not dish_orders.empty else 0
        total_actual = dish_servings['actual_weight'].sum() if not dish_servings.empty else 0
        total_waste = dish_wastes['waste_weight'].sum() if not dish_wastes.empty else 0
        
        total_servings = len(dish_servings)
        avg_waste_rate = calculate_waste_rate(total_planned, total_actual, total_waste)
        
        under_serve_count = 0
        if not dish_orders.empty and not dish_servings.empty:
            merged = pd.merge(
                dish_orders[['elderly_id', 'date', 'meal_type', 'planned_weight']],
                dish_servings[['elderly_id', 'date', 'meal_type', 'actual_weight']],
                on=['elderly_id', 'date', 'meal_type'],
                how='left'
            )
            under_serve_count = len(merged[
                (merged['actual_weight'] < merged['planned_weight'] * 0.9) &
                (merged['actual_weight'] > 0)
            ])
        
        under_serve_rate = (under_serve_count / total_servings * 100) if total_servings > 0 else 0
        
        is_persistent_under = False
        if not dish_servings.empty:
            daily_under = []
            merged_all = pd.merge(
                all_orders[['elderly_id', 'date', 'meal_type', 'dish_code', 'planned_weight']],
                all_servings[['elderly_id', 'date', 'meal_type', 'dish_code', 'actual_weight']],
                on=['elderly_id', 'date', 'meal_type', 'dish_code'],
                how='left'
            )
            dish_merged = merged_all[merged_all['dish_code'] == dish_code]
            
            if not dish_merged.empty:
                daily_stats = dish_merged.groupby('date').apply(
                    lambda x: (x['actual_weight'] < x['planned_weight'] * 0.9).sum() / len(x)
                )
                is_persistent_under = (daily_stats >= 0.6).any() if len(daily_stats) >= 3 else False
        
        chronic_waste_breakdown = {}
        if not dish_wastes.empty and not elderly_info.empty:
            merged_waste = pd.merge(
                dish_wastes,
                elderly_info[['elderly_id', 'chronic_diseases']],
                on='elderly_id',
                how='left'
            )
            
            for chronic in ChronicDisease.list():
                if chronic == '普通':
                    chronic_mask = (
                        merged_waste['chronic_diseases'].isna() |
                        (merged_waste['chronic_diseases'] == '') |
                        (merged_waste['chronic_diseases'] == '普通')
                    )
                else:
                    chronic_mask = merged_waste['chronic_diseases'].astype(str).str.contains(chronic)
                
                chronic_waste = merged_waste[chronic_mask]['waste_weight'].sum()
                chronic_total = dish_servings[
                    dish_servings['elderly_id'].isin(
                        elderly_info[
                            elderly_info['chronic_diseases'].astype(str).str.contains(chronic)
                            if chronic != '普通' else
                            (elderly_info['chronic_diseases'].isna() | 
                             (elderly_info['chronic_diseases'] == '') |
                             (elderly_info['chronic_diseases'] == '普通'))
                        ]['elderly_id']
                    )
                ]['actual_weight'].sum()
                
                if chronic_total > 0:
                    chronic_waste_breakdown[chronic] = (chronic_waste / chronic_total * 100)
        
        return WasteAnalysis(
            dish_code=dish_code,
            dish_name=dish_name,
            dish_category=dish_category,
            period_start=period_start,
            period_end=period_end,
            total_servings=total_servings,
            total_planned=total_planned,
            total_actual=total_actual,
            total_waste=total_waste,
            avg_waste_rate=avg_waste_rate,
            under_serve_count=under_serve_count,
            under_serve_rate=under_serve_rate,
            is_persistent_under=is_persistent_under,
            chronic_waste_breakdown=chronic_waste_breakdown
        )


class ChronicAnalyzer:
    def __init__(self, nutrition_calculator: NutritionCalculator):
        self.nutrition_calc = nutrition_calculator
    
    def analyze_chronic_group(self, chronic_type: str,
                              elderly_info: pd.DataFrame,
                              all_servings: pd.DataFrame,
                              all_wastes: pd.DataFrame,
                              period_start: date,
                              period_end: date) -> ChronicAnalysis:
        if chronic_type == '普通':
            chronic_mask = (
                elderly_info['chronic_diseases'].isna() |
                (elderly_info['chronic_diseases'] == '') |
                (elderly_info['chronic_diseases'] == '普通')
            )
        else:
            chronic_mask = elderly_info['chronic_diseases'].astype(str).str.contains(chronic_type)
        
        chronic_elderly = elderly_info[chronic_mask]
        total_persons = len(chronic_elderly)
        
        if total_persons == 0:
            return ChronicAnalysis(
                chronic_type=chronic_type,
                period_start=period_start,
                period_end=period_end,
                total_persons=0,
                avg_daily_nutrition={},
                nutrition_deviation={},
                key_concerns=[],
                improvement_suggestions=[]
            )
        
        chronic_ids = chronic_elderly['elderly_id'].unique()
        
        mask = (
            all_servings['elderly_id'].isin(chronic_ids) &
            (all_servings['date'] >= period_start) &
            (all_servings['date'] <= period_end)
        )
        chronic_servings = all_servings[mask].copy()
        
        if not all_wastes.empty:
            chronic_servings = pd.merge(
                chronic_servings,
                all_wastes[['elderly_id', 'date', 'meal_type', 'dish_code', 'waste_weight']],
                on=['elderly_id', 'date', 'meal_type', 'dish_code'],
                how='left'
            )
            chronic_servings['waste_weight'] = chronic_servings['waste_weight'].fillna(0)
        
        total_nutrition = {
            '能量': 0.0, '蛋白质': 0.0, '脂肪': 0.0,
            '碳水化合物': 0.0, '钠': 0.0, '膳食纤维': 0.0
        }
        person_days = defaultdict(set)
        
        for _, row in chronic_servings.iterrows():
            elderly_id = row['elderly_id']
            meal_date = row['date']
            dish_code = row.get('dish_code', '')
            
            consumed_weight = row.get('actual_weight', 0.0)
            if 'waste_weight' in row.index:
                consumed_weight = max(0, consumed_weight - row.get('waste_weight', 0))
            
            if consumed_weight > 0:
                dish_nutrition = self.nutrition_calc.calculate_nutrition_for_weight(
                    dish_code, consumed_weight
                )
                for key in total_nutrition:
                    total_nutrition[key] += dish_nutrition.get(key, 0.0)
                person_days[elderly_id].add(meal_date)
        
        total_unique_days = sum(len(days) for days in person_days.values())
        
        avg_daily = {}
        if total_unique_days > 0:
            for key in total_nutrition:
                avg_daily[key] = total_nutrition[key] / total_unique_days
        else:
            avg_daily = total_nutrition.copy()
        
        daily_ref = {
            nut: NutritionType.get_daily_reference(nut)
            for nut in NutritionType.list()
        }
        
        deviation = {}
        for nut in avg_daily:
            ref = daily_ref.get(nut, 0)
            if ref > 0:
                deviation[nut] = calculate_nutrition_deviation(avg_daily[nut], ref)
            else:
                deviation[nut] = 0.0
        
        key_concerns = []
        suggestions = []
        
        chronic_restrictions = ChronicDisease.get_restrictions(chronic_type)
        
        if chronic_type == '糖尿病':
            if deviation.get('碳水化合物', 0) > 20:
                key_concerns.append(f"碳水化合物摄入超标 {deviation['碳水化合物']:.1f}%")
                suggestions.append("建议减少主食量，增加蔬菜比例")
            if deviation.get('能量', 0) > 20:
                key_concerns.append(f"能量摄入超标 {deviation['能量']:.1f}%")
                suggestions.append("控制总能量摄入，选择低GI食物")
        
        elif chronic_type == '高血压':
            if deviation.get('钠', 0) > 20:
                key_concerns.append(f"钠摄入严重超标 {deviation['钠']:.1f}%")
                suggestions.append("立即减少盐摄入，选用低钠菜品")
            elif deviation.get('钠', 0) > 0:
                key_concerns.append(f"钠摄入超标 {deviation['钠']:.1f}%")
                suggestions.append("注意控制钠摄入，查看菜品钠含量")
        
        elif chronic_type == '高血脂':
            if deviation.get('脂肪', 0) > 30:
                key_concerns.append(f"脂肪摄入严重超标 {deviation['脂肪']:.1f}%")
                suggestions.append("选择 lean 肉类，增加鱼类摄入")
            elif deviation.get('脂肪', 0) > 10:
                key_concerns.append(f"脂肪摄入超标 {deviation['脂肪']:.1f}%")
                suggestions.append("减少油脂摄入，选择蒸煮方式")
        
        elif chronic_type == '肾病':
            if deviation.get('蛋白质', 0) > 50:
                key_concerns.append(f"蛋白质摄入严重超标 {deviation['蛋白质']:.1f}%")
                suggestions.append("严格控制蛋白质摄入，选择优质蛋白")
            elif deviation.get('蛋白质', 0) > 20:
                key_concerns.append(f"蛋白质摄入超标 {deviation['蛋白质']:.1f}%")
                suggestions.append("注意控制蛋白质摄入量")
        
        if not key_concerns:
            key_concerns.append("营养摄入整体在合理范围内")
            suggestions.append("继续保持当前配餐方案")
        
        return ChronicAnalysis(
            chronic_type=chronic_type,
            period_start=period_start,
            period_end=period_end,
            total_persons=total_persons,
            avg_daily_nutrition=avg_daily,
            nutrition_deviation=deviation,
            key_concerns=key_concerns,
            improvement_suggestions=suggestions
        )


class MetricsEngine:
    def __init__(self, dish_info: pd.DataFrame, elderly_info: pd.DataFrame):
        self.dish_info = dish_info
        self.elderly_info = elderly_info
        self.nutrition_calc = NutritionCalculator(dish_info)
        self.waste_analyzer = WasteAnalyzer(dish_info)
        self.chronic_analyzer = ChronicAnalyzer(self.nutrition_calc)
    
    def generate_daily_summary(self, date: date, meal_type: str,
                               orders: pd.DataFrame,
                               servings: pd.DataFrame,
                               wastes: pd.DataFrame) -> DailySummary:
        order_mask = (orders['date'] == date) & (orders['meal_type'] == meal_type)
        serving_mask = (servings['date'] == date) & (servings['meal_type'] == meal_type)
        waste_mask = (wastes['date'] == date) & (wastes['meal_type'] == meal_type)
        
        day_orders = orders[order_mask]
        day_servings = servings[serving_mask]
        day_wastes = wastes[waste_mask]
        
        total_orders = len(day_orders)
        total_elderly = day_orders['elderly_id'].nunique()
        total_dishes = day_orders['dish_code'].nunique()
        
        total_planned = day_orders['planned_weight'].sum()
        total_actual = day_servings['actual_weight'].sum()
        total_waste = day_wastes['waste_weight'].sum()
        
        waste_rate = calculate_waste_rate(total_planned, total_actual, total_waste)
        
        chronic_breakdown = {}
        if not self.elderly_info.empty:
            elderly_ids = day_orders['elderly_id'].unique()
            elderly_subset = self.elderly_info[
                self.elderly_info['elderly_id'].isin(elderly_ids)
            ]
            
            for chronic in ChronicDisease.list():
                if chronic == '普通':
                    mask = (
                        elderly_subset['chronic_diseases'].isna() |
                        (elderly_subset['chronic_diseases'] == '') |
                        (elderly_subset['chronic_diseases'] == '普通')
                    )
                else:
                    mask = elderly_subset['chronic_diseases'].astype(str).str.contains(chronic)
                chronic_breakdown[chronic] = mask.sum()
        
        avg_nutrition = {}
        if not day_servings.empty:
            merged = pd.merge(
                day_servings,
                day_wastes[['elderly_id', 'date', 'meal_type', 'dish_code', 'waste_weight']],
                on=['elderly_id', 'date', 'meal_type', 'dish_code'],
                how='left'
            )
            merged['waste_weight'] = merged['waste_weight'].fillna(0)
            
            total_nutrition = self.nutrition_calc.calculate_meal_nutrition(merged)
            if total_elderly > 0:
                avg_nutrition = {k: v / total_elderly for k, v in total_nutrition.items()}
        
        return DailySummary(
            date=date,
            meal_type=meal_type,
            total_orders=total_orders,
            total_elderly=total_elderly,
            total_dishes=total_dishes,
            total_planned_weight=total_planned,
            total_actual_weight=total_actual,
            total_waste_weight=total_waste,
            waste_rate=waste_rate,
            avg_nutrition=avg_nutrition,
            chronic_breakdown=chronic_breakdown
        )
    
    def get_all_waste_analysis(self, orders: pd.DataFrame,
                               servings: pd.DataFrame,
                               wastes: pd.DataFrame,
                               period_start: date,
                               period_end: date) -> List[WasteAnalysis]:
        dish_codes = set()
        dish_codes.update(orders['dish_code'].unique())
        dish_codes.update(servings['dish_code'].unique())
        dish_codes.update(wastes['dish_code'].unique())
        
        results = []
        for dish_code in dish_codes:
            analysis = self.waste_analyzer.analyze_dish_waste(
                dish_code, orders, servings, wastes, self.elderly_info,
                period_start, period_end
            )
            results.append(analysis)
        
        return sorted(results, key=lambda x: x.avg_waste_rate, reverse=True)
    
    def get_all_chronic_analysis(self, servings: pd.DataFrame,
                                 wastes: pd.DataFrame,
                                 period_start: date,
                                 period_end: date) -> List[ChronicAnalysis]:
        results = []
        for chronic in ChronicDisease.list():
            analysis = self.chronic_analyzer.analyze_chronic_group(
                chronic, self.elderly_info, servings, wastes,
                period_start, period_end
            )
            results.append(analysis)
        
        return results
