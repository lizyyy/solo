import pandas as pd
from typing import Dict, List
from datetime import datetime, timedelta
from ..utils.constants import RISK_LEVELS


class VisitScheduler:
    def __init__(self):
        self.risk_days = {
            'high': 7,
            'medium': 14,
            'low': 30
        }

    def generate_schedule(self, residents: pd.DataFrame, risk_results: pd.DataFrame, 
                          visits: pd.DataFrame) -> pd.DataFrame:
        schedules = []
        
        for _, resident in residents.iterrows():
            id_card = resident['身份证号']
            name = resident['姓名']
            
            risk_row = risk_results[risk_results['身份证号'] == id_card]
            if not risk_row.empty:
                risk_level = risk_row.iloc[0]['风险等级']
                suggested_days = int(risk_row.iloc[0]['建议回访间隔(天)'])
            else:
                risk_level = 'low'
                suggested_days = self.risk_days['low']

            last_visit_date = self._get_last_visit_date(visits, id_card)
            
            if last_visit_date:
                next_visit_date = last_visit_date + timedelta(days=suggested_days)
                days_overdue = (datetime.now() - next_visit_date).days
            else:
                next_visit_date = datetime.now() + timedelta(days=suggested_days)
                days_overdue = 0

            is_overdue = days_overdue > 0
            
            schedules.append({
                '身份证号': id_card,
                '姓名': name,
                '风险等级': risk_level,
                '风险等级名称': self._get_level_name(risk_level),
                '上次走访日期': last_visit_date.strftime('%Y-%m-%d') if last_visit_date else '无',
                '建议回访间隔(天)': suggested_days,
                '计划下次回访日期': next_visit_date.strftime('%Y-%m-%d'),
                '是否逾期': '是' if is_overdue else '否',
                '逾期天数': max(0, days_overdue),
                '优先级': RISK_LEVELS[risk_level]['priority'],
                '负责社工': self._get_last_worker(visits, id_card)
            })

        df = pd.DataFrame(schedules)
        df = df.sort_values(
            by=['优先级', '逾期天数', '计划下次回访日期', '身份证号'],
            ascending=[True, False, True, True]
        )
        df = df.drop(columns=['优先级'])
        
        return df

    def get_monthly_schedule(self, schedule_df: pd.DataFrame, 
                             year: int = None, month: int = None) -> pd.DataFrame:
        if year is None:
            year = datetime.now().year
        if month is None:
            month = datetime.now().month

        df = schedule_df.copy()
        df['计划回访月份'] = pd.to_datetime(df['计划下次回访日期']).dt.to_period('M')
        target_period = pd.Period(f"{year}-{month:02d}")
        
        monthly_df = df[df['计划回访月份'] == target_period].copy()
        monthly_df = monthly_df.drop(columns=['计划回访月份'])
        
        return monthly_df

    def _get_last_visit_date(self, visits: pd.DataFrame, id_card: str) -> datetime:
        if visits.empty:
            return None
            
        resident_visits = visits[visits['居民身份证号'] == id_card]
        if resident_visits.empty:
            return None

        visit_dates = []
        for _, visit in resident_visits.iterrows():
            date_str = str(visit.get('走访日期', '')).strip()
            try:
                if '-' in date_str:
                    visit_date = datetime.strptime(date_str, '%Y-%m-%d')
                elif '/' in date_str:
                    visit_date = datetime.strptime(date_str, '%Y/%m/%d')
                else:
                    continue
                visit_dates.append(visit_date)
            except ValueError:
                continue

        return max(visit_dates) if visit_dates else None

    def _get_last_worker(self, visits: pd.DataFrame, id_card: str) -> str:
        if visits.empty:
            return '待分配'
            
        resident_visits = visits[visits['居民身份证号'] == id_card]
        if resident_visits.empty:
            return '待分配'

        last_date = None
        last_worker = '待分配'
        
        for _, visit in resident_visits.iterrows():
            date_str = str(visit.get('走访日期', '')).strip()
            worker = str(visit.get('社工姓名', '')).strip()
            
            try:
                if '-' in date_str:
                    visit_date = datetime.strptime(date_str, '%Y-%m-%d')
                elif '/' in date_str:
                    visit_date = datetime.strptime(date_str, '%Y/%m/%d')
                else:
                    continue
                    
                if last_date is None or visit_date > last_date:
                    last_date = visit_date
                    last_worker = worker if worker else '待分配'
            except ValueError:
                continue

        return last_worker

    def _get_level_name(self, level: str) -> str:
        names = {'high': '高风险', 'medium': '中风险', 'low': '低风险'}
        return names.get(level, '未知')
