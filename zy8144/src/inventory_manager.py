import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import os


class InventoryManager:
    EXPIRY_CRITICAL_DAYS = 2
    EXPIRY_WARNING_DAYS = 5

    def __init__(self, inventory_df: pd.DataFrame = None):
        self.inventory_df = inventory_df
        self.assigned_bags: Dict[str, List[str]] = {}

    def load_from_csv(self, file_path: str) -> pd.DataFrame:
        self.inventory_df = pd.read_csv(file_path)
        self._process_dates()
        return self.inventory_df

    def _process_dates(self):
        if self.inventory_df is not None:
            self.inventory_df['expiry_date'] = pd.to_datetime(self.inventory_df['expiry_date'])
            self.inventory_df['collection_date'] = pd.to_datetime(self.inventory_df['collection_date'])

    def get_inventory_summary(self, current_date: datetime = None) -> Dict[str, Any]:
        if self.inventory_df is None:
            return {}

        if current_date is None:
            current_date = datetime.now()

        df = self.inventory_df.copy()

        df['days_until_expiry'] = (df['expiry_date'] - pd.Timestamp(current_date)).dt.days

        summary = {
            'total_bags': len(df),
            'total_volume_ml': int(df['volume_ml'].sum()),
            'by_blood_type': df.groupby('blood_type')['volume_ml'].sum().to_dict(),
            'by_campus': df.groupby('campus')['volume_ml'].sum().to_dict(),
            'expiry_summary': {
                'critical': len(df[df['days_until_expiry'] <= self.EXPIRY_CRITICAL_DAYS]),
                'warning': len(df[(df['days_until_expiry'] > self.EXPIRY_CRITICAL_DAYS) &
                                   (df['days_until_expiry'] <= self.EXPIRY_WARNING_DAYS)]),
                'normal': len(df[df['days_until_expiry'] > self.EXPIRY_WARNING_DAYS]),
                'expired': len(df[df['days_until_expiry'] < 0])
            }
        }

        return summary

    def get_expiring_bags(self, current_date: datetime = None, days_threshold: int = 5) -> pd.DataFrame:
        if self.inventory_df is None:
            return pd.DataFrame()

        if current_date is None:
            current_date = datetime.now()

        df = self.inventory_df.copy()
        df['days_until_expiry'] = (df['expiry_date'] - pd.Timestamp(current_date)).dt.days

        expiring = df[(df['days_until_expiry'] >= 0) &
                      (df['days_until_expiry'] <= days_threshold) &
                      (df['status'] == 'available')].copy()

        expiring['expiry_risk'] = expiring['days_until_expiry'].apply(
            lambda x: 'critical' if x <= self.EXPIRY_CRITICAL_DAYS else 'warning'
        )

        return expiring.sort_values('days_until_expiry', ascending=True)

    def get_available_bags(self, campus: str = None, blood_type: str = None) -> pd.DataFrame:
        if self.inventory_df is None:
            return pd.DataFrame()

        df = self.inventory_df[self.inventory_df['status'] == 'available'].copy()

        if campus:
            df = df[df['campus'] == campus]

        if blood_type:
            df = df[df['blood_type'] == blood_type]

        return df

    def get_bag_by_id(self, bag_id: str) -> Optional[Dict[str, Any]]:
        if self.inventory_df is None:
            return None

        bag = self.inventory_df[self.inventory_df['blood_bag_id'] == bag_id]
        if len(bag) == 0:
            return None

        return bag.iloc[0].to_dict()

    def mark_bag_assigned(self, bag_id: str, appointment_id: str) -> bool:
        bag = self.get_bag_by_id(bag_id)
        if bag is None or bag.get('status') != 'available':
            return False

        if bag_id in self.assigned_bags:
            if appointment_id not in self.assigned_bags[bag_id]:
                self.assigned_bags[bag_id].append(appointment_id)
        else:
            self.assigned_bags[bag_id] = [appointment_id]

        if self.inventory_df is not None:
            idx = self.inventory_df[self.inventory_df['blood_bag_id'] == bag_id].index
            if len(idx) > 0:
                self.inventory_df.loc[idx[0], 'status'] = 'assigned'

        return True

    def is_bag_assigned(self, bag_id: str) -> bool:
        return bag_id in self.assigned_bags

    def get_bag_assignments(self, bag_id: str) -> List[str]:
        return self.assigned_bags.get(bag_id, [])

    def get_all_assigned_bags(self) -> Dict[str, List[str]]:
        return self.assigned_bags.copy()

    def filter_inventory(self, campuses: List[str] = None,
                         blood_types: List[str] = None,
                         expiry_risk: str = None,
                         current_date: datetime = None) -> pd.DataFrame:
        if self.inventory_df is None:
            return pd.DataFrame()

        df = self.inventory_df.copy()

        if campuses:
            df = df[df['campus'].isin(campuses)]

        if blood_types:
            df = df[df['blood_type'].isin(blood_types)]

        if expiry_risk and current_date:
            df['days_until_expiry'] = (df['expiry_date'] - pd.Timestamp(current_date)).dt.days

            if expiry_risk == 'critical':
                df = df[df['days_until_expiry'] <= self.EXPIRY_CRITICAL_DAYS]
            elif expiry_risk == 'warning':
                df = df[(df['days_until_expiry'] > self.EXPIRY_CRITICAL_DAYS) &
                        (df['days_until_expiry'] <= self.EXPIRY_WARNING_DAYS)]
            elif expiry_risk == 'normal':
                df = df[df['days_until_expiry'] > self.EXPIRY_WARNING_DAYS]

        return df
