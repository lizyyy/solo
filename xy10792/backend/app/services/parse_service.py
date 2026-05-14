from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ..models import Resume, ParseResult, ResumeStatus
from ..schemas import ParseResultCreate, ParseDiffResponse, DiffItem
import hashlib


class ParseService:
    @staticmethod
    def mock_parse_resume(filename: str) -> Dict[str, Any]:
        return {
            "name": filename.split(".")[0][:10] if filename else "未知",
            "phone": "13800138000",
            "email": "example@test.com",
            "age": 28,
            "gender": "男",
            "education": "本科",
            "school": "北京大学",
            "major": "计算机科学",
            "work_years": 5.0,
            "current_company": "阿里巴巴",
            "current_position": "高级工程师",
            "expected_salary": "30K-50K",
            "current_salary": "25K",
            "city": "北京",
            "skills": ["Python", "Java", "SQL", "Docker", "Kubernetes"],
            "work_experience": [
                {
                    "company": "阿里巴巴",
                    "position": "高级工程师",
                    "start_date": "2020-01",
                    "end_date": "至今",
                    "description": "负责后端系统开发"
                }
            ],
            "education_experience": [
                {
                    "school": "北京大学",
                    "major": "计算机科学",
                    "degree": "本科",
                    "start_date": "2012-09",
                    "end_date": "2016-06"
                }
            ],
            "project_experience": [],
            "confidence_score": 0.85
        }
    
    @staticmethod
    def parse_resume(db: Session, resume_id: int) -> ParseResult:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise ValueError("简历不存在")
        
        parse_data = ParseService.mock_parse_resume(resume.filename)
        
        latest_version = db.query(ParseResult).filter(
            ParseResult.resume_id == resume_id
        ).count() + 1
        
        parse_result = ParseResult(
            resume_id=resume_id,
            version=latest_version,
            **parse_data,
            parse_source="自动",
            raw_content=str(parse_data)
        )
        
        db.add(parse_result)
        
        if parse_data["confidence_score"] >= 0.8:
            resume.status = ResumeStatus.PARSE_SUCCESS
        elif parse_data["confidence_score"] >= 0.5:
            resume.status = ResumeStatus.PARSE_COMPENSATED
        else:
            resume.status = ResumeStatus.PARSE_INTERCEPTED
        
        db.commit()
        db.refresh(parse_result)
        return parse_result
    
    @staticmethod
    def manual_parse(db: Session, resume_id: int, parse_data: Dict[str, Any], reviewer: str) -> ParseResult:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise ValueError("简历不存在")
        
        latest_version = db.query(ParseResult).filter(
            ParseResult.resume_id == resume_id
        ).count() + 1
        
        parse_result = ParseResult(
            resume_id=resume_id,
            version=latest_version,
            **parse_data,
            parse_source="人工",
            confidence_score=1.0,
            created_by=reviewer,
            raw_content=str(parse_data)
        )
        
        db.add(parse_result)
        resume.status = ResumeStatus.REVIEW_COMPLETED
        db.commit()
        db.refresh(parse_result)
        return parse_result
    
    @staticmethod
    def compare_parse_versions(db: Session, resume_id: int, version1: int = None, version2: int = None) -> ParseDiffResponse:
        parse_results = db.query(ParseResult).filter(
            ParseResult.resume_id == resume_id
        ).order_by(ParseResult.version).all()
        
        if len(parse_results) < 2:
            return ParseDiffResponse(has_changes=False, diffs=[])
        
        if version1 is None:
            old_parse = parse_results[-2]
        else:
            old_parse = next((p for p in parse_results if p.version == version1), parse_results[-2])
        
        if version2 is None:
            new_parse = parse_results[-1]
        else:
            new_parse = next((p for p in parse_results if p.version == version2), parse_results[-1])
        
        diffs = []
        compare_fields = [
            "name", "phone", "email", "age", "gender", "education", "school",
            "major", "work_years", "current_company", "current_position",
            "expected_salary", "current_salary", "city", "skills"
        ]
        
        for field in compare_fields:
            old_val = getattr(old_parse, field)
            new_val = getattr(new_parse, field)
            
            if old_val != new_val:
                change_type = "修改"
                if old_val is None and new_val is not None:
                    change_type = "新增"
                elif old_val is not None and new_val is None:
                    change_type = "删除"
                
                diffs.append(DiffItem(
                    field=field,
                    old_value=old_val,
                    new_value=new_val,
                    change_type=change_type
                ))
        
        return ParseDiffResponse(has_changes=len(diffs) > 0, diffs=diffs)
    
    @staticmethod
    def recalculate_match_score(db: Session, resume_id: int) -> float:
        from .match_service import MatchService
        
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume or not resume.matched_job_id:
            return 0.0
        
        latest_parse = db.query(ParseResult).filter(
            ParseResult.resume_id == resume_id
        ).order_by(ParseResult.version.desc()).first()
        
        if not latest_parse:
            return 0.0
        
        match_score = MatchService.calculate_match_score(
            db, latest_parse, resume.matched_job_id
        )
        
        resume.match_score = match_score
        db.commit()
        
        return match_score
