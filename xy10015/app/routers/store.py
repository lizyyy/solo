from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User
from app.models.store import Store, Product
from app.models.inventory import Inventory, InventoryHistory
from app.schemas.store import (
    StoreCreate, StoreUpdate, StoreResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    InventoryResponse, InventoryAdjustmentRequest, InventoryUpdateRequest
)
from app.schemas.common import PaginatedRequest, PaginatedResponse, BatchOperationRequest, BatchOperationResult
from app.schemas.inventory import InventoryHistoryResponse
from app.services.auth_service import get_current_user
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/stores", tags=["门店管理"])


@router.post("", response_model=StoreResponse)
def create_store(
    store_in: StoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if db.query(Store).filter(Store.code == store_in.code, Store.is_deleted == False).first():
        raise HTTPException(status_code=400, detail="门店编码已存在")

    store = Store(**store_in.model_dump(), created_by=current_user.id)
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("", response_model=PaginatedResponse[StoreResponse])
def list_stores(
    params: PaginatedRequest = Depends(),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Store).filter(Store.is_deleted == False)

    if params.keyword:
        query = query.filter(or_(
            Store.name.contains(params.keyword),
            Store.code.contains(params.keyword)
        ))
    if is_active is not None:
        query = query.filter(Store.is_active == is_active)

    total = query.count()
    stores = query.order_by(Store.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": stores,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


@router.get("/all", response_model=List[StoreResponse])
def list_all_stores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Store).filter(Store.is_deleted == False, Store.is_active == True).all()


@router.get("/{store_id}", response_model=StoreResponse)
def get_store(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    return store


@router.put("/{store_id}", response_model=StoreResponse)
def update_store(
    store_id: int,
    store_in: StoreUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")

    update_data = store_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(store, field, value)
    store.updated_by = current_user.id
    db.commit()
    db.refresh(store)
    return store


@router.delete("/{store_id}")
def delete_store(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")

    inventory_count = db.query(Inventory).filter(
        Inventory.store_id == store_id,
        Inventory.is_deleted == False,
        Inventory.quantity > 0
    ).count()
    if inventory_count > 0:
        raise HTTPException(status_code=400, detail="该门店还有库存，无法删除")

    store.is_deleted = True
    store.updated_by = current_user.id
    db.commit()
    return {"code": 200, "message": "删除成功"}


@router.post("/batch", response_model=BatchOperationResult)
def batch_operation_stores(
    operation: BatchOperationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success_count = 0
    failed_count = 0
    errors = []

    for store_id in operation.ids:
        try:
            store = db.query(Store).filter(Store.id == store_id, Store.is_deleted == False).first()
            if not store:
                failed_count += 1
                errors.append({"id": store_id, "error": "门店不存在"})
                continue

            if operation.action == "activate":
                store.is_active = True
            elif operation.action == "deactivate":
                store.is_active = False
            else:
                failed_count += 1
                errors.append({"id": store_id, "error": "不支持的操作"})
                continue

            store.updated_by = current_user.id
            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append({"id": store_id, "error": str(e)})

    db.commit()
    return {"success_count": success_count, "failed_count": failed_count, "errors": errors}


product_router = APIRouter(prefix="/products", tags=["商品管理"])


@product_router.post("", response_model=ProductResponse)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if db.query(Product).filter(Product.sku == product_in.sku, Product.is_deleted == False).first():
        raise HTTPException(status_code=400, detail="商品SKU已存在")

    product = Product(**product_in.model_dump(), created_by=current_user.id)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@product_router.get("", response_model=PaginatedResponse[ProductResponse])
def list_products(
    params: PaginatedRequest = Depends(),
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product).filter(Product.is_deleted == False)

    if params.keyword:
        query = query.filter(or_(
            Product.name.contains(params.keyword),
            Product.sku.contains(params.keyword),
            Product.barcode.contains(params.keyword)
        ))
    if category:
        query = query.filter(Product.category == category)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    total = query.count()
    products = query.order_by(Product.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": products,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


@product_router.get("/all", response_model=List[ProductResponse])
def list_all_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Product).filter(Product.is_deleted == False, Product.is_active == True).all()


@product_router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    return product


@product_router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    product.updated_by = current_user.id
    db.commit()
    db.refresh(product)
    return product


@product_router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    inventory_count = db.query(Inventory).filter(
        Inventory.product_id == product_id,
        Inventory.is_deleted == False,
        Inventory.quantity > 0
    ).count()
    if inventory_count > 0:
        raise HTTPException(status_code=400, detail="该商品还有库存，无法删除")

    product.is_deleted = True
    product.updated_by = current_user.id
    db.commit()
    return {"code": 200, "message": "删除成功"}


inventory_router = APIRouter(prefix="/inventory", tags=["库存管理"])


@inventory_router.get("", response_model=PaginatedResponse[InventoryResponse])
def list_inventory(
    params: PaginatedRequest = Depends(),
    store_id: Optional[int] = None,
    product_id: Optional[int] = None,
    low_stock: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.store import Product as ProductModel

    query = db.query(Inventory).filter(Inventory.is_deleted == False)

    if store_id:
        query = query.filter(Inventory.store_id == store_id)
    if product_id:
        query = query.filter(Inventory.product_id == product_id)
    if low_stock:
        query = query.join(ProductModel, Inventory.product_id == ProductModel.id).filter(
            Inventory.quantity <= ProductModel.min_stock
        )

    total = query.count()
    inventories = query.order_by(Inventory.updated_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    results = []
    for inv in inventories:
        store = db.query(Store).filter(Store.id == inv.store_id).first()
        product = db.query(ProductModel).filter(ProductModel.id == inv.product_id).first()
        results.append({
            "id": inv.id,
            "store_id": inv.store_id,
            "product_id": inv.product_id,
            "quantity": inv.quantity,
            "reserved_quantity": inv.reserved_quantity,
            "available_quantity": inv.available_quantity,
            "cost_price": inv.cost_price,
            "sale_price": inv.sale_price,
            "product_name": product.name if product else None,
            "product_sku": product.sku if product else None,
            "store_name": store.name if store else None
        })

    return {
        "code": 200,
        "message": "success",
        "data": results,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


@inventory_router.get("/{inventory_id}", response_model=InventoryResponse)
def get_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.store import Product as ProductModel

    inv = db.query(Inventory).filter(Inventory.id == inventory_id, Inventory.is_deleted == False).first()
    if not inv:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    store = db.query(Store).filter(Store.id == inv.store_id).first()
    product = db.query(ProductModel).filter(ProductModel.id == inv.product_id).first()

    return {
        "id": inv.id,
        "store_id": inv.store_id,
        "product_id": inv.product_id,
        "quantity": inv.quantity,
        "reserved_quantity": inv.reserved_quantity,
        "available_quantity": inv.available_quantity,
        "cost_price": inv.cost_price,
        "sale_price": inv.sale_price,
        "product_name": product.name if product else None,
        "product_sku": product.sku if product else None,
        "store_name": store.name if store else None
    }


@inventory_router.post("/adjust")
def adjust_inventory(
    adjustment: InventoryAdjustmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inventory = InventoryService.adjust_quantity(
        db=db,
        store_id=adjustment.store_id,
        product_id=adjustment.product_id,
        new_quantity=adjustment.new_quantity,
        adjustment_type=adjustment.adjustment_type,
        reason=adjustment.reason,
        user_id=current_user.id,
        reference=adjustment.reference
    )
    return {"code": 200, "message": "调整成功", "data": {"inventory_id": inventory.id}}


@inventory_router.put("/{inventory_id}")
def update_inventory_prices(
    inventory_id: int,
    update_data: InventoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inventory = InventoryService.update_prices(
        db=db,
        inventory_id=inventory_id,
        cost_price=update_data.cost_price,
        sale_price=update_data.sale_price,
        user_id=current_user.id
    )
    return {"code": 200, "message": "更新成功", "data": {"inventory_id": inventory.id}}


@inventory_router.get("/{inventory_id}/history", response_model=List[InventoryHistoryResponse])
def get_inventory_history(
    inventory_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return InventoryService.get_inventory_history(db, inventory_id, limit)
