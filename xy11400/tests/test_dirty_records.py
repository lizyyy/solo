import pytest
from datetime import datetime, timedelta
from app.config import settings


class TestDirtyRecords:
    def test_missing_fields_detected(self, client, operator_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "DIRTY001"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        dirty_records = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records",
            headers=operator_auth_headers
        ).json()

        missing_field_records = [r for r in dirty_records if r["record_type"] == "missing_fields"]
        assert len(missing_field_records) > 0

    def test_cross_day_signature_detected(self, client, operator_auth_headers):
        departure = datetime.now().isoformat()
        arrival = (datetime.now() + timedelta(days=2)).isoformat()

        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={
                "batch_no": "DIRTY002",
                "transport_order_no": "TO002",
                "departure_date": departure,
                "arrival_date": arrival
            },
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        dirty_records = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records",
            headers=operator_auth_headers
        ).json()

        cross_day_records = [r for r in dirty_records if r["record_type"] == "cross_day"]
        assert len(cross_day_records) > 0

    def test_box_rename_detected(self, client, operator_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "DIRTY003", "transport_order_no": "TO003"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/box-items",
            json={
                "box_no": "NEW_BOX_001",
                "original_box_no": "OLD_BOX_001",
                "product_name": "测试产品"
            },
            headers=operator_auth_headers
        )

        dirty_records = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records",
            headers=operator_auth_headers
        ).json()

        rename_records = [r for r in dirty_records if r["record_type"] == "box_renamed"]
        assert len(rename_records) > 0

    def test_resolve_dirty_record(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "DIRTY004"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        dirty_records = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records",
            headers=operator_auth_headers
        ).json()

        if dirty_records:
            record_id = dirty_records[0]["id"]

            resolve_response = client.post(
                f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records/{record_id}/resolve",
                json={"resolution_note": "已补充缺失字段"},
                headers=reviewer_auth_headers
            )
            assert resolve_response.json()["is_resolved"] == True
            assert resolve_response.json()["resolution_note"] == "已补充缺失字段"
