import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .config import Config

class DataMerger:
    def __init__(self):
        self.merged_data = None
        self.merge_log = []
        self.exceptions = []
    
    def merge_data(self, raw_data):
        df = raw_data.copy()
        
        df = self._handle_duplicate_complaints(df)
        df = self._handle_same_intersection(df)
        df = self._handle_coordinate_offset(df)
        df = self._detect_time_slot_conflicts(df)
        df = self._check_capacity_exceeded(df)
        df = self._assign_status(df)
        
        self.merged_data = df
        return df
    
    def _handle_duplicate_complaints(self, df):
        if 'stall_id' not in df.columns or 'complaint_count' not in df.columns:
            return df
        
        duplicate_mask = df.duplicated('stall_id', keep=False)
        duplicates = df[duplicate_mask].copy()
        
        for stall_id in duplicates['stall_id'].unique():
            stall_records = df[df['stall_id'] == stall_id]
            total_complaints = stall_records['complaint_count'].sum()
            
            original_sources = ', '.join(stall_records['_source_name'].unique())
            original_record_ids = ', '.join(stall_records['_record_id'].unique())
            
            keep_idx = stall_records.index[0]
            df.loc[keep_idx, 'complaint_count'] = total_complaints
            df.loc[keep_idx, '_merged_sources'] = original_sources
            df.loc[keep_idx, '_merged_record_ids'] = original_record_ids
            df.loc[keep_idx, '_merge_note'] = f"合并 {len(stall_records)} 条重复记录，投诉次数累计"
            
            drop_indices = stall_records.index[1:]
            df = df.drop(drop_indices)
            
            self.merge_log.append({
                'type': 'duplicate_complaint',
                'stall_id': stall_id,
                'message': f"摊位 {stall_id} 合并了 {len(stall_records)} 条重复投诉记录，累计投诉 {total_complaints} 次",
                'sources': original_sources
            })
        
        return df
    
    def _handle_same_intersection(self, df):
        if 'intersection' not in df.columns:
            return df
        
        intersection_groups = df.groupby('intersection')
        
        for intersection_name, group in intersection_groups:
            if len(group) > 1:
                stall_ids = ', '.join(group['stall_id'].astype(str).unique())
                self.merge_log.append({
                    'type': 'same_intersection',
                    'intersection': intersection_name,
                    'message': f"路口 '{intersection_name}' 有 {len(group)} 个摊位: {stall_ids}",
                    'stall_count': len(group)
                })
        
        return df
    
    def _handle_coordinate_offset(self, df):
        if 'longitude' not in df.columns or 'latitude' not in df.columns:
            return df
        
        tol = Config.COORDINATE_TOLERANCE
        coord_groups = []
        
        for idx, row in df.iterrows():
            if pd.isna(row['longitude']) or pd.isna(row['latitude']):
                continue
            
            matched = False
            for group in coord_groups:
                ref_lon, ref_lat = group['center']
                if (abs(row['longitude'] - ref_lon) < tol and 
                    abs(row['latitude'] - ref_lat) < tol):
                    group['records'].append(idx)
                    group['stalls'].append(row['stall_id'])
                    matched = True
                    break
            
            if not matched:
                coord_groups.append({
                    'center': (row['longitude'], row['latitude']),
                    'records': [idx],
                    'stalls': [row['stall_id']]
                })
        
        for group in coord_groups:
            if len(group['records']) > 1:
                stall_ids = ', '.join(str(s) for s in group['stalls'])
                self.merge_log.append({
                    'type': 'coordinate_offset',
                    'coordinates': group['center'],
                    'message': f"坐标 {group['center']} 附近有 {len(group['records'])} 个摊位位置重叠: {stall_ids}",
                    'stalls': stall_ids
                })
                
                center_lon = np.mean([df.loc[i, 'longitude'] for i in group['records']])
                center_lat = np.mean([df.loc[i, 'latitude'] for i in group['records']])
                
                for idx in group['records']:
                    df.loc[idx, '_corrected_longitude'] = center_lon
                    df.loc[idx, '_corrected_latitude'] = center_lat
                    df.loc[idx, '_coordinate_note'] = "坐标偏移已修正"
        
        return df
    
    def _detect_time_slot_conflicts(self, df):
        if 'start_time' not in df.columns or 'end_time' not in df.columns:
            return df
        
        def parse_time(t):
            if pd.isna(t):
                return None
            if isinstance(t, str):
                try:
                    return datetime.strptime(t, '%H:%M').time()
                except:
                    try:
                        return datetime.strptime(t, '%H:%M:%S').time()
                    except:
                        return None
            return t
        
        for idx, row in df.iterrows():
            start = parse_time(row['start_time'])
            end = parse_time(row['end_time'])
            
            if start and end and start >= end:
                df.loc[idx, '_time_conflict'] = True
                df.loc[idx, '_time_note'] = f"时间段冲突：开始时间 {start} 晚于或等于结束时间 {end}"
                self.exceptions.append({
                    'type': 'time_slot_conflict',
                    'stall_id': row.get('stall_id', '未知'),
                    'message': f"摊位 {row.get('stall_id', '未知')} 时间段设置错误，开始时间晚于结束时间",
                    'severity': 'high'
                })
        
        if 'intersection' in df.columns:
            for intersection, group in df.groupby('intersection'):
                records = []
                for idx, row in group.iterrows():
                    start = parse_time(row['start_time'])
                    end = parse_time(row['end_time'])
                    if start and end:
                        records.append((idx, start, end, row.get('stall_id', '未知')))
                
                for i, (idx1, s1, e1, stall1) in enumerate(records):
                    for (idx2, s2, e2, stall2) in records[i+1:]:
                        if s1 < e2 and s2 < e1:
                            df.loc[idx1, '_time_conflict'] = True
                            df.loc[idx1, '_time_note'] = f"与摊位 {stall2} 时间段重叠"
                            df.loc[idx2, '_time_conflict'] = True
                            df.loc[idx2, '_time_note'] = f"与摊位 {stall1} 时间段重叠"
                            
                            self.exceptions.append({
                                'type': 'time_overlap',
                                'intersection': intersection,
                                'stalls': f"{stall1}, {stall2}",
                                'message': f"路口 '{intersection}' 的摊位 {stall1} 和 {stall2} 经营时间段重叠",
                                'severity': 'medium'
                            })
        
        return df
    
    def _check_capacity_exceeded(self, df):
        if 'intersection' not in df.columns:
            return df
        
        intersection_counts = df['intersection'].value_counts()
        
        for intersection, count in intersection_counts.items():
            capacity = Config.STALL_CAPACITY.get('medium', 12)
            if count > capacity:
                self.exceptions.append({
                    'type': 'capacity_exceeded',
                    'intersection': intersection,
                    'message': f"路口 '{intersection}' 容量超限：规划容量 {capacity} 个，实际分配 {count} 个，超出 {count - capacity} 个",
                    'capacity': capacity,
                    'actual': count,
                    'exceeded': count - capacity,
                    'severity': 'high'
                })
                
                mask = df['intersection'] == intersection
                df.loc[mask, '_capacity_exceeded'] = True
                df.loc[mask, '_capacity_note'] = f"该路口容量超限（{count}/{capacity}）"
        
        return df
    
    def _assign_status(self, df):
        df['_status'] = 'processed'
        df['_status_text'] = '已处理'
        
        if '_time_conflict' in df.columns:
            df.loc[df['_time_conflict'] == True, '_status'] = 'pending'
            df.loc[df['_time_conflict'] == True, '_status_text'] = '待核实'
        
        if '_capacity_exceeded' in df.columns:
            df.loc[df['_capacity_exceeded'] == True, '_status'] = 'onsite'
            df.loc[df['_capacity_exceeded'] == True, '_status_text'] = '需要现场复看'
        
        return df
    
    def get_merge_report(self):
        report = {
            'merge_summary': {
                'total_records': len(self.merged_data) if self.merged_data is not None else 0,
                'merge_operations': len(self.merge_log),
                'exceptions_found': len(self.exceptions)
            },
            'merge_log': self.merge_log,
            'exceptions': self.exceptions
        }
        return report
    
    def get_exceptions_summary(self):
        summary = []
        for exc in self.exceptions:
            summary.append({
                '类型': self._translate_exception_type(exc.get('type', '')),
                '严重程度': self._translate_severity(exc.get('severity', '')),
                '详情': exc.get('message', '')
            })
        return summary
    
    def _translate_exception_type(self, t):
        types = {
            'time_slot_conflict': '时间段设置错误',
            'time_overlap': '经营时间重叠',
            'capacity_exceeded': '路口容量超限',
            'duplicate_complaint': '重复投诉记录'
        }
        return types.get(t, t)
    
    def _translate_severity(self, s):
        levels = {'high': '高', 'medium': '中', 'low': '低'}
        return levels.get(s, s)
