import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
import warnings


class AnomalyDetector:
    def __init__(self, billing_rules: Dict[str, Any]):
        self.rules = billing_rules
        self.anomaly_rules = billing_rules.get('billing_rules', {}).get('anomaly_detection', {})

    def detect_all_anomalies(self, bills_df: pd.DataFrame) -> pd.DataFrame:
        anomalies = []

        anomalies.extend(self._detect_cross_month_readings(bills_df))
        anomalies.extend(self._detect_multiplier_errors(bills_df))
        anomalies.extend(self._detect_vacant_shop_charges(bills_df))
        anomalies.extend(self._detect_shared_area_anomalies(bills_df))
        anomalies.extend(self._detect_missing_readings(bills_df))
        anomalies.extend(self._detect_multi_shop_single_meter(bills_df))
        anomalies.extend(self._detect_consumption_anomalies(bills_df))

        if anomalies:
            return pd.DataFrame(anomalies)
        return pd.DataFrame(columns=[
            'shop_no', 'meter_id', 'month', 'anomaly_type', 'description', 'severity', 'amount_impact'
        ])

    def _detect_cross_month_readings(self, df: pd.DataFrame) -> List[Dict]:
        anomalies = []
        for meter_id, group in df.groupby('meter_id'):
            group = group.sort_values('start_date')
            for i in range(len(group) - 1):
                current = group.iloc[i]
                next_row = group.iloc[i + 1]

                if pd.notna(current['end_date']) and pd.notna(next_row['start_date']):
                    days_diff = (next_row['start_date'] - current['end_date']).days

                    if days_diff > 5:
                        anomalies.append({
                            'shop_no': current['shop_no'],
                            'meter_id': meter_id,
                            'month': current['month'],
                            'anomaly_type': '跨月抄表',
                            'description': f'电表 {meter_id} 从 {current["end_date"].strftime("%Y-%m-%d")} 到 {next_row["start_date"].strftime("%Y-%m-%d")} 间隔 {days_diff} 天',
                            'severity': 'high' if days_diff > 10 else 'medium',
                            'amount_impact': 0
                        })

        return anomalies

    def _detect_multiplier_errors(self, df: pd.DataFrame) -> List[Dict]:
        anomalies = []
        max_ratio = self.anomaly_rules.get('max_monthly_increase_ratio', 2.0)

        for shop_no, group in df.groupby('shop_no'):
            group = group.sort_values('start_date')
            if len(group) < 2:
                continue

            for i in range(1, len(group)):
                prev = group.iloc[i - 1]
                current = group.iloc[i]

                if prev['consumption_kwh'] > 0:
                    ratio = current['consumption_kwh'] / prev['consumption_kwh']

                    if ratio > max_ratio:
                        anomalies.append({
                            'shop_no': shop_no,
                            'meter_id': current['meter_id'],
                            'month': current['month'],
                            'anomaly_type': '倍率错误',
                            'description': f'租户 {shop_no} 用电量环比增长 {ratio:.1f}倍 (上期: {prev["consumption_kwh"]:.0f}kWh, 本期: {current["consumption_kwh"]:.0f}kWh)',
                            'severity': 'high' if ratio > 3 else 'medium',
                            'amount_impact': (current['total_amount'] - prev['total_amount']) * (ratio - 1) / ratio
                        })

                    if current['multiplier'] != 1 and current['multiplier'] > 10:
                        anomalies.append({
                            'shop_no': shop_no,
                            'meter_id': current['meter_id'],
                            'month': current['month'],
                            'anomaly_type': '倍率错误',
                            'description': f'电表 {meter_id} 倍率达到异常值 {current["multiplier"]}',
                            'severity': 'high',
                            'amount_impact': current['base_amount'] * (current['multiplier'] - 1) / current['multiplier']
                        })

        return anomalies

    def _detect_vacant_shop_charges(self, df: pd.DataFrame) -> List[Dict]:
        anomalies = []

        for _, row in df.iterrows():
            if row.get('shop_status') == 'vacant':
                if row['consumption_kwh'] > 0 and row['total_amount'] > 0:
                    anomalies.append({
                        'shop_no': row['shop_no'],
                        'meter_id': row['meter_id'],
                        'month': row['month'],
                        'anomaly_type': '空铺仍计费',
                        'description': f'空铺 {row["shop_no"]}({row.get("shop_name", "")}) 本期用电 {row["consumption_kwh"]:.0f}kWh，产生费用 ¥{row["total_amount"]:.2f}',
                        'severity': 'high',
                        'amount_impact': row['total_amount']
                    })

        return anomalies

    def _detect_shared_area_anomalies(self, df: pd.DataFrame) -> List[Dict]:
        anomalies = []

        shared_meters = df[df['area_type'] == 'shared'].copy()

        for meter_id, group in shared_meters.groupby('meter_id'):
            shops_in_group = group['shop_no'].unique()

            for shop_no in shops_in_group:
                shop_data = group[group['shop_no'] == shop_no]

                for _, row in shop_data.iterrows():
                    expected_share = 1.0 / len(shops_in_group) if len(shops_in_group) > 0 else 0
                    actual_share = row['shared_ratio']

                    if abs(actual_share - expected_share) > 0.1:
                        anomalies.append({
                            'shop_no': shop_no,
                            'meter_id': meter_id,
                            'month': row['month'],
                            'anomaly_type': '共享区域分摊异常',
                            'description': f'共享区域电表 {meter_id} 分摊给 {shop_no} 的比例为 {actual_share:.2%}，期望值: {expected_share:.2%}',
                            'severity': 'medium',
                            'amount_impact': row['total_amount'] * abs(actual_share - expected_share)
                        })

        return anomalies

    def _detect_missing_readings(self, df: pd.DataFrame) -> List[Dict]:
        anomalies = []

        for meter_id, group in df.groupby('meter_id'):
            group = group.sort_values('start_date')
            months = group['month'].tolist()

            for i in range(len(months) - 1):
                current_month = months[i]
                next_month = months[i + 1]

                current_date = pd.to_datetime(group[group['month'] == current_month]['start_date'].iloc[0])
                next_date = pd.to_datetime(group[group['month'] == next_month]['start_date'].iloc[0])

                current_year_month = current_date.year * 12 + current_date.month
                next_year_month = next_date.year * 12 + next_date.month

                if next_year_month - current_year_month > 1:
                    anomalies.append({
                        'shop_no': group['shop_no'].iloc[0],
                        'meter_id': meter_id,
                        'month': current_month,
                        'anomaly_type': '缺失读数',
                        'description': f'电表 {meter_id} 缺失 {current_month} 至 {next_month} 之间的读数记录',
                        'severity': 'high',
                        'amount_impact': 0
                    })

        return anomalies

    def _detect_multi_shop_single_meter(self, df: pd.DataFrame) -> List[Dict]:
        anomalies = []

        meter_shop_counts = df.groupby('meter_id')['shop_no'].nunique()

        for meter_id, shop_count in meter_shop_counts.items():
            if shop_count > 1:
                shops = df[df['meter_id'] == meter_id]['shop_no'].unique()
                anomalies.append({
                    'shop_no': ', '.join(shops),
                    'meter_id': meter_id,
                    'month': df[df['meter_id'] == meter_id]['month'].iloc[0],
                    'anomaly_type': '同一电表挂多铺位',
                    'description': f'电表 {meter_id} 同时挂载了多个铺位: {", ".join(shops)}，需确认分摊规则是否正确',
                    'severity': 'medium',
                    'amount_impact': 0
                })

        return anomalies

    def _detect_consumption_anomalies(self, df: pd.DataFrame) -> List[Dict]:
        anomalies = []
        max_daily = self.anomaly_rules.get('max_daily_kwh', 500)
        min_daily = self.anomaly_rules.get('min_daily_kwh', 0)

        for _, row in df.iterrows():
            if pd.notna(row.get('end_date')) and pd.notna(row.get('start_date')):
                days = (row['end_date'] - row['start_date']).days + 1
                daily_avg = row['consumption_kwh'] / days if days > 0 else 0

                if daily_avg > max_daily:
                    anomalies.append({
                        'shop_no': row['shop_no'],
                        'meter_id': row['meter_id'],
                        'month': row['month'],
                        'anomaly_type': '日均用电异常',
                        'description': f'租户 {row["shop_no"]} 日均用电 {daily_avg:.0f}kWh，超过阈值 {max_daily}kWh',
                        'severity': 'medium',
                        'amount_impact': row['total_amount'] * 0.2
                    })

                zero_threshold = self.anomaly_rules.get('zero_reading_threshold_days', 30)
                if daily_avg <= min_daily and days >= zero_threshold:
                    anomalies.append({
                        'shop_no': row['shop_no'],
                        'meter_id': row['meter_id'],
                        'month': row['month'],
                        'anomaly_type': '长期零用电',
                        'description': f'租户 {row["shop_no"]} 连续 {days} 天日均用电 {daily_avg:.0f}kWh，可能存在异常',
                        'severity': 'low',
                        'amount_impact': 0
                    })

        return anomalies


