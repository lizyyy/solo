import os
import pandas as pd
from datetime import datetime
from .config import Config

class DataImporter:
    def __init__(self):
        Config.ensure_dirs()
        self.raw_data = None
        self.source_info = {}
        self.import_time = None
    
    def import_file(self, file_path, source_name="未命名数据源"):
        self.import_time = datetime.now()
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.csv':
            df = pd.read_csv(file_path)
        elif file_ext in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}")
        
        df = self._standardize_columns(df)
        
        self.source_info = {
            'source_name': source_name,
            'file_path': file_path,
            'import_time': self.import_time,
            'record_count': len(df),
            'columns': list(df.columns)
        }
        
        df['_source_name'] = source_name
        df['_import_time'] = self.import_time
        df['_record_id'] = [f"{source_name}_{i+1}" for i in range(len(df))]
        
        self.raw_data = df
        return df
    
    def _standardize_columns(self, df):
        column_mapping = {
            '摊位编号': 'stall_id',
            '摊位号': 'stall_id',
            '摊主姓名': 'owner_name',
            '摊主': 'owner_name',
            '经营品类': 'category',
            '品类': 'category',
            '位置': 'location',
            '路口': 'intersection',
            '街口': 'intersection',
            '经度': 'longitude',
            '纬度': 'latitude',
            '开始时间': 'start_time',
            '结束时间': 'end_time',
            '经营时间': 'time_slot',
            '摊位类型': 'stall_type',
            '类型': 'stall_type',
            '投诉次数': 'complaint_count',
            '投诉': 'complaint_count',
            '状态': 'status',
            '备注': 'remarks',
            '说明': 'remarks'
        }
        
        df.columns = [column_mapping.get(col.strip(), col.strip()) for col in df.columns]
        return df
    
    def get_import_summary(self):
        if self.raw_data is None:
            return "未导入数据"
        
        summary = {
            '数据源': self.source_info.get('source_name'),
            '导入时间': self.source_info.get('import_time').strftime('%Y-%m-%d %H:%M:%S'),
            '记录数': self.source_info.get('record_count'),
            '字段列表': self.source_info.get('columns')
        }
        return summary
    
    def validate_data(self):
        if self.raw_data is None:
            return []
        
        issues = []
        df = self.raw_data
        
        if 'stall_id' in df.columns:
            duplicate_stalls = df[df.duplicated('stall_id', keep=False)]
            if not duplicate_stalls.empty:
                issues.append({
                    'type': 'duplicate_stall',
                    'message': f"发现重复摊位编号: {len(duplicate_stalls['stall_id'].unique())}",
                    'count': len(duplicate_stalls)
                })
        
        if 'intersection' in df.columns:
            null_intersection = df['intersection'].isna().sum()
            if null_intersection > 0:
                issues.append({
                    'type': 'missing_intersection',
                    'message': f"有 {null_intersection} 条记录缺少路口信息",
                    'count': null_intersection
                })
        
        if 'longitude' in df.columns and 'latitude' in df.columns:
            invalid_coords = df[df['longitude'].isna() | df['latitude'].isna()]
            if not invalid_coords.empty:
                issues.append({
                    'type': 'missing_coordinates',
                    'message': f"有 {len(invalid_coords)} 条记录坐标信息不完整",
                    'count': len(invalid_coords)
                })
        
        return issues
