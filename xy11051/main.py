from datetime import datetime
import uuid
from typing import List
from fastapi import FastAPI, HTTPException
from models import (
    BoothAddItem, BoothAddItemCreate, BoothAddItemUpdate,
    ModificationRecord, AddItemStatus,
    SubmitRequest, CustomerConfirmRequest, WithdrawRequest,
    ManualProcessRequest, LedgerMatchRequest,
    db
)

app = FastAPI(title="展会搭建队展台加项签认API")


def create_modification_record(
    add_item_id: str,
    operator: str,
    old_status: AddItemStatus,
    new_status: AddItemStatus,
    change_type: str,
    description: str,
    remark: str = None,
    old_data: dict = None,
    new_data: dict = None
) -> ModificationRecord:
    record = ModificationRecord(
        id=str(uuid.uuid4()),
        add_item_id=add_item_id,
        operator=operator,
        old_status=old_status,
        new_status=new_status,
        change_type=change_type,
        description=description,
        remark=remark,
        old_data=old_data,
        new_data=new_data
    )
    db.modification_records.append(record)
    return record


@app.get("/api/add-items", response_model=List[BoothAddItem], summary="获取加项签认列表")
def get_add_items_list():
    return db.add_items


@app.get("/api/add-items/{item_id}", response_model=BoothAddItem, summary="获取加项签认详情")
def get_add_item_detail(item_id: str):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    return item


@app.get("/api/add-items/{item_id}/history", response_model=List[ModificationRecord], summary="获取修改历史")
def get_modification_history(item_id: str):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    return db.get_modification_history(item_id)


@app.post("/api/add-items", response_model=BoothAddItem, summary="创建加项签认")
def create_add_item(item_data: BoothAddItemCreate):
    item_id = str(uuid.uuid4())
    item = BoothAddItem(
        id=item_id,
        **item_data.model_dump(),
        total_price=item_data.quantity * item_data.unit_price,
        verbal_time=datetime.now() if item_data.is_verbal else None
    )
    db.add_items.append(item)
    
    create_modification_record(
        add_item_id=item_id,
        operator=item_data.creator,
        old_status=None,
        new_status=AddItemStatus.DRAFT,
        change_type="创建",
        description=f"创建加项记录：{item_data.add_item_name}",
        old_data=None,
        new_data=item.model_dump()
    )
    
    return item


@app.put("/api/add-items/{item_id}", response_model=BoothAddItem, summary="编辑加项签认")
def update_add_item(item_id: str, update_data: BoothAddItemUpdate, operator: str):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status not in [AddItemStatus.DRAFT, AddItemStatus.WITHDRAWN]:
        raise HTTPException(status_code=400, detail="当前状态不允许编辑")
    
    old_data = item.model_dump()
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(item, key, value)
    
    if 'quantity' in update_dict or 'unit_price' in update_dict:
        item.total_price = item.quantity * item.unit_price
    
    item.update_time = datetime.now()
    
    create_modification_record(
        add_item_id=item_id,
        operator=operator,
        old_status=item.status,
        new_status=item.status,
        change_type="编辑",
        description=f"编辑加项记录",
        old_data=old_data,
        new_data=item.model_dump()
    )
    
    return item


@app.post("/api/add-items/{item_id}/submit", response_model=BoothAddItem, summary="提交加项签认")
def submit_add_item(item_id: str, request: SubmitRequest):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status not in [AddItemStatus.DRAFT, AddItemStatus.WITHDRAWN]:
        raise HTTPException(status_code=400, detail="当前状态不允许提交")
    
    old_status = item.status
    
    if item.is_verbal and not item.customer_confirmed:
        item.status = AddItemStatus.VERBAL_NO_CONFIRM
        description = "提交口头加项，待客户确认"
    else:
        item.status = AddItemStatus.SUBMITTED
        description = "提交加项签认"
    
    item.update_time = datetime.now()
    item.current_remark = request.remark
    
    create_modification_record(
        add_item_id=item_id,
        operator=request.operator,
        old_status=old_status,
        new_status=item.status,
        change_type="提交",
        description=description,
        remark=request.remark
    )
    
    return item


@app.post("/api/add-items/{item_id}/customer-confirm", response_model=BoothAddItem, summary="客户确认")
def customer_confirm(item_id: str, request: CustomerConfirmRequest):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status != AddItemStatus.VERBAL_NO_CONFIRM:
        raise HTTPException(status_code=400, detail="当前状态不需要客户确认")
    
    old_status = item.status
    item.status = AddItemStatus.CUSTOMER_CONFIRMED
    item.customer_confirmed = True
    item.customer_confirm_time = datetime.now()
    item.customer_confirmer = request.confirmer
    item.update_time = datetime.now()
    item.current_remark = request.remark
    
    create_modification_record(
        add_item_id=item_id,
        operator=request.confirmer,
        old_status=old_status,
        new_status=AddItemStatus.CUSTOMER_CONFIRMED,
        change_type="客户确认",
        description="客户确认口头加项",
        remark=request.remark
    )
    
    return item


