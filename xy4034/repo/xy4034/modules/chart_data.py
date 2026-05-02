import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from modules.time_window_merger import BatchTimeWindow, get_temperature_statistics
from modules.risk_rules import RiskCheckResult

def generate_trend_chart_data(
    merged_batches: Dict[str, BatchTimeWindow],
    group_by: str = 'store'
) -> pd.DataFrame:
    data = []
    
    for batch_number, batch in merged_batches.items():
        temp_stats = get_temperature_statistics(batch)
        
        row = {
            '批次号': batch_number,
            '菜品': batch.dish,
            '门店': batch.store,
            '配送车': batch.delivery_car,
            '冷柜数量': len(batch.freezer_ids),
            '温度记录数': temp_stats['count'],
            '最高温度': temp_stats['max'],
            '最低温度': temp_stats['min'],
            '平均温度': temp_stats['avg'],
            '超高温次数': temp_stats['over_threshold_count'],
            '超低温次数': temp_stats['under_threshold_count'],
            '留样数量': len(batch.sample_records),
            '生产时间': batch.production_time,
            '出库时间': batch.outbound_time,
            '签收时间': batch.signoff_time
        }
        data.append(row)
    
    return pd.DataFrame(data)

def generate_temperature_chart_data(
    batch: BatchTimeWindow
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    if not batch.temperature_records:
        return pd.DataFrame(), {}
    
    data = []
    for record in batch.temperature_records:
        row = {
            '时间': record.get('温度读数时间'),
            '温度值': record.get('温度值'),
            '冷柜编号': record.get('冷柜编号')
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    
    stats = {
        'min_temp': df['温度值'].min() if not df.empty else None,
        'max_temp': df['温度值'].max() if not df.empty else None,
        'avg_temp': df['温度值'].mean() if not df.empty else None,
        'threshold_high': 4.0,
        'threshold_low': -18.0
    }
    
    return df, stats

def generate_risk_timeline_data(
    risk_results: List[RiskCheckResult]
) -> pd.DataFrame:
    if not risk_results:
        return pd.DataFrame()
    
    data = []
    for result in risk_results:
        row = {
            '时间': result.timestamp,
            '批次号': result.batch_number,
            '规则名称': result.rule_name,
            '风险等级': result.risk_level,
            '描述': result.description,
            '证据': result.evidence
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    
    risk_order = {'high': 3, 'medium': 2, 'low': 1}
    df['风险等级排序'] = df['风险等级'].map(risk_order)
    df = df.sort_values(['时间', '风险等级排序'], ascending=[True, False])
    df = df.drop(columns=['风险等级排序'])
    
    return df

def generate_store_comparison_data(
    merged_batches: Dict[str, BatchTimeWindow],
    risk_results: List[RiskCheckResult]
) -> pd.DataFrame:
    store_stats = {}
    
    for batch_number, batch in merged_batches.items():
        store = batch.store or '未知门店'
        if store not in store_stats:
            store_stats[store] = {
                '总批次': 0,
                '温度记录数': 0,
                '超温次数': 0,
                '留样缺失': 0
            }
        
        store_stats[store]['总批次'] += 1
        
        temp_stats = get_temperature_statistics(batch)
        store_stats[store]['温度记录数'] += temp_stats['count']
        store_stats[store]['超温次数'] += temp_stats['over_threshold_count']
        
        if not batch.sample_records:
            store_stats[store]['留样缺失'] += 1
    
    batch_risk_count = {}
    for result in risk_results:
        if result.batch_number not in batch_risk_count:
            batch_risk_count[result.batch_number] = {'high': 0, 'medium': 0, 'low': 0}
        batch_risk_count[result.batch_number][result.risk_level] += 1
    
    for batch_number, batch in merged_batches.items():
        store = batch.store or '未知门店'
        if batch_number in batch_risk_count:
            if '高风险批次' not in store_stats[store]:
                store_stats[store]['高风险批次'] = 0
                store_stats[store]['中风险批次'] = 0
            
            if batch_risk_count[batch_number]['high'] > 0:
                store_stats[store]['高风险批次'] += 1
            elif batch_risk_count[batch_number]['medium'] > 0:
                store_stats[store]['中风险批次'] += 1
    
    data = []
    for store, stats in store_stats.items():
        row = {
            '门店': store,
            '总批次': stats.get('总批次', 0),
            '高风险批次': stats.get('高风险批次', 0),
            '中风险批次': stats.get('中风险批次', 0),
            '温度记录数': stats.get('温度记录数', 0),
            '超温次数': stats.get('超温次数', 0),
            '留样缺失': stats.get('留样缺失', 0)
        }
        data.append(row)
    
    return pd.DataFrame(data)

def generate_delivery_car_comparison_data(
    merged_batches: Dict[str, BatchTimeWindow],
    risk_results: List[RiskCheckResult]
) -> pd.DataFrame:
    car_stats = {}
    
    for batch_number, batch in merged_batches.items():
        car = batch.delivery_car or '未知配送车'
        if car not in car_stats:
            car_stats[car] = {
                '总批次': 0,
                '温度记录数': 0,
                '超温次数': 0
            }
        
        car_stats[car]['总批次'] += 1
        
        temp_stats = get_temperature_statistics(batch)
        car_stats[car]['温度记录数'] += temp_stats['count']
        car_stats[car]['超温次数'] += temp_stats['over_threshold_count']
    
    batch_risk_count = {}
    for result in risk_results:
        if result.batch_number not in batch_risk_count:
            batch_risk_count[result.batch_number] = {'high': 0, 'medium': 0, 'low': 0}
        batch_risk_count[result.batch_number][result.risk_level] += 1
    
    for batch_number, batch in merged_batches.items():
        car = batch.delivery_car or '未知配送车'
        if batch_number in batch_risk_count:
            if '高风险批次' not in car_stats[car]:
                car_stats[car]['高风险批次'] = 0
                car_stats[car]['中风险批次'] = 0
            
            if batch_risk_count[batch_number]['high'] > 0:
                car_stats[car]['高风险批次'] += 1
            elif batch_risk_count[batch_number]['medium'] > 0:
                car_stats[car]['中风险批次'] += 1
    
    data = []
    for car, stats in car_stats.items():
        row = {
            '配送车': car,
            '总批次': stats.get('总批次', 0),
            '高风险批次': stats.get('高风险批次', 0),
            '中风险批次': stats.get('中风险批次', 0),
            '温度记录数': stats.get('温度记录数', 0),
            '超温次数': stats.get('超温次数', 0)
        }
        data.append(row)
    
    return pd.DataFrame(data)

def generate_freezer_comparison_data(
    merged_batches: Dict[str, BatchTimeWindow]
) -> pd.DataFrame:
    freezer_stats = {}
    
    for batch_number, batch in merged_batches.items():
        for freezer_id in batch.freezer_ids:
            if freezer_id not in freezer_stats:
                freezer_stats[freezer_id] = {
                    '关联批次': set(),
                    '温度记录数': 0,
                    '超温次数': 0,
                    '温度值列表': []
                }
            
            freezer_stats[freezer_id]['关联批次'].add(batch_number)
            
            for record in batch.temperature_records:
                if record.get('冷柜编号') == freezer_id:
                    freezer_stats[freezer_id]['温度记录数'] += 1
                    temp = record.get('温度值')
                    if temp is not None:
                        freezer_stats[freezer_id]['温度值列表'].append(temp)
                        if temp > 4.0:
                            freezer_stats[freezer_id]['超温次数'] += 1
    
    data = []
    for freezer_id, stats in freezer_stats.items():
        temps = stats.get('温度值列表', [])
        row = {
            '冷柜编号': freezer_id,
            '关联批次数量': len(stats.get('关联批次', [])),
            '温度记录数': stats.get('温度记录数', 0),
            '超温次数': stats.get('超温次数', 0),
            '平均温度': round(sum(temps) / len(temps), 2) if temps else None,
            '最高温度': max(temps) if temps else None,
            '最低温度': min(temps) if temps else None
        }
        data.append(row)
    
    return pd.DataFrame(data)
