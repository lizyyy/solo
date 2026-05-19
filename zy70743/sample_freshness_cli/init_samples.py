#!/usr/bin/env python3
"""初始化测试样例数据
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from core.models import Sample, LanguageType, SampleStatus
from core.storage import StorageManager

storage = StorageManager()

samples = [
    Sample(
        sample_id="S001",
        name="正常用户查询",
        description="正常输入的用户查询样例",
        language=LanguageType.PYTHON,
        api_endpoint="/api/v1/users",
        api_version="2.0.0",
        expected_api_version="2.0.0",
        code_content="""
import requests

response = requests.get('/api/v1/users', params={'id': 123})
print(response.json())
        """,
        input_data={"user_id": 123},
        expected_output={"id": 123, "name": "张三", "email": "test@example.com"},
        status=SampleStatus.ACTIVE,
        tags=["正常", "用户", "GET"],
    ),
    Sample(
        sample_id="S002",
        name="脏数据测试",
        description="包含非法字符的脏数据样例",
        language=LanguageType.PYTHON,
        api_endpoint="/api/v1/users",
        api_version="2.0.0",
        expected_api_version="2.0.0",
        code_content="""
import requests

data = {'name': '<script>alert(1)</script>'}
response = requests.post('/api/v1/users', json=data)
        """,
        input_data={"name": "<script>alert(1)</script>"},
        expected_output={"success": True},
        status=SampleStatus.ACTIVE,
        tags=["脏数据", "安全"],
    ),
    Sample(
        sample_id="S003",
        name="边界冲突测试",
        description="请求频率超限的边界情况",
        language=LanguageType.CURL,
        api_endpoint="/api/v1/orders",
        api_version="1.5.0",
        expected_api_version="1.5.0",
        code_content="""
curl -X GET /api/v1/orders?page=999999
        """,
        input_data={"page": 999999},
        expected_output={"error": "rate_limit_exceeded"},
        status=SampleStatus.ACTIVE,
        tags=["边界冲突", "限流"],
    ),
    Sample(
        sample_id="S004",
        name="空结果查询",
        description="查询无数据返回的情况",
        language=LanguageType.JAVASCRIPT,
        api_endpoint="/api/v1/products",
        api_version="3.0.0",
        expected_api_version="3.0.0",
        code_content="""
fetch('/api/v1/products?id=999999')
  .then(res => res.json())
  .then(data => console.log(data))
        """,
        input_data={"product_id": 999999},
        expected_output={"data": [], "total": 0},
        status=SampleStatus.ACTIVE,
        tags=["空结果", "404"],
    ),
    Sample(
        sample_id="S005",
        name="版本不匹配样例",
        description="API版本已升级但样例未更新",
        language=LanguageType.PYTHON,
        api_endpoint="/api/v1/users",
        api_version="1.0.0",
        expected_api_version="2.0.0",
        code_content="""
import requests

# 旧版本API调用
response = requests.get('/api/v1/users/123')
        """,
        input_data={"user_id": 123},
        expected_output={"id": 123},
        status=SampleStatus.ACTIVE,
        tags=["版本不匹配", "已过时"],
    ),
    Sample(
        sample_id="S006",
        name="API字段变更样例",
        description="接口字段已变更的情况",
        language=LanguageType.PYTHON,
        api_endpoint="/api/v1/auth",
        api_version="1.0.0",
        expected_api_version="1.0.0",
        code_content="""
import requests

response = requests.post('/api/v1/auth', json={
    'user_name': 'test',
    'password': '123456'
})
        """,
        input_data={"user_name": "test", "password": "123456"},
        expected_output={"token": "xxx"},
        status=SampleStatus.ACTIVE,
        tags=["API变更", "字段错误"],
    ),
]

for sample in samples:
    storage.save_sample(sample)
    print(f"✓ 已添加样例: {sample.sample_id} - {sample.name}")

print(f"\n共初始化 {len(samples)} 个测试样例")
