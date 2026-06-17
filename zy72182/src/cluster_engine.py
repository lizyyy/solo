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
                "unchanged": [],
                "matched_by_image_path": []
            },
            "label_changes": {
                "predicted_changed": [],
                "human_changed": [],
                "unchanged": []
            }
        }
        
        has_old_id = 'sample_id' in df_old.columns
        has_new_id = 'sample_id' in df_new.columns
        has_old_img = 'image_path' in df_old.columns
        has_new_img = 'image_path' in df_new.columns
        
        old_by_id = {}
        new_by_id = {}
        if has_old_id:
            old_by_id = df_old.set_index('sample_id').to_dict('index')
        if has_new_id:
            new_by_id = df_new.set_index('sample_id').to_dict('index')
        
        old_by_img = {}
        new_by_img = {}
        if has_old_img:
            for _, row in df_old.iterrows():
                ip = row.get('image_path', '')
                if pd.notna(ip) and ip:
                    old_by_img[ip] = row.to_dict()
        if has_new_img:
            for _, row in df_new.iterrows():
                ip = row.get('image_path', '')
                if pd.notna(ip) and ip:
                    new_by_img[ip] = row.to_dict()
        
        old_matched = set()
        new_matched = set()
        
        if has_old_id and has_new_id:
            common_ids = set(old_by_id.keys()) & set(new_by_id.keys())
            for sid in common_ids:
                old_matched.add(('id', sid))
                new_matched.add(('id', sid))
                comparison["sample_changes"]["unchanged"].append(sid)
        
        if has_old_img and has_new_img:
            common_imgs = set(old_by_img.keys()) & set(new_by_img.keys())
            for img in common_imgs:
                old_row = old_by_img[img]
                new_row = new_by_img[img]
                old_sid = old_row.get('sample_id', '')
                new_sid = new_row.get('sample_id', '')
                
                if ('id', old_sid) not in old_matched and ('id', new_sid) not in new_matched:
                    old_matched.add(('img', img))
                    new_matched.add(('img', img))
                    comparison["sample_changes"]["matched_by_image_path"].append({
                        "image_path": img,
                        "old_sample_id": old_sid,
                        "new_sample_id": new_sid
                    })
                    comparison["sample_changes"]["unchanged"].append(new_sid)
        
        if has_new_id:
            for sid, row in new_by_id.items():
                if ('id', sid) not in new_matched:
                    ip = row.get('image_path', '')
                    if not (has_new_img and ip and ('img', ip) in new_matched):
                        comparison["sample_changes"]["added"].append(sid)
        
        if has_old_id:
            for sid, row in old_by_id.items():
                if ('id', sid) not in old_matched:
                    ip = row.get('image_path', '')
                    if not (has_old_img and ip and ('img', ip) in old_matched):
                        comparison["sample_changes"]["removed"].append(sid)
        
        for item in comparison["sample_changes"]["matched_by_image_path"]:
            img = item["image_path"]
            old_row = old_by_img.get(img, {})
            new_row = new_by_img.get(img, {})
            
            old_pred = old_row.get('predicted_label')
            new_pred = new_row.get('predicted_label')
            old_human = old_row.get('human_label')
            new_human = new_row.get('human_label')
            
            pred_changed = pd.notna(old_pred) and pd.notna(new_pred) and str(old_pred) != str(new_pred)
            human_changed = pd.notna(old_human) and pd.notna(new_human) and str(old_human) != str(new_human)
            
            if pred_changed:
                comparison["label_changes"]["predicted_changed"].append({
                    "sample_id": item["new_sample_id"],
                    "image_path": img,
                    "old_label": old_pred,
                    "new_label": new_pred
                })
            elif human_changed:
                comparison["label_changes"]["human_changed"].append({
                    "sample_id": item["new_sample_id"],
                    "image_path": img,
                    "old_label": old_human,
                    "new_label": new_human
                })
            else:
                comparison["label_changes"]["unchanged"].append(item["new_sample_id"])
        
        common_ids = [sid for sid in comparison["sample_changes"]["unchanged"] 
                      if not any(m["new_sample_id"] == sid 
                                for m in comparison["sample_changes"]["matched_by_image_path"])]
        if common_ids and 'predicted_label' in df_old.columns and 'predicted_label' in df_new.columns:
            old_pred_labels = df_old.set_index('sample_id')['predicted_label'].to_dict()
            new_pred_labels = df_new.set_index('sample_id')['predicted_label'].to_dict()
            
            for sid in common_ids:
                old_lbl = old_pred_labels.get(sid)
                new_lbl = new_pred_labels.get(sid)
                if pd.notna(old_lbl) and pd.notna(new_lbl) and str(old_lbl) != str(new_lbl):
                    comparison["label_changes"]["predicted_changed"].append({
                        "sample_id": sid,
                        "old_label": old_lbl,
                        "new_label": new_lbl
                    })
        
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
