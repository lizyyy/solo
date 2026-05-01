import pandas as pd
import json
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple


def parse_flights(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df['arrival_datetime'] = pd.to_datetime(df['arrival_date'] + ' ' + df['arrival_time'])
    df['expected_first_bag'] = pd.to_datetime(df['arrival_date'] + ' ' + df['expected_first_bag'])
    df['expected_last_bag'] = pd.to_datetime(df['arrival_date'] + ' ' + df['expected_last_bag'])
    
    for idx, row in df.iterrows():
        if row['expected_first_bag'] < row['arrival_datetime'] - timedelta(hours=12):
            df.at[idx, 'expected_first_bag'] += timedelta(days=1)
        if row['expected_last_bag'] < row['arrival_datetime'] - timedelta(hours=12):
            df.at[idx, 'expected_last_bag'] += timedelta(days=1)
    
    return df


def parse_bag_scans(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df['scan_datetime'] = pd.to_datetime(df['scan_time'])
    return df


def parse_carousel_allocations(json_path: str) -> Dict:
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def parse_interventions(yaml_path: str) -> List[Dict]:
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        return data.get('interventions', [])


def get_flight_bag_times(bag_scans_df: pd.DataFrame, flight_num: str) -> Tuple[Optional[datetime], Optional[datetime]]:
    flight_scans = bag_scans_df[bag_scans_df['flight_num'] == flight_num]
    
    first_bag = None
    last_bag = None
    
    if not flight_scans.empty:
        first_scans = flight_scans[flight_scans['bag_type'] == 'first']
        last_scans = flight_scans[flight_scans['bag_type'] == 'last']
        
        if not first_scans.empty:
            first_bag = first_scans.iloc[0]['scan_datetime']
        if not last_scans.empty:
            last_bag = last_scans.iloc[0]['scan_datetime']
    
    return first_bag, last_bag


def get_carousel_for_flight(allocations: Dict, flight_num: str, date: str, terminal: str) -> Optional[str]:
    if date in allocations:
        if terminal in allocations[date]:
            if flight_num in allocations[date][terminal]:
                return allocations[date][terminal][flight_num]
    return None
