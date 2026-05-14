from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class ResumeStatus(str, enum.Enum):
    PENDING_PARSE = "待解析"
    PARSE_SUCCESS = "解析成功"
    PARSE_INTERCEPTED = "解析拦截"
    PARSE_COMPENSATED = "解析补偿"
    PENDING_REVIEW = "待人工复核"
    REVIEW_COMPLETED = "复核完成"
    EXPORTED = "已导出"


class JobPosition(Base):
    __tablename__ = "job_positions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, comment="岗位名称")
    department = Column(String(100), comment="所属部门")
    required_skills = Column(JSON, comment="所需技能列表")
    required_experience = Column(String(100), comment="经验要求")
    required_education = Column(String(100), comment="学历要求")
    description = Column(Text, comment="岗位描述")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    resumes = relationship("Resume", back_populates="matched_job")


class Resume(Base):
    __tablename__ = "resumes"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(500), nullable=False, comment="文件名")
    file_path = Column(String(1000), comment="文件存储路径")
    file_hash = Column(String(100), index=True, comment="文件哈希")
    status = Column(String(50), default=ResumeStatus.PENDING_PARSE, comment="状态")
    matched_job_id = Column(Integer, ForeignKey("job_positions.id"), nullable=True)
    match_score = Column(Float, default=0.0, comment="岗位匹配度")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    matched_job = relationship("JobPosition", back_populates="resumes")
    parse_results = relationship("ParseResult", back_populates="resume", order_by="ParseResult.version.desc()")
    review_records = relationship("ReviewRecord", back_populates="resume")


class ParseResult(Base):
    __tablename__ = "parse_results"
    
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    version = Column(Integer, default=1, comment="版本号")
    
    name = Column(String(100), comment="姓名")
    phone = Column(String(50), comment="电话")
    email = Column(String(200), comment="邮箱")
    age = Column(Integer, comment="年龄")
    gender = Column(String(20), comment="性别")
    education = Column(String(100), comment="学历")
    school = Column(String(200), comment="毕业院校")
    major = Column(String(200), comment="专业")
    work_years = Column(Float, comment="工作年限")
    current_company = Column(String(200), comment="当前公司")
    current_position = Column(String(200), comment="当前职位")
    expected_salary = Column(String(100), comment="期望薪资")
    current_salary = Column(String(100), comment="当前薪资")
    city = Column(String(100), comment="所在城市")
    
    skills = Column(JSON, comment="技能列表")
    work_experience = Column(JSON, comment="工作经历")
    education_experience = Column(JSON, comment="教育经历")
    project_experience = Column(JSON, comment="项目经历")
    
    raw_content = Column(Text, comment="原始解析内容")
    parse_source = Column(String(50), comment="解析来源：自动/人工/补偿")
    confidence_score = Column(Float, default=0.0, comment="解析置信度")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(100), comment="创建人")
    
    resume = relationship("Resume", back_populates="parse_results")


class ReviewRecord(Base):
    __tablename__ = "review_records"
    
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    reviewer = Column(String(100), comment="复核人")
    review_comment = Column(Text, comment="复核意见")
    changes_made = Column(JSON, comment="修改内容")
    review_time = Column(DateTime(timezone=True), server_default=func.now())
    
    resume = relationship("Resume", back_populates="review_records")
