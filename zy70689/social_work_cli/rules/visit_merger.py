import pandas as pd
from typing import Dict, List
from datetime import datetime
from hashlib import md5


class VisitMerger:
    def __init__(self):
        pass

    def merge_duplicates(self, visits: pd.DataFrame, residents: pd.DataFrame) -> Dict:
        if visits.empty:
            return {
                'merged': pd.DataFrame(),
                'duplicates': pd.DataFrame(),
                'original_count': 0,
                'merged_count': 0,
                'duplicate_count': 0
            }

        visits_with_keys = self._add_duplicate_keys(visits.copy())
        
        duplicate_groups = visits_with_keys.groupby('_duplicate_key')
        merged_visits = []
        duplicate_records = []
        
        for key, group in duplicate_groups:
            if len(group) == 1:
                visit = group.iloc[0].copy()
                visit['_merge_status'] = '唯一记录'
                visit['_merge_note'] = ''
                merged_visits.append(visit)
            else:
                sorted_group = group.sort_values(by=['_date_value', '_row_number'])
                
                primary = sorted_group.iloc[0].copy()
                
                merged_contents = []
                source_infos = []
                
                for idx, (_, row) in enumerate(sorted_group.iterrows()):
                    content = str(row.get('走访内容', ''))
                    if content and content not in merged_contents:
                        merged_contents.append(content)
                    source_info = f"文件:{row.get('_source_file', '')} 行号:{row.get('_row_number', '')}"
                    source_infos.append(source_info)
                    
                    if idx > 0:
                        duplicate_records.append({
                            '重复组ID': key,
                            '居民身份证号': row.get('居民身份证号', ''),
                            '居民姓名': self._get_resident_name(residents, row.get('居民身份证号', '')),
                            '走访日期': row.get('走访日期', ''),
                            '社工姓名': row.get('社工姓名', ''),
                            '走访内容': content,
                            '保留记录': '否',
                            '来源文件': row.get('_source_file', ''),
                            '来源行号': row.get('_row_number', '')
                        })
                
                primary['走访内容'] = ' | '.join(merged_contents)
                primary['_merge_status'] = '合并记录'
                primary['_merge_note'] = f'合并了{len(sorted_group)}条重复记录'
                primary['_merge_sources'] = '; '.join(source_infos)
                
                duplicate_records.append({
                    '重复组ID': key,
                    '居民身份证号': primary.get('居民身份证号', ''),
                    '居民姓名': self._get_resident_name(residents, primary.get('居民身份证号', '')),
                    '走访日期': primary.get('走访日期', ''),
                    '社工姓名': primary.get('社工姓名', ''),
                    '走访内容': primary['走访内容'],
                    '保留记录': '是',
                    '来源文件': primary.get('_source_file', ''),
                    '来源行号': primary.get('_row_number', '')
                })
                
                merged_visits.append(primary)

        merged_df = pd.DataFrame(merged_visits)
        
        if not merged_df.empty:
            if '_date_value' in merged_df.columns:
                merged_df = merged_df.sort_values(by=['居民身份证号', '_date_value'])
            else:
                merged_df = merged_df.sort_values(by=['居民身份证号'])
            merged_df = self._clean_internal(merged_df)
        
        duplicates_df = pd.DataFrame(duplicate_records)
        
        return {
            'merged': merged_df,
            'duplicates': duplicates_df,
            'original_count': len(visits),
            'merged_count': len(merged_df),
            'duplicate_count': len(duplicates_df)
        }

    def _add_duplicate_keys(self, df: pd.DataFrame) -> pd.DataFrame:
        keys = []
        date_values = []
        
        for _, row in df.iterrows():
            id_card = str(row.get('居民身份证号', ''))
            visit_date = str(row.get('走访日期', ''))
            worker = str(row.get('社工姓名', ''))
            
            normalized_date = self._normalize_date(visit_date)
            date_values.append(normalized_date)
            
            key_content = f"{id_card}|{normalized_date}|{worker}"
            key = md5(key_content.encode('utf-8')).hexdigest()[:12]
            
            keys.append(key)
        
        df['_duplicate_key'] = keys
        df['_date_value'] = date_values
        
        return df

    def _clean_internal(self, df: pd.DataFrame) -> pd.DataFrame:
        cols_to_keep = []
        for col in df.columns:
            if not col.startswith('_'):
                cols_to_keep.append(col)
            elif col in ['_merge_status', '_merge_note', '_merge_sources']:
                cols_to_keep.append(col)
        return df[cols_to_keep]

    def _normalize_date(self, date_str: str) -> str:
        date_str = str(date_str).strip()
        if not date_str:
            return ''
            
        try:
            if '-' in date_str:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
            elif '/' in date_str:
                dt = datetime.strptime(date_str, '%Y/%m/%d')
            else:
                return date_str
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            return date_str

    def _get_resident_name(self, residents: pd.DataFrame, id_card: str) -> str:
        if residents.empty:
            return '未知'
        matches = residents[residents['身份证号'] == id_card]
        if not matches.empty:
            return matches.iloc[0].get('姓名', '未知')
        return '未知'

    def get_duplicate_summary(self, merge_result: Dict) -> Dict:
        duplicates_df = merge_result['duplicates']
        if duplicates_df.empty:
            return {
                'total_duplicates': 0,
                'by_resident': {},
                'by_worker': {}
            }
        
        by_resident = duplicates_df.groupby('居民姓名').size().to_dict()
        by_worker = duplicates_df.groupby('社工姓名').size().to_dict()
        
        return {
            'total_duplicates': len(duplicates_df),
            'by_resident': by_resident,
            'by_worker': by_worker
        }
