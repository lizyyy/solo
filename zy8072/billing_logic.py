import pandas as pd
import numpy as np
import yaml
import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
import warnings


class BillingCalculator:
    def __init__(self, billing_rules: Dict[str, Any]):
        self.rules = billing_rules
        self.default_rules = billing_rules.get('billing_rules', {}).get('default', {})

    def calculate_shop_bill(
        self,
        shop_no: str,
        consumption_kwh: float,
        area_type: str,
        days: int,
        holiday_info: Optional[Dict] = None
    ) -> Dict[str, float]:
        shop_rules = self.rules.get('billing_rules', {}).get('shop_billing_rules', {}).get(shop_no, {})
        area_multipliers = self.rules.get('billing_rules', {}).get('area_type_multipliers', {})

        price = shop_rules.get('price_per_kwh', self.default_rules.get('price_per_kwh', 1.2))
        service_fee_ratio = shop_rules.get('service_fee_ratio', self.default_rules.get('service_fee_ratio', 0.1))

        base_price = price * area_multipliers.get(area_type, 1.0)

        if holiday_info and holiday_info.get('is_holiday'):
            discount = self.rules.get('billing_rules', {}).get('holiday_handling', {}).get('holiday_discount', 1.0)
            base_price *= discount

        base_amount = consumption_kwh * base_price
        service_fee = base_amount * service_fee_ratio
        total = base_amount + service_fee

        minimum_charge = shop_rules.get('minimum_charge', self.default_rules.get('minimum_charge', 0))
        if total < minimum_charge and minimum_charge > 0:
            total = minimum_charge

        return {
            'consumption_kwh': consumption_kwh,
            'base_price': base_price,
            'base_amount': base_amount,
            'service_fee': service_fee,
            'total_amount': total
        }


class MeterDataParser:
    def __init__(self, meter_readings: pd.DataFrame, shop_mapping: Dict, billing_rules: Dict):
        self.raw_data = meter_readings
        self.shop_mapping = shop_mapping
        self.billing_rules = billing_rules
        self.billing_calc = BillingCalculator(billing_rules)

    def parse_readings(self) -> pd.DataFrame:
        df = self.raw_data.copy()
        df['reading_date'] = pd.to_datetime(df['reading_date'])
        df = df.sort_values(['meter_id', 'reading_date'])

        meter_readings = {}
        for meter_id, group in df.groupby('meter_id'):
            readings = group.sort_values('reading_date').reset_index(drop=True)
            meter_readings[meter_id] = readings

        return self._process_meter_readings(meter_readings)

    def _process_meter_readings(self, meter_readings: Dict) -> pd.DataFrame:
        results = []

        for meter_id, readings in meter_readings.items():
            mapping = self.shop_mapping.get('meter_shop_mapping', {}).get(meter_id, {})
            shop_list = mapping.get('shop_no', [])
            area_type = mapping.get('area_type', 'retail')
            shared_ratio = mapping.get('shared_ratio', 0)
            multiplier = mapping.get('multiplier', 1)

            for i in range(len(readings) - 1):
                start_row = readings.iloc[i]
                end_row = readings.iloc[i + 1]

                if start_row['reading_type'] != 'start' or end_row['reading_type'] != 'end':
                    continue

                start_date = start_row['reading_date']
                end_date = end_row['reading_date']

                if start_date.year != end_date.year or start_date.month != end_date.month:
                    continue

                consumption_raw = (end_row['reading_value'] - start_row['reading_value']) * multiplier
                consumption_kwh = max(0, consumption_raw)

                days = (end_date - start_date).days + 1

                for shop_no in shop_list:
                    shop_info = self.shop_mapping.get('shop_info', {}).get(shop_no, {})
                    shop_name = shop_info.get('shop_name', shop_no)
                    shop_status = shop_info.get('status', 'active')
                    area = shop_info.get('area', 0)

                    if shared_ratio > 0:
                        consumption_kwh = consumption_kwh * shared_ratio / len(shop_list) if len(shop_list) > 0 else 0

                    bill = self.billing_calc.calculate_shop_bill(
                        shop_no=shop_no,
                        consumption_kwh=consumption_kwh,
                        area_type=area_type,
                        days=days,
                        holiday_info=None
                    )

                    results.append({
                        'meter_id': meter_id,
                        'shop_no': shop_no,
                        'shop_name': shop_name,
                        'shop_status': shop_status,
                        'month': f"{start_date.year}-{start_date.month:02d}",
                        'start_date': start_date,
                        'end_date': end_date,
                        'start_reading': start_row['reading_value'],
                        'end_reading': end_row['reading_value'],
                        'raw_consumption': consumption_raw,
                        'consumption_kwh': consumption_kwh,
                        'multiplier': multiplier,
                        'area_type': area_type,
                        'area': area,
                        'shared_ratio': shared_ratio,
                        **bill
                    })

        return pd.DataFrame(results)


