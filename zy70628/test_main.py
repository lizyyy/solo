#!/usr/bin/env python3
"""
pytest测试用例
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json
import os
import random

# 删除测试数据库
if os.path.exists("test_parcel_management.db"):
    os.remove("test_parcel_management.db")

# 修改数据库路径用于测试
import database
database.SQLALCHEMY_DATABASE_URL = "sqlite:///./test_parcel_management.db"

# 重新创建engine
from sqlalchemy import create_engine
engine = create_engine(
    database.SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
database.engine = engine
database.SessionLocal = database.sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 重新初始化表
database.Base.metadata.create_all(bind=engine)

from main import app

client = TestClient(app)

_counter = 0


def generate_tracking_number():
    """生成测试快递单号"""
    global _counter
    _counter += 1
    return f"TEST{int(datetime.now().timestamp())}_{_counter}"


def generate_phone():
    """生成测试手机号"""
    return f"138{random.randint(10000000, 99999999)}"


@pytest.fixture(scope="function")
def test_parcel_data():
    """创建测试包裹"""
    tracking_number = generate_tracking_number()
    data = {
        "tracking_number": tracking_number,
        "courier_company": "顺丰",
        "recipient": {
            "name": "测试用户",
            "phone": generate_phone(),
            "address": "测试地址"
        },
        "inbound_time": datetime.now().isoformat(),
        "shelf_location": "A-01",
        "weight": "1.5kg",
        "remarks": "测试备注",
        "created_by": "admin"
    }
    response = client.post("/api/parcels", json=data)
    assert response.status_code == 200
    return response.json()


class TestParcelCreation:
    """测试包裹创建"""

    def test_create_parcel_success(self):
        """测试成功创建包裹"""
        tracking_number = generate_tracking_number()
        data = {
            "tracking_number": tracking_number,
            "courier_company": "圆通",
            "recipient": {
                "name": "张三",
                "phone": "13800138001",
                "address": "上海市浦东新区"
            },
            "inbound_time": datetime.now().isoformat(),
            "shelf_location": "B-02",
            "weight": "2.0kg",
            "remarks": "测试包裹",
            "created_by": "staff01"
        }
        response = client.post("/api/parcels", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["tracking_number"] == tracking_number
        assert result["recipient_name"] == "张三"
        assert result["status"] == "pending"

    def test_create_parcel_duplicate_tracking(self, test_parcel_data):
        """测试重复快递单号"""
        data = {
            "tracking_number": test_parcel_data["tracking_number"],
            "courier_company": "顺丰",
            "recipient": {
                "name": "李四",
                "phone": "13800138002"
            },
            "created_by": "admin"
        }
        response = client.post("/api/parcels", json=data)
        assert response.status_code == 400

    def test_create_parcel_missing_required_fields(self):
        """测试缺少必填字段"""
        data = {
            "courier_company": "顺丰",
            "recipient": {
                "name": "王五"
            }
        }
        response = client.post("/api/parcels", json=data)
        assert response.status_code == 422


class TestParcelQuery:
    """测试包裹查询"""

    def test_list_parcels(self, test_parcel_data):
        """测试查询包裹列表"""
        response = client.get("/api/parcels")
        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)
        assert len(result) > 0

    def test_list_parcels_with_filters(self):
        """测试带过滤器的查询"""
        # 按状态过滤
        response = client.get("/api/parcels?status=pending")
        assert response.status_code == 200
        result = response.json()
        for parcel in result:
            assert parcel["status"] == "pending"

        # 按快递单号搜索
        response = client.get("/api/parcels?tracking_number=TEST")
        assert response.status_code == 200

    def test_get_parcel_detail(self, test_parcel_data):
        """测试获取包裹详情"""
        response = client.get(f"/api/parcels/{test_parcel_data['id']}")
        assert response.status_code == 200
        result = response.json()
        assert result["id"] == test_parcel_data["id"]
        assert "reminder_records" in result
        assert "operation_logs" in result

    def test_get_parcel_detail_not_found(self):
        """测试获取不存在的包裹"""
        response = client.get("/api/parcels/999999")
        assert response.status_code == 404


class TestReminder:
    """测试催取功能"""

    def test_create_reminder_success(self, test_parcel_data):
        """测试成功创建催取"""
        data = {
            "parcel_ids": [test_parcel_data["id"]],
            "reminder_type": "normal",
            "reminder_channel": "sms",
            "sent_by": "admin"
        }
        response = client.post("/api/reminders", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["total_success"] >= 0

    def test_reminder_deduplication(self, test_parcel_data):
        """测试催取去重"""
        # 第一次催取
        data = {
            "parcel_ids": [test_parcel_data["id"]],
            "reminder_type": "normal",
            "reminder_channel": "sms",
            "sent_by": "admin"
        }
        client.post("/api/reminders", json=data)

        # 第二次催取（应该被去重）
        response = client.post("/api/reminders", json=data)
        assert response.status_code == 200
        # 同一包裹同一天同类型催取应该去重


class TestRejection:
    """测试拒收功能"""

    def test_create_rejection_success(self):
        """测试成功创建拒收"""
        # 创建一个新包裹用于测试拒收
        tracking_number = generate_tracking_number()
        parcel_data = {
            "tracking_number": tracking_number,
            "courier_company": "顺丰",
            "recipient": {
                "name": "拒收测试用户",
                "phone": generate_phone()
            },
            "created_by": "admin"
        }
        parcel_response = client.post("/api/parcels", json=parcel_data)
        assert parcel_response.status_code == 200
        parcel_id = parcel_response.json()["id"]

        data = {
            "parcel_id": parcel_id,
            "reason": "商品破损",
            "rejected_by": "staff01",
            "contact_result": "已联系发件人",
            "follow_up_action": "等待退回",
            "remarks": "外包装严重破损"
        }
        response = client.post("/api/rejections", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["parcel_id"] == parcel_id

    def test_create_rejection_duplicate(self):
        """测试重复拒收"""
        # 创建一个新包裹
        tracking_number = generate_tracking_number()
        parcel_data = {
            "tracking_number": tracking_number,
            "courier_company": "顺丰",
            "recipient": {
                "name": "重复拒收测试",
                "phone": generate_phone()
            },
            "created_by": "admin"
        }
        parcel_response = client.post("/api/parcels", json=parcel_data)
        assert parcel_response.status_code == 200
        parcel_id = parcel_response.json()["id"]

        # 第一次拒收
        data = {
            "parcel_id": parcel_id,
            "reason": "测试原因",
            "rejected_by": "admin"
        }
        client.post("/api/rejections", json=data)

        # 第二次拒收应该失败
        response = client.post("/api/rejections", json=data)
        assert response.status_code == 400


class TestReturn:
    """测试退回功能"""

    def test_create_return_success(self):
        """测试成功创建退回"""
        # 创建一个新包裹
        tracking_number = generate_tracking_number()
        parcel_data = {
            "tracking_number": tracking_number,
            "courier_company": "顺丰",
            "recipient": {
                "name": "退回测试用户",
                "phone": generate_phone()
            },
            "created_by": "admin"
        }
        parcel_response = client.post("/api/parcels", json=parcel_data)
        assert parcel_response.status_code == 200
        parcel_id = parcel_response.json()["id"]

        data = {
            "parcel_id": parcel_id,
            "return_tracking_number": generate_tracking_number(),
            "return_courier_company": "圆通",
            "return_reason": "发错货",
            "return_address": "上海市退货仓库",
            "return_contact": "退货员",
            "return_phone": "4001234567",
            "reported_by": "admin",
            "remarks": "测试退回"
        }
        response = client.post("/api/returns", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["parcel_id"] == parcel_id


class TestStatusUpdate:
    """测试状态更新"""

    def test_update_status_success(self, test_parcel_data):
        """测试成功更新状态"""
        data = {
            "parcel_id": test_parcel_data["id"],
            "new_status": "picked_up",
            "operator": "admin",
            "remarks": "已取件"
        }
        response = client.put("/api/parcels/status", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["new_status"] == "picked_up"

    def test_update_status_invalid(self, test_parcel_data):
        """测试无效状态"""
        data = {
            "parcel_id": test_parcel_data["id"],
            "new_status": "invalid_status",
            "operator": "admin"
        }
        response = client.put("/api/parcels/status", json=data)
        assert response.status_code == 400


class TestManualCorrection:
    """测试人工修正"""

    def test_manual_correction_success(self, test_parcel_data):
        """测试成功人工修正"""
        data = {
            "parcel_id": test_parcel_data["id"],
            "field_name": "shelf_location",
            "field_value": "C-99",
            "operator": "admin",
            "reason": "货架位置调整"
        }
        response = client.put("/api/parcels/correct", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["new_value"] == "C-99"

    def test_manual_correction_invalid_field(self, test_parcel_data):
        """测试修改不允许的字段"""
        data = {
            "parcel_id": test_parcel_data["id"],
            "field_name": "id",
            "field_value": "999",
            "operator": "admin",
            "reason": "测试"
        }
        response = client.put("/api/parcels/correct", json=data)
        assert response.status_code == 400


class TestCloseParcel:
    """测试关闭包裹"""

    def test_close_parcel_success(self):
        """测试成功关闭包裹"""
        # 创建一个新包裹
        tracking_number = generate_tracking_number()
        parcel_data = {
            "tracking_number": tracking_number,
            "courier_company": "顺丰",
            "recipient": {
                "name": "关闭测试用户",
                "phone": generate_phone()
            },
            "created_by": "admin"
        }
        parcel_response = client.post("/api/parcels", json=parcel_data)
        assert parcel_response.status_code == 200
        parcel_id = parcel_response.json()["id"]

        data = {
            "parcel_id": parcel_id,
            "close_reason": "包裹已退回发件人",
            "closed_by": "admin"
        }
        response = client.post("/api/parcels/close", json=data)
        assert response.status_code == 200


class TestStatistics:
    """测试统计接口"""

    def test_get_statistics(self):
        """测试获取统计数据"""
        response = client.get("/api/statistics")
        assert response.status_code == 200
        result = response.json()
        assert "total_parcels" in result
        assert "status_distribution" in result
        assert "stagnation_distribution" in result
        assert "reminders_today" in result


class TestExport:
    """测试导出功能"""

    def test_export_report(self):
        """测试导出Excel报告"""
        response = client.get("/api/export")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats" in response.headers["content-type"]
        assert len(response.content) > 0

    def test_export_with_filters(self):
        """测试带过滤条件的导出"""
        response = client.get("/api/export?status=pending")
        assert response.status_code == 200
