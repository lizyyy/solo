import pytest
from datetime import datetime, timedelta
from models import ProcessingStatus, ChangeStatus


def create_test_customer(client):
    return client.post(
        "/customers/",
        json={"name": "张三", "phone": "13800138000", "email": "zhangsan@example.com"}
    )


def create_test_prescription(client, customer_id):
    return client.post(
        "/prescriptions/",
        json={
            "customer_id": customer_id,
            "optometrist": "王医生",
            "exam_date": (datetime.now()).isoformat(),
            "od_sphere": -2.0,
            "od_cylinder": -0.5,
            "od_axis": 180,
            "os_sphere": -2.5,
            "os_cylinder": -0.75,
            "os_axis": 170,
            "pd_distance": 62,
            "notes": "初诊验光"
        }
    )


def create_test_frame(client):
    return client.post(
        "/frames/",
        json={
            "sku": "FRAME001",
            "brand": "雷朋",
            "model": "RB5154",
            "color": "黑色",
            "material": "板材",
            "size": "51",
            "bridge": "21",
            "temple_length": "145",
            "quantity": 10,
            "price": 580.0
        }
    )


def create_test_lens_order(client, customer_id, prescription_id, frame_id=None):
    data = {
        "customer_id": customer_id,
        "prescription_id": prescription_id,
        "lens_type_od": "1.67非球面",
        "lens_type_os": "1.67非球面",
        "lens_brand": "依视路",
        "rush_order": False
    }
    if frame_id:
        data["frame_id"] = frame_id
    return client.post("/lens-orders/", json=data)


class TestCustomerFlow:
    def test_create_customer(self, client):
        response = create_test_customer(client)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "张三"
        assert data["phone"] == "13800138000"

    def test_create_duplicate_customer(self, client):
        create_test_customer(client)
        response = create_test_customer(client)
        assert response.status_code == 400

    def test_get_customer(self, client):
        create_response = create_test_customer(client)
        customer_id = create_response.json()["id"]
        get_response = client.get(f"/customers/{customer_id}")
        assert get_response.status_code == 200
        assert get_response.json()["name"] == "张三"


