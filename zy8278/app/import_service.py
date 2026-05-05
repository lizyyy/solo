import csv
import json
import yaml
from typing import List, Dict, Any, Optional
from io import StringIO
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Contestant, JudgeScore, RankRule, Appeal


class ImportService:
    @staticmethod
    def import_contestants(db: Session, csv_content: str) -> Dict[str, Any]:
        reader = csv.DictReader(StringIO(csv_content))
        imported_count = 0
        errors = []
        
        for row in reader:
            try:
                contestant_id = row.get('contestant_id') or row.get('id')
                if not contestant_id:
                    errors.append(f"Missing contestant_id in row: {row}")
                    continue
                
                existing = db.query(Contestant).filter(
                    Contestant.contestant_id == contestant_id
                ).first()
                
                if existing:
                    existing.name = row.get('name', existing.name)
                    existing.category = row.get('category', existing.category)
                    existing.group = row.get('group', existing.group)
                    existing.info = row.get('info', existing.info)
                else:
                    contestant = Contestant(
                        contestant_id=contestant_id,
                        name=row.get('name', ''),
                        category=row.get('category'),
                        group=row.get('group'),
                        info=row.get('info')
                    )
                    db.add(contestant)
                imported_count += 1
            except Exception as e:
                    errors.append(f"Error importing row {row}: {str(e)}")
        
        db.commit()
        return {"imported": imported_count, "errors": errors}
    
    @staticmethod
    def import_judge_scores(db: Session, csv_content: str) -> Dict[str, Any]:
        reader = csv.DictReader(StringIO(csv_content))
        imported_count = 0
        errors = []
        
        for row in reader:
            try:
                contestant_id = row.get('contestant_id')
                judge_id = row.get('judge_id')
                score_str = row.get('score')
                
                if not all([contestant_id, judge_id, score_str]):
                    errors.append(f"Missing required fields in row: {row}")
                    continue
                
                try:
                    score = float(score_str)
                except ValueError:
                    errors.append(f"Invalid score value: {score_str}")
                    continue
                
                existing = db.query(JudgeScore).filter(
                    JudgeScore.contestant_id == contestant_id,
                    JudgeScore.judge_id == judge_id
                ).first()
                
                if existing:
                    if existing.original_score is None:
                        existing.original_score = existing.score
                    existing.score = score
                else:
                    judge_score = JudgeScore(
                        contestant_id=contestant_id,
                        judge_id=judge_id,
                        score=score,
                        original_score=None
                    )
                    db.add(judge_score)
                imported_count += 1
            except Exception as e:
                errors.append(f"Error importing row {row}: {str(e)}")
        
        db.commit()
        return {"imported": imported_count, "errors": errors}
    
    @staticmethod
    def import_rank_rules(db: Session, yaml_content: str) -> Dict[str, Any]:
        try:
            rules = yaml.safe_load(yaml_content)
            if not rules:
                return {"imported": 0, "errors": ["Empty YAML content"]}
            
            rule_name = rules.get('rule_name', 'default')
            drop_highest = rules.get('drop_highest', 0)
            drop_lowest = rules.get('drop_lowest', 0)
            ranking_mode = rules.get('ranking_mode', 'competition')
            promotion_threshold = rules.get('promotion_threshold')
            promotion_score = rules.get('promotion_score')
            categories = rules.get('categories')
            
            existing = db.query(RankRule).filter(
                RankRule.rule_name == rule_name
            ).first()
            
            if existing:
                existing.drop_highest = drop_highest
                existing.drop_lowest = drop_lowest
                existing.ranking_mode = ranking_mode
                existing.promotion_threshold = promotion_threshold
                existing.promotion_score = promotion_score
                existing.categories = json.dumps(categories) if categories else None
            else:
                rank_rule = RankRule(
                    rule_name=rule_name,
                    drop_highest=drop_highest,
                    drop_lowest=drop_lowest,
                    ranking_mode=ranking_mode,
                    promotion_threshold=promotion_threshold,
                    promotion_score=promotion_score,
                    categories=json.dumps(categories) if categories else None
                )
                db.add(rank_rule)
            
            db.commit()
            return {"imported": 1, "errors": [], "rule": {
                "rule_name": rule_name,
                "drop_highest": drop_highest,
                "drop_lowest": drop_lowest,
                "ranking_mode": ranking_mode,
                "promotion_threshold": promotion_threshold,
                "promotion_score": promotion_score,
                "categories": categories
            }}
        except Exception as e:
            return {"imported": 0, "errors": [str(e)]}
    
    @staticmethod
    def import_appeals(db: Session, jsonl_content: str) -> Dict[str, Any]:
        imported_count = 0
        errors = []
        
        lines = jsonl_content.strip().split('\n')
        
        for line_num, line in enumerate(lines, 1):
            if not line.strip():
                continue
            
            try:
                appeal_data = json.loads(line)
                
                contestant_id = appeal_data.get('contestant_id')
                original_score = appeal_data.get('original_score')
                new_score = appeal_data.get('new_score')
                
                if contestant_id is None or original_score is None or new_score is None:
                    errors.append(f"Line {line_num}: Missing required fields")
                    continue
                
                existing = db.query(Appeal).filter(
                    Appeal.contestant_id == contestant_id,
                    Appeal.original_score == original_score,
                    Appeal.new_score == new_score
                ).first()
                
                if not existing:
                    appeal = Appeal(
                        contestant_id=contestant_id,
                        judge_id=appeal_data.get('judge_id'),
                        original_score=original_score,
                        new_score=new_score,
                        reason=appeal_data.get('reason'),
                        status=appeal_data.get('status', 'pending')
                    )
                    db.add(appeal)
                    imported_count += 1
                else:
                    existing.judge_id = appeal_data.get('judge_id', existing.judge_id)
                    existing.reason = appeal_data.get('reason', existing.reason)
                    existing.status = appeal_data.get('status', existing.status)
                    imported_count += 1
                    
            except json.JSONDecodeError as e:
                errors.append(f"Line {line_num}: Invalid JSON - {str(e)}")
            except Exception as e:
                errors.append(f"Line {line_num}: Error - {str(e)}")
        
        db.commit()
        return {"imported": imported_count, "errors": errors}
    
    @staticmethod
    def process_appeal(db: Session, appeal_id: int, approve: bool) -> Dict[str, Any]:
        appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
        if not appeal:
            return {"success": False, "error": "Appeal not found"}
        
        if appeal.status != 'pending':
            return {"success": False, "error": "Appeal already processed"}
        
        if approve:
            judge_score = db.query(JudgeScore).filter(
                JudgeScore.contestant_id == appeal.contestant_id,
                JudgeScore.judge_id == appeal.judge_id
            ).first()
            
            if judge_score:
                if judge_score.original_score is None:
                    judge_score.original_score = judge_score.score
                judge_score.score = appeal.new_score
            else:
                new_score = JudgeScore(
                    contestant_id=appeal.contestant_id,
                    judge_id=appeal.judge_id,
                    score=appeal.new_score,
                    original_score=appeal.original_score
                )
                db.add(new_score)
            
            appeal.status = 'approved'
        else:
            appeal.status = 'rejected'
        
        appeal.processed_at = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "appeal_id": appeal_id,
            "status": appeal.status,
            "contestant_id": appeal.contestant_id
        }
