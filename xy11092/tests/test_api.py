import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from main import app
from app.database import Base, get_db
from app import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_rule_01_create_lighting_set_success(db_session):
    """规则1: 成功创建灯光设备套装"""
    response = client.post(
        "/lighting-sets/",
        json={
            "set_code": "LIGHT-001",
            "set_name": "演唱会标准灯光套装",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "available",
            "daily_rental_price": 1500.0,
            "items": [
                {
                    "item_code": "PAR-001",
                    "item_name": "LED帕灯",
                    "category": "面光灯",
                    "brand": "珠江灯光",
                    "model": "PR-5000",
                    "quantity": 8,
                    "unit_price": 2500.0,
                    "status": "normal"
                },
                {
                    "item_code": "BEAM-001",
                    "item_name": "230W光束灯",
                    "category": "效果灯",
                    "brand": "明道灯光",
                    "model": "GTD-230",
                    "quantity": 4,
                    "unit_price": 4500.0,
                    "status": "normal"
                },
                {
                    "item_code": "CON-001",
                    "item_name": "灯光控台",
                    "category": "控制设备",
                    "brand": "MA Lighting",
                    "model": "grandMA2",
                    "quantity": 1,
                    "unit_price": 15000.0,
                    "status": "normal"
                }
            ]
        }
    )
    assert response.status_code == 200, f"失败: {response.text}"
    data = response.json()
    assert data["set_code"] == "LIGHT-001"
    assert data["total_value"] == 8 * 2500 + 4 * 4500 + 1 * 15000
    assert data["completeness_score"] == 100.0


def test_rule_02_create_duplicate_set_code(db_session):
    """规则2: 套装编号重复应失败"""
    test_rule_01_create_lighting_set_success(db_session)
    
    response = client.post(
        "/lighting-sets/",
        json={
            "set_code": "LIGHT-001",
            "set_name": "重复套装",
            "store": "海淀门店",
            "responsible_person": "李四",
            "status": "available",
            "daily_rental_price": 1000.0,
            "items": []
        }
    )
    assert response.status_code == 400, f"应返回400但返回{response.status_code}"
    assert "已存在" in response.text


def test_rule_03_query_by_store(db_session):
    """规则3: 按门店筛选"""
    for i in range(3):
        client.post(
            "/lighting-sets/",
            json={
                "set_code": f"LIGHT-00{i+1}",
                "set_name": f"套装{i+1}",
                "store": "朝阳门店" if i < 2 else "海淀门店",
                "responsible_person": "张三",
                "status": "available",
                "daily_rental_price": 1000.0,
                "items": [
                    {
                        "item_code": f"ITEM-{i}",
                        "item_name": "测试设备",
                        "category": "测试",
                        "quantity": 1,
                        "unit_price": 100.0
                    }
                ]
            }
        )
    
    response = client.get("/lighting-sets/?store=朝阳门店")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_rule_04_query_by_status(db_session):
    """规则4: 按状态筛选"""
    for i, status in enumerate(["available", "rented", "maintenance"]):
        client.post(
            "/lighting-sets/",
            json={
                "set_code": f"LIGHT-00{i+1}",
                "set_name": f"套装{i+1}",
                "store": "朝阳门店",
                "responsible_person": "张三",
                "status": status,
                "daily_rental_price": 1000.0,
                "items": [
                    {
                        "item_code": f"ITEM-{i}",
                        "item_name": "测试设备",
                        "category": "测试",
                        "quantity": 1,
                        "unit_price": 100.0
                    }
                ]
            }
        )
    
    response = client.get("/lighting-sets/?status=rented")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "rented"


