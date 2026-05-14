from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ..models import Resume, ParseResult, ResumeStatus
import pandas as pd
from io import BytesIO
from datetime import datetime


class ExportService:
    FIELD_NAMES_CN = {
        "name": "姓名",
        "phone": "联系电话",
        "email": "电子邮箱",
        "age": "年龄",
        "gender": "性别",
        "education": "最高学历",
        "school": "毕业院校",
        "major": "所学专业",
        "work_years": "工作年限(年)",
        "current_company": "当前公司",
        "current_position": "当前职位",
        "expected_salary": "期望薪资",
        "current_salary": "当前薪资",
        "city": "所在城市",
        "skills": "技能列表",
        "match_score": "岗位匹配度(%)",
        "matched_job": "匹配岗位",
        "status": "当前状态",
        "filename": "简历文件名",
        "created_at": "上传时间",
        "parse_source": "解析来源",
        "confidence_score": "解析置信度(%)"
    }
    
    @staticmethod
    def get_export_data(db: Session, resume_ids: List[int] = None, 
                       status_filter: List[str] = None,
                       start_date: datetime = None,
                       end_date: datetime = None) -> List[Dict[str, Any]]:
        query = db.query(Resume)
        
        if resume_ids:
            query = query.filter(Resume.id.in_(resume_ids))
        
        if status_filter:
            query = query.filter(Resume.status.in_(status_filter))
        
        if start_date:
            query = query.filter(Resume.created_at >= start_date)
        
        if end_date:
            query = query.filter(Resume.created_at <= end_date)
        
        resumes = query.order_by(Resume.created_at.desc()).all()
        
        export_data = []
        for resume in resumes:
            latest_parse = db.query(ParseResult).filter(
                ParseResult.resume_id == resume.id
            ).order_by(ParseResult.version.desc()).first()
            
            row = {
                "简历ID": resume.id,
                "简历文件名": resume.filename,
                "当前状态": resume.status,
                "岗位匹配度(%)": resume.match_score,
                "匹配岗位": resume.matched_job.name if resume.matched_job else "",
                "上传时间": resume.created_at.strftime("%Y-%m-%d %H:%M:%S") if resume.created_at else ""
            }
            
            if latest_parse:
                parse_fields = [
                    "name", "phone", "email", "age", "gender", "education",
                    "school", "major", "work_years", "current_company",
                    "current_position", "expected_salary", "current_salary",
                    "city", "skills"
                ]
                
                for field in parse_fields:
                    value = getattr(latest_parse, field)
                    if field == "skills" and isinstance(value, list):
                        value = "、".join(value)
                    row[ExportService.FIELD_NAMES_CN.get(field, field)] = value
                
                row["解析来源"] = latest_parse.parse_source
                row["解析置信度(%)"] = round(latest_parse.confidence_score * 100, 2)
                row["解析版本"] = latest_parse.version
            
            export_data.append(row)
        
        return export_data
    
    @staticmethod
    def export_to_excel(data: List[Dict[str, Any]]) -> BytesIO:
        df = pd.DataFrame(data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='简历复核数据', index=False)
            
            worksheet = writer.sheets['简历复核数据']
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        return output
    
    @staticmethod
    def export_to_csv(data: List[Dict[str, Any]]) -> BytesIO:
        df = pd.DataFrame(data)
        output = BytesIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        return output
    
    @staticmethod
    def export_resumes(db: Session, export_format: str = "excel", **kwargs) -> tuple:
        data = ExportService.get_export_data(db, **kwargs)
        
        if export_format == "csv":
            file_content = ExportService.export_to_csv(data)
            media_type = "text/csv"
            filename = f"简历复核数据_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        else:
            file_content = ExportService.export_to_excel(data)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"简历复核数据_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        
        return file_content, media_type, filename
    
    @staticmethod
    def mark_as_exported(db: Session, resume_ids: List[int]) -> None:
        db.query(Resume).filter(Resume.id.in_(resume_ids)).update(
            {Resume.status: ResumeStatus.EXPORTED},
            synchronize_session=False
        )
        db.commit()
