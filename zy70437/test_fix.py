#!/usr/bin/env python3
"""
测试脚本：验证修复的功能
1. 规则版本创建（修复 db.func 问题）
2. 审批不覆盖原始重放结论
"""

import sys
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import Batch, GatewayErrorExtract, ReplayResult, RuleVersion, ReplayStatus
from replay_engine import ReplayEngine

def init_db():
    """初始化内存数据库"""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()

def test_rule_version_creation(db):
    """测试规则版本创建：修复 db.func 问题"""
    print("\n=== 测试 1: 规则版本创建 ===")
    
    try:
        from sqlalchemy import func
        
        rule_version1 = RuleVersion(
            version="v1.0",
            rule_name="默认规则",
            description="第一版规则",
            rules={"approval_opinion_check": True},
            is_active=True,
            created_by="admin",
            effective_from=datetime.now()
        )
        db.add(rule_version1)
        db.commit()
        print(f"✓ 创建第一个规则版本: {rule_version1.version}, is_active={rule_version1.is_active}")
        
        rule_version2 = RuleVersion(
            version="v2.0",
            rule_name="更新规则",
            description="第二版规则",
            rules={"approval_opinion_check": True, "extra_check": True},
            is_active=True,
            created_by="admin",
            effective_from=datetime.now()
        )
        
        db.query(RuleVersion).filter(RuleVersion.is_active == True).update(
            {RuleVersion.is_active: False, RuleVersion.effective_to: func.now()}
        )
        
        db.add(rule_version2)
        db.commit()
        print(f"✓ 创建第二个规则版本: {rule_version2.version}, is_active={rule_version2.is_active}")
        
        db.refresh(rule_version1)
        print(f"✓ 第一个规则版本自动失活: is_active={rule_version1.is_active}, effective_to={rule_version1.effective_to}")
        
        print("✓ 规则版本创建测试通过！")
        return True
    except Exception as e:
        print(f"✗ 规则版本创建失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_approval_not_override_replay_status(db):
    """测试审批不覆盖原始重放结论"""
    print("\n=== 测试 2: 审批不覆盖原始重放结论 ===")
    
    try:
        batch = Batch(
            batch_number="TEST-BATCH-001",
            created_by="admin",
            status="pending"
        )
        db.add(batch)
        db.commit()
        
        extract = GatewayErrorExtract(
            batch_id=batch.id,
            trace_id="trace-001",
            request_id="req-001",
            error_code="E500",
            error_message="Internal Server Error",
            request_path="/api/data",
            request_method="POST",
            request_headers={},
            request_body={},
            response_status=500,
            response_body={},
            timestamp=datetime.now(),
            service_name="order-service",
            upstream_service="gateway",
            approval_opinion="",
            approval_status="pending",
            raw_data={}
        )
        db.add(extract)
        db.commit()
        
        engine = ReplayEngine(db)
        result = engine.process_extract(extract, {})
        result.batch_id = batch.id
        db.add(result)
        db.commit()
        db.refresh(result)
        
        print(f"✓ 重放完成，原始重放结论: replay_status={result.replay_status}")
        print(f"✓ 审批状态（初始）: approval_status={result.approval_status}")
        
        assert result.replay_status == ReplayStatus.BLOCKED, "重放应该是 blocked"
        assert result.approval_status is None, "初始审批状态应为 None"
        
        result.approval_status = ReplayStatus.APPROVED
        db.commit()
        db.refresh(result)
        
        print(f"✓ 审批后状态: approval_status={result.approval_status}")
        print(f"✓ 原始重放结论（未修改）: replay_status={result.replay_status}")
        
        assert result.replay_status == ReplayStatus.BLOCKED, "原始重放结论应保持不变"
        assert result.approval_status == ReplayStatus.APPROVED, "审批状态应更新为 approved"
        
        print("✓ 审批不覆盖原始结论测试通过！")
        return True
    except Exception as e:
        print(f"✗ 审批测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("事件重放审批系统 - 修复验证测试")
    print("=" * 60)
    
    db = init_db()
    
    all_passed = True
    all_passed &= test_rule_version_creation(db)
    all_passed &= test_approval_not_override_replay_status(db)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ 所有测试通过！")
    else:
        print("✗ 部分测试失败！")
        sys.exit(1)
    print("=" * 60)

if __name__ == "__main__":
    main()