def test_rule_05_query_by_responsible_person(db_session):
    """规则5: 按负责人筛选"""
    for i, person in enumerate(["张三", "李四", "张三"]):
        client.post(
            "/lighting-sets/",
            json={
                "set_code": f"LIGHT-00{i+1}",
                "set_name": f"套装{i+1}",
                "store": "朝阳门店",
                "responsible_person": person,
                "status": "available",
                "daily_rental_price": 1000.0,
                "items": [
                    {
                        "item_code": f"ITEM-{i}",
                        "item_name": "测试设备",
                        "category": "测试",
                        "quantity": 1,
                        "unit_price": 100.0
                    }
                ]
            }
        )
    
    response = client.get("/lighting-sets/?responsible_person=张三")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_rule_06_update_lighting_set(db_session):
    """规则6: 更新灯光设备套装信息"""
    create_response = client.post(
        "/lighting-sets/",
        json={
            "set_code": "LIGHT-001",
            "set_name": "演唱会标准灯光套装",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "available",
            "daily_rental_price": 1500.0,
            "items": [
                {
                    "item_code": "PAR-001",
                    "item_name": "LED帕灯",
                    "category": "面光灯",
                    "quantity": 8,
                    "unit_price": 2500.0
                }
            ]
        }
    )
    set_id = create_response.json()["id"]
    
    update_response = client.put(
        f"/lighting-sets/{set_id}",
        json={
            "daily_rental_price": 1800.0,
            "remarks": "更新了日租价格"
        }
    )
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["daily_rental_price"] == 1800.0
    assert updated_data["remarks"] == "更新了日租价格"


def test_rule_07_update_items_changes_completeness(db_session):
    """规则7: 更新设备清单影响完整性分数"""
    create_response = client.post(
        "/lighting-sets/",
        json={
            "set_code": "LIGHT-001",
            "set_name": "演唱会标准灯光套装",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "available",
            "daily_rental_price": 1500.0,
            "items": [
                {
                    "item_code": "PAR-001",
                    "item_name": "LED帕灯",
                    "category": "面光灯",
                    "quantity": 8,
                    "unit_price": 2500.0
                },
                {
                    "item_code": "BEAM-001",
                    "item_name": "230W光束灯",
                    "category": "效果灯",
                    "quantity": 4,
                    "unit_price": 4500.0
                }
            ]
        }
    )
    set_id = create_response.json()["id"]
    assert create_response.json()["completeness_score"] == 100.0
    
    update_response = client.put(
        f"/lighting-sets/{set_id}",
        json={
            "items": [
                {
                    "item_code": "PAR-001",
                    "item_name": "LED帕灯",
                    "category": "面光灯",
                    "quantity": 8,
                    "unit_price": 2500.0
                }
            ]
        }
    )
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["completeness_score"] == 50.0


def test_rule_08_batch_import_partial_success(db_session):
    """规则8: 批量导入部分成功不中断，返回行级结果"""
    import_data = [
        {
            "set_code": "LIGHT-001",
            "set_name": "套装1",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "available",
            "daily_rental_price": 1000.0,
            "items": [
                {
                    "item_code": "ITEM-001",
                    "item_name": "设备1",
                    "category": "测试",
                    "quantity": 1,
                    "unit_price": 100.0
                }
            ]
        },
        {
            "set_code": "LIGHT-001",
            "set_name": "重复套装",
            "store": "海淀门店",
            "responsible_person": "李四",
            "status": "available",
            "daily_rental_price": 1000.0,
            "items": []
        },
        {
            "set_code": "LIGHT-003",
            "set_name": "套装3",
            "store": "朝阳门店",
            "responsible_person": "王五",
            "status": "available",
            "daily_rental_price": 1000.0,
            "items": [
                {
                    "item_code": "ITEM-003",
                    "item_name": "设备3",
                    "category": "测试",
                    "quantity": 1,
                    "unit_price": 100.0
                }
            ]
        }
    ]
    
    response = client.post("/lighting-sets/batch-import/", json=import_data)
    assert response.status_code == 200
    result = response.json()
    
    assert result["total"] == 3
    assert result["success"] == 2
    assert result["failed"] == 1
    
    assert result["results"][0]["success"] == True
    assert result["results"][1]["success"] == False
    assert len(result["results"][1]["errors"]) > 0
    assert result["results"][2]["success"] == True


