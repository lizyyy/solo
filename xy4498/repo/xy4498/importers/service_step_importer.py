import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json

from models import ServiceStep


class ServiceStepImporter:
    """拆洗步骤记录导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    DEFAULT_STEPS = [
        '外观检查',
        '功能测试',
        '表壳表带拆解',
        '机芯取出',
        '机芯拆解',
        '零件清洗',
        '零件检查',
        '更换磨损零件',
        '机芯组装',
        '上油润滑',
        '机芯调试',
        '表壳组装',
        '防水测试',
        '最终检测',
        '质量复核'
    ]
    
    def __init__(self):
        self.steps: List[ServiceStep] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         work_order_id: Optional[str] = None,
                         step_number_column: str = 'step_number',
                         step_name_column: str = 'step_name',
                         technician_column: str = 'technician',
                         status_column: Optional[str] = None,
                         start_time_column: Optional[str] = None,
                         end_time_column: Optional[str] = None,
                         duration_column: Optional[str] = None,
                         issues_column: Optional[str] = None,
                         notes_column: Optional[str] = None) -> List[ServiceStep]:
        """
        从文件导入拆洗步骤记录
        
        Args:
            file_path: 文件路径
            format_type: 文件格式，默认自动检测
            work_order_id: 关联工单ID
            step_number_column: 步骤序号列名
            step_name_column: 步骤名称列名
            technician_column: 操作师傅列名
            status_column: 状态列名（可选）
            start_time_column: 开始时间列名（可选）
            end_time_column: 结束时间列名（可选）
            duration_column: 耗时列名（可选）
            issues_column: 发现问题列名（可选）
            notes_column: 备注列名（可选）
        
        Returns:
            拆洗步骤记录列表
        """
        self.steps = []
        self.errors = []
        
        if format_type is None:
            format_type = self._detect_format(file_path)
        
        if format_type not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {format_type}")
        
        try:
            df = self._read_file(file_path, format_type)
            self._parse_dataframe(
                df, work_order_id, step_number_column, step_name_column,
                technician_column, status_column, start_time_column,
                end_time_column, duration_column, issues_column, notes_column
            )
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.steps
    
    def _detect_format(self, file_path: str) -> str:
        """检测文件格式"""
        if file_path.endswith('.csv'):
            return 'csv'
        elif file_path.endswith('.json'):
            return 'json'
        elif file_path.endswith(('.xlsx', '.xls')):
            return 'excel'
        else:
            raise ValueError(f"无法检测文件格式: {file_path}")
    
    def _read_file(self, file_path: str, format_type: str) -> pd.DataFrame:
        """读取文件为DataFrame"""
        if format_type == 'csv':
            return pd.read_csv(file_path)
        elif format_type == 'json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
            elif isinstance(data, dict):
                if 'steps' in data:
                    return pd.DataFrame(data['steps'])
            raise ValueError("JSON格式不正确")
        elif format_type == 'excel':
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的格式: {format_type}")
    
    def _parse_dataframe(self, df: pd.DataFrame,
                         work_order_id: Optional[str],
                         step_number_column: str,
                         step_name_column: str,
                         technician_column: str,
                         status_column: Optional[str],
                         start_time_column: Optional[str],
                         end_time_column: Optional[str],
                         duration_column: Optional[str],
                         issues_column: Optional[str],
                         notes_column: Optional[str]):
        """解析DataFrame为拆洗步骤记录"""
        
        has_step_number = step_number_column in df.columns
        has_step_name = step_name_column in df.columns
        
        if not has_step_name:
            raise ValueError(f"缺少必要列 '{step_name_column}' 不存在于数据中")
        
        for idx, row in df.iterrows():
            try:
                step_number = int(idx + 1)
                if has_step_number and not pd.isna(row[step_number_column]):
                    try:
                        step_number = int(row[step_number_column])
                    except:
                        pass
                
                step_name = str(row[step_name_column]) if not pd.isna(row[step_name_column]) else f"步骤 {step_number}"
                
                technician = ""
                if technician_column in df.columns and not pd.isna(row[technician_column]):
                    technician = str(row[technician_column])
                
                status = "pending"
                if status_column and status_column in df.columns:
                    if not pd.isna(row[status_column]):
                        status_val = str(row[status_column]).lower()
                        if status_val in ['pending', 'in_progress', 'completed', 'skipped']:
                            status = status_val
                        elif '完成' in status_val or '已完成' in status_val:
                            status = 'completed'
                        elif '进行' in status_val or '进行中' in status_val:
                            status = 'in_progress'
                        elif '跳过' in status_val:
                            status = 'skipped'
                
                start_time = None
                if start_time_column and start_time_column in df.columns:
                    if not pd.isna(row[start_time_column]):
                        try:
                            if isinstance(row[start_time_column], datetime):
                                start_time = row[start_time_column]
                            else:
                                start_time = pd.to_datetime(row[start_time_column]).to_pydatetime()
                        except:
                            pass
                
                end_time = None
                if end_time_column and end_time_column in df.columns:
                    if not pd.isna(row[end_time_column]):
                        try:
                            if isinstance(row[end_time_column], datetime):
                                end_time = row[end_time_column]
                            else:
                                end_time = pd.to_datetime(row[end_time_column]).to_pydatetime()
                        except:
                            pass
                
                duration_minutes = None
                if duration_column and duration_column in df.columns:
                    if not pd.isna(row[duration_column]):
                        try:
                            duration_minutes = float(row[duration_column])
                        except:
                            pass
                
                if duration_minutes is None and start_time and end_time:
                    duration_minutes = (end_time - start_time).total_seconds() / 60
                
                issues_found: List[str] = []
                if issues_column and issues_column in df.columns:
                    if not pd.isna(row[issues_column]):
                        issues_val = str(row[issues_column])
                        if issues_val:
                            if ';' in issues_val:
                                issues_found = [i.strip() for i in issues_val.split(';') if i.strip()]
                            elif ',' in issues_val:
                                issues_found = [i.strip() for i in issues_val.split(',') if i.strip()]
                            else:
                                issues_found = [issues_val.strip()]
                
                notes = None
                if notes_column and notes_column in df.columns:
                    if not pd.isna(row[notes_column]):
                        notes = str(row[notes_column])
                
                step = ServiceStep(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id or "",
                    step_number=step_number,
                    step_name=step_name,
                    technician=technician,
                    start_time=start_time,
                    end_time=end_time,
                    duration_minutes=duration_minutes,
                    status=status,
                    notes=notes,
                    issues_found=issues_found
                )
                self.steps.append(step)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行步骤记录失败: {str(e)}")
        
        self.steps.sort(key=lambda x: x.step_number)
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         work_order_id: Optional[str] = None) -> List[ServiceStep]:
        """从字典列表导入拆洗步骤记录"""
        self.steps = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                step_number = item.get('step_number', idx + 1)
                if isinstance(step_number, str):
                    try:
                        step_number = int(step_number)
                    except:
                        step_number = idx + 1
                
                step_name = item.get('step_name', f"步骤 {step_number}")
                technician = item.get('technician', '')
                
                status = item.get('status', 'pending')
                if isinstance(status, str):
                    status = status.lower()
                
                start_time = item.get('start_time')
                if start_time and isinstance(start_time, str):
                    try:
                        start_time = datetime.fromisoformat(start_time)
                    except:
                        start_time = None
                
                end_time = item.get('end_time')
                if end_time and isinstance(end_time, str):
                    try:
                        end_time = datetime.fromisoformat(end_time)
                    except:
                        end_time = None
                
                duration_minutes = item.get('duration_minutes')
                if duration_minutes is not None:
                    try:
                        duration_minutes = float(duration_minutes)
                    except:
                        duration_minutes = None
                
                if duration_minutes is None and start_time and end_time:
                    duration_minutes = (end_time - start_time).total_seconds() / 60
                
                issues_found = item.get('issues_found', [])
                if isinstance(issues_found, str):
                    if ';' in issues_found:
                        issues_found = [i.strip() for i in issues_found.split(';') if i.strip()]
                    elif ',' in issues_found:
                        issues_found = [i.strip() for i in issues_found.split(',') if i.strip()]
                    else:
                        issues_found = [issues_found.strip()]
                
                notes = item.get('notes')
                
                step = ServiceStep(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id or "",
                    step_number=step_number,
                    step_name=step_name,
                    technician=technician,
                    start_time=start_time,
                    end_time=end_time,
                    duration_minutes=duration_minutes,
                    status=status,
                    notes=notes,
                    issues_found=issues_found
                )
                self.steps.append(step)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项步骤记录失败: {str(e)}")
        
        self.steps.sort(key=lambda x: x.step_number)
        return self.steps
    
    def create_default_steps(self, work_order_id: Optional[str] = None,
                             technician: Optional[str] = None) -> List[ServiceStep]:
        """创建默认拆洗步骤"""
        self.steps = []
        self.errors = []
        
        for idx, step_name in enumerate(self.DEFAULT_STEPS):
            step = ServiceStep(
                id=str(uuid.uuid4()),
                work_order_id=work_order_id or "",
                step_number=idx + 1,
                step_name=step_name,
                technician=technician or "",
                status="pending"
            )
            self.steps.append(step)
        
        return self.steps
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取拆洗步骤统计信息"""
        if not self.steps:
            return {
                'step_count': 0,
                'completed_count': 0,
                'in_progress_count': 0,
                'pending_count': 0,
                'skipped_count': 0,
                'total_duration_minutes': 0,
                'issues_found_count': 0
            }
        
        completed = [s for s in self.steps if s.status == 'completed']
        in_progress = [s for s in self.steps if s.status == 'in_progress']
        pending = [s for s in self.steps if s.status == 'pending']
        skipped = [s for s in self.steps if s.status == 'skipped']
        
        total_duration = sum(
            s.duration_minutes for s in self.steps 
            if s.duration_minutes is not None
        )
        
        issues_count = sum(
            len(s.issues_found) for s in self.steps
        )
        
        return {
            'step_count': len(self.steps),
            'completed_count': len(completed),
            'in_progress_count': len(in_progress),
            'pending_count': len(pending),
            'skipped_count': len(skipped),
            'total_duration_minutes': total_duration,
            'issues_found_count': issues_count,
            'completion_percentage': (len(completed) / len(self.steps) * 100) if self.steps else 0
        }
