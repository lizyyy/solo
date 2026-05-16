from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json

DATABASE_URL = "sqlite:///./sso_mapping.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class IdentitySource(Base):
    __tablename__ = "identity_sources"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    provider = Column(String)
    status = Column(String, default="draft")
    config = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    mappings = relationship("AttributeMapping", back_populates="identity_source")
    test_users = relationship("TestUser", back_populates="identity_source")
    reports = relationship("MappingReport", back_populates="identity_source")

class AttributeMapping(Base):
    __tablename__ = "attribute_mappings"
    id = Column(Integer, primary_key=True, index=True)
    identity_source_id = Column(Integer, ForeignKey("identity_sources.id"))
    source_attribute = Column(String)
    target_attribute = Column(String)
    mapping_type = Column(String)
    validation_rule = Column(Text)
    is_required = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    identity_source = relationship("IdentitySource", back_populates="mappings")

class TestUser(Base):
    __tablename__ = "test_users"
    id = Column(Integer, primary_key=True, index=True)
    identity_source_id = Column(Integer, ForeignKey("identity_sources.id"))
    external_id = Column(String)
    email = Column(String)
    raw_attributes = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    identity_source = relationship("IdentitySource", back_populates="test_users")
    role_results = relationship("RoleResult", back_populates="test_user")
    corrections = relationship("CorrectionRecord", back_populates="test_user")

class RoleResult(Base):
    __tablename__ = "role_results"
    id = Column(Integer, primary_key=True, index=True)
    test_user_id = Column(Integer, ForeignKey("test_users.id"))
    role_name = Column(String)
    source = Column(String)
    has_conflict = Column(Boolean, default=False)
    conflict_detail = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    test_user = relationship("TestUser", back_populates="role_results")

class CorrectionRecord(Base):
    __tablename__ = "correction_records"
    id = Column(Integer, primary_key=True, index=True)
    test_user_id = Column(Integer, ForeignKey("test_users.id"))
    field_name = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)
    corrected_by = Column(String)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    test_user = relationship("TestUser", back_populates="corrections")

class MappingReport(Base):
    __tablename__ = "mapping_reports"
    id = Column(Integer, primary_key=True, index=True)
    identity_source_id = Column(Integer, ForeignKey("identity_sources.id"))
    total_users = Column(Integer)
    success_count = Column(Integer)
    failed_count = Column(Integer)
    conflict_count = Column(Integer)
    summary = Column(Text)
    status = Column(String, default="generating")
    created_at = Column(DateTime, default=datetime.utcnow)
    identity_source = relationship("IdentitySource", back_populates="reports")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SSO属性映射API")

class IdentitySourceCreate(BaseModel):
    name: str
    provider: str
    config: Dict[str, Any]

class AttributeMappingCreate(BaseModel):
    identity_source_id: int
    source_attribute: str
    target_attribute: str
    mapping_type: str
    validation_rule: Optional[str] = None
    is_required: bool = False

class TestUserCreate(BaseModel):
    identity_source_id: int
    external_id: str
    email: str
    raw_attributes: Dict[str, Any]

class CorrectionCreate(BaseModel):
    test_user_id: int
    field_name: str
    new_value: str
    corrected_by: str
    reason: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/identity-sources", response_model=Dict[str, Any])
