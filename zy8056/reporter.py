
import csv
from typing import Dict, List
from datetime import datetime
from data_loader import SampleImage
from database import ReviewState, Database


class Reporter:
    @staticmethod
    def generate_summary_md(output_path: str, db: Database, images: Dict[str, SampleImage], batches: Dict[str, List[str]]):
        stats = db.get_review_stats()
        all_reviews = db.get_all_reviews()
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# 菌落计数复核报告\n\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## 统计概览\n\n")
            f.write(f"- 复核图片数: {stats['total_images']}\n")
            f.write(f"- 复核菌落数: {stats['total_colonies']}\n")
            f.write(f"- 接受: {stats['accepted']}\n")
            f.write(f"- 拒绝: {stats['rejected']}\n")
            f.write(f"- 污染标记: {stats['contamination']}\n")
            f.write(f"- 漏检标记: {stats['missing']}\n")
            f.write(f"- 重叠标记: {stats['overlap']}\n\n")
            
            f.write("## 按批次统计\n\n")
            for batch_id, image_ids in batches.items():
                batch_reviews = [r for r in all_reviews if r.image_id in image_ids]
                if batch_reviews:
                    f.write(f"### 批次 {batch_id}\n\n")
                    f.write(f"- 图片数: {len(set(r.image_id for r in batch_reviews))}\n")
                    f.write(f"- 菌落数: {len(batch_reviews)}\n")
                    f.write(f"- 接受: {sum(1 for r in batch_reviews if r.accepted)}\n")
                    f.write(f"- 拒绝: {sum(1 for r in batch_reviews if not r.accepted)}\n\n")
            
            f.write("## 问题详情\n\n")
            issues = [r for r in all_reviews if not r.accepted or r.marked_contamination or r.marked_missing or r.marked_overlap]
            if issues:
                for review in issues:
                    f.write(f"### {review.image_id} - {review.colony_id}\n\n")
                    f.write(f"- 接受: {review.accepted}\n")
                    f.write(f"- 污染: {review.marked_contamination}\n")
                    f.write(f"- 漏检: {review.marked_missing}\n")
                    f.write(f"- 重叠: {review.marked_overlap}\n")
                    if review.notes:
                        f.write(f"- 备注: {review.notes}\n")
                    f.write("\n")
            else:
                f.write("无问题记录\n")
    
    @staticmethod
    def generate_issues_csv(output_path: str, db: Database):
        all_reviews = db.get_all_reviews()
        issues = [r for r in all_reviews if not r.accepted or r.marked_contamination or r.marked_missing or r.marked_overlap]
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'image_id', 'colony_id', 'accepted', 
                'marked_contamination', 'marked_missing', 
                'marked_overlap', 'notes', 'reviewed_at'
            ])
            
            for review in issues:
                writer.writerow([
                    review.image_id,
                    review.colony_id,
                    review.accepted,
                    review.marked_contamination,
                    review.marked_missing,
                    review.marked_overlap,
                    review.notes,
                    review.reviewed_at
                ])

