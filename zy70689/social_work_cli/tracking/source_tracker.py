import pandas as pd
from typing import Dict, List, Any
from datetime import datetime
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class ChangeLog:
    id_card: str
    field_name: str
    old_value: str
    new_value: str
    change_time: str
    source: str
    operator: str = 'system'


@dataclass
class SourceInfo:
    id_card: str
    source_file: str
    sheet_name: str
    row_number: int
    import_time: str
    data_type: str


class SourceTracker:
    def __init__(self):
        self.source_infos: List[SourceInfo] = []
        self.change_logs: List[ChangeLog] = []
        self.data_versions: Dict[str, List[Dict]] = defaultdict(list)

    def track_source(self, df: pd.DataFrame, data_type: str, file_path: str, 
                     sheet_name: str = ''):
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        for _, row in df.iterrows():
            if '身份证号' in row:
                id_card = row['身份证号']
            elif '居民身份证号' in row:
                id_card = row['居民身份证号']
            else:
                continue
                
            row_num = row.get('_row_number', 0)
            
            source_info = SourceInfo(
                id_card=id_card,
                source_file=file_path,
                sheet_name=sheet_name,
                row_number=row_num,
                import_time=now,
                data_type=data_type
            )
            self.source_infos.append(source_info)
            
            version_data = {
                'version': len(self.data_versions[id_card]) + 1,
                'data': row.to_dict(),
                'timestamp': now,
                'source': file_path
            }
            self.data_versions[id_card].append(version_data)

    def log_change(self, id_card: str, field_name: str, old_value: str, 
                   new_value: str, source: str = 'rule_engine'):
        if str(old_value) == str(new_value):
            return
            
        change_log = ChangeLog(
            id_card=id_card,
            field_name=field_name,
            old_value=str(old_value),
            new_value=str(new_value),
            change_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            source=source
        )
        self.change_logs.append(change_log)

    def get_source_by_id(self, id_card: str) -> List[SourceInfo]:
        return [s for s in self.source_infos if s.id_card == id_card]

    def get_changes_by_id(self, id_card: str) -> List[ChangeLog]:
        return [c for c in self.change_logs if c.id_card == id_card]

    def get_versions_by_id(self, id_card: str) -> List[Dict]:
        return self.data_versions.get(id_card, [])

    def get_all_sources(self) -> pd.DataFrame:
        if not self.source_infos:
            return pd.DataFrame()
            
        data = []
        for s in self.source_infos:
            data.append({
                '身份证号': s.id_card,
                '数据类型': s.data_type,
                '来源文件': s.source_file,
                '工作表': s.sheet_name,
                '行号': s.row_number,
                '导入时间': s.import_time
            })
        
        df = pd.DataFrame(data)
        df = df.sort_values(by=['身份证号', '数据类型', '导入时间'])
        return df

    def get_all_changes(self) -> pd.DataFrame:
        if not self.change_logs:
            return pd.DataFrame()
            
        data = []
        for c in self.change_logs:
            data.append({
                '身份证号': c.id_card,
                '字段名称': c.field_name,
                '原值': c.old_value,
                '新值': c.new_value,
                '修改时间': c.change_time,
                '修改来源': c.source,
                '操作人': c.operator
            })
        
        df = pd.DataFrame(data)
        df = df.sort_values(by=['身份证号', '修改时间'])
        return df

    def get_bad_rows_report(self, bad_rows: List) -> pd.DataFrame:
        if not bad_rows:
            return pd.DataFrame()
            
        data = []
        for br in bad_rows:
            data.append({
                '来源文件': br.file_path,
                '工作表': br.sheet_name,
                '行号': br.row_number,
                '错误类型': br.error_type,
                '错误描述': br.error_message,
                '原始数据': br.raw_data[:200] if br.raw_data else ''
            })
        
        df = pd.DataFrame(data)
        df = df.sort_values(by=['来源文件', '行号'])
        return df

    def get_tracking_summary(self) -> Dict:
        unique_ids = set(s.id_card for s in self.source_infos)
        source_files = set(s.source_file for s in self.source_infos)
        
        by_type = defaultdict(int)
        for s in self.source_infos:
            by_type[s.data_type] += 1
        
        return {
            'total_records': len(self.source_infos),
            'unique_residents': len(unique_ids),
            'source_files': len(source_files),
            'total_changes': len(self.change_logs),
            'by_data_type': dict(by_type),
            'source_file_list': list(source_files)
        }

    def export_trail(self, id_card: str) -> Dict:
        return {
            '身份证号': id_card,
            '来源信息': [
                {
                    '文件': s.source_file,
                    '工作表': s.sheet_name,
                    '行号': s.row_number,
                    '导入时间': s.import_time,
                    '数据类型': s.data_type
                }
                for s in self.get_source_by_id(id_card)
            ],
            '修改记录': [
                {
                    '字段': c.field_name,
                    '原值': c.old_value,
                    '新值': c.new_value,
                    '修改时间': c.change_time,
                    '来源': c.source
                }
                for c in self.get_changes_by_id(id_card)
            ],
            '版本数量': len(self.get_versions_by_id(id_card))
        }