def create_identity_source(source: IdentitySourceCreate):
    db = next(get_db())
    db_source = IdentitySource(
        name=source.name,
        provider=source.provider,
        config=json.dumps(source.config)
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return {"id": db_source.id, "name": db_source.name, "provider": db_source.provider, "status": db_source.status}

@app.get("/api/identity-sources", response_model=List[Dict[str, Any]])
def list_identity_sources():
    db = next(get_db())
    sources = db.query(IdentitySource).all()
    return [{"id": s.id, "name": s.name, "provider": s.provider, "status": s.status} for s in sources]

@app.post("/api/attribute-mappings", response_model=Dict[str, Any])
def create_mapping(mapping: AttributeMappingCreate):
    db = next(get_db())
    db_mapping = AttributeMapping(**mapping.dict(exclude={"validation_rule"}), validation_rule=json.dumps({"rule": mapping.validation_rule}) if mapping.validation_rule else None)
    db.add(db_mapping)
    db.commit()
    db.refresh(db_mapping)
    return {"id": db_mapping.id, "source_attribute": db_mapping.source_attribute, "target_attribute": db_mapping.target_attribute}

@app.get("/api/attribute-mappings/{source_id}", response_model=List[Dict[str, Any]])
def list_mappings(source_id: int):
    db = next(get_db())
    mappings = db.query(AttributeMapping).filter(AttributeMapping.identity_source_id == source_id).all()
    return [{"id": m.id, "source_attribute": m.source_attribute, "target_attribute": m.target_attribute} for m in mappings]

@app.post("/api/test-users", response_model=Dict[str, Any])
def create_test_user(user: TestUserCreate):
    db = next(get_db())
    db_user = TestUser(
        identity_source_id=user.identity_source_id,
        external_id=user.external_id,
        email=user.email,
        raw_attributes=json.dumps(user.raw_attributes)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "external_id": db_user.external_id, "email": db_user.email, "status": db_user.status}

@app.post("/api/test-users/{user_id}/validate")
def validate_test_user(user_id: int):
    db = next(get_db())
    user = db.query(TestUser).filter(TestUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    source = db.query(IdentitySource).filter(IdentitySource.id == user.identity_source_id).first()
    mappings = db.query(AttributeMapping).filter(AttributeMapping.identity_source_id == user.identity_source_id).all()
    
    raw_attrs = json.loads(user.raw_attributes)
    errors = []
    mapped_roles = []
    
    for mapping in mappings:
        if mapping.target_attribute == "roles":
            roles = raw_attrs.get(mapping.source_attribute, [])
            if isinstance(roles, str):
                roles = [roles]
            for role in roles:
                has_conflict = len(role) > 50
                db_role = RoleResult(
                    test_user_id=user.id,
                    role_name=role,
                    source=mapping.source_attribute,
                    has_conflict=has_conflict,
                    conflict_detail="角色名过长" if has_conflict else None
                )
                db.add(db_role)
                mapped_roles.append({"role": role, "has_conflict": has_conflict})
        if mapping.is_required and mapping.source_attribute not in raw_attrs:
            errors.append(f"缺少必填字段: {mapping.source_attribute}")
    
    if errors:
        user.status = "failed"
        result = {"status": "failed", "errors": errors, "raw_input": raw_attrs}
    else:
        user.status = "validated"
        result = {"status": "validated", "roles": mapped_roles, "raw_input": raw_attrs}
    
    db.commit()
    return result

@app.post("/api/corrections", response_model=Dict[str, Any])
def create_correction(correction: CorrectionCreate):
    db = next(get_db())
    user = db.query(TestUser).filter(TestUser.id == correction.test_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    raw_attrs = json.loads(user.raw_attributes)
    old_value = str(raw_attrs.get(correction.field_name, ""))
    
    db_correction = CorrectionRecord(
        test_user_id=correction.test_user_id,
        field_name=correction.field_name,
        old_value=old_value,
        new_value=correction.new_value,
        corrected_by=correction.corrected_by,
        reason=correction.reason
    )
    db.add(db_correction)
    
    raw_attrs[correction.field_name] = correction.new_value
    user.raw_attributes = json.dumps(raw_attrs)
    user.status = "corrected"
    
    db.commit()
    db.refresh(db_correction)
    return {"id": db_correction.id, "field_name": db_correction.field_name, "old_value": old_value, "new_value": correction.new_value}

@app.post("/api/reports/{source_id}", response_model=Dict[str, Any])
def generate_report(source_id: int):
    db = next(get_db())
    users = db.query(TestUser).filter(TestUser.identity_source_id == source_id).all()
    total = len(users)
    success = len([u for u in users if u.status == "validated"])
    failed = len([u for u in users if u.status == "failed"])
    
    conflicts = 0
    for user in users:
        roles = db.query(RoleResult).filter(RoleResult.test_user_id == user.id, RoleResult.has_conflict == True).all()
        conflicts += len(roles)
    
    report = MappingReport(
        identity_source_id=source_id,
        total_users=total,
        success_count=success,
        failed_count=failed,
        conflict_count=conflicts,
        summary=f"总用户: {total}, 成功: {success}, 失败: {failed}, 角色冲突: {conflicts}",
        status="completed"
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"id": report.id, "total_users": total, "success_count": success, "failed_count": failed, "conflict_count": conflicts}

@app.get("/api/reports/{report_id}", response_model=Dict[str, Any])
def get_report(report_id: int):
    db = next(get_db())
    report = db.query(MappingReport).filter(MappingReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": report.id,
        "total_users": report.total_users,
        "success_count": report.success_count,
        "failed_count": report.failed_count,
        "conflict_count": report.conflict_count,
        "summary": report.summary,
        "created_at": report.created_at.isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
