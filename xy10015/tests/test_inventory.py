import pytest
from decimal import Decimal
from app.models.store import Store, Product
from app.models.inventory import Inventory, PriceChange, InventoryTransfer


def test_create_price_change(client, auth_headers, db_session):
    store = Store(name="门店1", code="PC_STORE")
    product = Product(name="商品1", sku="PC_SKU", unit="件", default_cost=10, default_sale_price=20)
    db_session.add_all([store, product])
    db_session.commit()
    db_session.refresh(store)
    db_session.refresh(product)

    response = client.post(
        "/api/v1/price-changes",
        json={
            "store_id": store.id,
            "items": [
                {
                    "product_id": product.id,
                    "new_cost_price": 12.0,
                    "new_sale_price": 25.0
                }
            ],
            "reason": "价格调整"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "pending"


def test_list_price_changes(client, auth_headers, db_session):
    response = client.get("/api/v1/price-changes", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


def test_create_transfer(client, auth_headers, db_session):
    store1 = Store(name="源门店", code="TRF_SRC")
    store2 = Store(name="目标门店", code="TRF_DEST")
    product = Product(name="调拨商品", sku="TRF_SKU", unit="件", default_cost=10, default_sale_price=20)
    db_session.add_all([store1, store2, product])
    db_session.commit()
    db_session.refresh(store1)
    db_session.refresh(store2)
    db_session.refresh(product)

    inv = Inventory(
        store_id=store1.id,
        product_id=product.id,
        quantity=100,
        reserved_quantity=0,
        available_quantity=100,
        cost_price=10,
        sale_price=20
    )
    db_session.add(inv)
    db_session.commit()

    response = client.post(
        "/api/v1/transfers",
        json={
            "source_store_id": store1.id,
            "target_store_id": store2.id,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 10
                }
            ],
            "reason": "门店调拨"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    assert data["total_quantity"] == 10


def test_list_transfers(client, auth_headers, db_session):
    response = client.get("/api/v1/transfers", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


def test_transfer_same_store_error(client, auth_headers, db_session):
    store = Store(name="测试门店", code="TEST_STORE")
    product = Product(name="测试商品", sku="TEST_SKU", unit="件", default_cost=10, default_sale_price=20)
    db_session.add_all([store, product])
    db_session.commit()
    db_session.refresh(store)
    db_session.refresh(product)

    response = client.post(
        "/api/v1/transfers",
        json={
            "source_store_id": store.id,
            "target_store_id": store.id,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 10
                }
            ],
            "reason": "测试调拨"
        },
        headers=auth_headers
    )
    assert response.status_code == 400


def test_inventory_history(client, auth_headers, db_session):
    store = Store(name="门店", code="HIST_STORE")
    product = Product(name="商品", sku="HIST_SKU", unit="件", default_cost=10, default_sale_price=20)
    db_session.add_all([store, product])
    db_session.commit()
    db_session.refresh(store)
    db_session.refresh(product)

    inv = Inventory(
        store_id=store.id,
        product_id=product.id,
        quantity=100,
        reserved_quantity=0,
        available_quantity=100,
        cost_price=10,
        sale_price=20
    )
    db_session.add(inv)
    db_session.commit()
    db_session.refresh(inv)

    response = client.get(f"/api/v1/inventory/{inv.id}/history", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_import_template_download(client, auth_headers):
    response = client.get("/api/v1/import-export/template/inventory", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/")


def test_list_failed_tasks(client, auth_headers):
    response = client.get("/api/v1/failed-tasks", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


def test_list_audit_logs(client, auth_headers):
    response = client.get("/api/v1/audit/logs", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


def test_batch_store_operation(client, auth_headers, db_session):
    store1 = Store(name="批量门店1", code="BATCH01")
    store2 = Store(name="批量门店2", code="BATCH02")
    db_session.add_all([store1, store2])
    db_session.commit()
    db_session.refresh(store1)
    db_session.refresh(store2)

    response = client.post(
        "/api/v1/stores/batch",
        json={
            "ids": [store1.id, store2.id],
            "action": "deactivate"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "success_count" in data
    assert "failed_count" in data
