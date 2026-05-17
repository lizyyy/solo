import pandas as pd
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
from ..utils.constants import RISK_LEVELS, RISK_CRITERIA


class RiskClassifier:
    def __init__(self):
        self.risk_levels = RISK_LEVELS
        self.risk_criteria = RISK_CRITERIA

    def classify_resident(self, resident: pd.Series, visits: pd.DataFrame, 
                          materials: pd.DataFrame) -> Dict:
        risk_factors = []
        high_count = 0
        medium_count = 0

        age = self._parse_age(resident.get('年龄', 0))
        living_situation = str(resident.get('居住情况', '')).strip()
        health_status = str(resident.get('健康状况', '')).strip()
        children_situation = str(resident.get('子女情况', '')).strip()
        economic_status = str(resident.get('经济状况', '')).strip()

        if age >= 80 and '独居' in living_situation:
            high_count += 1
            risk_factors.append('独居且高龄(>=80岁)')
        elif 70 <= age < 80 and '独居' in living_situation:
            medium_count += 1
            risk_factors.append('独居(70-79岁)')

        if '严重' in health_status or '重病' in health_status or '住院' in health_status:
            high_count += 1
            risk_factors.append('有严重慢性病/近期住院')
        elif '慢性病' in health_status or '一般' in health_status:
            medium_count += 1
            risk_factors.append('有慢性病但稳定')

        if '无子女' in children_situation or '不在身边' in children_situation or '外地' in children_situation:
            high_count += 1
            risk_factors.append('无子女或子女长期不在身边')
        elif '本地' in children_situation and '少' in children_situation:
            medium_count += 1
            risk_factors.append('子女在本地但探望频率低')

        if '困难' in economic_status or '低保' in economic_status:
            medium_count += 1
            risk_factors.append('经济困难')

        if not visits.empty:
            last_visit = self._get_last_visit(visits)
            if last_visit:
                days_since_visit = (datetime.now() - last_visit).days
                if days_since_visit > 60:
                    medium_count += 1
                    risk_factors.append(f'超过60天未走访({days_since_visit}天)')

            for _, visit in visits.iterrows():
                content = str(visit.get('走访内容', ''))
                if '需要帮助' in content or '困难' in content or '紧急' in content:
                    medium_count += 1
                    risk_factors.append('走访记录显示需要帮助')
                    break

        if high_count >= 1:
            risk_level = 'high'
            level_name = '高风险'
        elif medium_count >= 2:
            risk_level = 'medium'
            level_name = '中风险'
        else:
            risk_level = 'low'
            level_name = '低风险'

        days_until_review = self.risk_levels[risk_level]['days_until_review']
        next_review_date = datetime.now() + timedelta(days=days_until_review)

        return {
            '身份证号': resident.get('身份证号', ''),
            '姓名': resident.get('姓名', ''),
            '风险等级': risk_level,
            '风险等级名称': level_name,
            '风险因素': '; '.join(risk_factors) if risk_factors else '无',
            '高风险因素数量': high_count,
            '中风险因素数量': medium_count,
            '建议回访间隔(天)': days_until_review,
            '建议下次回访日期': next_review_date.strftime('%Y-%m-%d'),
            '评估时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

    def classify_all_residents(self, residents: pd.DataFrame, visits: pd.DataFrame, 
                                materials: pd.DataFrame) -> pd.DataFrame:
        results = []
        
        for _, resident in residents.iterrows():
            id_card = resident['身份证号']
            resident_visits = visits[visits['居民身份证号'] == id_card] if not visits.empty else pd.DataFrame()
            resident_materials = materials[materials['居民身份证号'] == id_card] if not materials.empty else pd.DataFrame()
            
            risk_result = self.classify_resident(resident, resident_visits, resident_materials)
            results.append(risk_result)

        df = pd.DataFrame(results)
        df['_sort_key'] = df['风险等级'].map({'high': 1, 'medium': 2, 'low': 3})
        df = df.sort_values(by=['_sort_key', '身份证号'], ascending=[True, True])
        df = df.drop(columns=['_sort_key'])
        
        return df

    def _parse_age(self, age_value) -> int:
        try:
            return int(float(str(age_value).strip()))
        except (ValueError, TypeError):
            return 0

    def _get_last_visit(self, visits: pd.DataFrame) -> datetime:
        if visits.empty:
            return None
        
        try:
            visit_dates = []
            for _, visit in visits.iterrows():
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
        except Exception:
            return None