@app.post("/api/add-items/{item_id}/withdraw", response_model=BoothAddItem, summary="撤回加项签认")
def withdraw_add_item(item_id: str, request: WithdrawRequest):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status not in [AddItemStatus.SUBMITTED, AddItemStatus.VERBAL_NO_CONFIRM, 
                           AddItemStatus.CUSTOMER_CONFIRMED, AddItemStatus.MANUAL_PROCESSING]:
        raise HTTPException(status_code=400, detail="当前状态不允许撤回")
    
    old_status = item.status
    item.status = AddItemStatus.WITHDRAWN
    item.update_time = datetime.now()
    item.current_remark = request.reason
    
    create_modification_record(
        add_item_id=item_id,
        operator=request.operator,
        old_status=old_status,
        new_status=AddItemStatus.WITHDRAWN,
        change_type="撤回",
        description=f"撤回加项签认：{request.reason}",
        remark=request.reason
    )
    
    return item


@app.post("/api/add-items/{item_id}/manual-process", response_model=BoothAddItem, summary="进入人工处理")
def start_manual_process(item_id: str, request: ManualProcessRequest):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status not in [AddItemStatus.SUBMITTED, AddItemStatus.VERBAL_NO_CONFIRM, AddItemStatus.CUSTOMER_CONFIRMED]:
        raise HTTPException(status_code=400, detail="当前状态不允许进入人工处理")
    
    old_status = item.status
    item.status = AddItemStatus.MANUAL_PROCESSING
    item.manual_processor = request.processor
    item.manual_process_start_time = datetime.now()
    item.update_time = datetime.now()
    item.current_remark = request.remark
    
    create_modification_record(
        add_item_id=item_id,
        operator=request.processor,
        old_status=old_status,
        new_status=AddItemStatus.MANUAL_PROCESSING,
        change_type="进入人工处理",
        description="进入人工处理流程",
        remark=request.remark
    )
    
    return item


@app.post("/api/add-items/{item_id}/manual-remark", response_model=BoothAddItem, summary="人工处理添加备注")
def add_manual_remark(item_id: str, request: ManualProcessRequest):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status != AddItemStatus.MANUAL_PROCESSING:
        raise HTTPException(status_code=400, detail="当前状态不是人工处理中")
    
    old_data = item.model_dump()
    item.current_remark = request.remark
    item.update_time = datetime.now()
    
    create_modification_record(
        add_item_id=item_id,
        operator=request.processor,
        old_status=item.status,
        new_status=item.status,
        change_type="人工处理备注",
        description="人工处理添加备注",
        remark=request.remark,
        old_data=old_data,
        new_data=item.model_dump()
    )
    
    return item


@app.post("/api/add-items/{item_id}/manual-submit", response_model=BoothAddItem, summary="人工处理后再次提交")
def manual_resubmit(item_id: str, request: SubmitRequest):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status != AddItemStatus.MANUAL_PROCESSING:
        raise HTTPException(status_code=400, detail="当前状态不是人工处理中")
    
    old_status = item.status
    item.status = AddItemStatus.SUBMITTED
    item.update_time = datetime.now()
    item.current_remark = request.remark
    
    create_modification_record(
        add_item_id=item_id,
        operator=request.operator,
        old_status=old_status,
        new_status=AddItemStatus.SUBMITTED,
        change_type="人工处理后提交",
        description="人工处理完成后再次提交",
        remark=request.remark
    )
    
    return item


@app.post("/api/add-items/{item_id}/ledger-match", response_model=BoothAddItem, summary="台账核对")
def ledger_match(item_id: str, request: LedgerMatchRequest):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status not in [AddItemStatus.SUBMITTED, AddItemStatus.CUSTOMER_CONFIRMED]:
        raise HTTPException(status_code=400, detail="当前状态不允许台账核对")
    
    old_status = item.status
    
    if request.matched:
        item.status = AddItemStatus.LEDGER_MATCHED
        item.ledger_matched = True
        description = "台账核对一致"
    else:
        item.status = AddItemStatus.LEDGER_MISMATCH
        item.ledger_matched = False
        item.ledger_mismatch_reason = request.mismatch_reason
        description = f"台账核对不一致：{request.mismatch_reason}"
    
    item.ledger_match_time = datetime.now()
    item.update_time = datetime.now()
    
    create_modification_record(
        add_item_id=item_id,
        operator=request.operator,
        old_status=old_status,
        new_status=item.status,
        change_type="台账核对",
        description=description,
        remark=request.mismatch_reason
    )
    
    return item


@app.post("/api/add-items/{item_id}/approve", response_model=BoothAddItem, summary="批准加项")
def approve_add_item(item_id: str, operator: str, remark: str = None):
    item = db.get_add_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="加项记录不存在")
    
    if item.status not in [AddItemStatus.LEDGER_MATCHED, AddItemStatus.SUBMITTED, AddItemStatus.CUSTOMER_CONFIRMED]:
        raise HTTPException(status_code=400, detail="当前状态不允许批准")
    
    old_status = item.status
    item.status = AddItemStatus.APPROVED
    item.update_time = datetime.now()
    item.current_remark = remark
    
    create_modification_record(
        add_item_id=item_id,
        operator=operator,
        old_status=old_status,
        new_status=AddItemStatus.APPROVED,
        change_type="批准",
        description="加项签认已批准",
        remark=remark
    )
    
    return item