class TestPrescriptionFlow:
    def test_create_prescription(self, client):
        customer = create_test_customer(client).json()
        response = create_test_prescription(client, customer["id"])
        assert response.status_code == 200
        data = response.json()
        assert data["od_sphere"] == -2.0
        assert data["version"] == 1

    def test_get_customer_prescriptions(self, client):
        customer = create_test_customer(client).json()
        create_test_prescription(client, customer["id"])
        response = client.get(f"/prescriptions/customer/{customer['id']}")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestLensOrderFlow:
    def test_create_order(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        frame = create_test_frame(client).json()
        response = create_test_lens_order(client, customer["id"], prescription["id"], frame["id"])
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == ProcessingStatus.PENDING.value

    def test_get_order(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()
        response = client.get(f"/lens-orders/{order['id']}")
        assert response.status_code == 200
        assert response.json()["order_no"] == order["order_no"]

    def test_list_orders_with_filters(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        create_test_lens_order(client, customer["id"], prescription["id"])
        response = client.get(f"/lens-orders/?customer_id={customer['id']}&status=pending")
        assert response.status_code == 200
        assert len(response.json()["items"]) >= 1


class TestProcessingStateMachine:
    def test_normal_status_transition(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        response = client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_PREPARING.value, "changed_by": "操作员A"}
        )
        assert response.status_code == 200
        assert response.json()["current_status"] == ProcessingStatus.LENS_PREPARING.value

    def test_invalid_status_transition(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_PREPARING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_CUTTING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_POLISHING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.FRAME_FITTING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.QUALITY_CHECK.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.READY_FOR_PICKUP.value, "changed_by": "操作员A"}
        )
        response = client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.PENDING.value, "changed_by": "操作员A"}
        )
        assert response.status_code == 400

    def test_get_status_history(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_PREPARING.value, "changed_by": "操作员A"}
        )
        response = client.get(f"/lens-orders/{order['id']}/status-history")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestDegreeChangeFlow:
    def test_request_degree_change_pending(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        response = client.post(
            "/degree-changes/",
            json={
                "lens_order_id": order["id"],
                "reason": "顾客反馈度数不准确",
                "requested_by": "客服小王",
                "od_sphere": -1.75
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == ChangeStatus.PENDING_REVIEW.value
        assert data["can_apply"] == True

    def test_degree_change_interception_polishing_stage(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_PREPARING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_CUTTING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_POLISHING.value, "changed_by": "操作员A"}
        )

        response = client.post(
            "/degree-changes/",
            json={
                "lens_order_id": order["id"],
                "reason": "顾客要求改度",
                "requested_by": "客服小王",
                "od_sphere": -1.5
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == ChangeStatus.REJECTED.value
        assert data["can_apply"] == False
        assert "抛光阶段" in data["interception_reason"]

    def test_approve_degree_change(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        change_response = client.post(
            "/degree-changes/",
            json={
                "lens_order_id": order["id"],
                "reason": "验光师重新验光",
                "requested_by": "客服小王",
                "od_sphere": -1.75,
                "os_sphere": -2.25
            }
        )
        change_id = change_response.json()["id"]

        review_response = client.post(
            f"/degree-changes/{change_id}/review",
            json={
                "status": ChangeStatus.APPROVED.value,
                "reviewed_by": "张主管",
                "review_notes": "已复核新验光数据，批准改度"
            }
        )
        assert review_response.status_code == 200
        data = review_response.json()
        assert data["status"] == ChangeStatus.APPROVED.value
        assert data["new_prescription_id"] is not None

    def test_reject_degree_change(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        change_response = client.post(
            "/degree-changes/",
            json={
                "lens_order_id": order["id"],
                "reason": "顾客主观不适",
                "requested_by": "客服小王",
                "od_sphere": -1.0
            }
        )
        change_id = change_response.json()["id"]

        review_response = client.post(
            f"/degree-changes/{change_id}/review",
            json={
                "status": ChangeStatus.REJECTED.value,
                "reviewed_by": "张主管",
                "review_notes": "建议先适应一周"
            }
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == ChangeStatus.REJECTED.value

    def test_list_degree_changes(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        client.post(
            "/degree-changes/",
            json={
                "lens_order_id": order["id"],
                "reason": "测试改度",
                "requested_by": "客服小王",
                "od_sphere": -1.5
            }
        )
        response = client.get(f"/degree-changes/?order_id={order['id']}")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestPickupFlow:
    def test_send_pickup_reminder(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_PREPARING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_CUTTING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_POLISHING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.FRAME_FITTING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.QUALITY_CHECK.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.READY_FOR_PICKUP.value, "changed_by": "操作员A"}
        )

        response = client.post(
            f"/pickup-reports/{order['id']}/reminder",
            json={"reminder_type": "first", "sent_by": "客服小王", "notes": "短信已发送"}
        )
        assert response.status_code == 200
        assert response.json()["first_reminder_sent"] == True

    def test_confirm_pickup(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_PREPARING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_CUTTING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.LENS_POLISHING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.FRAME_FITTING.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.QUALITY_CHECK.value, "changed_by": "操作员A"}
        )
        client.patch(
            f"/lens-orders/{order['id']}/status",
            json={"status": ProcessingStatus.READY_FOR_PICKUP.value, "changed_by": "操作员A"}
        )

        response = client.post(
            f"/pickup-reports/{order['id']}/confirm",
            json={"picked_up_by": "张三本人", "pickup_notes": "顾客满意"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True

    def test_send_reminder_wrong_status(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        response = client.post(
            f"/pickup-reports/{order['id']}/reminder",
            json={"reminder_type": "first", "sent_by": "客服小王"}
        )
        assert response.status_code == 400


class TestOrderManagement:
    def test_withdraw_order(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        response = client.post(
            f"/lens-orders/{order['id']}/withdraw",
            json={"reason": "顾客取消订单", "changed_by": "客服小王"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == ProcessingStatus.CANCELLED.value

    def test_manual_correction(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        response = client.post(
            f"/lens-orders/{order['id']}/manual-correction",
            json={
                "field_name": "lens_type_od",
                "old_value": "1.67非球面",
                "new_value": "1.74非球面",
                "reason": "顾客补差价升级镜片",
                "corrected_by": "主管老李"
            }
        )
        assert response.status_code == 200
        assert response.json()["success"] == True


class TestExport:
    def test_export_lens_orders(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        create_test_lens_order(client, customer["id"], prescription["id"])

        response = client.post(
            "/export/lens-orders",
            json={"status": ["pending"]}
        )
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]


class TestEdgeCases:
    def test_create_order_nonexistent_customer(self, client):
        response = client.post(
            "/lens-orders/",
            json={
                "customer_id": 9999,
                "prescription_id": 1,
                "lens_type_od": "1.67非球面",
                "lens_type_os": "1.67非球面"
            }
        )
        assert response.status_code == 404

    def test_get_nonexistent_order(self, client):
        response = client.get("/lens-orders/9999")
        assert response.status_code == 404

    def test_degree_change_no_changes(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        response = client.post(
            "/degree-changes/",
            json={
                "lens_order_id": order["id"],
                "reason": "无实际变更",
                "requested_by": "客服小王"
            }
        )
        assert response.status_code == 400

    def test_review_already_processed_change(self, client):
        customer = create_test_customer(client).json()
        prescription = create_test_prescription(client, customer["id"]).json()
        order = create_test_lens_order(client, customer["id"], prescription["id"]).json()

        change_response = client.post(
            "/degree-changes/",
            json={
                "lens_order_id": order["id"],
                "reason": "测试",
                "requested_by": "客服小王",
                "od_sphere": -1.5
            }
        )
        change_id = change_response.json()["id"]

        client.post(
            f"/degree-changes/{change_id}/review",
            json={
                "status": ChangeStatus.REJECTED.value,
                "reviewed_by": "张主管",
                "review_notes": "拒绝"
            }
        )

        second_review = client.post(
            f"/degree-changes/{change_id}/review",
            json={
                "status": ChangeStatus.APPROVED.value,
                "reviewed_by": "李主管",
                "review_notes": "再次审核"
            }
        )
        assert second_review.status_code == 400

    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
