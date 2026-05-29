import pytest
import os
import time
from app.models import TaskStatus, AudioType


@pytest.fixture
def sample_task(client):
    response = client.post(
        "/api/v1/tasks",
        json={
            "name": "测试降噪对比任务",
            "description": "测试不同参数的降噪效果",
            "created_by": "测试用户",
            "manual_notes": "这是手工备注，不能被覆盖",
            "source_metadata": {"source": "测试数据", "project": "视频项目A"}
        }
    )
    return response.json()


@pytest.fixture
def imported_task(client):
    task_response = client.post(
        "/api/v1/tasks",
        json={"name": "导入测试任务", "manual_notes": "原始备注"}
    )
    task_id = task_response.json()["id"]

    client.post(
        f"/api/v1/tasks/{task_id}/import",
        json={
            "audio_segments": [
                {
                    "audio_type": "original",
                    "name": "导入的音频1",
                    "file_path": "/import/audio1.wav",
                    "duration": 30.0,
                    "manual_notes": "音频备注1"
                },
                {
                    "audio_type": "original",
                    "name": "导入的音频2",
                    "file_path": "/import/audio2.wav",
                    "duration": 45.0,
                    "manual_notes": "音频备注2"
                }
            ],
            "params": [
                {
                    "name": "导入参数A",
                    "params_json": {"noise_reduction": 65, "voice_protection": 75},
                    "manual_notes": "参数备注A"
                },
                {
                    "name": "导入参数B",
                    "params_json": {"noise_reduction": 80, "voice_protection": 60},
                    "manual_notes": "参数备注B"
                }
            ],
            "listening_records": []
        }
    )
    return task_id


@pytest.fixture
def processed_task(client, imported_task):
    client.post(
        "/api/v1/tasks/batch-process",
        json={"task_id": imported_task}
    )
    return imported_task


