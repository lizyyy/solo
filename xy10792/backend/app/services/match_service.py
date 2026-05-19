from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ..models import JobPosition, ParseResult, Resume


class MatchService:
    @staticmethod
    def calculate_match_score(db: Session, parse_result: ParseResult, job_id: int) -> float:
        job = db.query(JobPosition).filter(JobPosition.id == job_id).first()
        if not job:
            return 0.0
        
        score = 0.0
        total_weight = 0.0
        
        if job.required_skills and parse_result.skills:
            skill_weight = 0.4
            total_weight += skill_weight
            required_skills = set(job.required_skills)
            candidate_skills = set(parse_result.skills)
            matched = len(required_skills & candidate_skills)
            if len(required_skills) > 0:
                score += skill_weight * (matched / len(required_skills))
        
        if job.required_experience and parse_result.work_years:
            exp_weight = 0.3
            total_weight += exp_weight
            try:
                required_years = float(''.join(filter(str.isdigit, job.required_experience)) or 0)
                if parse_result.work_years >= required_years:
                    score += exp_weight
                else:
                    score += exp_weight * (parse_result.work_years / required_years if required_years > 0 else 0)
            except:
                score += exp_weight * 0.5
        
        if job.required_education and parse_result.education:
            edu_weight = 0.2
            total_weight += edu_weight
            edu_order = {"大专": 1, "本科": 2, "硕士": 3, "博士": 4}
            candidate_edu = edu_order.get(parse_result.education, 0)
            required_edu = edu_order.get(job.required_education, 0)
            if candidate_edu >= required_edu:
                score += edu_weight
            else:
                score += edu_weight * 0.5
        
        score += 0.1
        total_weight += 0.1
        
        final_score = (score / total_weight) * 100 if total_weight > 0 else 0
        return round(final_score, 2)
    
    @staticmethod
    def match_best_job(db: Session, parse_result: ParseResult) -> tuple:
        active_jobs = db.query(JobPosition).filter(JobPosition.is_active == True).all()
        if not active_jobs:
            return None, 0.0
        
        best_job = None
        best_score = 0.0
        
        for job in active_jobs:
            score = MatchService.calculate_match_score(db, parse_result, job.id)
            if score > best_score:
                best_score = score
                best_job = job
        
        return best_job, best_score
    
    @staticmethod
    def match_resume_to_job(db: Session, resume_id: int, job_id: int) -> float:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise ValueError("简历不存在")
        
        latest_parse = db.query(ParseResult).filter(
            ParseResult.resume_id == resume_id
        ).order_by(ParseResult.version.desc()).first()
        
        if not latest_parse:
            raise ValueError("未找到解析结果")
        
        match_score = MatchService.calculate_match_score(db, latest_parse, job_id)
        
        resume.matched_job_id = job_id
        resume.match_score = match_score
        db.commit()
        
        return match_score
    
    @staticmethod
    def auto_match_resume(db: Session, resume_id: int) -> Dict[str, Any]:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise ValueError("简历不存在")
        
        latest_parse = db.query(ParseResult).filter(
            ParseResult.resume_id == resume_id
        ).order_by(ParseResult.version.desc()).first()
        
        if not latest_parse:
            raise ValueError("未找到解析结果")
        
        best_job, best_score = MatchService.match_best_job(db, latest_parse)
        
        if best_job:
            resume.matched_job_id = best_job.id
            resume.match_score = best_score
            db.commit()
        
        return {
            "matched_job": best_job.name if best_job else None,
            "match_score": best_score,
            "job_id": best_job.id if best_job else None
        }
