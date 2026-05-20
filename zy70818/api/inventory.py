from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from datetime import date

from models.inventory import InventoryItem
from services.import_service import import_service
from utils.storage import store

router = APIRouter(tags=["库存管理"])


@router.post("/import", summary="导入库存CSV")
async def import_inventory(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text_content = content.decode('utf-8-sig')
        result = import_service.import_inventory(text_content)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", summary="获取所有库存记录")
async def get_inventory(store_name: Optional[str] = None):
    items = store.get_all('inventory', InventoryItem)
    if store_name:
        items = [i for i in items if i.store_name == store_name]
    return {"count": len(items), "items": [i.model_dump() for i in items]}


@router.get("/{item_id}", summary="获取单个库存记录")
async def get_inventory_item(item_id: str):
    item = store.get('inventory', item_id, InventoryItem)
    if not item:
        raise HTTPException(status_code=404, detail="库存记录不存在")
    return item.model_dump()


@router.post("/", summary="创建库存记录")
async def create_inventory_item(item: InventoryItem):
    item_id = store.add('inventory', item)
    return {"id": item_id, "message": "创建成功"}


@router.put("/{item_id}", summary="更新库存记录")
async def update_inventory_item(item_id: str, item: InventoryItem):
    if store.update('inventory', item_id, item):
        return {"message": "更新成功"}
    raise HTTPException(status_code=404, detail="库存记录不存在")


@router.delete("/{item_id}", summary="删除库存记录")
async def delete_inventory_item(item_id: str):
    if store.delete('inventory', item_id):
        return {"message": "删除成功"}
    raise HTTPException(status_code=404, detail="库存记录不存在")
