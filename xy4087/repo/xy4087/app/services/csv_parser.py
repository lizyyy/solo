import pandas as pd
import numpy as np
import json
import os
from typing import List, Dict, Any, Optional
from app.config import settings


class CSVParser:
    """CSV解析和数据导入服务"""
    
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        self._ensure_upload_dir()
    
    def _ensure_upload_dir(self):
        """确保上传目录存在"""
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir)
    
    def parse_csv(self, file_path: str, field_configs: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        解析CSV文件
        
        Args:
            file_path: CSV文件路径
            field_configs: 字段配置列表，包含name和field_type
            
        Returns:
            包含解析结果的字典
        """
        try:
            # 读取CSV文件
            df = pd.read_csv(file_path, encoding='utf-8')
            
            # 检查字段
            if field_configs:
                field_names = [fc['name'] for fc in field_configs]
                missing_fields = set(field_names) - set(df.columns)
                if missing_fields:
                    raise ValueError(f"CSV缺少必要字段: {', '.join(missing_fields)}")
                
                # 只保留配置的字段
                df = df[field_names]
            
            # 分析字段特征
            field_analysis = self._analyze_fields(df, field_configs)
            
            # 转换数据为可序列化格式
            data_records = df.to_dict('records')
            
            return {
                'success': True,
                'row_count': len(df),
                'column_count': len(df.columns),
                'columns': list(df.columns),
                'field_analysis': field_analysis,
                'data_records': data_records,
                'dataframe': df
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _analyze_fields(self, df: pd.DataFrame, field_configs: List[Dict[str, Any]] = None) -> Dict[str, Dict[str, Any]]:
        """
        分析数据框中的字段特征
        
        Args:
            df: pandas数据框
            field_configs: 字段配置
            
        Returns:
            字段分析结果
        """
        field_analysis = {}
        field_config_map = {fc['name']: fc for fc in field_configs} if field_configs else {}
        
        for column in df.columns:
            series = df[column]
            config = field_config_map.get(column, {})
            
            # 基本统计
            analysis = {
                'name': column,
                'dtype': str(series.dtype),
                'null_count': int(series.isnull().sum()),
                'null_percentage': float(series.isnull().sum() / len(series) * 100),
                'unique_count': int(series.nunique()),
                'sample_values': self._get_sample_values(series)
            }
            
            # 根据字段类型进行额外分析
            field_type = config.get('field_type', 'dimension')
            analysis['field_type'] = field_type
            
            if field_type == 'metric':
                # 数值字段分析
                numeric_series = pd.to_numeric(series, errors='coerce')
                analysis['numeric_stats'] = {
                    'min': float(numeric_series.min()) if not numeric_series.isnull().all() else None,
                    'max': float(numeric_series.max()) if not numeric_series.isnull().all() else None,
                    'mean': float(numeric_series.mean()) if not numeric_series.isnull().all() else None,
                    'median': float(numeric_series.median()) if not numeric_series.isnull().all() else None
                }
            
            elif field_type == 'dimension':
                # 维度字段分析 - 获取值分布
                value_counts = series.value_counts().head(20)
                analysis['value_distribution'] = {
                    str(k): int(v) for k, v in value_counts.items()
                }
            
            field_analysis[column] = analysis
        
        return field_analysis
    
    def _get_sample_values(self, series: pd.Series, sample_size: int = 5) -> List[Any]:
        """获取字段的样本值"""
        non_null = series.dropna()
        if len(non_null) == 0:
            return []
        
        samples = non_null.head(sample_size).tolist()
        # 转换为可序列化格式
        return [self._serialize_value(v) for v in samples]
    
    def _serialize_value(self, value: Any) -> Any:
        """序列化值为JSON兼容格式"""
        if isinstance(value, (np.integer, np.int64, np.int32)):
            return int(value)
        elif isinstance(value, (np.floating, np.float64, np.float32)):
            return float(value)
        elif isinstance(value, np.ndarray):
            return value.tolist()
        elif pd.isna(value):
            return None
        return value
    
    def save_dataset_data(self, dataset_id: int, df: pd.DataFrame) -> str:
        """
        保存数据集数据到文件
        
        Args:
            dataset_id: 数据集ID
            df: pandas数据框
            
        Returns:
            保存的文件路径
        """
        dataset_dir = os.path.join(self.upload_dir, f"dataset_{dataset_id}")
        if not os.path.exists(dataset_dir):
            os.makedirs(dataset_dir)
        
        # 保存为pickle格式（保留数据类型）
        pickle_path = os.path.join(dataset_dir, "data.pkl")
        df.to_pickle(pickle_path)
        
        # 同时保存为CSV（便于查看）
        csv_path = os.path.join(dataset_dir, "data.csv")
        df.to_csv(csv_path, index=False, encoding='utf-8')
        
        return pickle_path
    
    def load_dataset_data(self, dataset_id: int) -> Optional[pd.DataFrame]:
        """
        加载数据集数据
        
        Args:
            dataset_id: 数据集ID
            
        Returns:
            pandas数据框或None
        """
        pickle_path = os.path.join(self.upload_dir, f"dataset_{dataset_id}", "data.pkl")
        
        if not os.path.exists(pickle_path):
            return None
        
        try:
            return pd.read_pickle(pickle_path)
        except Exception:
            # 尝试从CSV加载
            csv_path = os.path.join(self.upload_dir, f"dataset_{dataset_id}", "data.csv")
            if os.path.exists(csv_path):
                return pd.read_csv(csv_path, encoding='utf-8')
            return None
    
    def delete_dataset_data(self, dataset_id: int) -> bool:
        """
        删除数据集数据
        
        Args:
            dataset_id: 数据集ID
            
        Returns:
            是否成功
        """
        import shutil
        dataset_dir = os.path.join(self.upload_dir, f"dataset_{dataset_id}")
        
        if os.path.exists(dataset_dir):
            shutil.rmtree(dataset_dir)
            return True
        return False


csv_parser = CSVParser()