def test_rule_09_batch_import_warnings_for_incomplete_set(db_session):
    """规则9: 批量导入时对不成套设备给出警告"""
    import_data = [
        {
            "set_code": "LIGHT-001",
            "set_name": "婚礼灯光套装",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "returned",
            "daily_rental_price": 800.0,
            "items": [
                {
                    "item_code": "ITEM-001",
                    "item_name": "帕灯",
                    "category": "面光灯",
                    "quantity": 2,
                    "unit_price": 100.0,
                    "status": "damaged"
                }
            ]
        }
    ]
    
    response = client.post("/lighting-sets/batch-import/", json=import_data)
    assert response.status_code == 200
    result = response.json()
    
    assert result["success"] == 1
    assert len(result["results"][0]["warnings"]) >= 1
    has_damaged_warning = any("damaged" in w or "状态" in w for w in result["results"][0]["warnings"])
    has_count_warning = any("少于3件" in w for w in result["results"][0]["warnings"])
    assert has_damaged_warning or has_count_warning


def test_rule_10_export_json(db_session):
    """规则10: 导出JSON格式数据"""
    for i in range(2):
        client.post(
            "/lighting-sets/",
            json={
                "set_code": f"LIGHT-00{i+1}",
                "set_name": f"套装{i+1}",
                "store": "朝阳门店",
                "responsible_person": "张三",
                "status": "available",
                "daily_rental_price": 1000.0,
                "items": [
                    {
                        "item_code": f"ITEM-{i}",
                        "item_name": "测试设备",
                        "category": "测试",
                        "quantity": 1,
                        "unit_price": 100.0
                    }
                ]
            }
        )
    
    response = client.get("/lighting-sets/export/json")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert "set_code" in data[0]
    assert "items" in data[0]


def test_rule_11_return_set_with_completeness_check(db_session):
    """规则11: 归还时检查完整性"""
    create_response = client.post(
        "/lighting-sets/",
        json={
            "set_code": "LIGHT-001",
            "set_name": "租赁套装",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "rented",
            "daily_rental_price": 1500.0,
            "items": [
                {
                    "item_code": "PAR-001",
                    "item_name": "LED帕灯",
                    "category": "面光灯",
                    "quantity": 8,
                    "unit_price": 2500.0
                },
                {
                    "item_code": "BEAM-001",
                    "item_name": "230W光束灯",
                    "category": "效果灯",
                    "quantity": 2,
                    "unit_price": 4500.0,
                    "status": "damaged",
                    "condition_description": "灯罩有划痕"
                }
            ]
        }
    )
    set_id = create_response.json()["id"]
    
    return_response = client.put(f"/lighting-sets/{set_id}/return")
    assert return_response.status_code == 200
    result = return_response.json()
    
    assert "completeness_score" in result
    assert "warnings" in result
    assert len(result["warnings"]) > 0


def test_rule_12_delete_lighting_set(db_session):
    """规则12: 删除灯光设备套装"""
    create_response = client.post(
        "/lighting-sets/",
        json={
            "set_code": "LIGHT-001",
            "set_name": "测试套装",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "available",
            "daily_rental_price": 1000.0,
            "items": []
        }
    )
    set_id = create_response.json()["id"]
    
    delete_response = client.delete(f"/lighting-sets/{set_id}")
    assert delete_response.status_code == 200
    
    get_response = client.get(f"/lighting-sets/{set_id}")
    assert get_response.status_code == 404


def test_rule_13_query_by_date_range(db_session):
    """规则13: 按日期范围筛选"""
    client.post(
        "/lighting-sets/",
        json={
            "set_code": "LIGHT-001",
            "set_name": "套装1",
            "store": "朝阳门店",
            "responsible_person": "张三",
            "status": "available",
            "daily_rental_price": 1000.0,
            "items": []
        }
    )
    
    future = (datetime.now() + timedelta(days=1)).isoformat()
    response = client.get(f"/lighting-sets/?start_date={future}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0