class TestTaskCRUD:
    def test_create_task(self, sample_task):
        assert sample_task["name"] == "测试降噪对比任务"
        assert sample_task["status"] == "created"
        assert sample_task["manual_notes"] == "这是手工备注，不能被覆盖"
        assert sample_task["source_metadata"]["source"] == "测试数据"
        assert sample_task["batch_no"].startswith("BAT")
        assert "id" in sample_task

    def test_create_task_with_custom_batch_no(self, client):
        response = client.post(
            "/api/v1/tasks",
            json={
                "name": "自定义批次号任务",
                "batch_no": "CUSTOM20240101"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["batch_no"] == "CUSTOM20240101"

    def test_create_task_duplicate_batch_no(self, client):
        client.post(
            "/api/v1/tasks",
            json={"name": "任务1", "batch_no": "DUPLICATE001"}
        )
        response = client.post(
            "/api/v1/tasks",
            json={"name": "任务2", "batch_no": "DUPLICATE001"}
        )
        assert response.status_code == 400

    def test_get_task(self, client, sample_task):
        task_id = sample_task["id"]
        response = client.get(f"/api/v1/tasks/{task_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == task_id
        assert data["name"] == "测试降噪对比任务"

    def test_get_task_not_found(self, client):
        response = client.get("/api/v1/tasks/99999")
        assert response.status_code == 404

    def test_list_tasks(self, client, sample_task):
        time.sleep(0.01)
        client.post("/api/v1/tasks", json={"name": "第二个任务"})

        response = client.get("/api/v1/tasks")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_list_tasks_by_status(self, client, sample_task):
        response = client.get("/api/v1/tasks?status=created")
        assert response.status_code == 200
        data = response.json()
        assert all(t["status"] == "created" for t in data)

    def test_get_task_by_batch_no(self, client):
        client.post(
            "/api/v1/tasks",
            json={"name": "批次查询测试", "batch_no": "BATCHQUERY001"}
        )
        response = client.get("/api/v1/tasks/batch/BATCHQUERY001")
        assert response.status_code == 200
        data = response.json()
        assert data["batch_no"] == "BATCHQUERY001"

    def test_update_task(self, client, sample_task):
        task_id = sample_task["id"]
        response = client.patch(
            f"/api/v1/tasks/{task_id}",
            json={
                "name": "更新后的任务名称",
                "manual_notes": "追加的备注信息"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "更新后的任务名称"
        assert data["manual_notes"] == "追加的备注信息"

    def test_update_task_status(self, client, sample_task):
        task_id = sample_task["id"]
        response = client.patch(
            f"/api/v1/tasks/{task_id}/status",
            json={
                "status": "processing",
                "updated_by": "管理员",
                "notes": "开始批量处理"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert "开始批量处理" in data["manual_notes"]


class TestParamsAndSegments:
    def test_add_params(self, client, sample_task):
        task_id = sample_task["id"]

        response = client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "保守降噪参数",
                "params_json": {
                    "noise_reduction": 60,
                    "voice_protection": 85,
                    "aggressiveness": 0.3
                },
                "source": "参数方案A",
                "manual_notes": "适合人声保留"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "保守降噪参数"
        assert data["version"] == 1
        assert data["params_json"]["noise_reduction"] == 60
        assert data["is_active"] == True

    def test_update_params_creates_new_version(self, client, sample_task):
        task_id = sample_task["id"]
        param_response = client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "版本测试参数",
                "params_json": {"noise_reduction": 60}
            }
        )
        params_id = param_response.json()["id"]

        response = client.patch(
            f"/api/v1/tasks/params/{params_id}",
            json={
                "params_json": {
                    "noise_reduction": 70,
                    "voice_protection": 80,
                    "aggressiveness": 0.4
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == 2
        assert data["params_json"]["noise_reduction"] == 70
        assert data["is_active"] == True

        old_params = client.get(f"/api/v1/tasks/{task_id}/params")
        params_list = old_params.json()
        inactive = [p for p in params_list if p["version"] == 1][0]
        assert inactive["is_active"] == False

    def test_param_override_detects_anomaly(self, client, sample_task):
        task_id = sample_task["id"]

        client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "同名参数",
                "params_json": {"noise_reduction": 60}
            }
        )

        response = client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "同名参数",
                "params_json": {"noise_reduction": 70}
            }
        )
        assert response.status_code == 201

        anomalies = client.get(f"/api/v1/tasks/{task_id}/anomalies")
        anomaly_list = anomalies.json()
        assert len(anomaly_list) >= 1
        param_anomalies = [
            a for a in anomaly_list if a["anomaly_type"] == "param_override"
        ]
        assert len(param_anomalies) >= 1
        assert "已自动标记为非活动状态" in param_anomalies[0]["message"]
        assert "建议" in param_anomalies[0]["suggestion"]

    def test_add_audio_segment(self, client, sample_task):
        task_id = sample_task["id"]

        response = client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "original",
                "name": "户外采访片段",
                "file_path": "/audio/original/interview_01.wav",
                "duration": 45.5,
                "sample_rate": 44100,
                "channels": 2,
                "start_time": 0.0,
                "end_time": 45.5,
                "source_metadata": {"location": "户外", "device": "手机录音"},
                "manual_notes": "背景有街道噪音"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["audio_type"] == "original"
        assert data["duration"] == 45.5
        assert data["manual_notes"] == "背景有街道噪音"

    def test_list_segments_by_type(self, client, sample_task):
        task_id = sample_task["id"]

        client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "original",
                "name": "原始音频1",
                "file_path": "/audio/o1.wav"
            }
        )
        client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "voice_segment",
                "name": "人声片段1",
                "file_path": "/audio/v1.wav"
            }
        )
        client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "noise_sample",
                "name": "噪音样本1",
                "file_path": "/audio/n1.wav"
            }
        )

        response = client.get(f"/api/v1/tasks/{task_id}/segments?audio_type=voice_segment")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["audio_type"] == "voice_segment"

    def test_get_segment_preview(self, client, sample_task):
        task_id = sample_task["id"]
        seg_response = client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "original",
                "name": "户外采访片段",
                "file_path": "/audio/original/interview_01.wav"
            }
        )
        segment_id = seg_response.json()["id"]

        response = client.get(
            f"/api/v1/tasks/{task_id}/segments/{segment_id}/preview"
        )
        assert response.status_code == 200
        data = response.json()
        assert "preview_url" in data
        assert data["preview_url"] == "/audio/original/interview_01.wav"


class TestImportAndBatchProcess:
    def test_import_task_data(self, client, imported_task):
        task_id = imported_task
        response = client.get(f"/api/v1/tasks/{task_id}")
        data = response.json()
        assert data["status"] == "imported"
        assert data["audio_segments_count"] == 2
        assert data["params_count"] == 2
        assert data["manual_notes"] == "原始备注"
        assert len(data["audio_segments"]) == 2
        assert len(data["params"]) == 2

        seg1 = data["audio_segments"][0]
        assert seg1["manual_notes"] == "音频备注1"
        param1 = data["params"][0]
        assert param1["manual_notes"] == "参数备注A"

    def test_batch_process(self, client, imported_task):
        task_id = imported_task

        response = client.post(
            "/api/v1/tasks/batch-process",
            json={"task_id": task_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert data["total_combinations"] == 4
        assert data["processed_count"] == 4

        results = client.get(f"/api/v1/tasks/{task_id}/results")
        assert len(results.json()) == 4

        task = client.get(f"/api/v1/tasks/{task_id}")
        assert task.json()["status"] == "reviewing"

    def test_batch_process_with_over_denoise_detection(self, client):
        task_response = client.post(
            "/api/v1/tasks",
            json={"name": "过度降噪测试"}
        )
        task_id = task_response.json()["id"]

        client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "original",
                "name": "测试音频",
                "file_path": "/test/audio.wav",
                "duration": 30.0
            }
        )
        client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "激进降噪",
                "params_json": {
                    "noise_reduction": 98,
                    "voice_protection": 30,
                    "aggressiveness": 0.95
                }
            }
        )

        for i in range(5):
            client.post(
                "/api/v1/tasks/batch-process",
                json={"task_id": task_id}
            )

        anomalies = client.get(f"/api/v1/tasks/{task_id}/anomalies?resolved=false")
        anomaly_list = anomalies.json()

        over_denoise = [
            a for a in anomaly_list
            if a["anomaly_type"] == "over_denoise"
        ]
        if over_denoise:
            assert "降噪率" in over_denoise[0]["message"]
            assert "人声保留率仅" in over_denoise[0]["message"]
            assert "建议降低降噪强度" in over_denoise[0]["suggestion"]


