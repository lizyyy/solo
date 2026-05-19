from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ..models import Resume, ParseResult, ResumeStatus
from ..schemas import ParseDiffResponse, DiffItem
import hashlib


class ParseService:
    @staticmethod
    def generate_confidence(filename: str) -> float:
        """根据文件名生成伪随机置信度，用于模拟不同的解析结果"""
        hash_val = int(hashlib.md5(filename.encode()).hexdigest(), 16)
        confidence = (hash_val % 100) / 100.0
        return round(confidence, 2)
    
    @staticmethod
    def mock_parse_resume(filename: str) -> Dict[str, Any]:
        """根据文件名生成不同的解析结果，包含各种字段的完整度"""
        confidence = ParseService.generate_confidence(filename)
        
        base_data = {
            "name": filename.split(".")[0][:10] if filename else "未知",
            "confidence_score": confidence
        }
        
        # 根据置信度设置不同字段
        if confidence >= 0.8:
            # 高置信度：完整信息
            base_data.update({
                "phone": "13800138000",
                "email": f"{base_data['name'].lower().replace(' ', '')}@example.com",
                "age": 28,
                "gender": "男",
                "education": "本科",
                "school": "北京大学",
                "major": "计算机科学与技术",
                "work_years": 5.0,
                "current_company": "阿里巴巴",
                "current_position": "高级工程师",
                "expected_salary": "30K-50K",
                "current_salary": "25K",
                "city": "北京",
                "skills": ["Python", "Java", "SQL", "Docker", "Kubernetes", "Redis", "MySQL"],
                "work_experience": [
                    {
                        "company": "阿里巴巴",
                        "position": "高级工程师",
                        "start_date": "2020-01",
                        "end_date": "至今",
                        "description": "负责后端系统开发和架构设计"
                    },
                    {
                        "company": "腾讯",
                        "position": "工程师",
                        "start_date": "2017-07",
                        "end_date": "2019-12",
                        "description": "参与微信支付系统开发"
                    }
                ],
                "education_experience": [
                    {
                        "school": "北京大学",
                        "major": "计算机科学与技术",
                        "degree": "本科",
                        "start_date": "2013-09",
                        "end_date": "2017-06"
                    }
                ],
                "project_experience": []
            })
        elif confidence >= 0.5:
            # 中等置信度：部分信息缺失（补偿模式）
            base_data.update({
                "phone": "13800138000",
                "email": None,
                "age": None,
                "gender": "男",
                "education": "本科",
                "school": "北京大学",
                "major": None,
                "work_years": 3.0,
                "current_company": "阿里巴巴",
                "current_position": "工程师",
                "expected_salary": "20K-35K",
                "current_salary": None,
                "city": "北京",
                "skills": ["Python", "Java", "SQL"],
                "work_experience": [
                    {
                        "company": "阿里巴巴",
                        "position": "工程师",
                        "start_date": "2020-01",
                        "end_date": "至今",
                        "description": "后端系统开发"
                    }
                ],
                "education_experience": [],
                "project_experience": []
            })
        else:
            # 低置信度：信息严重缺失（拦截模式）
            base_data.update({
                "phone": None,
                "email": None,
                "age": None,
                "gender": None,
                "education": None,
                "school": None,
                "major": None,
                "work_years": None,
                "current_company": None,
                "current_position": None,
                "expected_salary": None,
                "current_salary": None,
                "city": None,
                "skills": [],
                "work_experience": [],
                "education_experience": [],
                "project_experience": []
            })
        
        return base_data
    
    @staticmethod
    def parse_resume(db: Session, resume_id: int) -> ParseResult:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise ValueError("简历不存在")
        
        parse_data = ParseService.mock_parse_resume(resume.filename)
        confidence = parse_data["confidence_score"]
        
        latest_version = db.query(ParseResult).filter(
            ParseResult.resume_id == resume_id
        ).count() + 1
        
        parse_source = "自动"
        if confidence >= 0.8:
            parse_source = "自动"
        elif confidence >= 0.5:
            parse_source = "自动(补偿)"
        else:
            parse_source = "自动(拦截)"
        
        parse_result = ParseResult(
            resume_id=resume_id,
            version=latest_version,
            **parse_data,
            parse_source=parse_source,
            raw_content=str(parse_data)
        )
        
        db.add(parse_result)
        
        if confidence >= 0.8:
            resume.status = ResumeStatus.PARSE_SUCCESS
        elif confidence >= 0.5:
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
        
        server_managed_fields = {
            'id', 'resume_id', 'version', 'parse_source',
            'confidence_score', 'created_by', 'created_at', 'raw_content'
        }
        cleaned_parse_data = {
            k: v for k, v in parse_data.items()
            if k not in server_managed_fields
        }
        
        parse_result = ParseResult(
            resume_id=resume_id,
            version=latest_version,
            **cleaned_parse_data,
            parse_source="人工",
            confidence_score=1.0,
            created_by=reviewer,
            raw_content=str(cleaned_parse_data)
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
