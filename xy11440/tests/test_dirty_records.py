import pytest


def create_test_batch(client, token, batch_no="DIRTY-001"):
    response = client.post(
        "/batches",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "batch_no": batch_no,
            "supplier_name": "测试供应商",
            "delivery_date": "2024-01-15T10:00:00"
        }
    )
    return response.json()


class TestDirtyRecordDetection:
    def test_missing_field_detection(self, client, entry_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch["id"]
        
        record_data = {
            "batch_id": batch_id,
            "record_type": "delivery_note",
            "external_ref_no": "MISSING-001",
            "raw_content": "缺少字段的记录",
            "product_name": "苹果",
            "quantity": 100,
            "unit_price": 5.0,
        }
        
        response = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        )
        assert response.status_code == 200
        record = response.json()
        assert record["is_dirty"] == True
        assert record["dirty_type"] == "missing_field"
        assert "缺失必填字段" in record["dirty_note"]

    def test_cross_date_detection(self, client, entry_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch["id"]
        
        record_data = {
            "batch_id": batch_id,
            "record_type": "delivery_note",
            "external_ref_no": "CROSSDATE-001",
            "raw_content": "跨日记录",
            "product_name": "苹果",
            "quantity": 100,
            "unit_price": 5.0,
            "amount": 500.0,
            "record_date": "2024-01-20T10:00:00",
            "supplier_name_in_record": "测试供应商"
        }
        
        response = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        )
        assert response.status_code == 200
        record = response.json()
        assert record["is_dirty"] == True
        assert record["dirty_type"] == "cross_date"

    def test_name_change_detection(self, client, entry_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch["id"]
        
        record_data = {
            "batch_id": batch_id,
            "record_type": "delivery_note",
            "external_ref_no": "NAMECHANGE-001",
            "raw_content": "改名记录",
            "product_name": "苹果",
            "quantity": 100,
            "unit_price": 5.0,
            "amount": 500.0,
            "record_date": "2024-01-15T10:00:00",
            "supplier_name_in_record": "另一个供应商"
        }
        
        response = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        )
        assert response.status_code == 200
        record = response.json()
        assert record["is_dirty"] == True
        assert record["dirty_type"] == "name_change"

    def test_amount_conflict_detection(self, client, entry_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch["id"]
        
        record_data = {
            "batch_id": batch_id,
            "record_type": "delivery_note",
            "external_ref_no": "AMOUNT-001",
            "raw_content": "金额冲突记录",
            "product_name": "苹果",
            "quantity": 100,
            "unit_price": 5.0,
            "amount": 600.0,
            "record_date": "2024-01-15T10:00:00",
            "supplier_name_in_record": "测试供应商"
        }
        
        response = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        )
        assert response.status_code == 200
        record = response.json()
        assert record["is_dirty"] == True
        assert record["dirty_type"] == "amount_conflict"

    def test_clean_record(self, client, entry_token):
        batch = create_test_batch(client, entry_token, "CLEAN-001")
        batch_id = batch["id"]
        
        record_data = {
            "batch_id": batch_id,
            "record_type": "delivery_note",
            "external_ref_no": "CLEAN-001",
            "raw_content": "干净的记录",
            "product_name": "苹果",
            "quantity": 100,
            "unit_price": 5.0,
            "amount": 500.0,
            "record_date": "2024-01-15T10:00:00",
            "supplier_name_in_record": "测试供应商"
        }
        
        response = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        )
        assert response.status_code == 200
        record = response.json()
        assert record["is_dirty"] == False
        assert record["dirty_type"] == "clean"
        assert record["is_processed"] == True

    def test_record_correction_trail(self, client, entry_token):
        batch = create_test_batch(client, entry_token, "CORRECT-001")
        batch_id = batch["id"]
        
        record_data = {
            "batch_id": batch_id,
            "record_type": "delivery_note",
            "external_ref_no": "CORRECT-001",
            "raw_content": "待修正记录",
            "product_name": "苹果",
            "quantity": 100,
            "unit_price": 5.0,
            "amount": 600.0,
            "record_date": "2024-01-15T10:00:00",
            "supplier_name_in_record": "测试供应商"
        }
        
        record = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        ).json()
        record_id = record["id"]
        assert record["is_dirty"] == True
        
        update_response = client.put(
            f"/records/{record_id}",
            headers={"Authorization": f"Bearer {entry_token}"},
            json={"amount": 500.0}
        )
        assert update_response.status_code == 200
        updated_record = update_response.json()
        assert updated_record["is_dirty"] == False
        
        corrections = client.get(
            f"/records/{record_id}/corrections",
            headers={"Authorization": f"Bearer {entry_token}"}
        )
        assert corrections.status_code == 200
        correction_list = corrections.json()
        assert len(correction_list) >= 1
        assert correction_list[0]["field_name"] == "amount"
        assert correction_list[0]["old_value"] == "600.0"
        assert correction_list[0]["new_value"] == "500.0"
