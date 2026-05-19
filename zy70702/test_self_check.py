import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    print("=" * 60)
    print("测试1: 模块导入")
    print("=" * 60)
    try:
        from fastapi import FastAPI
        from sqlalchemy import create_engine
        from main import app, PackageStatus, ErrorCode, get_db
        print("✓ FastAPI 导入成功")
        print("✓ SQLAlchemy 导入成功")
        print("✓ 主程序模块导入成功")
        print("✓ 状态机枚举导入成功")
        return True
    except Exception as e:
        print(f"✗ 导入失败: {e}")
        return False

def test_database_operations():
    print("\n" + "=" * 60)
    print("测试2: 数据库操作")
    print("=" * 60)
    try:
        from sqlalchemy.orm import Session
        from main import engine, Base, PackageVersion, WithdrawRequest, DependentProject, PackageStatus
        Base.metadata.create_all(bind=engine)
        print("✓ 数据库表创建成功")
        with Session(engine) as db:
            test_pkg = PackageVersion(
                package_name="test-pkg",
                version="1.0.0",
                publisher="tester",
                dependencies=json.dumps(["dep1", "dep2"])
            )
            db.add(test_pkg)
            db.commit()
            print("✓ 包版本创建成功")
            pkg = db.query(PackageVersion).filter(
                PackageVersion.package_name == "test-pkg",
                PackageVersion.version == "1.0.0"
            ).first()
            assert pkg is not None
            assert pkg.status == PackageStatus.PUBLISHED.value
            print("✓ 包版本查询成功")
            for i in range(7):
                dep = DependentProject(
                    project_name=f"project-{i}",
                    package_name="test-pkg",
                    version_constraint=">=1.0.0",
                    owner=f"owner-{i}"
                )
                db.add(dep)
            db.commit()
            print("✓ 依赖项目创建成功")
        return True
    except Exception as e:
        print(f"✗ 数据库操作失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_api_endpoints():
    print("\n" + "=" * 60)
    print("测试3: API 端点")
    print("=" * 60)
    try:
        from fastapi.testclient import TestClient
        from main import app, PackageStatus, ErrorCode
        client = TestClient(app)
        print("✓ TestClient 创建成功")
        response = client.post(
            "/api/packages/",
            json={
                "package_name": "api-test-pkg",
                "version": "2.0.0",
                "publisher": "api-tester",
                "dependencies": ["dep-a", "dep-b"]
            }
        )
        assert response.status_code == 200
        print("✓ 包创建 API 成功")
        response = client.post(
            "/api/packages/",
            json={"package_name": "", "version": "1.0.0", "publisher": ""}
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == ErrorCode.MISSING_FIELD.value
        print("✓ 缺字段错误响应正确")
        response = client.post(
            "/api/withdraw-requests/",
            json={
                "package_name": "api-test-pkg",
                "version": "2.0.0",
                "requester": "user123",
                "reason": "误发版本"
            }
        )
        assert response.status_code == 200
        data = response.json()
        request_id = data["request_id"]
        print(f"✓ 撤回申请创建成功, request_id: {request_id}")
        response = client.post(
            "/api/withdraw-requests/",
            json={
                "package_name": "api-test-pkg",
                "version": "2.0.0",
                "requester": "user456",
                "request_id": "different-request-id"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] in [ErrorCode.ALREADY_PROCESSED.value, ErrorCode.DUPLICATE_REQUEST.value]
        print("✓ 重复撤回申请幂等检查正确")
        response = client.post(f"/api/withdraw-requests/{request_id}/calculate-impact")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == PackageStatus.PENDING_ARBITRATION.value
        print("✓ 依赖影响计算成功")
        print(f"  - 影响项目数: {data['total_impacted']}")
        print(f"  - 关键影响: {data['critical_impact']}")
        return request_id
    except Exception as e:
        print(f"✗ API 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_arbitration_flow(request_id):
    print("\n" + "=" * 60)
    print("测试4: 仲裁流程")
    print("=" * 60)
    if not request_id:
        print("✗ 跳过仲裁测试（无有效 request_id）")
        return False
    try:
        from fastapi.testclient import TestClient
        from main import app, ArbitrationResult, ErrorCode, PackageStatus
        client = TestClient(app)
        response = client.get(f"/api/impact-reports/{request_id}")
        impact_data = response.json()
        has_critical_impact = impact_data.get("critical_impact", False)
        if has_critical_impact:
            response = client.post(
                "/api/arbitrations/",
                json={
                    "request_id": request_id,
                    "arbitrator": "admin",
                    "result": ArbitrationResult.APPROVED.value,
                    "comment": "短"
                }
            )
            assert response.status_code == 400
            data = response.json()
            assert data["error_code"] == ErrorCode.NEED_MANUAL_REVIEW.value
            print("✓ 关键影响需要人工复核验证正确")
        response = client.post(
            "/api/arbitrations/",
            json={
                "request_id": request_id,
                "arbitrator": "admin",
                "result": ArbitrationResult.APPROVED.value,
                "comment": "经过详细评估，该版本确实存在严重问题，批准撤回"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["result"] == "approved"
        assert data["package_status"] == PackageStatus.WITHDRAWN.value
        print("✓ 仲裁批准成功")
        response = client.post(
            "/api/arbitrations/",
            json={
                "request_id": request_id,
                "arbitrator": "admin2",
                "result": ArbitrationResult.REJECTED.value
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == ErrorCode.ALREADY_PROCESSED.value
        print("✓ 重复仲裁检查正确")
        return True
    except Exception as e:
        print(f"✗ 仲裁流程测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_filter_and_export():
    print("\n" + "=" * 60)
    print("测试5: 筛选和导出")
    print("=" * 60)
    try:
        from fastapi.testclient import TestClient
        from main import app
        client = TestClient(app)
        response = client.get("/api/withdraw-requests/")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ 获取所有撤回申请成功, 共 {len(data)} 条")
        response = client.get("/api/withdraw-requests/", params={"status": "withdrawn"})
        assert response.status_code == 200
        data = response.json()
        print(f"✓ 按状态筛选成功, 撤回状态共 {len(data)} 条")
        response = client.get("/api/withdraw-requests/", params={"package_name": "api-test-pkg"})
        assert response.status_code == 200
        data = response.json()
        print(f"✓ 按包名筛选成功, 共 {len(data)} 条")
        if data:
            request_id = data[0]["request_id"]
            response = client.get(f"/api/impact-reports/{request_id}")
            assert response.status_code == 200
            report = response.json()
            export_data = {
                "export_time": datetime.utcnow().isoformat(),
                "request_id": request_id,
                "impact_report": report
            }
            export_path = "/tmp/impact_report_export.json"
            with open(export_path, "w") as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            print(f"✓ 影响报告导出成功: {export_path}")
            print(f"  - 影响项目数: {report['total_impacted']}")
            print(f"  - 关键影响: {report['critical_impact']}")
        return True
    except Exception as e:
        print(f"✗ 筛选和导出测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_error_scenarios():
    print("\n" + "=" * 60)
    print("测试6: 错误场景验证")
    print("=" * 60)
    try:
        from fastapi.testclient import TestClient
        from main import app, ErrorCode, PackageStatus
        client = TestClient(app)
        response = client.post(
            "/api/withdraw-requests/",
            json={
                "package_name": "nonexistent-pkg",
                "version": "1.0.0",
                "requester": "user"
            }
        )
        assert response.status_code == 404
        data = response.json()
        assert data["error_code"] == ErrorCode.NOT_FOUND.value
        print("✓ 包不存在错误响应正确")
        response = client.post("/api/withdraw-requests/invalid-id/calculate-impact")
        assert response.status_code == 404
        data = response.json()
        assert data["error_code"] == ErrorCode.NOT_FOUND.value
        print("✓ 撤回申请不存在错误响应正确")
        response = client.post(
            "/api/arbitrations/",
            json={
                "request_id": "invalid-id",
                "arbitrator": "admin",
                "result": "approved"
            }
        )
        assert response.status_code == 404
        data = response.json()
        assert data["error_code"] == ErrorCode.NOT_FOUND.value
        print("✓ 仲裁申请不存在错误响应正确")
        client.post(
            "/api/packages/",
            json={
                "package_name": "status-test-pkg",
                "version": "1.0.0",
                "publisher": "tester"
            }
        )
        response = client.post(
            "/api/withdraw-requests/",
            json={
                "package_name": "status-test-pkg",
                "version": "1.0.0",
                "requester": "user"
            }
        )
        request_id = response.json()["request_id"]
        response = client.post(
            "/api/arbitrations/",
            json={
                "request_id": request_id,
                "arbitrator": "admin",
                "result": "approved"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == ErrorCode.INVALID_STATUS.value
        print("✓ 状态不允许错误响应正确")
        return True
    except Exception as e:
        print(f"✗ 错误场景测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "=" * 60)
    print("包撤回依赖影响仲裁系统 - 自检脚本")
    print("=" * 60)
    results = {}
    results["imports"] = test_imports()
    results["database"] = test_database_operations()
    request_id = test_api_endpoints()
    results["api"] = request_id is not None
    results["arbitration"] = test_arbitration_flow(request_id)
    results["filter_export"] = test_filter_and_export()
    results["error_scenarios"] = test_error_scenarios()
    print("\n" + "=" * 60)
    print("自检结果汇总")
    print("=" * 60)
    all_passed = True
    for test_name, passed in results.items():
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"{status} - {test_name}")
        if not passed:
            all_passed = False
    print("=" * 60)
    if all_passed:
        print("✓ 所有测试通过！系统运行正常")
        return 0
    else:
        print("✗ 部分测试失败，请检查错误信息")
        return 1

if __name__ == "__main__":
    sys.exit(main())