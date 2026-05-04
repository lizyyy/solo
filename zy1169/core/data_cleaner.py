import os
import pandas as pd
import numpy as np
from datetime import datetime
from models import db, CleaningTask, CleaningLog

class DataCleaner:
    def __init__(self, rules):
        self.rules = rules
        self.logs = []
    
    def apply_rules(self, df):
        self.logs = []
        df_cleaned = df.copy()
        
        for rule in self.rules.get('rules', []):
            rule_name = rule.get('name', 'unnamed_rule')
            rule_type = rule.get('type')
            column = rule.get('column')
            
            if rule_type == 'drop_missing':
                threshold = rule.get('threshold', 0.0)
                df_cleaned, rows_affected = self._drop_missing(df_cleaned, column, threshold)
                self._log(rule_name, column, 'drop_missing', rows_affected, 
                         f"Dropped {rows_affected} rows with missing values")
            
            elif rule_type == 'fill_missing':
                strategy = rule.get('strategy', 'mean')
                fill_value = rule.get('value')
                df_cleaned, rows_affected = self._fill_missing(df_cleaned, column, strategy, fill_value)
                self._log(rule_name, column, 'fill_missing', rows_affected,
                         f"Filled {rows_affected} missing values using {strategy}")
            
            elif rule_type == 'drop_duplicates':
                subset = rule.get('subset')
                df_cleaned, rows_affected = self._drop_duplicates(df_cleaned, subset)
                self._log(rule_name, column, 'drop_duplicates', rows_affected,
                         f"Dropped {rows_affected} duplicate rows")
            
            elif rule_type == 'convert_type':
                target_type = rule.get('to_type', 'str')
                df_cleaned, rows_affected = self._convert_type(df_cleaned, column, target_type)
                self._log(rule_name, column, 'convert_type', rows_affected,
                         f"Converted {column} to {target_type}")
            
            elif rule_type == 'filter':
                condition = rule.get('condition')
                df_cleaned, rows_affected = self._filter(df_cleaned, condition)
                self._log(rule_name, column, 'filter', rows_affected,
                         f"Filtered {rows_affected} rows: {condition}")
            
            elif rule_type == 'rename_column':
                new_name = rule.get('new_name')
                df_cleaned, _ = self._rename_column(df_cleaned, column, new_name)
                self._log(rule_name, column, 'rename_column', 0,
                         f"Renamed {column} to {new_name}")
            
            elif rule_type == 'drop_column':
                df_cleaned = self._drop_column(df_cleaned, column)
                self._log(rule_name, column, 'drop_column', 0,
                         f"Dropped column: {column}")
        
        return df_cleaned, self.logs
    
    def _drop_missing(self, df, column, threshold):
        original_count = len(df)
        if column:
            df = df.dropna(subset=[column])
        else:
            if threshold > 0:
                df = df.dropna(thresh=int(len(df.columns) * threshold))
            else:
                df = df.dropna()
        return df, original_count - len(df)
    
    def _fill_missing(self, df, column, strategy, fill_value=None):
        original_count = df[column].isna().sum() if column else df.isna().sum().sum()
        if column:
            if fill_value is not None:
                df[column] = df[column].fillna(fill_value)
            elif strategy == 'mean':
                df[column] = df[column].fillna(df[column].mean())
            elif strategy == 'median':
                df[column] = df[column].fillna(df[column].median())
            elif strategy == 'mode':
                df[column] = df[column].fillna(df[column].mode()[0])
        else:
            if fill_value is not None:
                df = df.fillna(fill_value)
            elif strategy == 'mean':
                df = df.fillna(df.mean())
            elif strategy == 'median':
                df = df.fillna(df.median())
        return df, original_count - (df[column].isna().sum() if column else df.isna().sum().sum())
    
    def _drop_duplicates(self, df, subset):
        original_count = len(df)
        df = df.drop_duplicates(subset=subset)
        return df, original_count - len(df)
    
    def _convert_type(self, df, column, target_type):
        rows_affected = len(df)
        if target_type == 'numeric':
            df[column] = pd.to_numeric(df[column], errors='coerce')
        elif target_type == 'datetime':
            df[column] = pd.to_datetime(df[column], errors='coerce')
        elif target_type == 'string':
            df[column] = df[column].astype(str)
        elif target_type == 'int':
            df[column] = df[column].fillna(0).astype(int)
        elif target_type == 'float':
            df[column] = df[column].astype(float)
        return df, rows_affected
    
    def _filter(self, df, condition):
        original_count = len(df)
        try:
            df = df.query(condition)
        except Exception:
            pass
        return df, original_count - len(df)
    
    def _rename_column(self, df, old_name, new_name):
        df = df.rename(columns={old_name: new_name})
        return df, 0
    
    def _drop_column(self, df, column):
        if isinstance(column, list):
            df = df.drop(columns=column, errors='ignore')
        else:
            df = df.drop(columns=[column], errors='ignore')
        return df
    
    def _log(self, rule_name, column, action, rows_affected, message):
        self.logs.append({
            'rule_name': rule_name,
            'column_name': column,
            'action': action,
            'rows_affected': rows_affected,
            'message': message
        })


def run_cleaning_task(cleaning_task_id, data_folder):
    cleaning_task = CleaningTask.query.get(cleaning_task_id)
    if not cleaning_task:
        return False, "Cleaning task not found"
    
    from core.data_uploader import load_yaml_file
    
    try:
        cleaning_task.status = 'running'
        cleaning_task.started_at = datetime.utcnow()
        db.session.commit()
        
        dataset = cleaning_task.dataset_version
        df = pd.read_csv(dataset.file_path)
        
        rules = load_yaml_file(cleaning_task.rules_file_path)
        
        cleaning_task.row_count_before = len(df)
        cleaning_task.column_count_before = len(df.columns)
        
        cleaner = DataCleaner(rules)
        df_cleaned, logs = cleaner.apply_rules(df)
        
        output_filename = f"cleaned_{cleaning_task.version}.csv"
        output_path = os.path.join(data_folder, 'cleaned', output_filename)
        df_cleaned.to_csv(output_path, index=False)
        
        cleaning_task.output_file_path = output_path
        cleaning_task.row_count_after = len(df_cleaned)
        cleaning_task.column_count_after = len(df_cleaned.columns)
        cleaning_task.status = 'completed'
        cleaning_task.completed_at = datetime.utcnow()
        
        for log in logs:
            cleaning_log = CleaningLog(
                cleaning_task_id=cleaning_task.id,
                rule_name=log['rule_name'],
                column_name=log.get('column_name'),
                action=log.get('action'),
                rows_affected=log.get('rows_affected'),
                message=log.get('message')
            )
            db.session.add(cleaning_log)
        
        db.session.commit()
        return True, "Cleaning completed successfully"
    
    except Exception as e:
        cleaning_task.status = 'failed'
        cleaning_task.error_message = str(e)
        db.session.commit()
        return False, str(e)
