import os
import json
import hashlib
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional


class DataManager:
    def __init__(self, work_dir: str = "./workspace"):
        self.work_dir = Path(work_dir)
        self.raw_dir = self.work_dir / "raw"
        self.processed_dir = self.work_dir / "processed"
        self.review_dir = self.work_dir / "reviews"
        self.report_dir = self.work_dir / "reports"
        self.meta_dir = self.work_dir / "meta"
        
        for d in [self.raw_dir, self.processed_dir, self.review_dir, 
                  self.report_dir, self.meta_dir]:
            d.mkdir(parents=True, exist_ok=True)
        
        self.version_file = self.meta_dir / "versions.json"
        self._init_versions()
    
    def _init_versions(self):
        if not self.version_file.exists():
            with open(self.version_file, 'w') as f:
                json.dump({"versions": [], "current_version": None}, f, indent=2)
    
    def _load_versions(self) -> Dict:
        with open(self.version_file, 'r') as f:
            return json.load(f)
    
    def _save_versions(self, data: Dict):
        with open(self.version_file, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _generate_sample_id(self, row: pd.Series) -> str:
        key_fields = ['image_path', 'defect_type', 'defect_location']
        available_fields = [f for f in key_fields if f in row and pd.notna(row[f])]
        if available_fields:
            key = '|'.join([str(row[f]) for f in available_fields])
        else:
            key = str(hash(tuple(row.dropna().items())))
        return hashlib.md5(key.encode()).hexdigest()[:12]
    
    def create_version(self, model_version: str, description: str = "") -> str:
        versions_data = self._load_versions()
        version_num = len(versions_data["versions"]) + 1
        version_id = f"v{version_num}_{model_version.replace('.', '_')}"
        
        version_info = {
            "version_id": version_id,
            "model_version": model_version,
            "created_at": datetime.now().isoformat(),
            "description": description,
            "status": "created"
        }
        
        versions_data["versions"].append(version_info)
        versions_data["current_version"] = version_id
        self._save_versions(versions_data)
        
        version_dir = self.processed_dir / version_id
        version_dir.mkdir(exist_ok=True)
        
        return version_id
    
    def load_raw_data(self, file_path: str, version_id: Optional[str] = None) -> pd.DataFrame:
        if version_id is None:
            versions_data = self._load_versions()
            version_id = versions_data["current_version"]
            if version_id is None:
                raise ValueError("No active version, please create a version first")
        
        df = pd.read_excel(file_path) if file_path.endswith('.xlsx') else pd.read_csv(file_path)
        
        df['_raw_index'] = df.index
        df['_source_file'] = os.path.basename(file_path)
        df['_loaded_at'] = datetime.now().isoformat()
        
        return df
    
    def clean_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        stats = {
            "total_rows": len(df),
            "null_rows": 0,
            "duplicate_rows": 0,
            "valid_rows": 0,
            "removed_samples": []
        }
        
        df = df.replace(r'^\s*$', np.nan, regex=True)
        df = df.fillna(np.nan)
        null_mask = df.isnull().all(axis=1)
        stats["null_rows"] = int(null_mask.sum())
        df = df[~null_mask].copy()
        
        df['sample_id'] = df.apply(self._generate_sample_id, axis=1)
        
        duplicate_mask = df.duplicated(subset=['sample_id'], keep='first')
        stats["duplicate_rows"] = duplicate_mask.sum()
        stats["removed_samples"] = df[duplicate_mask][['sample_id', '_raw_index']].to_dict('records')
        df = df[~duplicate_mask].copy()
        
        stats["valid_rows"] = len(df)
        
        return df, stats
    
    def save_processed_data(self, df: pd.DataFrame, version_id: str, step: str):
        version_dir = self.processed_dir / version_id
        save_path = version_dir / f"{step}.parquet"
        df.to_parquet(save_path)
        
        meta_path = version_dir / f"{step}_meta.json"
        meta = {
            "saved_at": datetime.now().isoformat(),
            "row_count": len(df),
            "columns": list(df.columns)
        }
        with open(meta_path, 'w') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
    
    def load_processed_data(self, version_id: str, step: str) -> Optional[pd.DataFrame]:
        save_path = self.processed_dir / version_id / f"{step}.parquet"
        if save_path.exists():
            return pd.read_parquet(save_path)
        return None
    
    def get_version_info(self, version_id: str) -> Optional[Dict]:
        versions_data = self._load_versions()
        for v in versions_data["versions"]:
            if v["version_id"] == version_id:
                return v
        return None
    
    def list_versions(self) -> List[Dict]:
        versions_data = self._load_versions()
        return versions_data["versions"]
    
    def merge_with_historical_reviews(self, df: pd.DataFrame, version_id: str) -> Tuple[pd.DataFrame, Dict]:
        merge_stats = {
            "total_samples": len(df),
            "matched_reviews": 0,
            "conflicting_labels": 0,
            "applied_labels": 0
        }
        
        df = df.copy()
        
        if 'human_label' not in df.columns:
            df['human_label'] = None
        if 'review_status' not in df.columns:
            df['review_status'] = 'pending'
        if 'review_note' not in df.columns:
            df['review_note'] = None
        if 'review_source' not in df.columns:
            df['review_source'] = None
        
        all_reviews = []
        for review_file in self.review_dir.glob("*.json"):
            with open(review_file, 'r') as f:
                review_data = json.load(f)
                if isinstance(review_data, list):
                    all_reviews.extend(review_data)
        
        if not all_reviews:
            return df, merge_stats
        
        review_df = pd.DataFrame(all_reviews)
        if 'sample_id' not in review_df.columns:
            return df, merge_stats
        
        for idx, row in df.iterrows():
            sample_id = row['sample_id']
            sample_reviews = review_df[review_df['sample_id'] == sample_id]
            
            if len(sample_reviews) > 0:
                merge_stats["matched_reviews"] += 1
                
                latest_review = sample_reviews.iloc[-1]
                
                if pd.notna(latest_review.get('human_label')):
                    current_label = row.get('predicted_label', row.get('model_label'))
                    historical_label = latest_review['human_label']
                    
                    if pd.notna(current_label) and str(current_label) != str(historical_label):
                        merge_stats["conflicting_labels"] += 1
                        df.at[idx, 'review_status'] = 'need_confirm'
                        df.at[idx, 'review_note'] = f'历史标签[{historical_label}]与模型预测[{current_label}]不一致'
                    else:
                        df.at[idx, 'human_label'] = historical_label
                        df.at[idx, 'review_status'] = 'confirmed'
                        merge_stats["applied_labels"] += 1
                    
                    df.at[idx, 'review_source'] = latest_review.get('source_version', 'historical')
        
        return df, merge_stats
