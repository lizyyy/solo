import pandas as pd
import json
import os
from datetime import datetime
from typing import Dict, Optional, List, Union
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from .utils import parse_datetime, ensure_datetime_columns


class DataParser:
    def __init__(self):
        self.cleaning_records = None
        self.work_orders = None
        self.volume_records = None
        
    def parse_cleaning_csv(self, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path)
        required_columns = ["store_name", "machine_id", "cleaning_time", "cleaning_type", "operator"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"清洁记录CSV缺少必要列: {missing_columns}")
        
        df = ensure_datetime_columns(df, ["cleaning_time"])
        df["cleaning_date"] = df["cleaning_time"].dt.date
        self.cleaning_records = df
        return df
    
    def parse_workorder_json(self, file_path: str) -> pd.DataFrame:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict) and "work_orders" in data:
            df = pd.DataFrame(data["work_orders"])
        else:
            df = pd.DataFrame([data])
        
        required_columns = ["workorder_id", "store_name", "machine_id", "issue_type", 
                           "reported_time", "status", "description"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"维修工单JSON缺少必要列: {missing_columns}")
        
        datetime_columns = ["reported_time", "assigned_time", "resolved_time", "closed_time"]
        df = ensure_datetime_columns(df, [col for col in datetime_columns if col in df.columns])
        
        if "closed_time" not in df.columns:
            df["closed_time"] = None
        
        self.work_orders = df
        return df
    
    def parse_volume_csv(self, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path)
        required_columns = ["store_name", "machine_id", "record_time", "cup_count", "drink_type"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"出杯量CSV缺少必要列: {missing_columns}")
        
        df = ensure_datetime_columns(df, ["record_time"])
        df["record_date"] = df["record_time"].dt.date
        df["record_hour"] = df["record_time"].dt.hour
        
        self.volume_records = df
        return df
    
    def parse_all_from_directory(self, directory: str) -> Dict[str, pd.DataFrame]:
        results = {}
        
        csv_files = [f for f in os.listdir(directory) if f.endswith('.csv')]
        json_files = [f for f in os.listdir(directory) if f.endswith('.json')]
        
        for csv_file in csv_files:
            file_path = os.path.join(directory, csv_file)
            try:
                df = pd.read_csv(file_path, nrows=1)
                if "cleaning_time" in df.columns:
                    results["cleaning"] = self.parse_cleaning_csv(file_path)
                elif "cup_count" in df.columns:
                    results["volume"] = self.parse_volume_csv(file_path)
            except Exception as e:
                print(f"解析文件 {csv_file} 时出错: {e}")
        
        for json_file in json_files:
            file_path = os.path.join(directory, json_file)
            try:
                results["workorders"] = self.parse_workorder_json(file_path)
            except Exception as e:
                print(f"解析文件 {json_file} 时出错: {e}")
        
        return results
    
    def load_sample_data(self) -> Dict[str, pd.DataFrame]:
        return self.parse_all_from_directory(config.SAMPLE_DIR)
    
    def get_summary(self) -> Dict:
        summary = {
            "cleaning_records": len(self.cleaning_records) if self.cleaning_records is not None else 0,
            "work_orders": len(self.work_orders) if self.work_orders is not None else 0,
            "volume_records": len(self.volume_records) if self.volume_records is not None else 0,
            "stores": [],
            "machines": [],
            "date_range": None
        }
        
        all_dfs = []
        if self.cleaning_records is not None:
            summary["stores"] = list(set(summary["stores"]) | set(self.cleaning_records["store_name"].unique()))
            summary["machines"] = list(set(summary["machines"]) | set(self.cleaning_records["machine_id"].unique()))
            all_dfs.append(self.cleaning_records)
        
        if self.work_orders is not None:
            summary["stores"] = list(set(summary["stores"]) | set(self.work_orders["store_name"].unique()))
            summary["machines"] = list(set(summary["machines"]) | set(self.work_orders["machine_id"].unique()))
            all_dfs.append(self.work_orders)
        
        if self.volume_records is not None:
            summary["stores"] = list(set(summary["stores"]) | set(self.volume_records["store_name"].unique()))
            summary["machines"] = list(set(summary["machines"]) | set(self.volume_records["machine_id"].unique()))
            all_dfs.append(self.volume_records)
        
        if all_dfs:
            all_times = []
            for df in all_dfs:
                for col in df.columns:
                    if "time" in col.lower() or "date" in col.lower():
                        valid_times = df[col].dropna()
                        if len(valid_times) > 0:
                            all_times.extend(valid_times.tolist())
            
            if all_times:
                valid_times = [t for t in all_times if isinstance(t, datetime)]
                if valid_times:
                    summary["date_range"] = {
                        "min": min(valid_times),
                        "max": max(valid_times)
                    }
        
        return summary
