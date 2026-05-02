import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from .data_parser import get_flight_bag_times, get_carousel_for_flight


def calculate_flight_metrics(
    flights_df: pd.DataFrame,
    bag_scans_df: pd.DataFrame,
    carousel_allocations: Dict,
    interventions: List[Dict]
) -> pd.DataFrame:
    metrics = []
    
    for _, flight in flights_df.iterrows():
        flight_num = flight['flight_num']
        arrival_date = flight['arrival_date']
        terminal = flight['terminal']
        
        first_bag, last_bag = get_flight_bag_times(bag_scans_df, flight_num)
        carousel = get_carousel_for_flight(carousel_allocations, flight_num, arrival_date, terminal)
        
        first_delay_minutes = None
        last_overtime_minutes = None
        first_missing = False
        last_missing = False
        
        if first_bag is not None:
            first_delay = first_bag - flight['expected_first_bag']
            first_delay_minutes = max(0, int(first_delay.total_seconds() / 60))
        else:
            first_missing = True
        
        if last_bag is not None:
            last_overtime = last_bag - flight['expected_last_bag']
            last_overtime_minutes = max(0, int(last_overtime.total_seconds() / 60))
        else:
            last_missing = True
        
        intervention = next((i for i in interventions if i['flight_num'] == flight_num), None)
        
        metrics.append({
            'flight_num': flight_num,
            'arrival_date': arrival_date,
            'terminal': terminal,
            'carousel': carousel,
            'arrival_datetime': flight['arrival_datetime'],
            'expected_first_bag': flight['expected_first_bag'],
            'actual_first_bag': first_bag,
            'first_delay_minutes': first_delay_minutes,
            'first_missing': first_missing,
            'expected_last_bag': flight['expected_last_bag'],
            'actual_last_bag': last_bag,
            'last_overtime_minutes': last_overtime_minutes,
            'last_missing': last_missing,
            'bag_count': flight['bag_count'],
            'has_intervention': intervention is not None,
            'intervention_type': intervention['type'] if intervention else None
        })
    
    return pd.DataFrame(metrics)


def detect_carousel_conflicts(metrics_df: pd.DataFrame) -> List[Dict]:
    conflicts = []
    
    for carousel in metrics_df['carousel'].dropna().unique():
        carousel_flights = metrics_df[metrics_df['carousel'] == carousel].sort_values('arrival_datetime')
        
        for i in range(len(carousel_flights) - 1):
            flight1 = carousel_flights.iloc[i]
            flight2 = carousel_flights.iloc[i + 1]
            
            f1_end = flight1['actual_last_bag'] if pd.notna(flight1['actual_last_bag']) else flight1['expected_last_bag']
            f2_start = flight2['actual_first_bag'] if pd.notna(flight2['actual_first_bag']) else flight2['expected_first_bag']
            
            if f1_end > f2_start:
                overlap_minutes = int((f1_end - f2_start).total_seconds() / 60)
                conflicts.append({
                    'carousel': carousel,
                    'flight1': flight1['flight_num'],
                    'flight2': flight2['flight_num'],
                    'overlap_minutes': overlap_minutes,
                    'f1_end': f1_end,
                    'f2_start': f2_start
                })
    
    return conflicts


def calculate_reassignment_impact(metrics_df: pd.DataFrame, interventions: List[Dict]) -> List[Dict]:
    impacts = []
    
    reassignments = [i for i in interventions if i['type'] == 'carousel_reassign']
    
    for reassignment in reassignments:
        flight = metrics_df[metrics_df['flight_num'] == reassignment['flight_num']]
        
        if not flight.empty:
            flight = flight.iloc[0]
            original_carousel = reassignment['from_carousel']
            new_carousel = reassignment['to_carousel']
            
            impacts.append({
                'flight_num': reassignment['flight_num'],
                'date': reassignment['date'],
                'original_carousel': original_carousel,
                'new_carousel': new_carousel,
                'reason': reassignment['reason'],
                'first_delay_minutes': flight['first_delay_minutes'],
                'last_overtime_minutes': flight['last_overtime_minutes']
            })
    
    return impacts


def get_summary_stats(metrics_df: pd.DataFrame) -> Dict:
    total_flights = len(metrics_df)
    flights_with_first_delay = len(metrics_df[metrics_df['first_delay_minutes'] > 0])
    flights_with_last_overtime = len(metrics_df[metrics_df['last_overtime_minutes'] > 0])
    flights_missing_first = len(metrics_df[metrics_df['first_missing']])
    flights_missing_last = len(metrics_df[metrics_df['last_missing']])
    flights_with_intervention = len(metrics_df[metrics_df['has_intervention']])
    
    avg_first_delay = metrics_df['first_delay_minutes'].mean()
    avg_last_overtime = metrics_df['last_overtime_minutes'].mean()
    
    return {
        'total_flights': total_flights,
        'flights_with_first_delay': flights_with_first_delay,
        'flights_with_last_overtime': flights_with_last_overtime,
        'flights_missing_first': flights_missing_first,
        'flights_missing_last': flights_missing_last,
        'flights_with_intervention': flights_with_intervention,
        'avg_first_delay_minutes': round(avg_first_delay, 2) if pd.notna(avg_first_delay) else 0,
        'avg_last_overtime_minutes': round(avg_last_overtime, 2) if pd.notna(avg_last_overtime) else 0
    }
