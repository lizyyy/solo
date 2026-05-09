import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from collections import Counter

from config import config
from logger import get_logger
from data_loader import DataLoader


class QualityControl:
    def __init__(self, data_loader: DataLoader):
        self.loader = data_loader
        self.logger = get_logger()
        self.qc_report = {
            'missing_values': {},
            'duplicates': [],
            'inconsistent_units': [],
            'outliers': [],
            'negative_values': [],
            'extreme_values': []
        }
    
    def run_all_checks(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("开始质量控制检查")
        
        df = self.check_missing_values(df)
        df = self.check_duplicates(df)
        df = self.check_negative_values(df)
        df = self.check_outliers_iqr(df)
        df = self.check_outliers_zscore(df)
        
        self._print_qc_summary()
        return df
    
    def check_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("检查缺失值")
        
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            missing_count = df[col_name].isna().sum()
            missing_ratio = missing_count / len(df) if len(df) > 0 else 0
            
            self.qc_report['missing_values'][col_name] = {
                'count': missing_count,
                'ratio': missing_ratio
            }
            
            if missing_count > 0:
                missing_indices = df[df[col_name].isna()].index
                for idx in missing_indices:
                    self.logger.record_failed_sample(
                        df.loc[idx, '_original_index'],
                        df.loc[idx].to_dict(),
                        f"{col_name} 列存在缺失值",
                        'missing_value'
                    )
            
            self.logger.log_info(
                f"{col_name}: 缺失 {missing_count} 条 ({missing_ratio:.1%})"
            )
        
        return df
    
    def check_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("检查重复记录")
        
        key_cols = config.duplicate_detection_columns
        if key_cols is None:
            key_cols = []
            if self.loader.mapping['datetime']:
                key_cols.append(self.loader.mapping['datetime'])
            if self.loader.mapping['id']:
                key_cols.append(self.loader.mapping['id'])
        
        if len(key_cols) == 0:
            key_cols = [col for col in df.columns if not col.startswith('_') and col != '_original_index']
        
        if len(key_cols) == 0:
            self.logger.log_warning("无法确定去重键列，跳过重复检查")
            return df
        
        key_cols = [c for c in key_cols if c in df.columns]
        
        duplicates_mask = df.duplicated(subset=key_cols, keep=False)
        duplicates = df[duplicates_mask]
        
        if len(duplicates) > 0:
            grouped = duplicates.groupby(key_cols)
            for name, group in grouped:
                indices = group['_original_index'].tolist()
                self.qc_report['duplicates'].append({
                    'key': name,
                    'indices': indices,
                    'count': len(indices)
                })
                
                for idx, (row_idx, row) in enumerate(group.iterrows()):
                    if idx == 0:
                        continue
                    self.logger.record_failed_sample(
                        row['_original_index'],
                        row.to_dict(),
                        f"与索引 {indices[0]} 的记录重复，键值: {name}",
                        'duplicate'
                    )
            
            self.logger.log_warning(f"发现 {len(duplicates)} 条重复记录")
            df = df.drop_duplicates(subset=key_cols, keep='first').reset_index(drop=True)
            self.logger.log_info(f"去重后剩余 {len(df)} 条记录")
        
        return df
    
    def check_negative_values(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("检查负值（能耗/产量/压力/泄漏应为非负）")
        
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            negative_mask = df[col_name] < 0
            negative_count = negative_mask.sum()
            
            if negative_count > 0:
                negative_indices = df[negative_mask].index
                for idx in negative_indices:
                    value = df.loc[idx, col_name]
                    self.logger.record_failed_sample(
                        df.loc[idx, '_original_index'],
                        df.loc[idx].to_dict(),
                        f"{col_name} 存在负值: {value}",
                        'negative_value'
                    )
                    self.qc_report['negative_values'].append({
                        'column': col_name,
                        'index': df.loc[idx, '_original_index'],
                        'value': value
                    })
                
                df.loc[negative_mask, col_name] = np.nan
                self.logger.log_warning(f"{col_name}: 发现 {negative_count} 个负值，已置为缺失")
        
        return df
    
    def check_outliers_iqr(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("使用IQR方法检查异常值")
        
        multiplier = config.outlier_iqr_multiplier
        
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            valid_data = df[col_name].dropna()
            if len(valid_data) < 4:
                continue
            
            q1 = valid_data.quantile(0.25)
            q3 = valid_data.quantile(0.75)
            iqr = q3 - q1
            
            if iqr == 0:
                continue
            
            lower_bound = q1 - multiplier * iqr
            upper_bound = q3 + multiplier * iqr
            
            outlier_mask = (df[col_name] < lower_bound) | (df[col_name] > upper_bound)
            outlier_count = outlier_mask.sum()
            
            if outlier_count > 0:
                outlier_indices = df[outlier_mask].index
                for idx in outlier_indices:
                    value = df.loc[idx, col_name]
                    bounds = f"[{lower_bound:.4f}, {upper_bound:.4f}]"
                    
                    self.logger.record_failed_sample(
                        df.loc[idx, '_original_index'],
                        df.loc[idx].to_dict(),
                        f"{col_name} 异常值(IQR): {value} 超出范围 {bounds}",
                        'outlier_iqr'
                    )
                    self.qc_report['outliers'].append({
                        'method': 'IQR',
                        'column': col_name,
                        'index': df.loc[idx, '_original_index'],
                        'value': value,
                        'bounds': bounds
                    })
                
                self.logger.log_info(
                    f"{col_name}: IQR检测到 {outlier_count} 个异常值 (范围: {bounds})"
                )
        
        return df
    
    def check_outliers_zscore(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("使用Z-score方法检查异常值")
        
        threshold = config.zscore_threshold
        
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            valid_data = df[col_name].dropna()
            if len(valid_data) < 4:
                continue
            
            mean = valid_data.mean()
            std = valid_data.std()
            
            if std == 0:
                continue
            
            z_scores = (df[col_name] - mean) / std
            outlier_mask = z_scores.abs() > threshold
            outlier_count = outlier_mask.sum()
            
            if outlier_count > 0:
                outlier_indices = df[outlier_mask].index
                for idx in outlier_indices:
                    value = df.loc[idx, col_name]
                    z = z_scores[idx]
                    
                    existing_outliers = [o for o in self.qc_report['outliers'] 
                                         if o['column'] == col_name and o['index'] == df.loc[idx, '_original_index']]
                    
                    if not existing_outliers:
                        self.logger.record_failed_sample(
                            df.loc[idx, '_original_index'],
                            df.loc[idx].to_dict(),
                            f"{col_name} 异常值(Z-score): {value}, Z={z:.2f} (阈值={threshold})",
                            'outlier_zscore'
                        )
                        self.qc_report['outliers'].append({
                            'method': 'Z-score',
                            'column': col_name,
                            'index': df.loc[idx, '_original_index'],
                            'value': value,
                            'zscore': z
                        })
                
                self.logger.log_info(
                    f"{col_name}: Z-score检测到 {outlier_count} 个异常值 (|Z| > {threshold})"
                )
        
        return df
    
    def _print_qc_summary(self):
        self.logger.log_info("\n" + "=" * 50)
        self.logger.log_info("质量控制摘要")
        self.logger.log_info("=" * 50)
        
        if self.qc_report['missing_values']:
            self.logger.log_info("\n缺失值统计:")
            for col, stats in self.qc_report['missing_values'].items():
                self.logger.log_info(f"  {col}: {stats['count']} 条 ({stats['ratio']:.1%})")
        
        if self.qc_report['duplicates']:
            self.logger.log_info(f"\n重复记录: {len(self.qc_report['duplicates'])} 组")
        
        if self.qc_report['negative_values']:
            self.logger.log_info(f"\n负值记录: {len(self.qc_report['negative_values'])} 条")
        
        if self.qc_report['outliers']:
            self.logger.log_info(f"\n异常值记录: {len(self.qc_report['outliers'])} 条")
        
        self.logger.log_info("=" * 50 + "\n")
    
    def get_qc_report(self) -> Dict:
        return self.qc_report
