#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
from app.models import ReplayResult

print("=" * 60)
print("验证修复 #1: response_body 非JSON时不崩溃")
print("=" * 60)

# 测试纯文本响应体
result1 = ReplayResult(
    request_id='test-001',
    environment_id=1,
    status='success',
    response_body='<html><body>Plain HTML response</body></html>'
)
try:
    dict1 = result1.to_dict()
    print(f"✓ HTML响应体解析成功: {dict1['response_body']}")
except Exception as e:
    print(f"✗ HTML响应体解析失败: {e}")
    sys.exit(1)

# 测试JSON响应体
result2 = ReplayResult(
    request_id='test-002',
    environment_id=1,
    status='success',
    response_body='{"code": 200, "message": "success"}'
)
try:
    dict2 = result2.to_dict()
    print(f"✓ JSON响应体解析成功: {dict2['response_body']}")
except Exception as e:
    print(f"✗ JSON响应体解析失败: {e}")
    sys.exit(1)

# 测试普通纯文本
result3 = ReplayResult(
    request_id='test-003',
    environment_id=1,
    status='success',
    response_body='Hello World! This is plain text.'
)
try:
    dict3 = result3.to_dict()
    print(f"✓ 纯文本响应体解析成功: {dict3['response_body']}")
except Exception as e:
    print(f"✗ 纯文本响应体解析失败: {e}")
    sys.exit(1)

# 测试空响应体
result4 = ReplayResult(
    request_id='test-004',
    environment_id=1,
    status='success',
    response_body=None
)
try:
    dict4 = result4.to_dict()
    print(f"✓ 空响应体解析成功: {dict4['response_body']}")
except Exception as e:
    print(f"✗ 空响应体解析失败: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("验证修复 #2: 授权校验绕过问题")
print("=" * 60)

# 启动Flask应用进行API测试
from app import create_app
from app.models import db, ReplayEnvironment, OriginalRequest, AuthorizationRecord
from datetime import datetime, timedelta

app = create_app()

with app.app_context():
    # 清理测试数据
    try:
        AuthorizationRecord.query.delete()
        OriginalRequest.query.delete()
        ReplayEnvironment.query.delete()
        db.session.commit()
    except:
        pass
    
    # 创建测试环境（需要审批）
    env = ReplayEnvironment(
        name='生产环境(需审批)',
        base_url='https://httpbin.org',
        description='测试环境',
        requires_approval=True,
        headers='{}'
    )
    db.session.add(env)
    db.session.commit()
    print(f"✓ 创建需要审批的环境 ID={env.id}")
    
    # 创建测试请求
    req = OriginalRequest(
        request_id='test-req-001',
        method='GET',
        url='/get',
        headers='{}',
        body='{}',
        source='test'
    )
    db.session.add(req)
    db.session.commit()
    print(f"✓ 创建测试请求 ID={req.request_id}")
    
    # 测试1: 不传authorization_id，应该失败
    from app.services import ReplayExecutor
    
    result, error = ReplayExecutor.execute_replay(
        request_id=req.request_id,
        environment_id=env.id,
        user='test-user'
    )
    if error and "需要审批" in error:
        print(f"✓ 不传authorization_id正确拒绝: {error}")
    else:
        print(f"✗ 不传authorization_id应该失败但没失败: result={result}, error={error}")
        sys.exit(1)
    
    # 测试2: 传入无效authorization_id，应该失败
    result, error = ReplayExecutor.execute_replay(
        request_id=req.request_id,
        environment_id=env.id,
        user='test-user',
        authorization_id=999  # 不存在的ID
    )
    if error and ("授权记录无效" in error or "需要审批" in error):
        print(f"✓ 无效authorization_id正确拒绝: {error}")
    else:
        print(f"✗ 无效authorization_id应该失败但没失败: result={result}, error={error}")
        sys.exit(1)
    
    # 测试3: 创建pending状态的授权，应该失败
    auth_pending = AuthorizationRecord(
        request_id=req.request_id,
        environment_id=env.id,
        requester='test-user',
        status='pending',
        reason='测试',
        requested_at=datetime.utcnow()
    )
    db.session.add(auth_pending)
    db.session.commit()
    
    result, error = ReplayExecutor.execute_replay(
        request_id=req.request_id,
        environment_id=env.id,
        user='test-user',
        authorization_id=auth_pending.id  # pending状态，未批准
    )
    if error and ("授权记录无效" in error or "未批准" in error):
        print(f"✓ pending状态授权正确拒绝: {error}")
    else:
        print(f"✗ pending状态授权应该失败但没失败: result={result}, error={error}")
        sys.exit(1)
    
    # 测试4: approved状态的授权，应该成功
    auth_approved = AuthorizationRecord(
        request_id=req.request_id,
        environment_id=env.id,
        requester='test-user',
        approver='admin',
        status='approved',
        reason='测试审批',
        requested_at=datetime.utcnow(),
        approved_at=datetime.utcnow()
    )
    db.session.add(auth_approved)
    db.session.commit()
    
    result, error = ReplayExecutor.execute_replay(
        request_id=req.request_id,
        environment_id=env.id,
        user='test-user',
        authorization_id=auth_approved.id
    )
    if result and not error:
        print(f"✓ approved状态授权执行成功: status={result.status}")
    else:
        print(f"✗ approved状态授权应该成功但失败了: result={result}, error={error}")
        sys.exit(1)
    
    # 测试5: 不传authorization_id但存在有效授权，应该自动找到授权
    result, error = ReplayExecutor.execute_replay(
        request_id=req.request_id,
        environment_id=env.id,
        user='test-user'
    )
    if result and not error:
        print(f"✓ 不传authorization_id但有有效授权，执行成功")
    else:
        print(f"✗ 不传authorization_id但有有效授权，应该成功但失败了: {error}")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✓ 所有测试通过！")
    print("=" * 60)
