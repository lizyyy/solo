from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from models import BatchStatus, ClaimStatus, DesensitizationType
from datetime import datetime, timedelta

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    print("正在创建脱敏规则...")
    
    phone_rule = models.DesensitizationRule(
        name="手机号脱敏",
        rule_type=DesensitizationType.MASK,
        mask_char="*",
        keep_start=3,
        keep_end=4,
        description="保留前3后4，中间用*代替"
    )
    db.add(phone_rule)

    id_card_rule = models.DesensitizationRule(
        name="身份证号脱敏",
        rule_type=DesensitizationType.MASK,
        mask_char="*",
        keep_start=6,
        keep_end=4,
        description="保留前6后4，中间用*代替"
    )
    db.add(id_card_rule)

    name_rule = models.DesensitizationRule(
        name="姓名脱敏",
        rule_type=DesensitizationType.MASK,
        mask_char="*",
        keep_start=1,
        keep_end=0,
        description="只保留姓氏"
    )
    db.add(name_rule)

    email_rule = models.DesensitizationRule(
        name="邮箱脱敏",
        rule_type=DesensitizationType.MASK,
        mask_char="*",
        keep_start=2,
        keep_end=0,
        description="保留前2位，@后面的保留"
    )
    db.add(email_rule)

    hash_rule = models.DesensitizationRule(
        name="哈希脱敏",
        rule_type=DesensitizationType.HASH,
        description="对敏感字段进行SHA256哈希处理，取前16位"
    )
    db.add(hash_rule)

    db.commit()

    print("正在创建样本批次...")
    
    batch = models.SampleBatch(
        batch_no="BATCH-2024-001",
        name="用户中心接口样本",
        description="包含用户注册、登录、信息查询等接口的脱敏样本数据",
        status=BatchStatus.APPROVED,
        created_by="admin",
        approver="manager",
        approval_comment="审批通过，脱敏规则符合要求",
        expire_at=datetime.now() + timedelta(days=30)
    )
    db.add(batch)
    db.flush()

    print("正在添加API路径...")
    
    api_paths = [
        {"path": "/api/v1/user/register", "method": "POST", "sample_count": 100, "description": "用户注册接口"},
        {"path": "/api/v1/user/login", "method": "POST", "sample_count": 500, "description": "用户登录接口"},
        {"path": "/api/v1/user/profile", "method": "GET", "sample_count": 200, "description": "用户信息查询接口"},
        {"path": "/api/v1/user/update", "method": "PUT", "sample_count": 150, "description": "用户信息更新接口"}
    ]
    
    for p in api_paths:
        db.add(models.ApiPath(batch_id=batch.id, **p))

    print("正在添加敏感字段配置...")
    
    rules = {r.name: r.id for r in db.query(models.DesensitizationRule).all()}
    
    sensitive_fields = [
        {"field_path": "user.phone", "field_type": "string", "rule_id": rules["手机号脱敏"], "description": "用户手机号"},
        {"field_path": "user.id_card", "field_type": "string", "rule_id": rules["身份证号脱敏"], "description": "用户身份证号"},
        {"field_path": "user.name", "field_type": "string", "rule_id": rules["姓名脱敏"], "description": "用户姓名"},
        {"field_path": "user.email", "field_type": "string", "rule_id": rules["邮箱脱敏"], "description": "用户邮箱"},
        {"field_path": "user.password_hash", "field_type": "string", "rule_id": rules["哈希脱敏"], "description": "密码哈希值"}
    ]
    
    for f in sensitive_fields:
        db.add(models.SensitiveField(batch_id=batch.id, **f))

    print("正在添加授权范围...")
    
    scope = models.AuthorizationScope(
        batch_id=batch.id,
        scope_type="department",
        scope_value="qa",
        allowed_users=["tester1", "tester2", "tester3"],
        allowed_roles=["qa", "developer"],
        max_claims=3,
        claim_hours=8,
        description="QA部门测试使用，有效期8小时"
    )
    db.add(scope)

    print("正在添加领取记录...")
    
    claim = models.ClaimRecord(
        batch_id=batch.id,
        claimant="tester1",
        claimant_email="tester1@example.com",
        purpose="复现用户登录接口的Bug",
        status=ClaimStatus.APPROVED,
        approver="admin",
        approval_comment="批准使用，注意数据保密",
        claimed_at=datetime.now(),
        expire_at=datetime.now() + timedelta(hours=8)
    )
    db.add(claim)

    db.commit()

    print("\n初始化完成！")
    print(f"批次编号: {batch.batch_no}")
    print(f"批次ID: {batch.id}")
    print(f"脱敏规则: {len(rules)} 条")
    print(f"API路径: {len(api_paths)} 条")
    print(f"敏感字段: {len(sensitive_fields)} 个")
    print(f"领取记录ID: {claim.id}")
    print("\n可以使用以下命令启动服务:")
    print("  python main.py")
    print("或:")
    print("  uvicorn main:app --reload --host 0.0.0.0 --port 8000")

except Exception as e:
    print(f"初始化失败: {e}")
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
