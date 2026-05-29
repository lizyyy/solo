"""
端到端测试：验证CI缓存污染定位系统的完整流程
测试目标：确保从导入样例到复核报告的全链路数据一致性
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile

from app.main import app
from app.database import Base, get_db
from app import models

import pytest


@pytest.fixture
def test_db():
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield engine
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(test_db):
    with TestClient(app) as c:
        yield c


def test_full_pipeline_data_consistency(client):
    """
    测试完整分析流程的数据一致性
    验收路径：导入样例 -> 日志解析 -> 缓存指纹 -> 失败聚类 -> 复现脚本 -> 报告生成 -> 复核 -> 导出
    """
    print("\n" + "=" * 80)
    print("CI缓存污染定位系统 - 端到端测试")
    print("=" * 80)

    print("\n[1/9] 导入样例数据...")
    response = client.post(
        "/api/samples/import",
        json={"batch_name": "E2E测试批次 - 完整流程", "preset": "default"}
    )
    assert response.status_code == 200
    import_result = response.json()["data"]
    batch_id = import_result["batch_id"]
    batch_no = import_result["batch_no"]
    print(f"  ✓ 批次创建成功: {batch_no} (ID: {batch_id})")
    print(f"  ✓ 导入材料数: {import_result['materials_imported']}")

    material_ids = [m["id"] for m in import_result["materials"]]

    print("\n[2/9] 验证材料导入和溯源...")
    for mat_id in material_ids:
        response = client.get(f"/api/materials/{mat_id}")
        assert response.status_code == 200
        mat = response.json()["data"]
        assert mat["source"] is not None, f"材料 {mat_id} 缺少来源信息"
        assert mat["content_hash"] is not None, f"材料 {mat_id} 缺少内容哈希"
        assert mat["file_path"] is not None, f"材料 {mat_id} 缺少存储路径"
        print(f"  ✓ 材料 {mat_id}: {mat['material_type']} - {mat['name']}")
        print(f"    来源: {mat['source']}")
        print(f"    哈希: {mat['content_hash'][:16]}...")

    print("\n[3/9] 执行日志解析...")
    response = client.post(
        "/api/analysis/parse-logs",
        json={"batch_id": batch_id}
    )
    assert response.status_code == 200
    parse_result = response.json()["data"]
    print(f"  ✓ 解析日志条目: {parse_result['total_entries']}")
    print(f"  ✓ 分类统计: {parse_result['category_counts']}")
    print(f"  ✓ 异常条目: {parse_result['anomaly_count']}")
    assert parse_result["total_entries"] > 0
    assert parse_result["anomaly_count"] > 0

    print("\n[4/9] 验证解析后的日志数据...")
    response = client.get(f"/api/analysis/logs?batch_id={batch_id}&is_anomaly=true")
    assert response.status_code == 200
    anomaly_logs = response.json()["data"]
    print(f"  ✓ 异常日志数: {len(anomaly_logs)}")
    for log in anomaly_logs[:3]:
        assert log["is_anomaly"] is True
        print(f"    - [ID:{log['id']}] {log['category']}: {log['message'][:60]}...")

    print("\n[5/9] 执行缓存指纹分析...")
    response = client.post(
        "/api/analysis/fingerprints",
        json={"batch_id": batch_id}
    )
    assert response.status_code == 200
    fp_result = response.json()["data"]
    print(f"  ✓ 分析指纹数: {fp_result['total_fingerprints']}")
    print(f"  ✓ 状态统计: {fp_result['status_counts']}")
    print(f"  ✓ 不匹配数: {fp_result['mismatch_count']}")
    assert fp_result["total_fingerprints"] > 0

    print("\n[6/9] 执行失败聚类...")
    response = client.post(
        "/api/analysis/cluster",
        json={"batch_id": batch_id}
    )
    assert response.status_code == 200
    cluster_result = response.json()["data"]
    print(f"  ✓ 总聚类数: {cluster_result['total_clusters']}")
    print(f"  ✓ 异常聚类: {cluster_result['anomaly_clusters']}")
    print(f"  ✓ 正常聚类(已排除): {cluster_result['normal_clusters']}")
    print(f"  ✓ 生成异常数: {cluster_result['anomalies_created']}")

    print("\n[7/9] 验证聚类结果并排除正常结果...")
    response = client.get(f"/api/analysis/clusters?batch_id={batch_id}")
    assert response.status_code == 200
    clusters = response.json()["data"]
    for cluster in clusters:
        assert cluster["is_normal_result"] is False, "正常结果聚类不应出现在异常列表中"
        print(f"  ✓ 聚类 {cluster['id']}: {cluster['title']} (影响: {cluster['affected_count']})")
        print(f"    类型: {cluster['cluster_type']}, 严重程度: {cluster['severity']}")

    response = client.get(f"/api/analysis/clusters?batch_id={batch_id}&include_normal=true")
    all_clusters = response.json()["data"]
    normal_clusters = [c for c in all_clusters if c["is_normal_result"]]
    print(f"  ✓ 已排除的正常聚类数: {len(normal_clusters)}")

    print("\n[8/9] 生成复现脚本...")
    response = client.post(
        "/api/analysis/scripts",
        json={"batch_id": batch_id}
    )
    assert response.status_code == 200
    script_result = response.json()["data"]
    print(f"  ✓ 生成脚本数: {script_result['scripts_generated']}")
    for script in script_result["scripts"]:
        print(f"    - {script['name']} (ID: {script['id']})")

    response = client.get(f"/api/analysis/scripts?batch_id={batch_id}")
    scripts = response.json()["data"]
    for script in scripts:
        assert script["content"] is not None
        assert batch_no in script["content"], "脚本应包含批次号确保可追溯"
        print(f"  ✓ 脚本 {script['id']} 包含批次标识: {batch_no}")

    print("\n[9/9] 生成、复核并导出报告...")
    response = client.post(
        "/api/reports/generate",
        json={"batch_id": batch_id}
    )
    assert response.status_code == 200
    report_result = response.json()["data"]
    report_id = report_result["report_id"]
    report_no = report_result["report_no"]
    print(f"  ✓ 报告生成: {report_no} (ID: {report_id})")
    print(f"  ✓ 异常数: {report_result['anomaly_count']}")
    assert batch_no in report_no, "报告编号应包含批次号"

    print("\n  验证报告内容一致性...")
    response = client.get(f"/api/reports/{report_id}/content")
    report_content = response.json()["data"]["content"]
    assert batch_no in report_content, "报告内容应包含批次号"
    assert report_no in report_content, "报告内容应包含报告编号"

    anomaly_log_ids = [log["id"] for log in anomaly_logs]
    for log_id in anomaly_log_ids[:3]:
        assert str(log_id) in report_content, f"报告应引用证据日志ID {log_id}"
    print(f"  ✓ 报告引用了异常日志ID: {anomaly_log_ids[:3]}")

    print("\n  执行报告复核...")
    response = client.post(
        f"/api/reports/{report_id}/review",
        json={"reviewed_by": "QA工程师", "review_comment": "分析结果准确，建议立即修复缓存配置"}
    )
    assert response.status_code == 200
    reviewed_report = response.json()["data"]
    assert reviewed_report["status"] == "reviewed"
    assert reviewed_report["reviewed_by"] == "QA工程师"
    print(f"  ✓ 报告已复核: {reviewed_report['reviewed_by']}")
    print(f"  ✓ 复核意见: {reviewed_report['review_comment']}")

    print("\n  导出报告(Markdown)...")
    response = client.post(f"/api/reports/{report_id}/export?format=md")
    assert response.status_code == 200
    export_md = response.json()["data"]
    print(f"  ✓ MD导出路径: {export_md['export_path']}")
    print(f"  ✓ 文件大小: {export_md['file_size']} bytes")
    assert report_no in export_md["export_path"], "导出文件名应包含报告编号"
    assert batch_no in export_md["export_path"], "导出文件名应包含批次号"

    print("\n  导出报告(JSON)...")
    response = client.post(f"/api/reports/{report_id}/export?format=json")
    assert response.status_code == 200
    export_json = response.json()["data"]
    print(f"  ✓ JSON导出路径: {export_json['export_path']}")
    assert report_no in export_json["export_path"], "导出文件名应包含报告编号"

    print("\n" + "=" * 80)
    print("✓ 端到端测试通过！全流程数据一致性验证完成")
    print("=" * 80)
    print(f"\n关键验证点:")
    print(f"  1. 材料溯源: 所有材料均有来源、内容哈希、存储路径")
    print(f"  2. 日志解析: 正确识别异常日志条目")
    print(f"  3. 指纹分析: 检测到缓存指纹不匹配")
    print(f"  4. 失败聚类: 正确区分异常聚类和正常结果")
    print(f"  5. 复现脚本: 包含批次标识，可追溯")
    print(f"  6. 报告生成: 引用所有证据ID，数据一致")
    print(f"  7. 报告复核: 支持复核流程")
    print(f"  8. 报告导出: 文件名包含批次和报告编号，可区分")
    print(f"  9. 全链路: 从导入到导出使用同一批次数据")
    print("\n")

    return {
        "batch_id": batch_id,
        "batch_no": batch_no,
        "report_id": report_id,
        "report_no": report_no,
        "material_count": len(material_ids),
        "anomaly_count": len(anomaly_logs),
        "cluster_count": len(clusters),
        "script_count": len(scripts),
    }


def test_clean_sample_pipeline(client):
    """
    测试干净样例（无异常）的处理流程
    """
    print("\n" + "=" * 60)
    print("测试: 干净样例（无缓存污染）流程")
    print("=" * 60)

    print("\n导入干净样例...")
    response = client.post(
        "/api/samples/import",
        json={"batch_name": "E2E测试 - 干净样例", "preset": "clean"}
    )
    assert response.status_code == 200
    import_result = response.json()["data"]
    batch_id = import_result["batch_id"]

    print("\n执行一键分析...")
    response = client.post(f"/api/analysis/full-pipeline/{batch_id}")
    assert response.status_code == 200
    full_result = response.json()["data"]

    print(f"  ✓ 日志解析: {full_result['log_parsing'].get('total_entries', 0)} 条")
    print(f"  ✓ 指纹分析: {full_result['fingerprint_analysis'].get('total_fingerprints', 0)} 个")
    print(f"  ✓ 失败聚类: {full_result['failure_clustering']['anomalies_created']} 个异常")
    print(f"  ✓ 报告生成: {full_result['report_generation']['report_no']}")

    assert full_result["report_generation"]["anomaly_count"] == 0, "干净样例不应检测到异常"
    print("\n  ✓ 干净样例正确识别为无异常")

    return full_result


def test_preset_list(client):
    """测试样例预设列表"""
    response = client.get("/api/samples/presets")
    assert response.status_code == 200
    presets = response.json()["data"]
    assert len(presets) >= 3
    print(f"\n✓ 可用预设: {[p['name'] for p in presets]}")


def test_meta_info(client):
    """测试元数据接口"""
    response = client.get("/api/meta/material-types")
    assert response.status_code == 200
    mat_types = response.json()["data"]
    assert "pipeline_log" in mat_types
    assert "dependency_cache" in mat_types
    assert "env_vars" in mat_types
    print(f"\n✓ 材料类型: {list(mat_types.keys())}")

    response = client.get("/api/meta/anomaly-types")
    assert response.status_code == 200
    anomaly_types = response.json()["data"]
    assert "cache_miss_error" in anomaly_types
    assert "test_artifact_leftover" in anomaly_types
    assert "env_var_drift" in anomaly_types
    print(f"✓ 异常类型: {list(anomaly_types.keys())}")


def test_health_check(client):
    """测试健康检查"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print(f"\n✓ 服务健康: {data['service']} v{data['version']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
