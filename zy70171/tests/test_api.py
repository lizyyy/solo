import pytest


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_rebuild_index_success(client):
    request_data = {
        "task_id": "success_task_001",
        "document_versions": [
            {
                "document_id": "doc_001",
                "version": 1,
                "content_hash": "hash_001",
                "title": "测试文档1",
                "content": "这是测试文档的内容"
            },
            {
                "document_id": "doc_002",
                "version": 2,
                "content_hash": "hash_002",
                "title": "测试文档2"
            }
        ],
        "enable_rollback": True
    }
    
    response = client.post("/api/v1/index/rebuild", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "success_task_001"
    assert data["status"] == "completed"


def test_rebuild_index_missing_fields(client):
    request_data = {
        "task_id": "   ",
        "document_versions": [
            {
                "document_id": "   ",
                "version": 1,
                "content_hash": "   "
            }
        ]
    }
    
    response = client.post("/api/v1/index/rebuild", json=request_data)
    
    assert response.status_code == 400
    data = response.json()
    assert "errors" in data["detail"]


def test_rebuild_index_duplicate_task(client):
    request_data = {
        "task_id": "duplicate_task",
        "document_versions": [
            {
                "document_id": "doc_001",
                "version": 1,
                "content_hash": "hash_001"
            }
        ]
    }
    
    response1 = client.post("/api/v1/index/rebuild", json=request_data)
    assert response1.status_code == 200
    
    response2 = client.post("/api/v1/index/rebuild", json=request_data)
    assert response2.status_code == 409
    assert "任务ID已存在" in response2.json()["detail"]


def test_get_task_status(client):
    rebuild_data = {
        "task_id": "status_test_task",
        "document_versions": [
            {
                "document_id": "doc_001",
                "version": 1,
                "content_hash": "hash_001"
            }
        ]
    }
    
    rebuild_response = client.post("/api/v1/index/rebuild", json=rebuild_data)
    assert rebuild_response.status_code == 200
    
    status_response = client.get("/api/v1/index/task/status_test_task")
    
    assert status_response.status_code == 200
    data = status_response.json()
    
    assert data["task"]["task_id"] == "status_test_task"
    assert data["task"]["status"] == "completed"
    assert len(data["validations"]) == 1
    assert len(data["reports"]) == 1


def test_get_task_status_not_found(client):
    response = client.get("/api/v1/index/task/nonexistent_task")
    assert response.status_code == 404


def test_rollback_task(client):
    rebuild_data = {
        "task_id": "rollback_test_task",
        "document_versions": [
            {
                "document_id": "doc_001",
                "version": 1,
                "content_hash": "hash_001"
            }
        ]
    }
    
    rebuild_response = client.post("/api/v1/index/rebuild", json=rebuild_data)
    assert rebuild_response.status_code == 200
    
    rollback_data = {
        "task_id": "rollback_test_task",
        "reason": "测试人工回滚"
    }
    
    rollback_response = client.post("/api/v1/index/rollback", json=rollback_data)
    
    assert rollback_response.status_code == 200
    data = rollback_response.json()
    assert data["success"] == True
    
    status_response = client.get("/api/v1/index/task/rollback_test_task")
    assert status_response.json()["task"]["status"] == "rolled_back"


def test_rollback_task_not_found(client):
    rollback_data = {
        "task_id": "nonexistent_task",
        "reason": "测试回滚不存在的任务"
    }
    
    response = client.post("/api/v1/index/rollback", json=rollback_data)
    assert response.status_code == 404


def test_rebuild_index_with_recall_samples(client):
    request_data = {
        "task_id": "recall_test_task",
        "document_versions": [
            {
                "document_id": "sample_doc_001",
                "version": 2,
                "content_hash": "hash_recall_001"
            }
        ],
        "recall_samples": [
            {
                "query": "测试查询",
                "expected_document_id": "sample_doc_001",
                "expected_version": 2
            }
        ],
        "enable_rollback": True
    }
    
    response = client.post("/api/v1/index/rebuild", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    
    status_response = client.get("/api/v1/index/task/recall_test_task")
    status_data = status_response.json()
    
    assert len(status_data["recall_samples"]) == 1
    assert status_data["recall_samples"][0]["is_match"] == True
    assert status_data["reports"][0]["recall_accuracy"] == 1.0


def test_invalid_document_version(client):
    request_data = {
        "task_id": "invalid_version_task",
        "document_versions": [
            {
                "document_id": "doc_001",
                "version": 0,
                "content_hash": "hash_001"
            }
        ]
    }
    
    response = client.post("/api/v1/index/rebuild", json=request_data)
    assert response.status_code == 422


def test_rebuild_report_generation(client):
    request_data = {
        "task_id": "report_test_task",
        "document_versions": [
            {
                "document_id": "doc_001",
                "version": 1,
                "content_hash": "hash_001"
            },
            {
                "document_id": "doc_002",
                "version": 1,
                "content_hash": "hash_002"
            }
        ]
    }
    
    response = client.post("/api/v1/index/rebuild", json=request_data)
    assert response.status_code == 200
    
    status_response = client.get("/api/v1/index/task/report_test_task")
    status_data = status_response.json()
    
    report = status_data["reports"][0]
    assert report["overall_status"] == "success"
    assert report["total_documents"] == 2
    assert report["valid_documents"] == 2
    assert report["invalid_documents"] == 0
    assert report["recall_samples_count"] == 0
    assert report["recall_accuracy"] == 0.0