def apply_adjustments(bills_df: pd.DataFrame, anomalies_df: pd.DataFrame) -> pd.DataFrame:
    df = bills_df.copy()
    df['adjusted_amount'] = df['total_amount'].copy()
    df['adjustment_reason'] = ''

    if len(anomalies_df) == 0:
        return df

    for _, anomaly in anomalies_df.iterrows():
        mask = (df['shop_no'] == anomaly['shop_no']) & (df['month'] == anomaly['month'])

        if anomaly['anomaly_type'] == '空铺仍计费':
            df.loc[mask, 'adjusted_amount'] = 0
            df.loc[mask, 'adjustment_reason'] += f"空铺免收电费;"

        elif anomaly['anomaly_type'] == '倍率错误':
            df.loc[mask, 'adjusted_amount'] = df.loc[mask, 'adjusted_amount'] * 0.5
            df.loc[mask, 'adjustment_reason'] += f"倍率异常调整;"

        elif anomaly['anomaly_type'] == '共享区域分摊异常':
            df.loc[mask, 'adjusted_amount'] = df.loc[mask, 'adjusted_amount'] * 0.8
            df.loc[mask, 'adjustment_reason'] += f"共享分摊调整;"

    return df


def get_anomaly_summary(anomalies_df: pd.DataFrame) -> Dict[str, Any]:
    if len(anomalies_df) == 0:
        return {
            'total': 0,
            'by_type': {},
            'by_severity': {'high': 0, 'medium': 0, 'low': 0},
            'total_amount_impact': 0
        }

    return {
        'total': len(anomalies_df),
        'by_type': anomalies_df['anomaly_type'].value_counts().to_dict(),
        'by_severity': anomalies_df['severity'].value_counts().to_dict(),
        'total_amount_impact': anomalies_df['amount_impact'].sum()
    }