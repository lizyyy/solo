from app.models.store import Store, Product


def test_create_store(client, auth_headers, db_session_session):
    response = client.post(
        "/api/v1/stores",
        json={
            "name": "测试门店",
            "code": "TEST001",
            "address": "测试地址",
            "phone": "12345678"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "TEST001"
    assert data["name"] == "测试门店"


def test_list_stores(client, auth_headers, db_session):
    store1 = Store(name="门店1", code="ST001")
    store2 = Store(name="门店2", code="ST002")
    db_session.add_all([store1, store2])
    db_session.commit()

    response = client.get("/api/v1/stores", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2


def test_get_store(client, auth_headers, db_session):
    store = Store(name="测试门店", code="TEST002")
    db_session.add(store)
    db_session.commit()
    db_session.refresh(store)

    response = client.get(f"/api/v1/stores/{store.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == store.id


def test_update_store(client, auth_headers, db_session):
    store = Store(name="原始名称", code="TEST003")
    db_session.add(store)
    db_session.commit()
    db_session.refresh(store)

    response = client.put(
        f"/api/v1/stores/{store.id}",
        json={"name": "更新后的名称"},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "更新后的名称"


def test_create_product(client, auth_headers, db_session):
    response = client.post(
        "/api/v1/products",
        json={
            "name": "测试商品",
            "sku": "SKU_TEST001",
            "category": "测试分类",
            "unit": "件",
            "default_cost": 10.0,
            "default_sale_price": 20.0
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "SKU_TEST001"


def test_list_products(client, auth_headers, db_session):
    product1 = Product(name="商品1", sku="SKU1", unit="件", default_cost=0, default_sale_price=0)
    product2 = Product(name="商品2", sku="SKU2", unit="件", default_cost=0, default_sale_price=0)
    db_session.add_all([product1, product2])
    db_session.commit()

    response = client.get("/api/v1/products", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2


def test_get_product(client, auth_headers, db_session):
    product = Product(name="测试商品", sku="SKU_TEST002", unit="件", default_cost=0, default_sale_price=0)
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    response = client.get(f"/api/v1/products/{product.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == product.id


def test_inventory_adjustment(client, auth_headers, db_session):
    store = Store(name="门店", code="INV_STORE")
    product = Product(name="商品", sku="INV_SKU", unit="件", default_cost=10, default_sale_price=20)
    db_session.add_all([store, product])
    db_session.commit()
    db_session.refresh(store)
    db_session.refresh(product)

    response = client.post(
        "/api/v1/inventory/adjust",
        json={
            "store_id": store.id,
            "product_id": product.id,
            "new_quantity": 100,
            "adjustment_type": "set",
            "reason": "初始化库存"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200


def test_list_inventory(client, auth_headers, db_session):
    response = client.get("/api/v1/inventory", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