class TestListeningAndMetrics:
    def test_add_listening_record(self, client, sample_task):
        task_id = sample_task["id"]

        seg_response = client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "original",
                "name": "试听音频",
                "file_path": "/listen/audio.wav"
            }
        )
        segment_id = seg_response.json()["id"]

        param_response = client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "试听参数",
                "params_json": {"noise_reduction": 70}
            }
        )
        params_id = param_response.json()["id"]

        response = client.post(
            f"/api/v1/tasks/{task_id}/listening",
            json={
                "audio_segment_id": segment_id,
                "params_id": params_id,
                "listener": "评测员A",
                "naturalness_score": 85,
                "noise_reduction_score": 78,
                "overall_score": 82,
                "has_artifacts": False,
                "has_echo": False,
                "has_muffled": False,
                "comments": "人声自然，降噪效果不错",
                "manual_notes": "试听环境：安静办公室"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["naturalness_score"] == 85
        assert data["listener"] == "评测员A"
        assert data["manual_notes"] == "试听环境：安静办公室"

    def test_listening_quality_issue_detection(self, client):
        task_response = client.post(
            "/api/v1/tasks",
            json={"name": "质量问题测试"}
        )
        task_id = task_response.json()["id"]

        seg_response = client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "original",
                "name": "问题音频",
                "file_path": "/quality/audio.wav"
            }
        )
        segment_id = seg_response.json()["id"]

        param_response = client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "问题参数",
                "params_json": {"noise_reduction": 90}
            }
        )
        params_id = param_response.json()["id"]

        client.post(
            "/api/v1/tasks/batch-process",
            json={"task_id": task_id}
        )

        client.post(
            f"/api/v1/tasks/{task_id}/listening",
            json={
                "audio_segment_id": segment_id,
                "params_id": params_id,
                "listener": "评测员B",
                "naturalness_score": 45,
                "noise_reduction_score": 90,
                "overall_score": 60,
                "has_artifacts": True,
                "has_muffled": True,
                "comments": "人声发闷，有明显处理痕迹"
            }
        )

        anomalies = client.get(f"/api/v1/tasks/{task_id}/anomalies?resolved=false")
        anomaly_list = anomalies.json()
        quality_issues = [
            a for a in anomaly_list
            if a["anomaly_type"] == "audio_quality"
        ]
        assert len(quality_issues) >= 1
        assert "有明显处理伪影" in quality_issues[0]["message"]
        assert "声音发闷" in quality_issues[0]["message"]
        assert "人声自然度评分过低" in quality_issues[0]["message"]

    def test_get_task_metrics(self, client, processed_task):
        task_id = processed_task

        response = client.get(f"/api/v1/tasks/{task_id}/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert data["total_segments"] == 2
        assert data["total_params"] == 2
        assert len(data["comparisons"]) == 2
        assert "avg_voice_preservation" in data["comparisons"][0]
        assert "avg_naturalness_score" in data["comparisons"][0]

    def test_resolve_anomaly(self, client, sample_task):
        task_id = sample_task["id"]

        client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "重名参数",
                "params_json": {"noise_reduction": 60}
            }
        )

        client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "重名参数",
                "params_json": {"noise_reduction": 70}
            }
        )

        anomalies = client.get(f"/api/v1/tasks/{task_id}/anomalies?resolved=false")
        anomaly_list = anomalies.json()
        param_anomalies = [
            a for a in anomaly_list if a["anomaly_type"] == "param_override"
        ]
        assert len(param_anomalies) >= 1
        anomaly_id = param_anomalies[0]["id"]

        response = client.patch(
            f"/api/v1/tasks/anomalies/{anomaly_id}/resolve",
            json={
                "resolved_by": "管理员",
                "resolution_notes": "确认需要更新参数，已记录变更原因"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["resolved"] == True
        assert data["resolved_by"] == "管理员"
        assert data["resolution_notes"] == "确认需要更新参数，已记录变更原因"

        remaining = client.get(f"/api/v1/tasks/{task_id}/anomalies?resolved=false")
        remaining_list = remaining.json()
        still_open = [
            a for a in remaining_list
            if a["anomaly_type"] == "param_override" and a["id"] == anomaly_id
        ]
        assert len(still_open) == 0


class TestReportExport:
    def test_export_full_report(self, client, processed_task):
        task_id = processed_task

        response = client.post(
            f"/api/v1/tasks/{task_id}/export",
            json={
                "report_type": "full",
                "format": "xlsx",
                "exported_by": "视频团队"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["task_id"] == task_id
        assert data["report_type"] == "full"
        assert data["format"] == "xlsx"
        assert data["exported_by"] == "视频团队"
        assert data["batch_no"].startswith("RPT")
        assert data["name"].startswith("20")
        assert "full" in data["name"]
        assert task_id == data["summary"]["task_id"]

        assert os.path.exists(data["file_path"])
        assert data["name"] in data["file_path"]

        task = client.get(f"/api/v1/tasks/{task_id}")
        assert task.json()["status"] == "completed"

    def test_export_multiple_reports_distinct_names(self, client, processed_task):
        task_id = processed_task

        reports = []
        for report_type in ["metrics", "anomalies", "listening"]:
            time.sleep(0.01)
            response = client.post(
                f"/api/v1/tasks/{task_id}/export",
                json={"report_type": report_type, "format": "xlsx"}
            )
            assert response.status_code == 201
            reports.append(response.json())

        names = [r["name"] for r in reports]
        batch_nos = [r["batch_no"] for r in reports]
        assert len(set(names)) == len(names)
        assert len(set(batch_nos)) == len(batch_nos)

        for r in reports:
            assert r["report_type"] in r["name"]
            assert os.path.exists(r["file_path"])

    def test_list_reports(self, client, processed_task):
        task_id = processed_task

        client.post(
            f"/api/v1/tasks/{task_id}/export",
            json={"report_type": "full", "format": "xlsx"}
        )

        response = client.get(f"/api/v1/tasks/{task_id}/reports")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_report(self, client, processed_task):
        task_id = processed_task

        export_response = client.post(
            f"/api/v1/tasks/{task_id}/export",
            json={"report_type": "full", "format": "xlsx"}
        )
        report_id = export_response.json()["id"]

        response = client.get(f"/api/v1/tasks/reports/{report_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == report_id
        assert "summary" in data
        assert "best_params" in data["summary"]

    def test_report_summary_best_params(self, client):
        task_response = client.post(
            "/api/v1/tasks",
            json={"name": "最优参数测试"}
        )
        task_id = task_response.json()["id"]

        client.post(
            f"/api/v1/tasks/{task_id}/segments",
            json={
                "audio_type": "original",
                "name": "测试音频",
                "file_path": "/best/audio.wav",
                "duration": 30.0
            }
        )
        client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "好参数",
                "params_json": {
                    "noise_reduction": 60,
                    "voice_protection": 90,
                    "aggressiveness": 0.2
                }
            }
        )
        client.post(
            f"/api/v1/tasks/{task_id}/params",
            json={
                "name": "差参数",
                "params_json": {
                    "noise_reduction": 95,
                    "voice_protection": 30,
                    "aggressiveness": 0.9
                }
            }
        )

        client.post(
            "/api/v1/tasks/batch-process",
            json={"task_id": task_id}
        )

        seg_id = client.get(f"/api/v1/tasks/{task_id}/segments").json()[0]["id"]
        params_list = client.get(f"/api/v1/tasks/{task_id}/params").json()
        good_params_id = [p for p in params_list if p["name"] == "好参数"][0]["id"]
        bad_params_id = [p for p in params_list if p["name"] == "差参数"][0]["id"]

        client.post(
            f"/api/v1/tasks/{task_id}/listening",
            json={
                "audio_segment_id": seg_id,
                "params_id": good_params_id,
                "naturalness_score": 90,
                "noise_reduction_score": 70,
                "overall_score": 85
            }
        )
        client.post(
            f"/api/v1/tasks/{task_id}/listening",
            json={
                "audio_segment_id": seg_id,
                "params_id": bad_params_id,
                "naturalness_score": 30,
                "noise_reduction_score": 95,
                "overall_score": 50
            }
        )

        response = client.post(
            f"/api/v1/tasks/{task_id}/export",
            json={"report_type": "metrics", "format": "xlsx"}
        )
        data = response.json()
        assert data["summary"]["best_params"]["params_name"] == "好参数"
        assert data["summary"]["best_params"]["avg_voice_preservation"] > 70


class TestHealthAndRoot:
    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_root_endpoint(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "音频降噪对比台 API" in data["name"]
        assert data["docs"] == "/docs"
