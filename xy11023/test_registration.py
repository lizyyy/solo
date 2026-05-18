import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from main import app
from database import Base, get_db
from models import PesticideCategory, RegistrationStatus

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def run_around_tests():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    from models import PurchaseLimitRule, PesticideCategory
    rules = [
        PurchaseLimitRule(pesticide_category=PesticideCategory.INSECTICIDE, max_quantity_per_month=10, max_quantity_per_purchase=5),
        PurchaseLimitRule(pesticide_category=PesticideCategory.HERBICIDE, max_quantity_per_month=8, max_quantity_per_purchase=4),
        PurchaseLimitRule(pesticide_category=PesticideCategory.FUNGICIDE, max_quantity_per_month=12, max_quantity_per_purchase=6),
    ]
    db.add_all(rules)
    db.commit()
    db.close()
    
    yield


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture
def test_farmer():
    response = client.post(
        "/farmers/",
        json={
            "id_card": "110101199001011234",
            "name": "张三",
            "phone": "13800138000",
            "village": "东村村",
            "town": "李家镇",
            "county": "朝阳县",
            "planting_area": 50.5,
            "planting_crop": "水稻"
        }
    )
    return response.json()


@pytest.fixture
def test_farmer2():
    response = client.post(
        "/farmers/",
        json={
            "id_card": "110101199002025678",
            "name": "李四",
            "phone": "13900139000",
            "village": "西村村",
            "town": "王家镇",
            "county": "朝阳县",
            "planting_area": 30.0,
            "planting_crop": "小麦"
        }
    )
    return response.json()


