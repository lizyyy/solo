def test_operation_logs_requires_admin(client, auth_token):
    response = client.get(
        "/api/logs",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 403

def test_operation_logs_as_admin(client, admin_token, db, test_admin):
    from app.models import OperationLog, OperationType
    
    log = OperationLog(
        user_id=test_admin.id,
        operation_type=OperationType.CREATE,
        detail={"test": "data"}
    )
    db.add(log)
    db.commit()
    
    response = client.get(
        "/api/logs",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total" in data

def test_statistics_accessible_to_all(client, auth_token):
    response = client.get(
        "/api/statistics",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "by_status" in data

def test_failed_tasks(client, admin_token, db, test_reissue):
    from app.models import FailedTask
    
    task = FailedTask(
        task_name="test_task",
        reissue_id=test_reissue.id,
        error_message="Test error",
        retry_count=0,
        max_retries=3
    )
    db.add(task)
    db.commit()
    
    response = client.get(
        "/api/failed-tasks",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

def test_retry_failed_task(client, admin_token, db):
    from app.models import FailedTask
    
    task = FailedTask(
        task_name="test_task_2",
        error_message="Test error",
        retry_count=0,
        max_retries=3
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    response = client.post(
        f"/api/failed-tasks/{task.id}/retry",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["retry_count"] == 1
