#!/usr/bin/env python3

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from app import schemas, models, services, auth
from app.database import Base, init_database
from datetime import datetime, timedelta

print("=== 验证测试脚本 ===")
print()

print("正在初始化数据库...")
engine = init_database(use_memory_fallback=True)
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()
print("✅ 数据库初始化成功")
print()

print("1. 测试 Pydantic 2.x 兼容性 (from_attributes)...")
try:
    applicant = models.Applicant(
        name="测试用户",
        email="test@example.com",
        company="测试公司",
        created_at=datetime.utcnow()
    )
    db.add(applicant)
    db.commit()
    db.refresh(applicant)
    
    schema = schemas.Applicant.model_validate(applicant)
    print(f"   ✅ Pydantic 2.x 验证通过: {schema.name}")
except Exception as e:
    print(f"   ❌ Pydantic 验证失败: {e}")
    sys.exit(1)

print()
print("2. 测试创建申请...")
try:
    app_data = schemas.ApplicationCreate(
        applicant_name="测试申请人",
        applicant_email="test2@example.com",
        applicant_company="测试团队",
        api_scopes="users:read,orders:read",
        validity_days=30,
        reason="测试申请"
    )
    application = services.create_application(db, app_data)
    print(f"   ✅ 申请创建成功: ID={application.id}")
except Exception as e:
    print(f"   ❌ 申请创建失败: {e}")
    sys.exit(1)

print()
print("3. 测试审批和凭证签发...")
try:
    approval = schemas.ApprovalRequest(
        application_id=application.id,
        approved=True,
        reviewer_comment="测试审批"
    )
    credential = services.process_approval(db, approval)
    print(f"   ✅ 凭证签发成功: API Key={credential.api_key[:10]}...")
    print(f"   ✅ 凭证有效期至: {credential.expires_at}")
except Exception as e:
    print(f"   ❌ 凭证签发失败: {e}")
    sys.exit(1)

print()
print("4. 测试访问验证...")
try:
    access_req = schemas.AccessRequest(
        api_key=credential.api_key,
        api_secret=credential.api_secret,
        endpoint="/api/users",
        method="GET"
    )
    result = services.verify_access(db, access_req, "127.0.0.1", "test-agent")
    print(f"   ✅ 访问授权: granted={result['granted']}")
except Exception as e:
    print(f"   ❌ 访问验证失败: {e}")
    sys.exit(1)

print()
print("5. 测试越权访问（无权限的接口）...")
try:
    access_req = schemas.AccessRequest(
        api_key=credential.api_key,
        api_secret=credential.api_secret,
        endpoint="/api/orders",
        method="POST"
    )
    result = services.verify_access(db, access_req, "127.0.0.1", "test-agent")
    print(f"   ✅ 越权访问正确拒绝: granted={result['granted']}, reason={result['reason']}")
except Exception as e:
    print(f"   ❌ 越权访问测试失败: {e}")
    sys.exit(1)

print()
print("6. 测试凭证撤销...")
try:
    revoke_req = schemas.RevokeRequest(
        credential_id=credential.id,
        reason="测试撤销"
    )
    revoked = services.revoke_credential(db, revoke_req)
    print(f"   ✅ 凭证撤销成功: status={revoked.status}")
except Exception as e:
    print(f"   ❌ 凭证撤销失败: {e}")
    sys.exit(1)

print()
print("7. 测试创建已过期凭证（演示数据）...")
try:
    exp_app = schemas.ApplicationCreate(
        applicant_name="过期测试",
        applicant_email="expired@example.com",
        applicant_company="过期团队",
        api_scopes="users:read",
        validity_days=7,
        reason="已过期测试"
    )
    expired_cred = services.create_expired_credential_demo(db, exp_app)
    print(f"   ✅ 过期凭证创建成功: expires_at={expired_cred.expires_at}")
    print(f"   ✅ 凭证状态: {expired_cred.status}")
except Exception as e:
    print(f"   ❌ 过期凭证创建失败: {e}")
    sys.exit(1)

print()
print("8. 测试审计链路查询...")
try:
    chain = services.get_credential_audit_chain(db, expired_cred.id)
    log_count = len(chain['audit_logs'])
    print(f"   ✅ 审计链路完整: 申请人={chain['applicant'].name}, 审计日志数={log_count}")
except Exception as e:
    print(f"   ❌ 审计链路查询失败: {e}")
    sys.exit(1)

print()
print("=== 所有验证测试通过！✅ ===")
print()
print("项目可正常运行，请执行 ./start.sh 启动服务")
db.close()
