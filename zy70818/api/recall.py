from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from datetime import date

from models.recall import RecallNotice
from services.import_service import import_service
from utils.storage import store

router = APIRouter(tags=["召回公告"])


@router.post("/import", summary="导入召回公告Markdown")
async def import_recall(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text_content = content.decode('utf-8')
        result = import_service.import_recall(text_content)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", summary="获取所有召回公告")
async def get_recalls(status: Optional[str] = None):
    items = store.get_all('recall', RecallNotice)
    if status:
        items = [i for i in items if i.status == status]
    return {"count": len(items), "items": [i.model_dump() for i in items]}


@router.get("/{notice_id}", summary="获取单个召回公告")
async def get_recall(notice_id: str):
    item = store.get('recall', notice_id, RecallNotice)
    if not item:
        raise HTTPException(status_code=404, detail="召回公告不存在")
    return item.model_dump()


@router.post("/", summary="创建召回公告")
async def create_recall(item: RecallNotice):
    item_id = store.add('recall', item)
    return {"id": item_id, "message": "创建成功"}


@router.put("/{notice_id}", summary="更新召回公告")
async def update_recall(notice_id: str, item: RecallNotice):
    if store.update('recall', notice_id, item):
        return {"message": "更新成功"}
    raise HTTPException(status_code=404, detail="召回公告不存在")


@router.delete("/{notice_id}", summary="删除召回公告")
async def delete_recall(notice_id: str):
    if store.delete('recall', notice_id):
        return {"message": "删除成功"}
    raise HTTPException(status_code=404, detail="召回公告不存在")
