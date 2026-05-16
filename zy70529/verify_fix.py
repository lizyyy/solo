from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from app.database import Base, get_db
from app.models import CompensationStrategy

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

print("=" * 60)
print("验证：失败路径保存原始输入、处理依据和最终结论")
print("=" * 60)

# 1. 创建补偿记录
print("\n[步骤1] 创建补偿记录...")
create_response = client.post(
    "/api/v1/compensation/records",
    json={
        "queue_name": "test_queue",
        "message_id": "msg_verify_001",
        "business_no": "ORD_VERIFY_001",
        "strategy": CompensationStrategy.RETRY_THREE,
        "original_input": {
            "order_id": "ORD_12345",
            "amount": 999.99,
            "customer_id": "CUST_001",
            "extra_data": "测试原始输入数据"
        }
    }
)
print(f"创建状态码: {create_response.status_code}")
record_id = create_response.json()["id"]
print(f"记录ID: {record_id}")

# 2. 开始处理
print("\n[步骤2] 开始处理记录...")
process_response = client.post(f"/api/v1/compensation/records/{record_id}/process")
print(f"处理状态码: {process_response.status_code}")
print(f"当前状态: {process_response.json()['status']}")

# 3. 标记失败，传入完整信息
print("\n[步骤3] 标记处理失败（传入错误信息、处理依据、最终结论）...")
failure_response = client.post(
    f"/api/v1/compensation/records/{record_id}/failure",
    params={
        "error_message": "调用支付网关超时，错误码: PAY_500_TIMEOUT",
        "process_basis": "根据《支付补偿处理规范》第3.2条，网络超时需记录完整上下文并进入重试队列",
        "final_conclusion": "已记录失败，系统将自动重试3次，如仍失败则转人工处理"
    }
)
print(f"失败接口状态码: {failure_response.status_code}")
failure_data = failure_response.json()

# 4. 验证所有字段
print("\n" + "=" * 60)
print("[验证结果]")
print("=" * 60)

# 验证原始输入
print(f"\n 原始输入验证:")
print(f"   原始输入: {failure_data.get('original_input')}")
assert failure_data.get('original_input') is not None, "原始输入不应为None"
assert failure_data['original_input']['order_id'] == "ORD_12345", "原始输入order_id不匹配"
print("   ✓ 原始输入保存正确")

# 验证处理依据
print(f"\n 处理依据验证:")
print(f"   处理依据: {failure_data.get('process_basis')}")
assert failure_data.get('process_basis') is not None, "处理依据不应为None"
assert "支付补偿处理规范" in failure_data['process_basis'], "处理依据内容不匹配"
print("   ✓ 处理依据保存正确")

# 验证最终结论
print(f"\n 最终结论验证:")
print(f"   最终结论: {failure_data.get('final_conclusion')}")
assert failure_data.get('final_conclusion') is not None, "最终结论不应为None"
assert "自动重试3次" in failure_data['final_conclusion'], "最终结论内容不匹配"
print("   ✓ 最终结论保存正确")

# 验证错误信息
print(f"\n 错误信息验证:")
print(f"   错误信息: {failure_data.get('error_message')}")
assert failure_data.get('error_message') is not None, "错误信息不应为None"
print("   ✓ 错误信息保存正确")

# 验证重试计数
print(f"\n 重试次数验证:")
print(f"   当前重试次数: {failure_data.get('retry_count')}")
print(f"   最大重试次数: {failure_data.get('max_retry')}")
assert failure_data['retry_count'] == 1, "重试次数应该是1"
assert failure_data['max_retry'] == 3, "最大重试次数应该是3"
print("   ✓ 重试次数正确")

# 5. 验证导出字段
print("\n" + "=" * 60)
print("[导出字段验证]")
print("=" * 60)

export_response = client.post(
    "/api/v1/compensation/export",
    json={"queue_name": "test_queue"}
)
export_result = export_response.json()
print(f"\n导出成功: {export_result.get('success')}")
print(f"导出文件路径: {export_result.get('file_path')}")
print(f"导出记录数: {export_result.get('total_count')}")

# 6. 从数据库直接查询验证
db = TestingSessionLocal()
from app.models import CompensationRecord
record = db.query(CompensationRecord).filter(CompensationRecord.id == record_id).first()

print(f"\n数据库直查验证:")
print(f"   - 原始输入: {record.original_input}")
print(f"   - 处理依据: {record.process_basis}")
print(f"   - 最终结论: {record.final_conclusion}")
print(f"   - 错误信息: {record.error_message}")
print(f"   - 消费状态: {record.status}")
print(f"   - 业务单据号: {record.business_no}")

# 检查所有字段都不为空
assert record.original_input is not None, "数据库中原始输入为空"
assert record.process_basis is not None, "数据库中处理依据为空"
assert record.final_conclusion is not None, "数据库中最终结论为空"
assert record.error_message is not None, "数据库中错误信息为空"

print("\n" + "=" * 60)
print(" 所有验证通过！失败路径完整保存了:")
print("   - 原始输入 (original_input)")
print("   - 处理依据 (process_basis)")
print("   - 最终结论 (final_conclusion)")
print("   - 错误信息 (error_message)")
print("=" * 60)
