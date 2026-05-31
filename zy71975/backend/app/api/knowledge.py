from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.error_messages import get_user_friendly_message
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.knowledge import (
    KnowledgeCreate,
    KnowledgeUpdate,
    KnowledgeResponse,
    KnowledgeListItem,
    KnowledgeVersionResponse,
    VersionDiffResponse,
    VersionMarkResponse
)
from app.services.knowledge_service import knowledge_service

router = APIRouter(prefix="/knowledge", tags=["知识库管理"])


@router.get("", response_model=ApiResponse[PaginatedResponse[KnowledgeListItem]])
def get_knowledge_list(
    keyword: Optional[str] = None,
    knowledge_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db)
):
    try:
        items, total, total_pages = knowledge_service.get_knowledge_list(
            db, keyword, knowledge_type, is_active, page, page_size
        )
        return ApiResponse.success(
            data=PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages
            ),
            user_friendly_message="获取知识库列表成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/active", response_model=ApiResponse[list[KnowledgeListItem]])
def get_active_knowledge(db: Session = Depends(get_db)):
    try:
        items = knowledge_service.get_active_knowledge(db)
        return ApiResponse.success(
            data=items,
            user_friendly_message="获取启用的知识库成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/{knowledge_id}", response_model=ApiResponse[KnowledgeResponse])
def get_knowledge(knowledge_id: int, db: Session = Depends(get_db)):
    try:
        knowledge = knowledge_service.get_knowledge(db, knowledge_id)
        return ApiResponse.success(
            data=knowledge,
            user_friendly_message="获取知识库详情成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("", response_model=ApiResponse[KnowledgeResponse])
def create_knowledge(knowledge_in: KnowledgeCreate, db: Session = Depends(get_db)):
    try:
        knowledge = knowledge_service.create_knowledge(db, knowledge_in)
        return ApiResponse.success(
            data=knowledge,
            user_friendly_message="知识库创建成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.put("/{knowledge_id}", response_model=ApiResponse[KnowledgeResponse])
def update_knowledge(
    knowledge_id: int,
    knowledge_in: KnowledgeUpdate,
    auto_increment_version: bool = True,
    db: Session = Depends(get_db)
):
    try:
        knowledge = knowledge_service.update_knowledge(db, knowledge_id, knowledge_in, auto_increment_version)
        return ApiResponse.success(
            data=knowledge,
            user_friendly_message="知识库更新成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.delete("/{knowledge_id}", response_model=ApiResponse)
def delete_knowledge(knowledge_id: int, db: Session = Depends(get_db)):
    try:
        knowledge_service.delete_knowledge(db, knowledge_id)
        return ApiResponse.success(
            user_friendly_message="知识库删除成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.patch("/{knowledge_id}/toggle", response_model=ApiResponse[KnowledgeResponse])
def toggle_knowledge_active(knowledge_id: int, db: Session = Depends(get_db)):
    try:
        knowledge = knowledge_service.toggle_active(db, knowledge_id)
        return ApiResponse.success(
            data=knowledge,
            user_friendly_message="知识库状态更新成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/{knowledge_id}/versions", response_model=ApiResponse[list[KnowledgeVersionResponse]])
def get_knowledge_versions(knowledge_id: int, db: Session = Depends(get_db)):
    try:
        versions = knowledge_service.get_knowledge_versions(db, knowledge_id)
        return ApiResponse.success(
            data=versions,
            user_friendly_message="获取版本列表成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/{knowledge_id}/versions/compare", response_model=ApiResponse[VersionDiffResponse])
def compare_versions(
    knowledge_id: int,
    old_version: Optional[str] = None,
    new_version: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        diff = knowledge_service.compare_versions(db, knowledge_id, old_version, new_version)
        return ApiResponse.success(
            data=diff,
            user_friendly_message="版本对比完成～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("/{knowledge_id}/versions/mark-affected", response_model=ApiResponse[VersionMarkResponse])
def mark_affected_questions(
    knowledge_id: int,
    version: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        result = knowledge_service.mark_affected_questions(db, knowledge_id, version)
        return ApiResponse.success(
            data=result,
            user_friendly_message="受影响问题标记完成～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )
