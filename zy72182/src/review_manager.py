import json
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional


class ReviewManager:
    def __init__(self, review_dir: str = "./workspace/reviews"):
        self.review_dir = Path(review_dir)
        self.review_dir.mkdir(parents=True, exist_ok=True)
    
    def get_pending_reviews(self, df: pd.DataFrame) -> pd.DataFrame:
        if 'review_status' not in df.columns:
            return df
        
        pending_mask = df['review_status'].isin(['pending', 'need_confirm', 'recheck'])
        return df[pending_mask].copy()
    
    def get_review_summary(self, df: pd.DataFrame) -> Dict:
        summary = {
            "total_samples": len(df),
            "by_status": {},
            "need_attention": [],
            "review_progress": 0.0
        }
        
        if 'review_status' in df.columns:
            summary["by_status"] = df['review_status'].value_counts().to_dict()
            
            confirmed = df['review_status'].isin(['confirmed', 'auto_confirmed']).sum()
            total = len(df)
            summary["review_progress"] = round(confirmed / total * 100, 2) if total > 0 else 0.0
        
        need_attention = df[df['review_status'] == 'need_confirm']
        if len(need_attention) > 0:
            summary["need_attention"] = need_attention[['sample_id', 'review_note', 'predicted_label', 'human_label']].to_dict('records')
        
        return summary
    
    def submit_review(self, sample_id: str, human_label: str, 
                      reviewer: str = "anonymous", note: str = "", 
                      version_id: str = "unknown") -> Dict:
        review_record = {
            "sample_id": sample_id,
            "human_label": human_label,
            "reviewer": reviewer,
            "review_time": datetime.now().isoformat(),
            "note": note,
            "source_version": version_id,
            "status": "confirmed"
        }
        
        review_file = self.review_dir / f"review_{version_id}_{datetime.now().strftime('%Y%m%d')}.json"
        
        existing_reviews = []
        if review_file.exists():
            with open(review_file, 'r', encoding='utf-8') as f:
                existing_reviews = json.load(f)
        
        existing_reviews.append(review_record)
        
        with open(review_file, 'w', encoding='utf-8') as f:
            json.dump(existing_reviews, f, indent=2, ensure_ascii=False)
        
        return review_record
    
    def batch_update_reviews(self, df: pd.DataFrame, version_id: str) -> Tuple[pd.DataFrame, Dict]:
        result_df = df.copy()
        update_stats = {
            "updated_count": 0,
            "confirmed_count": 0,
            "need_confirm_count": 0
        }
        
        review_file = self.review_dir / f"review_{version_id}_batch.json"
        batch_reviews = []
        
        for idx, row in result_df.iterrows():
            if row.get('review_status') == 'confirmed' and pd.notna(row.get('human_label')):
                review_record = {
                    "sample_id": row['sample_id'],
                    "human_label": row['human_label'],
                    "reviewer": "batch",
                    "review_time": datetime.now().isoformat(),
                    "note": row.get('review_note', ''),
                    "source_version": version_id,
                    "status": "confirmed"
                }
                batch_reviews.append(review_record)
                update_stats["updated_count"] += 1
                update_stats["confirmed_count"] += 1
            elif row.get('review_status') == 'need_confirm':
                update_stats["need_confirm_count"] += 1
        
        if batch_reviews:
            with open(review_file, 'w', encoding='utf-8') as f:
                json.dump(batch_reviews, f, indent=2, ensure_ascii=False)
        
        return result_df, update_stats
    
    def get_sample_review_history(self, sample_id: str) -> List[Dict]:
        history = []
        
        for review_file in sorted(self.review_dir.glob("*.json")):
            with open(review_file, 'r', encoding='utf-8') as f:
                reviews = json.load(f)
                for r in reviews:
                    if r.get('sample_id') == sample_id:
                        history.append(r)
        
        return sorted(history, key=lambda x: x.get('review_time', ''))
    
    def apply_reviews_to_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        result_df = df.copy()
        apply_stats = {
            "total_matched": 0,
            "labels_applied": 0,
            "conflicts_found": 0
        }
        
        all_reviews = []
        for review_file in self.review_dir.glob("*.json"):
            with open(review_file, 'r', encoding='utf-8') as f:
                reviews = json.load(f)
                all_reviews.extend(reviews)
        
        if not all_reviews:
            return result_df, apply_stats
        
        review_df = pd.DataFrame(all_reviews)
        review_df = review_df.sort_values('review_time').groupby('sample_id').last().reset_index()
        
        for idx, row in result_df.iterrows():
            sample_id = row['sample_id']
            sample_review = review_df[review_df['sample_id'] == sample_id]
            
            if len(sample_review) > 0:
                apply_stats["total_matched"] += 1
                review_data = sample_review.iloc[0]
                
                current_pred = row.get('predicted_label')
                historical_label = review_data['human_label']
                
                if pd.notna(current_pred) and str(current_pred) != str(historical_label):
                    apply_stats["conflicts_found"] += 1
                    result_df.at[idx, 'review_status'] = 'need_confirm'
                    result_df.at[idx, 'review_note'] = f"模型预测[{current_pred}]与人工标签[{historical_label}]不一致"
                else:
                    result_df.at[idx, 'human_label'] = historical_label
                    result_df.at[idx, 'review_status'] = 'confirmed'
                    result_df.at[idx, 'review_note'] = review_data.get('note', '')
                    apply_stats["labels_applied"] += 1
        
        return result_df, apply_stats
    
    def export_review_template(self, df: pd.DataFrame, output_path: str) -> str:
        export_cols = ['sample_id', 'image_path', 'defect_type', 'defect_description', 
                       'predicted_label', 'confidence', 'review_status', 'review_note']
        
        available_cols = [c for c in export_cols if c in df.columns]
        export_df = df[available_cols].copy()
        
        export_df['human_label'] = ''
        export_df['review_comment'] = ''
        
        if output_path.endswith('.xlsx'):
            export_df.to_excel(output_path, index=False)
        else:
            export_df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        return output_path
