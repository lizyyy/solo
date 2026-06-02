import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Dict, List, Tuple, Optional
from datetime import datetime


class ClusterEngine:
    def __init__(self, eps: float = 0.3, min_samples: int = 2):
        self.eps = eps
        self.min_samples = min_samples
        self.scaler = StandardScaler()
        self.vectorizer = TfidfVectorizer(max_features=100)
    
    def _extract_features(self, df: pd.DataFrame) -> np.ndarray:
        features = []
        
        if 'defect_description' in df.columns:
            text_features = self.vectorizer.fit_transform(
                df['defect_description'].fillna('').astype(str)
            ).toarray()
            features.append(text_features)
        
        numeric_cols = ['defect_size', 'defect_area', 'confidence', 'severity_score']
        available_numeric = [c for c in numeric_cols if c in df.columns]
        if available_numeric:
            numeric_data = df[available_numeric].copy()
            for col in available_numeric:
                numeric_data[col] = pd.to_numeric(numeric_data[col], errors='coerce').fillna(0)
            scaled_numeric = self.scaler.fit_transform(numeric_data.values)
            features.append(scaled_numeric)
        
        if 'defect_type' in df.columns:
            type_dummies = pd.get_dummies(df['defect_type'].fillna('unknown'), prefix='type')
            features.append(type_dummies.values)
        
        if 'defect_location' in df.columns:
            loc_dummies = pd.get_dummies(df['defect_location'].fillna('unknown'), prefix='loc')
            features.append(loc_dummies.values)
        
        if not features:
            return np.random.rand(len(df), 5)
        
        return np.hstack(features)
    
    def cluster_defects(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        result_df = df.copy()
        
        if len(df) == 0:
            result_df['cluster_id'] = []
            return result_df, {"cluster_count": 0, "samples_per_cluster": {}}
        
        features = self._extract_features(df)
        
        clustering = DBSCAN(eps=self.eps, min_samples=self.min_samples, metric='cosine')
        cluster_labels = clustering.fit_predict(features)
        
        result_df['cluster_id'] = [f"C{l}" if l != -1 else "noise" for l in cluster_labels]
        
        cluster_stats = {}
        for cid in sorted(result_df['cluster_id'].unique()):
            cluster_samples = result_df[result_df['cluster_id'] == cid]
            avg_conf = 0.0
            if 'confidence' in cluster_samples.columns:
                conf_values = pd.to_numeric(cluster_samples['confidence'], errors='coerce').dropna()
                if len(conf_values) > 0:
                    avg_conf = float(conf_values.mean())
            cluster_stats[cid] = {
                "count": len(cluster_samples),
                "defect_types": cluster_samples['defect_type'].value_counts().to_dict() if 'defect_type' in cluster_samples else {},
                "avg_confidence": avg_conf
            }
        
        stats = {
            "cluster_count": len([c for c in cluster_stats.keys() if c != 'noise']),
            "noise_count": int((result_df['cluster_id'] == 'noise').sum()),
            "samples_per_cluster": cluster_stats
        }
        
        return result_df, stats
    
    def assign_cluster_labels(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        result_df = df.copy()
        result_df['cluster_label'] = None
        result_df['cluster_representative'] = False
        
        label_stats = {}
        
        for cid in result_df['cluster_id'].unique():
            if cid == 'noise':
                continue
                
            cluster_samples = result_df[result_df['cluster_id'] == cid]
            
            if 'confidence' in cluster_samples.columns:
                conf_numeric = pd.to_numeric(cluster_samples['confidence'], errors='coerce')
                if conf_numeric.notna().any():
                    rep_idx = conf_numeric.idxmax()
                else:
                    rep_idx = cluster_samples.index[0]
            else:
                rep_idx = cluster_samples.index[0]
            
            result_df.at[rep_idx, 'cluster_representative'] = True
            
            if 'defect_type' in cluster_samples.columns:
                mode_result = cluster_samples['defect_type'].mode()
                if len(mode_result) > 0:
                    dominant_type = mode_result.iloc[0]
                    result_df.loc[result_df['cluster_id'] == cid, 'cluster_label'] = dominant_type
                    label_stats[cid] = dominant_type
        
        stats = {
            "labeled_clusters": len(label_stats),
            "cluster_labels": label_stats
        }
        
        return result_df, stats
    
    def compare_versions(self, df_old: pd.DataFrame, df_new: pd.DataFrame) -> Dict:
        comparison = {
            "total_samples_old": len(df_old),
            "total_samples_new": len(df_new),
            "sample_changes": {
                "added": [],
                "removed": [],
                "unchanged": []
            },
            "label_changes": {
                "changed": [],
                "unchanged": []
            }
        }
        
        old_ids = set(df_old['sample_id'].values) if 'sample_id' in df_old.columns else set()
        new_ids = set(df_new['sample_id'].values) if 'sample_id' in df_new.columns else set()
        
        comparison["sample_changes"]["added"] = list(new_ids - old_ids)
        comparison["sample_changes"]["removed"] = list(old_ids - new_ids)
        comparison["sample_changes"]["unchanged"] = list(old_ids & new_ids)
        
        common_samples = old_ids & new_ids
        if common_samples and 'human_label' in df_old.columns and 'predicted_label' in df_new.columns:
            old_labels = df_old.set_index('sample_id')['human_label'].to_dict()
            new_labels = df_new.set_index('sample_id')['predicted_label'].to_dict()
            
            for sid in common_samples:
                old_lbl = old_labels.get(sid)
                new_lbl = new_labels.get(sid)
                if pd.notna(old_lbl) and pd.notna(new_lbl) and str(old_lbl) != str(new_lbl):
                    comparison["label_changes"]["changed"].append({
                        "sample_id": sid,
                        "old_label": old_lbl,
                        "new_label": new_lbl
                    })
                else:
                    comparison["label_changes"]["unchanged"].append(sid)
        
        return comparison
    
    def calculate_metrics(self, df: pd.DataFrame) -> Dict:
        metrics = {
            "total_samples": len(df),
            "review_status": {},
            "label_distribution": {},
            "cluster_distribution": {},
            "confidence_stats": {}
        }
        
        if 'review_status' in df.columns:
            metrics["review_status"] = df['review_status'].value_counts().to_dict()
        
        label_cols = ['predicted_label', 'human_label', 'cluster_label']
        for col in label_cols:
            if col in df.columns:
                metrics["label_distribution"][col] = df[col].value_counts().to_dict()
        
        if 'cluster_id' in df.columns:
            metrics["cluster_distribution"] = df['cluster_id'].value_counts().to_dict()
        
        if 'confidence' in df.columns:
            conf_numeric = pd.to_numeric(df['confidence'], errors='coerce').dropna()
            if len(conf_numeric) > 0:
                metrics["confidence_stats"] = {
                    "mean": float(conf_numeric.mean()),
                    "min": float(conf_numeric.min()),
                    "max": float(conf_numeric.max()),
                    "low_confidence_count": int((conf_numeric < 0.5).sum())
                }
        
        return metrics