class TestPesticideRegistration:
    
    def test_create_registration(self, test_farmer):
        purchase_date = datetime.now().isoformat()
        response = client.post(
            "/registrations/",
            json={
                "farmer_id": test_farmer["id"],
                "store_name": "惠农农资店",
                "store_address": "朝阳县李家镇东街88号",
                "store_license_no": "NYJY20240001",
                "pesticide_name": "吡虫啉",
                "pesticide_category": PesticideCategory.INSECTICIDE.value,
                "pesticide_registration_no": "PD20180001",
                "pesticide_manufacturer": "江苏农药厂",
                "specification": "200ml/瓶",
                "quantity": 3.0,
                "unit": "瓶",
                "unit_price": 15.5,
                "total_amount": 46.5,
                "purchase_date": purchase_date,
                "purpose": "水稻田杀虫",
                "crop_area": 20.0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == RegistrationStatus.DRAFT.value
        assert data["pesticide_name"] == "吡虫啉"
        assert data["registration_no"] is not None
        return data
    
    def test_get_registration_list(self, test_farmer):
        self.test_create_registration(test_farmer)
        response = client.get("/registrations/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    def test_get_registration_detail(self, test_farmer):
        registration = self.test_create_registration(test_farmer)
        response = client.get(f"/registrations/{registration['id']}")
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert len(data["history"]) >= 1
    
    def test_submit_registration(self, test_farmer):
        registration = self.test_create_registration(test_farmer)
        response = client.post(
            f"/registrations/{registration['id']}/submit",
            params={"submitter": "张三"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == RegistrationStatus.SUBMITTED.value
        
        response = client.get(f"/registrations/{registration['id']}/history")
        assert response.status_code == 200
        history = response.json()
        assert any(h["change_type"] == "提交" for h in history)


class TestPurchaseLimit:
    
    def test_single_purchase_limit_exceeded(self, test_farmer):
        purchase_date = datetime.now().isoformat()
        response = client.post(
            "/registrations/",
            json={
                "farmer_id": test_farmer["id"],
                "store_name": "惠农农资店",
                "pesticide_name": "高效氯氰菊酯",
                "pesticide_category": PesticideCategory.INSECTICIDE.value,
                "quantity": 6.0,
                "unit": "瓶",
                "purchase_date": purchase_date,
                "purpose": "杀虫"
            }
        )
        assert response.status_code == 400
        assert "单次购买数量超限" in response.json()["detail"]
    
    def test_monthly_purchase_limit_multiple_attempts(self, test_farmer):
        purchase_date = datetime.now()
    
        for i in range(2):
            response = client.post(
                "/registrations/",
                json={
                    "farmer_id": test_farmer["id"],
                    "store_name": "惠农农资店",
                    "pesticide_name": f"杀虫剂{i+1}",
                    "pesticide_category": PesticideCategory.INSECTICIDE.value,
                    "quantity": 4.0,
                    "unit": "瓶",
                    "purchase_date": purchase_date.isoformat(),
                    "purpose": "杀虫"
                }
            )
            assert response.status_code == 200
            reg_id = response.json()["id"]
    
            response = client.post(
                f"/registrations/{reg_id}/submit",
                params={"submitter": "农户"}
            )
            assert response.status_code == 200
    
        response = client.post(
            "/registrations/",
            json={
                "farmer_id": test_farmer["id"],
                "store_name": "惠农农资店",
                "pesticide_name": "杀虫剂3",
                "pesticide_category": PesticideCategory.INSECTICIDE.value,
                "quantity": 3.0,
                "unit": "瓶",
                "purchase_date": purchase_date.isoformat(),
                "purpose": "杀虫"
            }
        )
        assert response.status_code == 400
        assert "本月累计购买超限" in response.json()["detail"]


class TestWithdrawAndResubmit:
    
    def test_withdraw_and_resubmit_flow(self, test_farmer):
        purchase_date = datetime.now().isoformat()
        response = client.post(
            "/registrations/",
            json={
                "farmer_id": test_farmer["id"],
                "store_name": "惠农农资店",
                "pesticide_name": "草甘膦",
                "pesticide_category": PesticideCategory.HERBICIDE.value,
                "quantity": 2.0,
                "unit": "瓶",
                "purchase_date": purchase_date,
                "purpose": "除草"
            }
        )
        assert response.status_code == 200
        registration = response.json()
        reg_id = registration["id"]
        
        response = client.post(
            f"/registrations/{reg_id}/submit",
            params={"submitter": "农户"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == RegistrationStatus.SUBMITTED.value
        
        response = client.post(
            f"/registrations/{reg_id}/withdraw",
            params={"withdrawer": "农户"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == RegistrationStatus.WITHDRAWN.value
        
        response = client.put(
            f"/registrations/{reg_id}",
            params={"changed_by": "农户"},
            json={
                "quantity": 3.0,
                "purpose": "果园除草"
            }
        )
        assert response.status_code == 200
        
        response = client.post(
            f"/registrations/{reg_id}/submit",
            params={"submitter": "农户"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == RegistrationStatus.SUBMITTED.value
        
        response = client.get(f"/registrations/{reg_id}/history")
        assert response.status_code == 200
        history = response.json()
        
        change_types = [h["change_type"] for h in history]
        assert "创建" in change_types
        assert "提交" in change_types
        assert "撤回" in change_types
        assert "修改" in change_types
        
        submit_count = change_types.count("提交")
        assert submit_count >= 2


class TestManualProcess:
    
    def test_manual_process_with_remark_and_submit(self, test_farmer):
        purchase_date = datetime.now().isoformat()
        response = client.post(
            "/registrations/",
            json={
                "farmer_id": test_farmer["id"],
                "store_name": "惠农农资店",
                "pesticide_name": "多菌灵",
                "pesticide_category": PesticideCategory.FUNGICIDE.value,
                "quantity": 2.0,
                "unit": "瓶",
                "purchase_date": purchase_date,
                "purpose": "杀菌"
            }
        )
        assert response.status_code == 200
        registration = response.json()
        reg_id = registration["id"]
        
        response = client.post(
            f"/registrations/{reg_id}/submit",
            params={"submitter": "农户"}
        )
        assert response.status_code == 200
        
        response = client.post(
            f"/registrations/{reg_id}/manual-process",
            params={"processor": "审核员A"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == RegistrationStatus.MANUAL_PROCESSING.value
        
        response = client.post(
            f"/registrations/{reg_id}/manual-remark",
            json={
                "manual_processor": "审核员A",
                "manual_remark": "经核实，该农户确有大面积果树种植，需要增加用量。"
            }
        )
        assert response.status_code == 200
        assert response.json()["manual_remark"] == "经核实，该农户确有大面积果树种植，需要增加用量。"
        
        response = client.post(
            f"/registrations/{reg_id}/submit-from-manual",
            params={"processor": "审核员A"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == RegistrationStatus.UNDER_REVIEW.value
        
        response = client.get(f"/registrations/{reg_id}/history")
        assert response.status_code == 200
        history = response.json()
        
        change_types = [h["change_type"] for h in history]
        assert "人工处理" in change_types
        assert "人工备注" in change_types
        assert "人工提交审核" in change_types
        
        for h in history:
            if h["change_type"] == "人工备注":
                assert h["change_reason"] == "经核实，该农户确有大面积果树种植，需要增加用量。"
                assert h["changed_by"] == "审核员A"


class TestAuditConsistency:
    
    def test_audit_consistency_with_history(self, test_farmer):
        purchase_date = datetime.now().isoformat()
        response = client.post(
            "/registrations/",
            json={
                "farmer_id": test_farmer["id"],
                "store_name": "惠农农资店",
                "pesticide_name": "代森锰锌",
                "pesticide_category": PesticideCategory.FUNGICIDE.value,
                "quantity": 2.0,
                "unit": "瓶",
                "purchase_date": purchase_date,
                "purpose": "防病"
            }
        )
        assert response.status_code == 200
        registration = response.json()
        reg_id = registration["id"]
        
        response = client.post(
            f"/registrations/{reg_id}/submit",
            params={"submitter": "农户"}
        )
        assert response.status_code == 200
        
        response = client.post(
            f"/registrations/{reg_id}/manual-process",
            params={"processor": "审核员B"}
        )
        assert response.status_code == 200
        
        response = client.post(
            f"/registrations/{reg_id}/submit-from-manual",
            params={"processor": "审核员B"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == RegistrationStatus.UNDER_REVIEW.value
        
        response = client.post(
            f"/registrations/{reg_id}/approve",
            json={
                "auditor": "审核员C",
                "audit_opinion": "材料齐全，符合要求，同意通过。"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == RegistrationStatus.APPROVED.value
        assert data["auditor"] == "审核员C"
        assert data["audit_opinion"] == "材料齐全，符合要求，同意通过。"
        
        response = client.get(f"/registrations/{reg_id}/history")
        assert response.status_code == 200
        history = response.json()
        
        change_types = [h["change_type"] for h in history]
        assert "审核通过" in change_types
        
        for h in history:
            if h["change_type"] == "审核通过":
                assert h["changed_by"] == "审核员C"
                assert h["change_reason"] == "材料齐全，符合要求，同意通过。"
        
        response = client.get(f"/registrations/{reg_id}")
        final_data = response.json()
        assert final_data["status"] == RegistrationStatus.APPROVED.value
        assert final_data["auditor"] == "审核员C"
        assert final_data["audit_opinion"] == "材料齐全，符合要求，同意通过。"
        
        for h in history:
            if h["change_type"] == "审核通过":
                assert h["status"] == RegistrationStatus.APPROVED.value


class TestMultipleModifications:
    
    def test_multiple_modifications_history(self, test_farmer):
        purchase_date = datetime.now().isoformat()
        response = client.post(
            "/registrations/",
            json={
                "farmer_id": test_farmer["id"],
                "store_name": "惠农农资店",
                "pesticide_name": "敌敌畏",
                "pesticide_category": PesticideCategory.INSECTICIDE.value,
                "quantity": 2.0,
                "unit": "瓶",
                "purchase_date": purchase_date,
                "purpose": "蔬菜杀虫"
            }
        )
        assert response.status_code == 200
        registration = response.json()
        reg_id = registration["id"]
        
        modifications = [
            {"quantity": 3.0, "purpose": "水稻田杀虫"},
            {"pesticide_name": "敌敌畏乳油", "specification": "300ml/瓶"},
            {"unit_price": 18.0, "total_amount": 54.0},
        ]
        
        for i, mod in enumerate(modifications):
            response = client.put(
                f"/registrations/{reg_id}",
                params={"changed_by": f"操作人员{i+1}"},
                json=mod
            )
            assert response.status_code == 200
        
        response = client.get(f"/registrations/{reg_id}/history")
        assert response.status_code == 200
        history = response.json()
        
        modify_count = sum(1 for h in history if h["change_type"] == "修改")
        assert modify_count == 3
        
        versions = sorted([h["version"] for h in history])
        assert versions == list(range(1, len(history) + 1))
        
        for h in history:
            assert h["store_name"] == "惠农农资店"
            assert h["pesticide_category"] == PesticideCategory.INSECTICIDE.value


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
