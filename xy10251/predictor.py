import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from config import OVERFLOW_THRESHOLD, PREDICTION_WINDOW_DAYS
from holiday_feature import (
    enrich_records_with_holiday_features,
    get_holiday_days_in_window,
    calculate_workday_baseline,
    get_date_multiplier,
    classify_date_type
)


def calculate_current_fill_level(bin_info, records_df, as_of_date):
    if len(records_df) == 0:
        return 0.0, 0.0

    bin_id = bin_info['bin_id']
    last_clean = pd.to_datetime(bin_info['last_clean'])

    df = records_df[
        (records_df['bin_id'] == bin_id) &
        (records_df['drop_time'] > last_clean) &
        (records_df['drop_time'] <= pd.to_datetime(as_of_date))
    ]

    df_valid = df[df['status'] == 'valid']
    current_liters = df_valid['volume_l'].sum()
    fill_ratio = current_liters / bin_info['capacity'] if bin_info['capacity'] > 0 else 0.0

    return current_liters, fill_ratio


def predict_fill_levels(bin_info, records_df, prediction_start_date, window_days=PREDICTION_WINDOW_DAYS):
    current_liters, current_ratio = calculate_current_fill_level(
        bin_info, records_df, prediction_start_date
    )

    baseline = calculate_workday_baseline(records_df, bin_info['bin_id'])

    window_df = get_holiday_days_in_window(prediction_start_date, window_days)

    projections = []
    accumulated_liters = current_liters

    for idx, day_row in window_df.iterrows():
        daily_expected = baseline * day_row['multiplier']
        accumulated_liters += daily_expected
        projected_ratio = accumulated_liters / bin_info['capacity']

        will_overflow = projected_ratio >= OVERFLOW_THRESHOLD
        overflow_day = day_row['date'] if will_overflow else None

        projections.append({
            'date': day_row['date'],
            'date_name': day_row['date_name'],
            'date_type': day_row['date_type'],
            'multiplier': day_row['multiplier'],
            'baseline_l': round(baseline, 2),
            'expected_daily_l': round(daily_expected, 2),
            'accumulated_l': round(accumulated_liters, 2),
            'projected_ratio': round(projected_ratio, 4),
            'will_overflow': will_overflow,
            'overflow_day': overflow_day
        })

    first_overflow = next(
        (p for p in projections if p['will_overflow']), None
    )

    result = {
        'bin_id': bin_info['bin_id'],
        'garbage_type': bin_info['type'],
        'community': bin_info['community'],
        'zone': bin_info['zone'],
        'capacity_l': bin_info['capacity'],
        'current_liters': round(current_liters, 2),
        'current_ratio': round(current_ratio, 4),
        'baseline_l': round(baseline, 2),
        'will_overflow_in_window': first_overflow is not None,
        'first_overflow_date': first_overflow['date'] if first_overflow else None,
        'first_overflow_day_name': first_overflow['date_name'] if first_overflow else None,
        'days_until_overflow': (
            (datetime.strptime(first_overflow['date'], '%Y-%m-%d') -
             datetime.strptime(prediction_start_date, '%Y-%m-%d')).days
            if first_overflow else None
        ),
        'projections': projections
    }

    return result


def calculate_priority_score(prediction):
    if not prediction['will_overflow_in_window']:
        if prediction['current_ratio'] >= OVERFLOW_THRESHOLD:
            score = 80.0
        else:
            score = 0.0
        return {
            'priority': 'low' if score == 0 else 'medium',
            'score': round(score, 1),
            'reason': '已接近阈值' if score > 0 else '无满溢风险'
        }

    days = prediction['days_until_overflow']
    current_ratio = prediction['current_ratio']

    urgency_component = max(0, 30 - days * 10)
    severity_component = current_ratio * 50
    bonus_component = 0

    for proj in prediction['projections']:
        if proj['date'] == prediction['first_overflow_date']:
            if proj['date_type'] == 'holiday':
                bonus_component = 20
            elif proj['date_type'] == 'weekend':
                bonus_component = 10
            break

    score = urgency_component + severity_component + bonus_component
    score = min(100, score)

    if score >= 70:
        priority = 'critical'
        reason = '即将满溢（节假日/高风险时段）'
    elif score >= 40:
        priority = 'high'
        reason = '预测将在近期满溢'
    else:
        priority = 'medium'
        reason = '有满溢风险'

    return {
        'priority': priority,
        'score': round(score, 1),
        'reason': reason
    }


def run_full_prediction(bin_manager, records_df, prediction_start_date):
    enriched_df = enrich_records_with_holiday_features(records_df)
    bins = bin_manager.get_all_bins()

    results = []
    for _, bin_row in bins.iterrows():
        prediction = predict_fill_levels(
            bin_row, enriched_df, prediction_start_date
        )
        priority = calculate_priority_score(prediction)

        result = {
            **prediction,
            'priority': priority['priority'],
            'priority_score': priority['score'],
            'priority_reason': priority['reason']
        }
        results.append(result)

    results_df = pd.DataFrame(results)
    results_df = results_df.sort_values(
        by=['priority_score', 'days_until_overflow'],
        ascending=[False, True]
    ).reset_index(drop=True)

    return results_df
