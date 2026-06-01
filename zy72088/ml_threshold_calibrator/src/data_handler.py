import pandas as pd
import os
from datetime import datetime
from typing import Dict, Optional
from pathlib import Path


class DataHandler:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir = self.output_dir / "backups"
        self.backup_dir.mkdir(exist_ok=True)

    def read_csv_safe(self, file_path: str, encoding: str = 'utf-8') -> pd.DataFrame:
        encodings = [encoding, 'gbk', 'gb2312', 'utf-8-sig']
        for enc in encodings:
            try:
                return pd.read_csv(file_path, encoding=enc)
            except UnicodeDecodeError:
                continue
        raise ValueError(f"无法读取文件 {file_path}，尝试了多种编码均失败")

    def read_excel_safe(self, file_path: str, sheet_name: Optional[str] = None) -> pd.DataFrame:
        if sheet_name:
            return pd.read_excel(file_path, sheet_name=sheet_name)
        return pd.read_excel(file_path)

    def load_data(self, file_path: str, sheet_name: Optional[str] = None) -> pd.DataFrame:
        ext = Path(file_path).suffix.lower()
        if ext in ['.xlsx', '.xls']:
            return self.read_excel_safe(file_path, sheet_name)
        elif ext == '.csv':
            return self.read_csv_safe(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def save_results(self, results_df: pd.DataFrame, anomalies_df: pd.DataFrame, 
                     conflicts: list, prefix: str = "calibration") -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        results_file = self.output_dir / f"{prefix}_results_{timestamp}.xlsx"
        anomalies_file = self.output_dir / f"{prefix}_anomalies_{timestamp}.xlsx"
        conflicts_file = self.output_dir / f"{prefix}_conflicts_{timestamp}.xlsx"
        
        with pd.ExcelWriter(results_file, engine='openpyxl') as writer:
            results_df.to_excel(writer, sheet_name='校准结果', index=False)
        
        with pd.ExcelWriter(anomalies_file, engine='openpyxl') as writer:
            anomalies_df.to_excel(writer, sheet_name='异常清单', index=False)
        
        if conflicts:
            conflicts_df = pd.DataFrame(conflicts)
            with pd.ExcelWriter(conflicts_file, engine='openpyxl') as writer:
                conflicts_df.to_excel(writer, sheet_name='参数冲突', index=False)
        
        latest_results = self.output_dir / f"{prefix}_results_latest.xlsx"
        latest_anomalies = self.output_dir / f"{prefix}_anomalies_latest.xlsx"
        latest_conflicts = self.output_dir / f"{prefix}_conflicts_latest.xlsx"
        
        if latest_results.exists():
            latest_results.unlink()
        if latest_anomalies.exists():
            latest_anomalies.unlink()
        if latest_conflicts.exists():
            latest_conflicts.unlink()
        
        results_df.to_excel(latest_results, sheet_name='校准结果', index=False)
        anomalies_df.to_excel(latest_anomalies, sheet_name='异常清单', index=False)
        
        latest_conflicts_path = None
        if conflicts:
            conflicts_df = pd.DataFrame(conflicts)
            conflicts_df.to_excel(latest_conflicts, sheet_name='参数冲突', index=False)
            latest_conflicts_path = str(latest_conflicts)
        
        return {
            'results': str(results_file),
            'anomalies': str(anomalies_file),
            'conflicts': str(conflicts_file) if conflicts else None,
            'latest_results': str(latest_results),
            'latest_anomalies': str(latest_anomalies),
            'latest_conflicts': latest_conflicts_path
        }

    def save_updated_param_table(self, results_df: pd.DataFrame, original_file: str, 
                                 preserve_manual: bool = True) -> str:
        original_df = self.load_data(original_file)
        
        for _, row in results_df.iterrows():
            metric_name = row['指标名称']
            mask = original_df['指标名称'] == metric_name
            
            if mask.any():
                original_idx = original_df[mask].index[0]
                
                if preserve_manual:
                    is_manual = original_df.loc[original_idx, '人工调整过'] if '人工调整过' in original_df.columns else False
                    if is_manual:
                        continue
                
                if '建议阈值' in row and pd.notna(row['建议阈值']):
                    if '当前阈值' in original_df.columns:
                        original_df.loc[original_idx, '当前阈值'] = row['建议阈值']
                
                if '机器学习阈值校准' in original_df.columns and '机器学习阈值校准' in row:
                    old_note = str(original_df.loc[original_idx, '机器学习阈值校准']) if pd.notna(original_df.loc[original_idx, '机器学习阈值校准']) else ''
                    new_note = str(row['机器学习阈值校准']) if pd.notna(row['机器学习阈值校准']) else ''
                    if old_note and new_note and old_note not in new_note:
                        original_df.loc[original_idx, '机器学习阈值校准'] = f"{old_note} | {new_note}"
                    elif new_note:
                        original_df.loc[original_idx, '机器学习阈值校准'] = new_note
                
                if '最后更新时间' in original_df.columns:
                    original_df.loc[original_idx, '最后更新时间'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = self.output_dir / f"updated_parameter_table_{timestamp}.xlsx"
        original_df.to_excel(output_file, index=False)
        
        return str(output_file)

    def backup_file(self, file_path: str) -> str:
        if not os.path.exists(file_path):
            return ""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = Path(file_path).name
        backup_file = self.backup_dir / f"{timestamp}_{file_name}"
        
        with open(file_path, 'rb') as src, open(backup_file, 'wb') as dst:
            dst.write(src.read())
        
        return str(backup_file)
