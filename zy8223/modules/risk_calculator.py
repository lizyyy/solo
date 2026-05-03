import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime


class RiskCalculator:
    def __init__(self, rules: Dict[str, Any]):
        self.rules = rules
        self.weather_data: pd.DataFrame = pd.DataFrame()
        self.inspection_events: pd.DataFrame = pd.DataFrame()

    def set_weather_data(self, weather_df: pd.DataFrame):
        self.weather_data = weather_df

    def set_inspection_events(self, inspection_df: pd.DataFrame):
        self.inspection_events = inspection_df

    def calculate_wind_risk(self, tree_row: pd.Series, typhoon_period: Optional[Dict] = None) -> Dict:
        """
        计算风雨暴露风险
        考虑跨午夜台风过程的连续性
        """
        wind_rules = self.rules.get('wind_risk', {})
        thresholds = wind_rules.get('thresholds', [
            {'wind_speed': 10, 'risk_level': 'low'},
            {'wind_speed': 20, 'risk_level': 'medium'},
            {'wind_speed': 30, 'risk_level': 'high'}
        ])
        weights = wind_rules.get('weights', {'exposure_hours': 0.3, 'max_wind': 0.7})

        if not self.weather_data.empty:
            if typhoon_period:
                period_df = self._get_weather_in_period(typhoon_period)
            else:
                period_df = self.weather_data.copy()

            if not period_df.empty and 'wind_speed' in period_df.columns:
                max_wind = period_df['wind_speed'].max()
                avg_wind = period_df['wind_speed'].mean()
                exposure_hours = len(period_df)
                
                risk_score = 0
                risk_level = 'low'

                for threshold in thresholds:
                    if max_wind >= threshold['wind_speed']:
                        risk_level = threshold['risk_level']

                normalized_wind = min(max_wind / 50, 1.0) * 100
                normalized_exposure = min(exposure_hours / 24, 1.0) * 100
                risk_score = normalized_wind * weights['max_wind'] + \
                             normalized_exposure * weights['exposure_hours']

                return {
                    'wind_risk_score': risk_score,
                    'wind_risk_level': risk_level,
                    'max_wind_speed': max_wind,
                    'avg_wind_speed': avg_wind,
                    'exposure_hours': exposure_hours,
                    'typhoon_period': typhoon_period.get('label') if typhoon_period else '全部时段'
                }

        return {
            'wind_risk_score': 0,
            'wind_risk_level': 'low',
            'max_wind_speed': 0,
            'avg_wind_speed': 0,
            'exposure_hours': 0,
            'typhoon_period': '无气象数据'
        }

    def _get_weather_in_period(self, period: Dict) -> pd.DataFrame:
        """
        获取指定时间段内的气象数据，处理跨午夜情况
        """
        if self.weather_data.empty or 'time' not in self.weather_data.columns:
            return pd.DataFrame()

        start_time = period.get('start')
        end_time = period.get('end')

        if start_time is None or end_time is None:
            return pd.DataFrame()

        mask = (self.weather_data['time'] >= start_time) & \
               (self.weather_data['time'] <= end_time)
        
        return self.weather_data[mask].copy()

    def calculate_root_risk(self, tree_row: pd.Series) -> Dict:
        """
        计算浅根风险
        """
        root_rules = self.rules.get('root_risk', {})
        categories = root_rules.get('categories', {'浅根': 'high', '中根': 'medium', '深根': 'low'})
        shallow_root_factor = root_rules.get('shallow_root_factor', 1.5)

        root_category = tree_row.get('root_depth_category', '未知')
        
        risk_score = 0
        risk_level = 'low'

        if root_category == '浅根':
            risk_score = 80 * shallow_root_factor
            risk_level = categories.get('浅根', 'high')
        elif root_category == '中根':
            risk_score = 50
            risk_level = categories.get('中根', 'medium')
        elif root_category == '深根':
            risk_score = 20
            risk_level = categories.get('深根', 'low')
        else:
            risk_score = 50
            risk_level = 'medium'

        return {
            'root_risk_score': min(risk_score, 100),
            'root_risk_level': risk_level,
            'root_depth_category': root_category,
            'is_shallow_root': root_category == '浅根'
        }

    def calculate_age_risk(self, tree_row: pd.Series) -> Dict:
        """
        计算高龄风险
        """
        age_rules = self.rules.get('age_risk', {})
        old_threshold = age_rules.get('old_tree_age_threshold', 30)
        young_threshold = age_rules.get('young_tree_age_threshold', 10)
        age_factor = age_rules.get('age_factor', {'old': 1.5, 'young': 0.8, 'normal': 1.0})

        tree_age = tree_row.get('tree_age', np.nan)
        age_category = tree_row.get('tree_age_category', '未知')

        risk_score = 0
        risk_level = 'medium'
        actual_age_category = 'normal'

        if pd.isna(tree_age):
            risk_score = 50
            risk_level = 'medium'
        elif tree_age >= old_threshold:
            risk_score = 75 * age_factor.get('old', 1.5)
            risk_level = 'high'
            actual_age_category = 'old'
        elif tree_age <= young_threshold:
            risk_score = 40 * age_factor.get('young', 0.8)
            risk_level = 'low'
            actual_age_category = 'young'
        else:
            risk_score = 50 * age_factor.get('normal', 1.0)
            risk_level = 'medium'
            actual_age_category = 'normal'

        return {
            'age_risk_score': min(risk_score, 100),
            'age_risk_level': risk_level,
            'tree_age': tree_age if not pd.isna(tree_age) else None,
            'tree_age_category': age_category,
            'age_risk_category': actual_age_category,
            'is_old_tree': actual_age_category == 'old'
        }

    def calculate_water_risk(self, tree_row: pd.Series, typhoon_period: Optional[Dict] = None) -> Dict:
        """
        计算积水风险
        考虑台风期间的降雨量
        """
        water_rules = self.rules.get('water_risk', {})
        rainfall_threshold = water_rules.get('rainfall_threshold', 50)
        water_pool_factor = water_rules.get('water_pool_factor', 1.3)

        has_water_pool = tree_row.get('has_water_pool', False)
        
        total_rainfall = 0
        if not self.weather_data.empty:
            if typhoon_period:
                period_df = self._get_weather_in_period(typhoon_period)
            else:
                period_df = self.weather_data.copy()

            if not period_df.empty and 'rainfall' in period_df.columns:
                total_rainfall = period_df['rainfall'].sum()

        risk_score = 0
        risk_level = 'low'

        if total_rainfall >= rainfall_threshold:
            if has_water_pool:
                risk_score = 70 * water_pool_factor
                risk_level = 'high'
            else:
                risk_score = 60
                risk_level = 'medium'
        elif total_rainfall >= rainfall_threshold * 0.5:
            if has_water_pool:
                risk_score = 50 * water_pool_factor
                risk_level = 'medium'
            else:
                risk_score = 40
                risk_level = 'low'
        else:
            if has_water_pool:
                risk_score = 35
                risk_level = 'low'
            else:
                risk_score = 20
                risk_level = 'low'

        return {
            'water_risk_score': min(risk_score, 100),
            'water_risk_level': risk_level,
            'total_rainfall': total_rainfall,
            'has_water_pool': has_water_pool,
            'rainfall_threshold': rainfall_threshold
        }

    def calculate_overall_risk(self, wind_risk: Dict, root_risk: Dict, 
                           age_risk: Dict, water_risk: Dict) -> Dict:
        """
        计算综合风险
        """
        overall_rules = self.rules.get('overall_risk', {})
        weights = overall_rules.get('weights', {
            'wind_risk': 0.35,
            'root_risk': 0.25,
            'age_risk': 0.20,
            'water_risk': 0.20
        })
        thresholds = overall_rules.get('thresholds', {'low': 30, 'medium': 60, 'high': 80})

        weighted_score = (
            wind_risk.get('wind_risk_score', 0) * weights.get('wind_risk', 0.35) +
            root_risk.get('root_risk_score', 0) * weights.get('root_risk', 0.25) +
            age_risk.get('age_risk_score', 0) * weights.get('age_risk', 0.20) +
            water_risk.get('water_risk_score', 0) * weights.get('water_risk', 0.20)
        )

        if weighted_score >= thresholds.get('high', 80):
            risk_level = 'high'
            priority = 1
        elif weighted_score >= thresholds.get('medium', 60):
            risk_level = 'medium'
            priority = 2
        elif weighted_score >= thresholds.get('low', 30):
            risk_level = 'low'
            priority = 3
        else:
            risk_level = 'very_low'
            priority = 4

        risk_level_cn = {
            'very_low': '极低',
            'low': '低',
            'medium': '中',
            'high': '高'
        }.get(risk_level, '未知')

        return {
            'overall_risk_score': round(weighted_score, 2),
            'overall_risk_level': risk_level,
            'overall_risk_level_cn': risk_level_cn,
            'priority': priority,
            'risk_weights': weights
        }

    def get_tree_inspections(self, tree_id: str) -> pd.DataFrame:
        """
        获取同一树木的所有巡查记录
        处理重复巡查的情况，返回最新的状态
        """
        if self.inspection_events.empty or 'tree_id' not in self.inspection_events.columns:
            return pd.DataFrame()

        tree_inspections = self.inspection_events[
            self.inspection_events['tree_id'] == str(tree_id)
        ].copy()

        if not tree_inspections.empty and 'inspection_time' in tree_inspections.columns:
            tree_inspections = tree_inspections.sort_values('inspection_time', ascending=False)

        return tree_inspections

    def get_latest_inspection_status(self, tree_id: str) -> Dict:
        """
        获取树木最新的巡查状态
        处理同一树木多次巡查的情况，取最新的状态
        """
        inspections = self.get_tree_inspections(tree_id)
        
        if inspections.empty:
            return {
                'has_inspection': False,
                'disposal_status': 'unknown',
                'disposal_status_cn': '未知',
                'latest_inspection_time': None,
                'inspection_count': 0,
                'damage_type': None,
                'damage_type_cn': None
            }

        latest = inspections.iloc[0]
        inspection_count = len(inspections)

        status_mapping_cn = {
            'resolved': '已处置',
            'processing': '处置中',
            'pending': '待处置',
            'no_action': '无需处置',
            'unknown': '未知'
        }

        damage_types = self.rules.get('damage_types', {
            'fall_over': '倒伏',
            'branch_break': '断枝',
            'leaning': '倾斜',
            'root_exposed': '露根'
        })

        damage_type = latest.get('damage_type', None)
        damage_type_cn = damage_types.get(damage_type, damage_type) if damage_type else None

        return {
            'has_inspection': True,
            'disposal_status': latest.get('disposal_status_standard', 'unknown'),
            'disposal_status_cn': status_mapping_cn.get(
                latest.get('disposal_status_standard', 'unknown'), '未知'
            ),
            'latest_inspection_time': latest.get('inspection_time'),
            'inspection_count': inspection_count,
            'damage_type': damage_type,
            'damage_type_cn': damage_type_cn,
            'is_fall_over': damage_type == 'fall_over',
            'is_branch_break': damage_type in ['branch_break', '断枝'],
            'is_damaged': damage_type is not None and damage_type != 'none'
        }

    def calculate_tree_risk(self, tree_row: pd.Series, 
                           typhoon_period: Optional[Dict] = None) -> Dict:
        """
        计算单棵树的完整风险评估
        """
        wind_risk = self.calculate_wind_risk(tree_row, typhoon_period)
        root_risk = self.calculate_root_risk(tree_row)
        age_risk = self.calculate_age_risk(tree_row)
        water_risk = self.calculate_water_risk(tree_row, typhoon_period)
        overall_risk = self.calculate_overall_risk(wind_risk, root_risk, age_risk, water_risk)

        tree_id = tree_row.get('tree_id', '')
        inspection_status = self.get_latest_inspection_status(tree_id)

        risk_factors = {
            'has_shallow_root': root_risk.get('is_shallow_root', False),
            'is_old_tree': age_risk.get('is_old_tree', False),
            'has_water_pool': water_risk.get('has_water_pool', False),
            'is_damaged': inspection_status.get('is_damaged', False)
        }

        risk_tags = []
        if risk_factors['has_shallow_root']:
            risk_tags.append('浅根')
        if risk_factors['is_old_tree']:
            risk_tags.append('高龄')
        if risk_factors['has_water_pool']:
            risk_tags.append('易积水')
        if risk_factors['is_damaged']:
            risk_tags.append('已受损')

        result = {
            'tree_id': tree_row.get('tree_id', ''),
            'road_name': tree_row.get('road_name', ''),
            'tree_species': tree_row.get('tree_species', ''),
            'latitude': tree_row.get('latitude'),
            'longitude': tree_row.get('longitude'),
            'has_coordinates': tree_row.get('has_coordinates', False),
            'tree_age': age_risk.get('tree_age'),
            'tree_age_category': age_risk.get('tree_age_category'),
            'root_depth_category': root_risk.get('root_depth_category'),
            'risk_tags': risk_tags,
            'risk_factors': risk_factors,
            **wind_risk,
            **root_risk,
            **age_risk,
            **water_risk,
            **overall_risk,
            **inspection_status
        }

        return result

    def calculate_all_trees_risk(self, trees_df: pd.DataFrame, 
                           typhoon_period: Optional[Dict] = None) -> pd.DataFrame:
        """
        批量计算所有树木的风险
        """
        risk_results = []

        for idx, row in trees_df.iterrows():
            try:
                risk = self.calculate_tree_risk(row, typhoon_period)
                risk_results.append(risk)
            except Exception as e:
                print(f"计算树木 {row.get('tree_id', idx)} 风险时出错: {e}")
                continue

        if not risk_results:
            return pd.DataFrame()

        return pd.DataFrame(risk_results)

    def filter_risk_list(self, risk_df: pd.DataFrame, 
                       filters: Optional[Dict] = None) -> pd.DataFrame:
        """
        按条件筛选风险列表
        支持按路段、树种、处置状态筛选
        """
        if risk_df.empty:
            return risk_df

        filtered_df = risk_df.copy()

        if filters is None:
            filters = {}

        if 'road_names' in filters and filters['road_names']:
            filtered_df = filtered_df[
                filtered_df['road_name'].isin(filters['road_names'])
            ]

        if 'tree_species' in filters and filters['tree_species']:
            filtered_df = filtered_df[
                filtered_df['tree_species'].isin(filters['tree_species'])
            ]

        if 'disposal_status' in filters and filters['disposal_status']:
            if 'all' not in filters['disposal_status']:
                filtered_df = filtered_df[
                    filtered_df['disposal_status'].isin(filters['disposal_status'])
                ]

        if 'risk_levels' in filters and filters['risk_levels']:
            if 'all' not in filters['risk_levels']:
                filtered_df = filtered_df[
                    filtered_df['overall_risk_level'].isin(filters['risk_levels'])
                ]

        if 'damage_types' in filters and filters['damage_types']:
            if 'fall_over' in filters['damage_types']:
                filtered_df = filtered_df[filtered_df['is_fall_over'] | (filtered_df['damage_type'] == 'fall_over')]
            elif 'branch_break' in filters['damage_types']:
                filtered_df = filtered_df[filtered_df['is_branch_break'] | (filtered_df['damage_type'] == 'branch_break')]

        return filtered_df

    def get_priority_disposal_list(self, risk_df: pd.DataFrame, 
                                     priority_type: str = 'all') -> pd.DataFrame:
        """
        生成优先处置清单
        支持按倒伏、断枝等不同类型的优先排序
        """
        if risk_df.empty:
            return risk_df

        priority_df = risk_df.copy()

        if priority_type == 'fall_over':
            priority_df = priority_df[
                (priority_df['damage_type'] == 'fall_over') | 
                (priority_df['is_fall_over'])
            ]
        elif priority_type == 'branch_break':
            priority_df = priority_df[
                (priority_df['damage_type'] == 'branch_break') | 
                (priority_df['is_branch_break'])
            ]
        elif priority_type == 'high_risk':
            priority_df = priority_df[
                priority_df['overall_risk_level'].isin(['high', 'medium'])
            ]
        elif priority_type == 'pending':
            priority_df = priority_df[
                priority_df['disposal_status'].isin(['pending', 'processing'])
            ]

        if not priority_df.empty:
            priority_df = priority_df.sort_values(
                by=['priority', 'overall_risk_score'],
                ascending=[True, False]
            )

        return priority_df

    def get_statistics(self, risk_df: pd.DataFrame) -> Dict:
        """
        获取风险统计信息
        """
        if risk_df.empty:
            return {}

        stats = {
            'total_trees': len(risk_df),
            'risk_distribution': risk_df['overall_risk_level'].value_counts().to_dict(),
            'risk_distribution_cn': risk_df['overall_risk_level_cn'].value_counts().to_dict(),
            'status_distribution': risk_df['disposal_status'].value_counts().to_dict(),
            'status_distribution_cn': risk_df['disposal_status_cn'].value_counts().to_dict(),
            'damage_distribution': risk_df['damage_type'].value_counts().to_dict(),
            'species_distribution': risk_df['tree_species'].value_counts().head(10).to_dict(),
            'road_distribution': risk_df['road_name'].value_counts().head(10).to_dict(),
            'avg_risk_score': round(risk_df['overall_risk_score'].mean(), 2),
            'max_risk_score': round(risk_df['overall_risk_score'].max(), 2),
            'high_risk_count': len(risk_df[risk_df['overall_risk_level'] == 'high']),
            'pending_count': len(risk_df[risk_df['disposal_status'] == 'pending']),
            'damaged_count': len(risk_df[risk_df['is_damaged']]),
            'fall_over_count': len(risk_df[risk_df['is_fall_over']]),
            'branch_break_count': len(risk_df[risk_df['is_branch_break']]),
            'without_coordinates': len(risk_df[~risk_df['has_coordinates']]),
            'multiple_inspections': len(risk_df[risk_df['inspection_count'] > 1])
        }

        return stats
