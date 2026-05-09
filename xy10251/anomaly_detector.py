import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from config import CAPACITY_L


def detect_duplicates(records_df, time_window_minutes=5):
    if len(records_df) == 0:
        return pd.DataFrame()

    df = records_df.copy()
    dup_list = []

    sorted_df = df.sort_values(['bin_id', 'drop_time'])

    for idx, row in sorted_df.iterrows():
        potential_dups = sorted_df[
            (sorted_df['bin_id'] == row['bin_id']) &
            (sorted_df.index != idx) &
            (sorted_df['volume_l'] == row['volume_l']) &
            (abs((sorted_df['drop_time'] - row['drop_time']).dt.total_seconds() / 60) <= time_window_minutes)
        ]

        if len(potential_dups) > 0:
            dup_list.append({
                'record_id_1': row['record_id'],
                'record_id_2': potential_dups.iloc[0]['record_id'],
                'bin_id': row['bin_id'],
                'drop_time_1': row['drop_time'],
                'drop_time_2': potential_dups.iloc[0]['drop_time'],
                'volume_l': row['volume_l'],
                'submitter_1': row.get('submitter'),
                'submitter_2': potential_dups.iloc[0].get('submitter'),
                'anomaly_type': 'duplicate',
                'confidence': 0.95
            })

    return pd.DataFrame(dup_list).drop_duplicates(subset=['record_id_1', 'record_id_2'])


def detect_conflicts(records_df, bin_manager):
    if len(records_df) == 0:
        return pd.DataFrame()

    df = records_df.copy()
    conflict_list = []

    bins = bin_manager.get_all_bins()
    bin_ids = bins['bin_id'].unique()

    for bin_id in bin_ids:
        bin_info = bin_manager.get_bin(bin_id)
        bin_records = df[df['bin_id'] == bin_id].sort_values('drop_time')

        if len(bin_records) == 0:
            continue

        last_clean = pd.to_datetime(bin_info['last_clean'])
        capacity = bin_info['capacity']

        current_fill = 0
        for idx, row in bin_records.iterrows():
            if row['drop_time'] <= last_clean:
                continue

            if row['status'] != 'valid':
                continue

            current_fill += row['volume_l']

            if current_fill > capacity * 1.2:
                conflict_list.append({
                    'record_id': row['record_id'],
                    'bin_id': bin_id,
                    'drop_time': row['drop_time'],
                    'volume_l': row['volume_l'],
                    'accumulated_l': current_fill,
                    'capacity_l': capacity,
                    'excess_ratio': current_fill / capacity,
                    'anomaly_type': 'conflict',
                    'description': f'累计投放量 {current_fill:.0f}L 超过桶容量 {capacity}L',
                    'confidence': 0.9
                })

    return pd.DataFrame(conflict_list)


def detect_missing(records_df, bin_manager, start_date, end_date, expected_records_per_bin_per_day=3):
    if len(records_df) == 0:
        return pd.DataFrame()

    missing_list = []
    bins = bin_manager.get_all_bins()

    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)

    date_range = pd.date_range(start=start_dt, end=end_dt, freq='D')

    for date in date_range:
        date_str = date.strftime('%Y-%m-%d')
        next_date = date + timedelta(days=1)

        for _, bin_row in bins.iterrows():
            bin_id = bin_row['bin_id']

            day_records = records_df[
                (records_df['bin_id'] == bin_id) &
                (records_df['drop_time'] >= date) &
                (records_df['drop_time'] < next_date) &
                (records_df['status'] == 'valid')
            ]

            if len(day_records) == 0:
                missing_list.append({
                    'bin_id': bin_id,
                    'date': date_str,
                    'community': bin_row['community'],
                    'zone': bin_row['zone'],
                    'garbage_type': bin_row['type'],
                    'expected_min_count': expected_records_per_bin_per_day,
                    'actual_count': 0,
                    'anomaly_type': 'missing',
                    'description': f'{date_str} 无有效投放记录',
                    'confidence': 0.7
                })
            elif len(day_records) < expected_records_per_bin_per_day:
                missing_list.append({
                    'bin_id': bin_id,
                    'date': date_str,
                    'community': bin_row['community'],
                    'zone': bin_row['zone'],
                    'garbage_type': bin_row['type'],
                    'expected_min_count': expected_records_per_bin_per_day,
                    'actual_count': len(day_records),
                    'anomaly_type': 'missing',
                    'description': f'{date_str} 记录数偏少（预期至少 {expected_records_per_bin_per_day} 条，实际 {len(day_records)} 条）',
                    'confidence': 0.6
                })

    return pd.DataFrame(missing_list)


def run_all_anomaly_checks(records_df, bin_manager, start_date=None, end_date=None):
    results = {}

    dup_df = detect_duplicates(records_df)
    results['duplicates'] = dup_df

    conflict_df = detect_conflicts(records_df, bin_manager)
    results['conflicts'] = conflict_df

    if start_date and end_date:
        missing_df = detect_missing(records_df, bin_manager, start_date, end_date)
        results['missing'] = missing_df
    else:
        results['missing'] = pd.DataFrame()

    return results


def apply_anomaly_flags(records_df, anomaly_results):
    df = records_df.copy()

    dup_df = anomaly_results.get('duplicates', pd.DataFrame())
    conflict_df = anomaly_results.get('conflicts', pd.DataFrame())

    if len(dup_df) > 0:
        dup_record_ids = set(dup_df['record_id_2'].tolist())
        df.loc[df['record_id'].isin(dup_record_ids), 'status'] = 'duplicate'

    if len(conflict_df) > 0:
        conflict_ids = set(conflict_df['record_id'].tolist())
        df.loc[df['record_id'].isin(conflict_ids), 'status'] = 'conflict'

    return df


def generate_anomaly_summary(anomaly_results):
    summary = []

    dup_count = len(anomaly_results.get('duplicates', pd.DataFrame()))
    if dup_count > 0:
        summary.append({
            'type': 'duplicate',
            'type_cn': '重复提交',
            'count': dup_count,
            'severity': 'medium'
        })

    conflict_count = len(anomaly_results.get('conflicts', pd.DataFrame()))
    if conflict_count > 0:
        summary.append({
            'type': 'conflict',
            'type_cn': '状态冲突',
            'count': conflict_count,
            'severity': 'high'
        })

    missing_count = len(anomaly_results.get('missing', pd.DataFrame()))
    if missing_count > 0:
        summary.append({
            'type': 'missing',
            'type_cn': '记录缺失',
            'count': missing_count,
            'severity': 'medium'
        })

    return pd.DataFrame(summary)
