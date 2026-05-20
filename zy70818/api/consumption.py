from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from datetime import date

from models.consumption import ConsumptionItem
from services.import_service import import_service
from utils.storage import store

router = APIRouter(tags=["门店消耗"])


@router.post("/import", summary="导入消耗CSV")
async def import_consumption(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text_content = content.decode('utf-8-sig')
        result = import_service.import_consumption(text_content)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", summary="获取所有消耗记录")
async def get_consumption(store_name: Optional[str] = None, is_transfer: Optional[bool] = None):
    items = store.get_all('consumption', ConsumptionItem)
    if store_name:
        items = [i for i in items if i.store_name == store_name]
    if is_transfer is not None:
        items = [i for i in items if i.is_transfer == is_transfer]
    return {"count": len(items), "items": [i.model_dump() for i in items]}


@router.get("/{item_id}", summary="获取单个消耗记录")
async def get_consumption_item(item_id: str):
    item = store.get('consumption', item_id, ConsumptionItem)
    if not item:
        raise HTTPException(status_code=404, detail="消耗记录不存在")
    return item.model_dump()


@router.post("/", summary="创建消耗记录")
async def create_consumption_item(item: ConsumptionItem):
    item_id = store.add('consumption', item)
    return {"id": item_id, "message": "创建成功"}


@router.put("/{item_id}", summary="更新消耗记录")
async def update_consumption_item(item_id: str, item: ConsumptionItem):
    if store.update('consumption', item_id, item):
        return {"message": "更新成功"}
    raise HTTPException(status_code=404, detail="消耗记录不存在")


@router.delete("/{item_id}", summary="删除消耗记录")
async def delete_consumption_item(item_id: str):
    if store.delete('consumption', item_id):
        return {"message": "删除成功"}
    raise HTTPException(status_code=404, detail="消耗记录不存在")
