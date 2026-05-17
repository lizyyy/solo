import pandas as pd
from typing import Dict, List, Tuple
from datetime import datetime
from ..utils.constants import MATERIAL_TYPES


class MaterialVerifier:
    def __init__(self):
        self.material_types = MATERIAL_TYPES

    def verify_materials(self, materials: pd.DataFrame, residents: pd.DataFrame) -> pd.DataFrame:
        results = []
        
        for _, material in materials.iterrows():
            id_card = material.get('居民身份证号', '')
            resident = residents[residents['身份证号'] == id_card]
            
            resident_name = resident.iloc[0]['姓名'] if not resident.empty else '未知居民'
            
            issues = []
            status = '正常'
            
            material_name = str(material.get('物资名称', '')).strip()
            quantity = str(material.get('数量', '')).strip()
            receiver = str(material.get('领取人', '')).strip()
            issue_date = str(material.get('发放日期', '')).strip()
            
            if not material_name:
                issues.append('物资名称为空')
                status = '异常'
            elif not any(t in material_name for t in self.material_types):
                issues.append('物资类型不在标准范围内')
            
            if not quantity:
                issues.append('数量为空')
                status = '异常'
            else:
                try:
                    qty = float(quantity)
                    if qty <= 0:
                        issues.append('数量为0或负数')
                        status = '异常'
                except ValueError:
                    issues.append('数量格式错误')
                    status = '异常'
            
            if not receiver:
                issues.append('领取人为空')
                status = '异常'
            
            if not issue_date:
                issues.append('发放日期为空')
                status = '异常'
            else:
                try:
                    if '-' in issue_date:
                        dt = datetime.strptime(issue_date, '%Y-%m-%d')
                    elif '/' in issue_date:
                        dt = datetime.strptime(issue_date, '%Y/%m/%d')
                    else:
                        issues.append('日期格式不正确')
                        status = '异常'
                except ValueError:
                    issues.append('日期格式错误')
                    status = '异常'
            
            if resident.empty:
                issues.append('居民信息不存在')
                status = '异常'

            results.append({
                '居民身份证号': id_card,
                '居民姓名': resident_name,
                '物资名称': material_name,
                '数量': quantity,
                '领取人': receiver,
                '发放日期': issue_date,
                '核销状态': status,
                '问题描述': '; '.join(issues) if issues else '无',
                '来源文件': material.get('_source_file', ''),
                '来源行号': material.get('_row_number', '')
            })

        df = pd.DataFrame(results)
        df['_status_order'] = df['核销状态'].map({'异常': 1, '正常': 2})
        df = df.sort_values(by=['_status_order', '发放日期', '居民身份证号'], ascending=[True, False, True])
        df = df.drop(columns=['_status_order'])
        
        return df

    def get_material_summary(self, verified_df: pd.DataFrame) -> Dict:
        if verified_df.empty:
            return {
                'total': 0,
                'normal': 0,
                'abnormal': 0,
                'by_type': {},
                'by_resident': {}
            }

        total = len(verified_df)
        normal = len(verified_df[verified_df['核销状态'] == '正常'])
        abnormal = len(verified_df[verified_df['核销状态'] == '异常'])

        by_type = {}
        for _, row in verified_df.iterrows():
            name = row['物资名称']
            by_type[name] = by_type.get(name, 0) + 1

        by_resident = verified_df.groupby('居民姓名').size().to_dict()

        return {
            'total': total,
            'normal': normal,
            'abnormal': abnormal,
            'by_type': by_type,
            'by_resident': by_resident
        }

    def get_abnormal_materials(self, verified_df: pd.DataFrame) -> pd.DataFrame:
        return verified_df[verified_df['核销状态'] == '异常'].copy()
