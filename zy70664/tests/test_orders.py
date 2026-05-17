from datetime import date, timedelta
import json


def test_batch_import_orders(client, test_data):
    today = date.today().isoformat()
    response = client.post(
        "/api/v1/orders/batch-import",
        json=[{
            "department_id": test_data["department"].id,
            "employee_id": test_data["employee"].id,
            "meal_date": today,
            "meal_type_id": test_data["meal_type"].id,
            "quantity": 1,
            "diet_restriction": "不吃辣",
            "remarks": "打包"
        }]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] == 1
    assert data["exception_count"] == 0


def test_batch_import_with_exception(client, test_data):
    today = date.today().isoformat()
    response = client.post(
        "/api/v1/orders/batch-import",
        json=[{
            "department_id": 9999,
            "employee_id": test_data["employee"].id,
            "meal_date": today,
            "meal_type_id": test_data["meal_type"].id,
            "quantity": 1
        }]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] == 0
    assert data["exception_count"] == 1


def test_get_orders(client, test_data):
    today = date.today().isoformat()
    client.post(
        "/api/v1/orders/batch-import",
        json=[{
            "department_id": test_data["department"].id,
            "employee_id": test_data["employee"].id,
            "meal_date": today,
            "meal_type_id": test_data["meal_type"].id,
            "quantity": 1
        }]
    )

    response = client.get("/api/v1/orders")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_cancellation_offset_matched(client, test_data, db):
    from app.models.models import OrderRecord
    today = date.today()

    order = OrderRecord(
        department_id=test_data["department"].id,
        employee_id=test_data["employee"].id,
        meal_date=today,
        meal_type_id=test_data["meal_type"].id,
        quantity=1,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    response = client.post(
        "/api/v1/orders/cancellation-offset",
        json=[{
            "order_record_id": order.id,
            "cancel_date": today.isoformat(),
            "cancel_quantity": 1,
            "reason": "临时有事"
        }]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched_count"] == 1
    assert data["unmatched_count"] == 0


def test_cancellation_offset_unmatched(client):
    today = date.today().isoformat()
    response = client.post(
        "/api/v1/orders/cancellation-offset",
        json=[{
            "cancel_date": today,
            "cancel_quantity": 1,
            "reason": "无法匹配的取消"
        }]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["unmatched_count"] == 1


def test_get_cancellations(client, test_data, db):
    from app.models.models import CancellationRecord
    today = date.today()

    cancel = CancellationRecord(
        cancel_date=today,
        cancel_quantity=1,
        reason="测试取消",
        matched=True,
        status="matched"
    )
    db.add(cancel)
    db.commit()

    response = client.get("/api/v1/orders/cancellations")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_get_exceptions(client, test_data, db):
    from app.models.models import OrderException

    exception = OrderException(
        exception_type="import_error",
        description="测试异常",
        status="pending"
    )
    db.add(exception)
    db.commit()

    response = client.get("/api/v1/orders/exceptions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_handle_exception(client, test_data, db):
    from app.models.models import OrderException

    exception = OrderException(
        exception_type="import_error",
        description="测试异常",
        status="pending"
    )
    db.add(exception)
    db.commit()
    db.refresh(exception)

    response = client.put(
        f"/api/v1/orders/exceptions/{exception.id}/handle",
        json={
            "handler": "管理员",
            "handle_result": "已处理",
            "handle_notes": "人工处理完成"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "handled"
    assert data["handler"] == "管理员"


def test_correct_order(client, test_data, db):
    from app.models.models import OrderRecord
    today = date.today()

    order = OrderRecord(
        department_id=test_data["department"].id,
        employee_id=test_data["employee"].id,
        meal_date=today,
        meal_type_id=test_data["meal_type"].id,
        quantity=1,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    response = client.put(
        f"/api/v1/orders/{order.id}/correct?handler=管理员",
        json={"diet_restriction": "素食", "remarks": "已修正"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "manual_updated"


def test_withdraw_order(client, test_data, db):
    from app.models.models import OrderRecord
    today = date.today()

    order = OrderRecord(
        department_id=test_data["department"].id,
        employee_id=test_data["employee"].id,
        meal_date=today,
        meal_type_id=test_data["meal_type"].id,
        quantity=1,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    response = client.put(
        f"/api/v1/orders/{order.id}/withdraw?handler=管理员&reason=重复录入"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "withdrawn"


def test_generate_meal_report(client, test_data, db):
    from app.models.models import OrderRecord
    today = date.today()

    for i in range(5):
        order = OrderRecord(
            department_id=test_data["department"].id,
            meal_date=today,
            meal_type_id=test_data["meal_type"].id,
            quantity=1,
            diet_restriction="不吃辣" if i % 2 == 0 else "素食",
            status="pending"
        )
        db.add(order)
    db.commit()

    response = client.post(
        "/api/v1/orders/generate-report",
        json={"report_date": today.isoformat()}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["total_orders"] >= 5


def test_get_reports(client, test_data, db):
    from app.models.models import MealReport
    today = date.today()

    report = MealReport(
        report_date=today,
        meal_type_id=test_data["meal_type"].id,
        department_id=test_data["department"].id,
        total_orders=10,
        total_cancelled=2,
        net_quantity=8,
        status="draft"
    )
    db.add(report)
    db.commit()

    response = client.get("/api/v1/orders/reports")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_confirm_report(client, test_data, db):
    from app.models.models import MealReport
    today = date.today()

    report = MealReport(
        report_date=today,
        meal_type_id=test_data["meal_type"].id,
        department_id=test_data["department"].id,
        total_orders=10,
        total_cancelled=2,
        net_quantity=8,
        status="draft"
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    response = client.put(
        f"/api/v1/orders/reports/{report.id}/confirm?confirmed_by=管理员"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"


def test_close_report(client, test_data, db):
    from app.models.models import MealReport
    today = date.today()

    report = MealReport(
        report_date=today,
        meal_type_id=test_data["meal_type"].id,
        department_id=test_data["department"].id,
        total_orders=10,
        total_cancelled=2,
        net_quantity=8,
        status="confirmed"
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    response = client.put(
        f"/api/v1/orders/reports/{report.id}/close?closed_by=管理员"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "closed"


def test_diet_restriction_summary(client, test_data, db):
    from app.models.models import MealReport
    today = date.today()

    report = MealReport(
        report_date=today,
        meal_type_id=test_data["meal_type"].id,
        department_id=test_data["department"].id,
        total_orders=10,
        total_cancelled=2,
        net_quantity=8,
        diet_restrictions=json.dumps({"不吃辣": 3, "素食": 2}, ensure_ascii=False),
        restriction_count=2,
        status="draft"
    )
    db.add(report)
    db.commit()

    response = client.get(f"/api/v1/orders/diet-restriction-summary?report_date={today.isoformat()}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_orders"] >= 10


def test_export_report(client, test_data, db):
    from app.models.models import MealReport
    today = date.today()

    report = MealReport(
        report_date=today,
        meal_type_id=test_data["meal_type"].id,
        department_id=test_data["department"].id,
        total_orders=10,
        total_cancelled=2,
        net_quantity=8,
        status="draft"
    )
    db.add(report)
    db.commit()

    response = client.get(f"/api/v1/orders/export-report?report_date={today.isoformat()}")
    assert response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]
