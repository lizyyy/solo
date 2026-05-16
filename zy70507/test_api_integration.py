#!/usr/bin/env python3
"""多租户密钥托管API - FastAPI集成测试"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tempfile
from fastapi.testclient import TestClient
from main import app
from database import init_db, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
import json


class TestResult:
    def __init__(self, name: str, passed: bool, message: str = ""):
        self.name = name
        self.passed = passed
        self.message = message

    def __str__(self):
        status = "✓ PASS" if self.passed else "✗ FAIL"
        return f"{status} - {self.name}: {self.message}"


def setup_test_db():
    """创建内存数据库用于测试"""
    db_file = tempfile.mktemp(suffix=".db")
    DATABASE_URL = f"sqlite:///{db_file}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return db_file


def run_api_tests():
    print("=" * 70)
    print("多租户密钥托管API - FastAPI集成测试 (TestClient)")
    print("=" * 70)
    print()

    db_file = setup_test_db()
    client = TestClient(app)
    results = []

    TENANT_ID = "API-TEST-TENANT"
    key_version = None

    print("📋 测试1: 健康检查接口")
    print("-" * 70)
    try:
        response = client.get("/health")
        assert response.status_code == 200, f"状态码错误: {response.status_code}"
        data = response.json()
        assert data["status"] == "healthy", "健康状态错误"
        print("  ✓ 健康检查接口正常")
        results.append(TestResult("健康检查接口", True))
    except Exception as e:
        results.append(TestResult("健康检查接口", False, str(e)))
        print(f"  ✗ 健康检查失败: {e}")
    print()

    print("📋 测试2: 创建密钥接口 POST /api/v1/keys")
    print("-" * 70)
    try:
        response = client.post(
            "/api/v1/keys",
            json={
                "tenant_id": TENANT_ID,
                "purpose": "data_encryption",
                "encryption_material": "-----BEGIN TEST KEY----- API TEST MATERIAL",
                "metadata": {"source": "api-test", "algorithm": "AES-256"},
                "operator": "test-operator"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}, 响应: {response.text}"
        data = response.json()
        assert data["tenant_id"] == TENANT_ID, "tenant_id不匹配"
        assert data["status"] == "pending", "初始状态应该是pending"
        assert "key_version" in data, "缺少key_version字段"
        key_version = data["key_version"]
        print(f"  ✓ 密钥创建成功,版本号: {key_version}")
        results.append(TestResult("创建密钥接口", True))
    except Exception as e:
        results.append(TestResult("创建密钥接口", False, str(e)))
        print(f"  ✗ 创建密钥失败: {e}")
    print()

    print("📋 测试3: 查询密钥接口 POST /api/v1/keys/query")
    print("-" * 70)
    try:
        response = client.post(
            "/api/v1/keys/query",
            json={
                "tenant_id": TENANT_ID,
                "status": "pending"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "应该返回列表"
        assert len(data) >= 1, "应该至少有一条密钥记录"
        assert any(k["key_version"] == key_version for k in data), "查询不到刚创建的密钥"
        print(f"  ✓ 查询接口正常,找到 {len(data)} 条密钥")
        results.append(TestResult("查询密钥接口", True))
    except Exception as e:
        results.append(TestResult("查询密钥接口", False, str(e)))
        print(f"  ✗ 查询密钥失败: {e}")
    print()

    print("📋 测试4: 状态推进接口 POST /api/v1/keys/status (激活密钥)")
    print("-" * 70)
    try:
        response = client.post(
            "/api/v1/keys/status",
            json={
                "tenant_id": TENANT_ID,
                "key_version": key_version,
                "target_status": "active",
                "approved_by": "security-admin",
                "operator": "test-operator",
                "reason": "测试激活密钥"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}, 响应: {response.text}"
        data = response.json()
        assert data["status"] == "active", "状态应该变为active"
        assert data["key_version"] == key_version, "key_version不匹配"
        print(f"  ✓ 密钥激活成功,当前状态: {data['status']}")
        results.append(TestResult("状态推进接口(激活)", True))
    except Exception as e:
        results.append(TestResult("状态推进接口(激活)", False, str(e)))
        print(f"  ✗ 状态推进失败: {e}")
    print()

    print("📋 测试5: 密钥引用接口 POST /api/v1/keys/reference")
    print("-" * 70)
    try:
        response = client.post(
            "/api/v1/keys/reference",
            json={
                "tenant_id": TENANT_ID,
                "key_version": key_version,
                "data_batch_id": "BATCH-API-TEST-001",
                "purpose": "API测试数据批次",
                "metadata": {"record_count": 1000},
                "operator": "api-client"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}, 响应: {response.text}"
        data = response.json()
        assert data["data_batch_id"] == "BATCH-API-TEST-001", "批次ID不匹配"
        assert data["reference_count"] == 1, "引用计数应该是1"
        print(f"  ✓ 密钥引用成功,批次ID: {data['data_batch_id']}")

        response2 = client.post(
            "/api/v1/keys/reference",
            json={
                "tenant_id": TENANT_ID,
                "key_version": key_version,
                "data_batch_id": "BATCH-API-TEST-001",
                "purpose": "重复引用测试",
                "operator": "api-client"
            }
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["reference_count"] == 2, "重复引用计数应该是2"
        print(f"  ✓ 重复引用计数正确: {data2['reference_count']}")
        results.append(TestResult("密钥引用接口", True))
    except Exception as e:
        results.append(TestResult("密钥引用接口", False, str(e)))
        print(f"  ✗ 密钥引用失败: {e}")
    print()

    print("📋 测试6: 查询引用记录接口 GET /api/v1/references/{tenant_id}")
    print("-" * 70)
    try:
        response = client.get(f"/api/v1/references/{TENANT_ID}")
        assert response.status_code == 200, f"状态码错误: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "应该返回列表"
        assert len(data) >= 1, "应该至少有一条引用记录"
        print(f"  ✓ 引用记录查询成功,共 {len(data)} 条记录")
        results.append(TestResult("查询引用接口", True))
    except Exception as e:
        results.append(TestResult("查询引用接口", False, str(e)))
        print(f"  ✗ 查询引用记录失败: {e}")
    print()

    print("📋 测试7: 人工修正接口 POST /api/v1/keys/correct")
    print("-" * 70)
    try:
        response = client.post(
            "/api/v1/keys/correct",
            json={
                "tenant_id": TENANT_ID,
                "key_version": key_version,
                "field_updates": {
                    "encryption_material": "-----BEGIN CORRECTED KEY-----",
                    "is_protected": True,
                    "metadata": {"corrected": True, "by": "api-test"}
                },
                "operator": "admin-user",
                "reason": "测试人工修正密钥"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}, 响应: {response.text}"
        data = response.json()
        assert data["key_version"] == key_version, "key_version不匹配"
        print(f"  ✓ 人工修正成功")
        results.append(TestResult("人工修正接口", True))
    except Exception as e:
        results.append(TestResult("人工修正接口", False, str(e)))
        print(f"  ✗ 人工修正失败: {e}")
    print()

    print("📋 测试8: 导出报告接口 POST /api/v1/reports/export")
    print("-" * 70)
    try:
        response = client.post(
            "/api/v1/reports/export",
            json={
                "tenant_id": TENANT_ID,
                "report_type": "full_escrow",
                "operator": "audit-admin"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}, 响应: {response.text}"
        data = response.json()
        assert "report_id" in data, "缺少report_id"
        assert "content" in data, "缺少content"
        assert data["tenant_id"] == TENANT_ID, "tenant_id不匹配"
        content = data["content"]
        assert "key_summary" in content, "报告缺少key_summary"
        assert "operation_summary" in content, "报告缺少operation_summary"
        assert "conclusions" in content, "报告缺少conclusions"
        print(f"  ✓ 报告导出成功,报告ID: {data['report_id']}")
        results.append(TestResult("导出报告接口", True))
    except Exception as e:
        results.append(TestResult("导出报告接口", False, str(e)))
        print(f"  ✗ 导出报告失败: {e}")
    print()

    print("📋 测试9: 查询操作日志接口 GET /api/v1/logs/{tenant_id}")
    print("-" * 70)
    try:
        response = client.get(f"/api/v1/logs/{TENANT_ID}")
        assert response.status_code == 200, f"状态码错误: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "应该返回列表"
        assert len(data) >= 5, f"应该至少有5条操作日志,实际有{len(data)}条"
        success_count = sum(1 for log in data if log.get("success"))
        print(f"  ✓ 操作日志查询成功,共 {len(data)} 条,成功: {success_count}")
        results.append(TestResult("查询操作日志接口", True))
    except Exception as e:
        results.append(TestResult("查询操作日志接口", False, str(e)))
        print(f"  ✗ 查询操作日志失败: {e}")
    print()

    print("📋 测试10: 状态推进接口 (停用受保护密钥)")
    print("-" * 70)
    try:
        response = client.post(
            "/api/v1/keys/status",
            json={
                "tenant_id": TENANT_ID,
                "key_version": key_version,
                "target_status": "deactivated",
                "operator": "test-operator",
                "reason": "测试停用受保护密钥,必须提供理由"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}, 响应: {response.text}"
        data = response.json()
        assert data["status"] == "deactivated", "状态应该变为deactivated"
        print(f"  ✓ 受保护密钥停用成功,当前状态: {data['status']}")
        results.append(TestResult("状态推进接口(停用)", True))
    except Exception as e:
        results.append(TestResult("状态推进接口(停用)", False, str(e)))
        print(f"  ✗ 密钥停用失败: {e}")
    print()

    print("=" * 70)
    print("API集成测试汇总")
    print("=" * 70)
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    for result in results:
        print(result)
    print()
    print(f"结果: {passed}/{total} 测试通过")

    # 清理
    try:
        os.unlink(db_file)
    except:
        pass

    if passed == total:
        print("\n🎉 所有API接口测试通过！FastAPI依赖注入修复成功。")
        return 0
    else:
        print("\n❌ 部分API测试失败，请检查代码。")
        return 1


if __name__ == "__main__":
    exit_code = run_api_tests()
    sys.exit(exit_code)