def parse_holiday_csv(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    df['date'] = pd.to_datetime(df['date'])
    return df


def parse_meter_readings_csv(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    return df


def parse_shop_mapping_json(filepath: str) -> Dict:
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def parse_billing_rules_yaml(filepath: str) -> Dict:
    with open(filepath, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def calculate_bill_adjustments(
    parsed_bills: pd.DataFrame,
    holiday_data: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    df = parsed_bills.copy()

    if holiday_data is not None:
        holiday_data['date'] = pd.to_datetime(holiday_data['date'])
        holiday_dict = dict(zip(holiday_data['date'], holiday_data.to_dict('records')))

        def get_holiday_info(date):
            normalized_date = pd.to_datetime(date).normalize()
            return holiday_dict.get(normalized_date, {})

        df['holiday_info'] = df['end_date'].apply(get_holiday_info)
        df['is_holiday'] = df['holiday_info'].apply(lambda x: x.get('is_holiday', False))
        df['is_weekend'] = df['holiday_info'].apply(lambda x: x.get('is_weekend', False))

    return df


def export_bill_adjustments(df: pd.DataFrame, filepath: str) -> None:
    export_df = df.copy()
    export_df['holiday_info'] = export_df['holiday_info'].apply(
        lambda x: json.dumps(x, ensure_ascii=False) if isinstance(x, dict) else ''
    )
    export_df.to_csv(filepath, index=False, encoding='utf-8-sig')


def generate_review_report(
    df: pd.DataFrame,
    anomalies: pd.DataFrame,
    filepath: str
) -> None:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("# 商场用电分摊复核报告\n\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        f.write("## 数据概览\n\n")
        f.write(f"- 总记录数: {len(df)}\n")
        f.write(f"- 涉及铺位数: {df['shop_no'].nunique()}\n")
        f.write(f"- 涉及电表数: {df['meter_id'].nunique()}\n")
        f.write(f"- 时间范围: {df['month'].min()} 至 {df['month'].max()}\n\n")

        f.write("## 计费汇总\n\n")
        summary = df.groupby('month').agg({
            'consumption_kwh': 'sum',
            'total_amount': 'sum'
        }).round(2)
        f.write(summary.to_markdown() + "\n\n")

        if len(anomalies) > 0:
            f.write("## 异常检测汇总\n\n")
            f.write(f"- 异常记录总数: {len(anomalies)}\n\n")

            anomaly_summary = anomalies.groupby('anomaly_type').size().reset_index(name='count')
            f.write(anomaly_summary.to_markdown() + "\n\n")

            f.write("### 异常明细\n\n")
            for _, row in anomalies.head(20).iterrows():
                f.write(f"#### {row['shop_no']} - {row['anomaly_type']}\n")
                f.write(f"- 月份: {row['month']}\n")
                f.write(f"- 电表: {row['meter_id']}\n")
                f.write(f"- 描述: {row['description']}\n")
                f.write(f"- 涉及金额: ¥{row.get('amount_impact', 0):.2f}\n\n")
        else:
            f.write("## 异常检测\n\n未检测到异常记录。\n\n")

        f.write("## 分摊前后对比\n\n")
        if 'adjusted_amount' in df.columns:
            comparison = df[['shop_no', 'shop_name', 'month', 'total_amount', 'adjusted_amount']].copy()
            comparison['差异'] = comparison['adjusted_amount'] - comparison['total_amount']
            f.write(comparison.head(20).to_markdown() + "\n\n")