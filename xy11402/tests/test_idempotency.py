import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import TaskSource, TaskStatus


class TestIdempotency:
    def test_submit_same_receipt_twice_returns_same_task(self, client: TestClient, db_session: Session):
        receipt_data = {
            "idempotency_key": "test-idemp-key-001",
            "source": TaskSource.DRIVER_PHOTO,
            "source_file": "driver_photos_20240101.xlsx",
            "source_row_no": 5,
            "box_no": "BOX001",
            "driver_id": "DRV001",
            "original_data": {"box_no": "BOX001", "temperature": "-18"},
            "compensation_amount": 50.0,
        }

        response1 = client.post("/api/v1/tasks/submit-receipt", json=receipt_data)
        assert response1.status_code == 200
        task1 = response1.json()
        task_no_1 = task1["task_no"]

        response2 = client.post("/api/v1/tasks/submit-receipt", json=receipt_data)
        assert response2.status_code == 200
        task2 = response2.json()
        task_no_2 = task2["task_no"]

        assert task_no_1 == task_no_2

    def test_import_same_data_twice_skips_duplicates(self, client: TestClient, db_session: Session):
        import_data = {
            "source": TaskSource.WMS_BOX,
            "source_file": "wms_boxes_20240101.json",
            "data": [
                {"box_no": "BOX001", "warehouse_code": "WH01", "operate_time": "2024-01-01 10:00:00", "compensation_amount": 100},
                {"box_no": "BOX002", "warehouse_code": "WH01", "operate_time": "2024-01-01 11:00:00", "compensation_amount": 200},
            ],
        }

        response1 = client.post("/api/v1/tasks/import/json", params=import_data)
        assert response1.status_code == 200
        result1 = response1.json()
        assert result1["created_count"] == 2
        assert result1["skipped_count"] == 0

        response2 = client.post("/api/v1/tasks/import/json", params=import_data)
        assert response2.status_code == 200
        result2 = response2.json()
        assert result2["created_count"] == 0
        assert result2["skipped_count"] == 2

    def test_create_task_with_same_idempotency_key(self, client: TestClient, db_session: Session):
        task_data = {
            "idempotency_key": "create-task-idemp-001",
            "source": TaskSource.DRIVER_PHOTO,
            "box_no": "BOX003",
            "evidences": [
                {
                    "source_file": "test.xlsx",
                    "source_row_no": 1,
                    "original_value": "test",
                }
            ],
        }

        response1 = client.post("/api/v1/tasks/", json=task_data)
        assert response1.status_code == 200
        task1 = response1.json()

        response2 = client.post("/api/v1/tasks/", json=task_data)
        assert response2.status_code == 200
        task2 = response2.json()

        assert task1["id"] == task2["id"]
        assert task1["task_no"] == task2["task_no"]
