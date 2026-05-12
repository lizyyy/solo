from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.schemas import (
    MemberCreate, MemberResponse, APIResponse, TransactionResponse
)
from app.services import MemberService

router = APIRouter(prefix="/api/members", tags=["会员管理"])

@router.post("", response_model=APIResponse)
def create_member(member_data: MemberCreate, db: Session = Depends(get_db)):
    try:
        member = MemberService.create_member(db, member_data)
        return APIResponse(
            success=True,
            code="MEMBER_CREATED",
            message=f"会员 {member.member_no} 创建成功",
            data=MemberResponse.model_validate(member).model_dump()
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="MEMBER_CREATE_FAILED",
            message=str(e),
            data=None
        )

@router.get("/{member_no}", response_model=APIResponse)
def get_member(member_no: str, db: Session = Depends(get_db)):
    member = MemberService.get_member(db, member_no)
    if not member:
        return APIResponse(
            success=False,
            code="MEMBER_NOT_FOUND",
            message=f"会员 {member_no} 不存在",
            data=None
        )
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data=MemberResponse.model_validate(member).model_dump()
    )

@router.get("/phone/{phone}", response_model=APIResponse)
def get_members_by_phone(phone: str, db: Session = Depends(get_db)):
    members = MemberService.get_members_by_phone(db, phone)
    return APIResponse(
        success=True,
        code="OK",
        message=f"找到 {len(members)} 个会员",
        data=[MemberResponse.model_validate(m).model_dump() for m in members]
    )

@router.get("/{member_no}/transactions", response_model=APIResponse)
def get_member_transactions(member_no: str, db: Session = Depends(get_db)):
    member = MemberService.get_member(db, member_no)
    if not member:
        return APIResponse(
            success=False,
            code="MEMBER_NOT_FOUND",
            message=f"会员 {member_no} 不存在",
            data=None
        )
    transactions = MemberService.get_transactions(db, member.id)
    return APIResponse(
        success=True,
        code="OK",
        message=f"找到 {len(transactions)} 条交易记录",
        data=[TransactionResponse.model_validate(t).model_dump() for t in transactions]
    )
