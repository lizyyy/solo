from typing import Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Resume, ParseResult, ResumeStatus
from datetime import datetime, timedelta
from collections import Counter


class StatisticsService:
    @staticmethod
    def get_basic_statistics(db: Session) -> Dict[str, Any]:
        total_resumes = db.query(Resume).count()
        
        status_query = db.query(
            Resume.status,
            func.count(Resume.id)
        ).group_by(Resume.status).all()
        
        status_distribution = {status: count for status, count in status_query}
        
        for status in ResumeStatus:
            if status.value not in status_distribution:
                status_distribution[status.value] = 0
        
        avg_match_score = db.query(func.avg(Resume.match_score)).scalar() or 0.0
        
        return {
            "total_resumes": total_resumes,
            "status_distribution": status_distribution,
            "avg_match_score": round(avg_match_score, 2)
        }
    
    @staticmethod
    def get_daily_trend(db: Session, days: int = 30) -> List[Dict[str, Any]]:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        trend_data = db.query(
            func.date(Resume.created_at).label('date'),
            func.count(Resume.id).label('count')
        ).filter(
            Resume.created_at >= start_date
        ).group_by(
            func.date(Resume.created_at)
        ).order_by(
            'date'
        ).all()
        
        date_dict = {}
        for date_val, count in trend_data:
            if date_val:
                if hasattr(date_val, 'isoformat'):
                    date_str = date_val.isoformat()
                else:
                    date_str = str(date_val)
                date_dict[date_str] = count
        
        result = []
        for i in range(days):
            current_date = end_date - timedelta(days=days - 1 - i)
            date_str = current_date.strftime("%Y-%m-%d")
            result.append({
                "date": date_str,
                "count": date_dict.get(date_str, 0)
            })
        
        return result
    
    @staticmethod
    def get_top_skills(db: Session, top_n: int = 10) -> List[Dict[str, Any]]:
        parse_results = db.query(ParseResult).filter(
            ParseResult.skills.isnot(None)
        ).all()
        
        all_skills = []
        for pr in parse_results:
            if isinstance(pr.skills, list):
                all_skills.extend(pr.skills)
        
        skill_counter = Counter(all_skills)
        top_skills = skill_counter.most_common(top_n)
        
        return [
            {"skill": skill, "count": count}
            for skill, count in top_skills
        ]
    
    @staticmethod
    def get_full_statistics(db: Session) -> Dict[str, Any]:
        basic_stats = StatisticsService.get_basic_statistics(db)
        
        return {
            **basic_stats,
            "daily_trend": StatisticsService.get_daily_trend(db),
            "top_skills": StatisticsService.get_top_skills(db)
        }
