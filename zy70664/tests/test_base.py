from datetime import date


def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_create_department(client):
    response = client.post(
        "/api/v1/base/departments",
        json={
            "name": "测试部门",
            "code": "TEST",
            "contact": "张三",
            "phone": "13800138000"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试部门"
    assert data["code"] == "TEST"


def test_get_departments(client):
    client.post(
        "/api/v1/base/departments",
        json={"name": "部门1", "code": "DEPT1", "contact": "张三"}
    )
    client.post(
        "/api/v1/base/departments",
        json={"name": "部门2", "code": "DEPT2", "contact": "李四"}
    )

    response = client.get("/api/v1/base/departments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_create_employee(client, test_data):
    response = client.post(
        "/api/v1/base/employees",
        json={
            "department_id": test_data["department"].id,
            "name": "新员工",
            "employee_no": "EMP002",
            "default_diet_restriction": "素食"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "新员工"
    assert data["employee_no"] == "EMP002"


def test_get_employees(client, test_data):
    response = client.get("/api/v1/base/employees")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_create_meal_type(client):
    response = client.post(
        "/api/v1/base/meal-types",
        json={
            "name": "早餐",
            "code": "BREAKFAST",
            "start_time": "07:00",
            "end_time": "09:00",
            "sort_order": 1
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "早餐"
    assert data["code"] == "BREAKFAST"


def test_get_meal_types(client, test_data):
    response = client.get("/api/v1/base/meal-types")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_duplicate_department(client):
    client.post(
        "/api/v1/base/departments",
        json={"name": "部门1", "code": "DUP", "contact": "张三"}
    )
    response = client.post(
        "/api/v1/base/departments",
        json={"name": "部门2", "code": "DUP", "contact": "李四"}
    )
    assert response.status_code == 400
