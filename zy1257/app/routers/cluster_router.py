from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Node, Slot, Request, SlotEvent, FailureEvent
from app.schemas import (
    NodeResponse, SlotResponse, RequestResponse, StatsResponse
)
from app.utils.redis_slot import key_slot

router = APIRouter(prefix="/cluster", tags=["Cluster State"])


@router.get("/nodes", response_model=List[NodeResponse])
def list_nodes(
    role: Optional[str] = None,
    alive_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Node)
    if role:
        query = query.filter(Node.role == role)
    if alive_only:
        query = query.filter(Node.is_alive == True)
    nodes = query.all()
    return nodes


@router.get("/nodes/{node_id}", response_model=NodeResponse)
def get_node(
    node_id: int,
    db: Session = Depends(get_db)
):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.get("/slots", response_model=List[SlotResponse])
def list_slots(
    state: Optional[str] = None,
    migrating_only: bool = False,
    importing_only: bool = False,
    limit: int = 1000,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(Slot)
    if state:
        query = query.filter(Slot.state == state)
    if migrating_only:
        query = query.filter(Slot.is_migrating == True)
    if importing_only:
        query = query.filter(Slot.is_importing == True)
    slots = query.order_by(Slot.slot_number).offset(offset).limit(limit).all()
    return slots


@router.get("/slots/{slot_number}", response_model=SlotResponse)
def get_slot(
    slot_number: int,
    db: Session = Depends(get_db)
):
    slot = db.query(Slot).filter(Slot.slot_number == slot_number).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    return slot


@router.get("/slots/key/{key}")
def get_slot_for_key(
    key: str,
    db: Session = Depends(get_db)
):
    slot_num = key_slot(key)
    slot = db.query(Slot).filter(Slot.slot_number == slot_num).first()
    
    result = {
        "key": key,
        "slot_number": slot_num,
        "slot_info": None,
        "owner_node": None
    }
    
    if slot:
        result["slot_info"] = {
            "state": slot.state,
            "is_migrating": slot.is_migrating,
            "is_importing": slot.is_importing
        }
        
        if slot.owner_node_id:
            node = db.query(Node).filter(Node.node_id == slot.owner_node_id).first()
            if node:
                result["owner_node"] = {
                    "node_id": node.node_id,
                    "host": node.host,
                    "port": node.port,
                    "role": node.role
                }
    
    return result


@router.get("/requests", response_model=List[RequestResponse])
def list_requests(
    command: Optional[str] = None,
    is_read: Optional[bool] = None,
    is_write: Optional[bool] = None,
    is_lua: Optional[bool] = None,
    is_transaction: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(Request)
    if command:
        query = query.filter(Request.command.ilike(f"%{command}%"))
    if is_read is not None:
        query = query.filter(Request.is_read == is_read)
    if is_write is not None:
        query = query.filter(Request.is_write == is_write)
    if is_lua is not None:
        query = query.filter(Request.is_lua == is_lua)
    if is_transaction is not None:
        query = query.filter(Request.is_transaction == is_transaction)
    
    requests = query.order_by(Request.timestamp).offset(offset).limit(limit).all()
    return requests


@router.get("/requests/{request_id}", response_model=RequestResponse)
def get_request(
    request_id: int,
    db: Session = Depends(get_db)
):
    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db)
):
    from app.models import DrillTask, Diagnosis
    return StatsResponse(
        total_nodes=db.query(Node).count(),
        total_slots=db.query(Slot).count(),
        total_requests=db.query(Request).count(),
        total_tasks=db.query(DrillTask).count(),
        total_diagnoses=db.query(Diagnosis).count()
    )
