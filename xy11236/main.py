from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
import uvicorn
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import hashlib
import json
import csv
import io
import re
from enum import Enum

app = FastAPI(title="高校实验室试剂管理系统", version="1.0.0")

DANGER_LEVELS = {"剧毒", "易制爆", "易制毒", "腐蚀", "氧化", "易燃", "普通"}

APPROVAL_LEVELS = {
    "普通": 1,
    "易燃": 1,
    "氧化": 1,
    "腐蚀": 2,
    "易制毒": 3,
    "易制爆": 3,
    "剧毒": 4
}

class Role(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"

class RecordStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ISSUED = "issued"
    RETURNED = "returned"

class BadRecord(BaseModel):
    row_number: int
    original_data: Dict[str, Any]
    error_reason: str
    suggestion: str
    import_batch: str

class ChemicalDangerRule(BaseModel):
    id: str
    cas_number: str
    chinese_name: str
    danger_level: str
    approval_level: int
    max_single_apply: float
    max_stock: float
    need_special_storage: bool = False

class InventoryItem(BaseModel):
    id: str
    cas_number: str
    chinese_name: str
    specification: str
    quantity: float
    unit: str
    location: str
    batch_number: Optional[str] = None
    expire_date: Optional[str] = None
    supplier: Optional[str] = None
    danger_level: str = "普通"

class ApplicationForm(BaseModel):
    id: str
    applicant_id: str
    applicant_name: str
    applicant_role: Role
    cas_number: str
    chinese_name: str
    quantity: float
    unit: str
    purpose: str
    lab_name: str
    status: RecordStatus = RecordStatus.PENDING
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    idempotency_key: Optional[str] = None

class ApprovalRecord(BaseModel):
    id: str
    application_id: str
    approver_id: str
    approver_name: str
    approval_level: int
    decision: str
    comment: Optional[str] = None
    approved_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    idempotency_key: Optional[str] = None

class OperationLog(BaseModel):
    id: str
    operation_type: str
    operator_id: str
    operator_name: str
    target_id: str
    target_type: str
    details: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

class InventoryRecord(BaseModel):
    id: str
    operation_type: str
    cas_number: str
    chinese_name: str
    quantity_change: float
    remaining_quantity: float
    operator_id: str
    operator_name: str
    related_application_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

class CreateApplicationRequest(BaseModel):
    applicant_id: str
    applicant_name: str
    applicant_role: Role
    cas_number: str
    chinese_name: str
    quantity: float
    unit: str
    purpose: str
    lab_name: str
    idempotency_key: Optional[str] = None

class ApproveApplicationRequest(BaseModel):
    application_id: str
    approver_id: str
    approver_name: str
    approval_level: int
    decision: str
    comment: Optional[str] = None
    idempotency_key: Optional[str] = None

class IssueChemicalRequest(BaseModel):
    application_id: str
    operator_id: str
    operator_name: str
    idempotency_key: Optional[str] = None

class ReturnChemicalRequest(BaseModel):
    application_id: str
    returned_quantity: float
    operator_id: str
    operator_name: str
    comment: Optional[str] = None
    idempotency_key: Optional[str] = None

class StocktakeRequest(BaseModel):
    cas_number: str
    actual_quantity: float
    operator_id: str
    operator_name: str
    comment: Optional[str] = None
    idempotency_key: Optional[str] = None

class StocktakeRecord(BaseModel):
    id: str
    cas_number: str
    chinese_name: str
    expected_quantity: float
    actual_quantity: float
    difference: float
    operator_id: str
    operator_name: str
    comment: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

chemical_rules: Dict[str, ChemicalDangerRule] = {}
inventory: Dict[str, InventoryItem] = {}
applications: Dict[str, ApplicationForm] = {}
approvals: Dict[str, ApprovalRecord] = {}
operation_logs: List[OperationLog] = []
inventory_records: List[InventoryRecord] = []
stocktake_records: List[StocktakeRecord] = []
bad_records: List[BadRecord] = []
processed_idempotency_keys: set = set()

def generate_idempotency_key(data: Dict[str, Any]) -> str:
    data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

def mask_sensitive_field(value: Optional[str]) -> Optional[str]:
    if not value or len(value) <= 2:
        return value
    return value[0] + "*" * (len(value) - 2) + value[-1]

def sanitize_for_export(data: Dict[str, Any]) -> Dict[str, Any]:
    sensitive_fields = ["applicant_id", "approver_id", "operator_id", "supplier"]
    result = data.copy()
    for field in sensitive_fields:
        if field in result:
            result[field] = mask_sensitive_field(result[field])
    return result

def validate_cas_number(cas: str) -> bool:
    if not cas:
        return False
    pattern = r'^\d{2,7}-\d{2}-\d$'
    if not re.match(pattern, cas):
        return False
    parts = cas.split('-')
    if len(parts) != 3:
        return False
    return True

def validate_quantity(quantity: float) -> bool:
    return quantity > 0

def get_approval_level(danger_level: str) -> int:
    return APPROVAL_LEVELS.get(danger_level, 1)

@app.post("/import/chemical-rules", response_model=Dict[str, Any])
async def import_chemical_rules(file: UploadFile = File(...)):
    batch_id = str(uuid.uuid4())
    content = await file.read()
    success_count = 0
    failed_count = 0
    
    if file.filename.endswith('.json'):
        data = json.loads(content.decode('utf-8'))
        rules_list = data if isinstance(data, list) else data.get('data', [])
    elif file.filename.endswith('.csv'):
        df = csv.DictReader(io.StringIO(content.decode('utf-8')))
        rules_list = list(df)
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    for idx, item in enumerate(rules_list, start=2):
        idempotency_key = generate_idempotency_key(item)
        if idempotency_key in processed_idempotency_keys:
            continue
            
        try:
            cas_number = str(item.get('cas_number', item.get('CAS号', ''))).strip()
            chinese_name = str(item.get('chinese_name', item.get('中文名', ''))).strip()
            danger_level = str(item.get('danger_level', item.get('危险等级', '普通'))).strip()
            
            errors = []
            if not validate_cas_number(cas_number):
                errors.append(f"CAS号格式不正确: {cas_number}")
            if not chinese_name:
                errors.append("中文名不能为空")
            if danger_level not in DANGER_LEVELS:
                errors.append(f"危险等级不在有效范围内: {danger_level}")
            
            if errors:
                failed_count += 1
                bad_records.append(BadRecord(
                    row_number=idx,
                    original_data=item,
                    error_reason="; ".join(errors),
                    suggestion="请检查CAS号格式（应为XXX-XX-X）、填写完整中文名、选择有效危险等级",
                    import_batch=batch_id
                ))
                continue
            
            rule = ChemicalDangerRule(
                id=str(uuid.uuid4()),
                cas_number=cas_number,
                chinese_name=chinese_name,
                danger_level=danger_level,
                approval_level=get_approval_level(danger_level),
                max_single_apply=float(item.get('max_single_apply', item.get('单次最大申领量', 1000))),
                max_stock=float(item.get('max_stock', item.get('最大库存量', 5000))),
                need_special_storage=bool(item.get('need_special_storage', danger_level in ["剧毒", "易制爆", "易制毒"]))
            )
            
            chemical_rules[cas_number] = rule
            processed_idempotency_keys.add(idempotency_key)
            success_count += 1
            
            operation_logs.append(OperationLog(
                id=str(uuid.uuid4()),
                operation_type="import_rule",
                operator_id="system",
                operator_name="系统导入",
                target_id=rule.id,
                target_type="chemical_rule",
                details=f"导入危化品规则: {chinese_name} ({cas_number})"
            ))
            
        except Exception as e:
            failed_count += 1
            bad_records.append(BadRecord(
                row_number=idx,
                original_data=item,
                error_reason=f"解析失败: {str(e)}",
                suggestion="检查数据格式是否正确，数值字段是否为有效数字",
                import_batch=batch_id
            ))
    
    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "failed_count": failed_count,
        "message": f"成功导入 {success_count} 条规则，失败 {failed_count} 条"
    }

@app.post("/import/inventory", response_model=Dict[str, Any])
async def import_inventory(file: UploadFile = File(...)):
    batch_id = str(uuid.uuid4())
    content = await file.read()
    success_count = 0
    failed_count = 0
    
    if file.filename.endswith('.json'):
        data = json.loads(content.decode('utf-8'))
        inventory_list = data if isinstance(data, list) else data.get('data', [])
    elif file.filename.endswith('.csv'):
        df = csv.DictReader(io.StringIO(content.decode('utf-8')))
        inventory_list = list(df)
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    for idx, item in enumerate(inventory_list, start=2):
        idempotency_key = generate_idempotency_key(item)
        if idempotency_key in processed_idempotency_keys:
            continue
            
        try:
            cas_number = str(item.get('cas_number', item.get('CAS号', ''))).strip()
            chinese_name = str(item.get('chinese_name', item.get('中文名', ''))).strip()
            quantity = float(item.get('quantity', item.get('数量', 0)))
            unit = str(item.get('unit', item.get('单位', 'g'))).strip()
            location = str(item.get('location', item.get('存放位置', ''))).strip()
            
            errors = []
            if not validate_cas_number(cas_number):
                errors.append(f"CAS号格式不正确: {cas_number}")
            if not chinese_name:
                errors.append("中文名不能为空")
            if not validate_quantity(quantity):
                errors.append(f"数量必须大于0: {quantity}")
            if not location:
                errors.append("存放位置不能为空")
            
            if errors:
                failed_count += 1
                bad_records.append(BadRecord(
                    row_number=idx,
                    original_data=item,
                    error_reason="; ".join(errors),
                    suggestion="请检查CAS号格式、填写完整信息、确保数量为正数",
                    import_batch=batch_id
                ))
                continue
            
            inv_item = InventoryItem(
                id=str(uuid.uuid4()),
                cas_number=cas_number,
                chinese_name=chinese_name,
                specification=str(item.get('specification', item.get('规格', ''))),
                quantity=quantity,
                unit=unit,
                location=location,
                batch_number=str(item.get('batch_number', item.get('批号', ''))),
                expire_date=str(item.get('expire_date', item.get('有效期', ''))),
                supplier=str(item.get('supplier', item.get('供应商', ''))),
                danger_level=str(item.get('danger_level', item.get('危险等级', '普通')))
            )
            
            inventory[cas_number] = inv_item
            processed_idempotency_keys.add(idempotency_key)
            success_count += 1
            
            operation_logs.append(OperationLog(
                id=str(uuid.uuid4()),
                operation_type="import_inventory",
                operator_id="system",
                operator_name="系统导入",
                target_id=inv_item.id,
                target_type="inventory",
                details=f"导入库存: {chinese_name} ({cas_number}), 数量: {quantity}{unit}"
            ))
            
        except Exception as e:
            failed_count += 1
            bad_records.append(BadRecord(
                row_number=idx,
                original_data=item,
                error_reason=f"解析失败: {str(e)}",
                suggestion="检查数据格式是否正确，数值字段是否为有效数字",
                import_batch=batch_id
            ))
    
    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "failed_count": failed_count,
        "message": f"成功导入 {success_count} 条库存，失败 {failed_count} 条"
    }

@app.post("/import/applications", response_model=Dict[str, Any])
async def import_applications(file: UploadFile = File(...)):
    batch_id = str(uuid.uuid4())
    content = await file.read()
    success_count = 0
    failed_count = 0
    
    if file.filename.endswith('.json'):
        data = json.loads(content.decode('utf-8'))
        app_list = data if isinstance(data, list) else data.get('data', [])
    elif file.filename.endswith('.csv'):
        df = csv.DictReader(io.StringIO(content.decode('utf-8')))
        app_list = list(df)
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式")
    
    for idx, item in enumerate(app_list, start=2):
        idempotency_key = generate_idempotency_key(item)
        if idempotency_key in processed_idempotency_keys:
            continue
            
        try:
            applicant_id = str(item.get('applicant_id', item.get('申请人ID', ''))).strip()
            applicant_name = str(item.get('applicant_name', item.get('申请人姓名', ''))).strip()
            cas_number = str(item.get('cas_number', item.get('CAS号', ''))).strip()
            chinese_name = str(item.get('chinese_name', item.get('中文名', ''))).strip()
            quantity = float(item.get('quantity', item.get('数量', 0)))
            purpose = str(item.get('purpose', item.get('用途', ''))).strip()
            lab_name = str(item.get('lab_name', item.get('实验室名称', ''))).strip()
            
            errors = []
            if not applicant_id:
                errors.append("申请人ID不能为空")
            if not applicant_name:
                errors.append("申请人姓名不能为空")
            if not validate_cas_number(cas_number):
                errors.append(f"CAS号格式不正确: {cas_number}")
            if not chinese_name:
                errors.append("中文名不能为空")
            if not validate_quantity(quantity):
                errors.append(f"数量必须大于0: {quantity}")
            if not purpose:
                errors.append("用途不能为空")
            if not lab_name:
                errors.append("实验室名称不能为空")
            
            if cas_number in chemical_rules:
                rule = chemical_rules[cas_number]
                if quantity > rule.max_single_apply:
                    errors.append(f"申领数量({quantity})超过单次最大申领量({rule.max_single_apply})")
            
            if cas_number in inventory:
                if quantity > inventory[cas_number].quantity:
                    errors.append(f"申领数量({quantity})超过当前库存量({inventory[cas_number].quantity})")
            
            if errors:
                failed_count += 1
                bad_records.append(BadRecord(
                    row_number=idx,
                    original_data=item,
                    error_reason="; ".join(errors),
                    suggestion="请检查必填项、CAS号、数量是否合理，确认库存是否充足",
                    import_batch=batch_id
                ))
                continue
            
            app = ApplicationForm(
                id=str(uuid.uuid4()),
                applicant_id=applicant_id,
                applicant_name=applicant_name,
                applicant_role=Role(str(item.get('applicant_role', item.get('角色', 'student')))),
                cas_number=cas_number,
                chinese_name=chinese_name,
                quantity=quantity,
                unit=str(item.get('unit', item.get('单位', 'g'))),
                purpose=purpose,
                lab_name=lab_name,
                idempotency_key=idempotency_key
            )
            
            applications[app.id] = app
            processed_idempotency_keys.add(idempotency_key)
            success_count += 1
            
            operation_logs.append(OperationLog(
                id=str(uuid.uuid4()),
                operation_type="import_application",
                operator_id="system",
                operator_name="系统导入",
                target_id=app.id,
                target_type="application",
                details=f"导入申领单: {applicant_name} 申请 {chinese_name} {quantity}"
            ))
            
        except Exception as e:
            failed_count += 1
            bad_records.append(BadRecord(
                row_number=idx,
                original_data=item,
                error_reason=f"解析失败: {str(e)}",
                suggestion="检查数据格式是否正确，数值字段是否为有效数字",
                import_batch=batch_id
            ))
    
    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "failed_count": failed_count,
        "message": f"成功导入 {success_count} 条申领单，失败 {failed_count} 条"
    }

@app.get("/bad-records", response_model=List[Dict[str, Any]])
def get_bad_records(batch_id: Optional[str] = None):
    result = []
    for record in bad_records:
        if batch_id and record.import_batch != batch_id:
            continue
        result.append({
            "row_number": record.row_number,
            "original_data": sanitize_for_export(record.original_data),
            "error_reason": record.error_reason,
            "suggestion": record.suggestion,
            "import_batch": record.import_batch
        })
    return result

@app.post("/application/create", response_model=Dict[str, Any])
def create_application(request: CreateApplicationRequest):
    if not request.idempotency_key:
        temp_data = {
            "applicant_id": request.applicant_id,
            "cas_number": request.cas_number,
            "quantity": request.quantity,
            "purpose": request.purpose,
            "timestamp": datetime.now().isoformat()
        }
        request.idempotency_key = generate_idempotency_key(temp_data)
    
    if request.idempotency_key in processed_idempotency_keys:
        for app in applications.values():
            if app.idempotency_key == request.idempotency_key:
                return {
                    "application_id": app.id,
                    "status": app.status,
                    "message": "重复提交，返回已有申领单",
                    "is_idempotent": True
                }
    
    errors = []
    warnings = []
    
    if not validate_cas_number(request.cas_number):
        errors.append(f"CAS号格式不正确: {request.cas_number}")
    if request.quantity <= 0:
        errors.append(f"数量必须大于0: {request.quantity}")
    
    if request.cas_number in chemical_rules:
        rule = chemical_rules[request.cas_number]
        if request.quantity > rule.max_single_apply:
            errors.append(f"申领数量({request.quantity})超过单次最大申领量({rule.max_single_apply})，需额外审批")
    
    if request.cas_number in inventory:
        if request.quantity > inventory[request.cas_number].quantity:
            warnings.append(f"申领数量({request.quantity})超过当前库存量({inventory[request.cas_number].quantity})")
    else:
        warnings.append("该化学品暂无库存记录")
    
    if errors:
        raise HTTPException(status_code=400, detail={
            "errors": errors,
            "warnings": warnings,
            "suggestion": "请修正错误后重新提交"
        })
    
    app = ApplicationForm(
        id=str(uuid.uuid4()),
        applicant_id=request.applicant_id,
        applicant_name=request.applicant_name,
        applicant_role=request.applicant_role,
        cas_number=request.cas_number,
        chinese_name=request.chinese_name,
        quantity=request.quantity,
        unit=request.unit,
        purpose=request.purpose,
        lab_name=request.lab_name,
        idempotency_key=request.idempotency_key
    )
    
    applications[app.id] = app
    processed_idempotency_keys.add(request.idempotency_key)
    
    operation_logs.append(OperationLog(
        id=str(uuid.uuid4()),
        operation_type="create_application",
        operator_id=mask_sensitive_field(request.applicant_id),
        operator_name=request.applicant_name,
        target_id=app.id,
        target_type="application",
        details=f"创建申领单: {request.chinese_name} {request.quantity}{request.unit}"
    ))
    
    return {
        "application_id": app.id,
        "status": app.status,
        "message": "申领单创建成功",
        "warnings": warnings,
        "is_idempotent": False
    }

@app.post("/application/approve", response_model=Dict[str, Any])
def approve_application(request: ApproveApplicationRequest):
    if request.application_id not in applications:
        raise HTTPException(status_code=404, detail="申领单不存在")
    
    app = applications[request.application_id]
    
    if not request.idempotency_key:
        temp_data = {
            "application_id": request.application_id,
            "approver_id": request.approver_id,
            "decision": request.decision
        }
        request.idempotency_key = generate_idempotency_key(temp_data)
    
    if request.idempotency_key in processed_idempotency_keys:
        for approval in approvals.values():
            if approval.idempotency_key == request.idempotency_key:
                return {
                    "approval_id": approval.id,
                    "message": "重复审批，返回已有审批记录",
                    "is_idempotent": True
                }
    
    if app.status not in [RecordStatus.PENDING, RecordStatus.APPROVED]:
        raise HTTPException(status_code=400, detail="申领单状态不允许审批")
    
    required_level = 1
    if app.cas_number in chemical_rules:
        required_level = chemical_rules[app.cas_number].approval_level
    
    if request.approval_level < required_level:
        raise HTTPException(status_code=403, detail={
            "message": f"审批级别不足",
            "required_level": required_level,
            "provided_level": request.approval_level,
            "explanation": f"该化学品危险等级需要{required_level}级审批，当前仅提供{request.approval_level}级"
        })
    
    approval = ApprovalRecord(
        id=str(uuid.uuid4()),
        application_id=request.application_id,
        approver_id=request.approver_id,
        approver_name=request.approver_name,
        approval_level=request.approval_level,
        decision=request.decision,
        comment=request.comment,
        idempotency_key=request.idempotency_key
    )
    
    approvals[approval.id] = approval
    processed_idempotency_keys.add(request.idempotency_key)
    
    if request.decision == "approve":
        app.status = RecordStatus.APPROVED
    elif request.decision == "reject":
        app.status = RecordStatus.REJECTED
    
    operation_logs.append(OperationLog(
        id=str(uuid.uuid4()),
        operation_type="approve_application",
        operator_id=mask_sensitive_field(request.approver_id),
        operator_name=request.approver_name,
        target_id=request.application_id,
        target_type="application",
        details=f"审批申领单: {request.decision}, {request.comment or '无备注'}"
    ))
    
    return {
        "approval_id": approval.id,
        "application_status": app.status,
        "message": "审批成功",
        "is_idempotent": False
    }

@app.post("/inventory/issue", response_model=Dict[str, Any])
def issue_chemical(request: IssueChemicalRequest):
    if request.application_id not in applications:
        raise HTTPException(status_code=404, detail="申领单不存在")
    
    app = applications[request.application_id]
    
    if app.status != RecordStatus.APPROVED:
        raise HTTPException(status_code=400, detail={
            "message": "申领单未通过审批，无法出库",
            "current_status": app.status,
            "explanation": "必须先通过审批才能出库"
        })
    
    if not request.idempotency_key:
        temp_data = {
            "application_id": request.application_id,
            "operation": "issue"
        }
        request.idempotency_key = generate_idempotency_key(temp_data)
    
    if request.idempotency_key in processed_idempotency_keys:
        for record in inventory_records:
            if record.related_application_id == request.application_id and record.operation_type == "issue":
                return {
                    "record_id": record.id,
                    "message": "重复出库，返回已有出库记录",
                    "remaining_quantity": record.remaining_quantity,
                    "is_idempotent": True
                }
    
    if app.cas_number not in inventory:
        raise HTTPException(status_code=400, detail={
            "message": "该化学品无库存记录",
            "cas_number": app.cas_number,
            "explanation": "请先导入库存数据"
        })
    
    inv_item = inventory[app.cas_number]
    
    if inv_item.quantity < app.quantity:
        raise HTTPException(status_code=400, detail={
            "message": "库存不足",
            "requested": app.quantity,
            "available": inv_item.quantity,
            "explanation": f"需要 {app.quantity}{inv_item.unit}，但仅存 {inv_item.quantity}{inv_item.unit}"
        })
    
    inv_item.quantity -= app.quantity
    app.status = RecordStatus.ISSUED
    
    record = InventoryRecord(
        id=str(uuid.uuid4()),
        operation_type="issue",
        cas_number=app.cas_number,
        chinese_name=app.chinese_name,
        quantity_change=-app.quantity,
        remaining_quantity=inv_item.quantity,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        related_application_id=request.application_id
    )
    
    inventory_records.append(record)
    processed_idempotency_keys.add(request.idempotency_key)
    
    operation_logs.append(OperationLog(
        id=str(uuid.uuid4()),
        operation_type="issue_chemical",
        operator_id=mask_sensitive_field(request.operator_id),
        operator_name=request.operator_name,
        target_id=request.application_id,
        target_type="application",
        details=f"出库: {app.chinese_name} {app.quantity}{inv_item.unit}"
    ))
    
    return {
        "record_id": record.id,
        "remaining_quantity": inv_item.quantity,
        "message": "出库成功",
        "is_idempotent": False
    }

@app.post("/inventory/return", response_model=Dict[str, Any])
def return_chemical(request: ReturnChemicalRequest):
    if request.application_id not in applications:
        raise HTTPException(status_code=404, detail="申领单不存在")
    
    app = applications[request.application_id]
    
    if app.status != RecordStatus.ISSUED:
        raise HTTPException(status_code=400, detail={
            "message": "申领单状态不允许归还",
            "current_status": app.status,
            "explanation": "只有已出库的申领单才能归还"
        })
    
    if not request.idempotency_key:
        temp_data = {
            "application_id": request.application_id,
            "returned_quantity": request.returned_quantity
        }
        request.idempotency_key = generate_idempotency_key(temp_data)
    
    if request.idempotency_key in processed_idempotency_keys:
        for record in inventory_records:
            if record.related_application_id == request.application_id and record.operation_type == "return":
                return {
                    "record_id": record.id,
                    "message": "重复归还，返回已有归还记录",
                    "remaining_quantity": record.remaining_quantity,
                    "is_idempotent": True
                }
    
    if request.returned_quantity <= 0 or request.returned_quantity > app.quantity:
        raise HTTPException(status_code=400, detail={
            "message": "归还数量不合理",
            "returned": request.returned_quantity,
            "max_allowed": app.quantity,
            "explanation": f"归还数量必须在 0 到 {app.quantity} 之间"
        })
    
    if app.cas_number not in inventory:
        inventory[app.cas_number] = InventoryItem(
            id=str(uuid.uuid4()),
            cas_number=app.cas_number,
            chinese_name=app.chinese_name,
            specification="",
            quantity=0,
            unit=app.unit,
            location="待入库"
        )
    
    inv_item = inventory[app.cas_number]
    inv_item.quantity += request.returned_quantity
    
    if request.returned_quantity >= app.quantity:
        app.status = RecordStatus.RETURNED
    
    record = InventoryRecord(
        id=str(uuid.uuid4()),
        operation_type="return",
        cas_number=app.cas_number,
        chinese_name=app.chinese_name,
        quantity_change=request.returned_quantity,
        remaining_quantity=inv_item.quantity,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        related_application_id=request.application_id
    )
    
    inventory_records.append(record)
    processed_idempotency_keys.add(request.idempotency_key)
    
    operation_logs.append(OperationLog(
        id=str(uuid.uuid4()),
        operation_type="return_chemical",
        operator_id=mask_sensitive_field(request.operator_id),
        operator_name=request.operator_name,
        target_id=request.application_id,
        target_type="application",
        details=f"归还: {app.chinese_name} {request.returned_quantity}{inv_item.unit}"
    ))
    
    return {
        "record_id": record.id,
        "remaining_quantity": inv_item.quantity,
        "application_status": app.status,
        "message": "归还成功",
        "is_idempotent": False
    }

@app.post("/inventory/stocktake", response_model=Dict[str, Any])
def stocktake(request: StocktakeRequest):
    if not request.idempotency_key:
        temp_data = {
            "cas_number": request.cas_number,
            "actual_quantity": request.actual_quantity,
            "date": datetime.now().date().isoformat()
        }
        request.idempotency_key = generate_idempotency_key(temp_data)
    
    if request.idempotency_key in processed_idempotency_keys:
        for record in stocktake_records:
            if record.cas_number == request.cas_number and record.created_at.startswith(datetime.now().date().isoformat()):
                return {
                    "stocktake_id": record.id,
                    "message": "今日已盘点，返回已有盘点记录",
                    "difference": record.difference,
                    "is_idempotent": True
                }
    
    expected_quantity = 0.0
    if request.cas_number in inventory:
        expected_quantity = inventory[request.cas_number].quantity
        inventory[request.cas_number].quantity = request.actual_quantity
    else:
        raise HTTPException(status_code=404, detail="该化学品无库存记录")
    
    difference = request.actual_quantity - expected_quantity
    
    record = StocktakeRecord(
        id=str(uuid.uuid4()),
        cas_number=request.cas_number,
        chinese_name=inventory[request.cas_number].chinese_name,
        expected_quantity=expected_quantity,
        actual_quantity=request.actual_quantity,
        difference=difference,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        comment=request.comment
    )
    
    stocktake_records.append(record)
    processed_idempotency_keys.add(request.idempotency_key)
    
    operation_logs.append(OperationLog(
        id=str(uuid.uuid4()),
        operation_type="stocktake",
        operator_id=mask_sensitive_field(request.operator_id),
        operator_name=request.operator_name,
        target_id=request.cas_number,
        target_type="inventory",
        details=f"盘点: {inventory[request.cas_number].chinese_name}, 差异: {difference}"
    ))
    
    return {
        "stocktake_id": record.id,
        "expected_quantity": expected_quantity,
        "actual_quantity": request.actual_quantity,
        "difference": difference,
        "message": "盘点完成",
        "is_idempotent": False
    }

@app.get("/inventory", response_model=List[Dict[str, Any]])
def get_inventory(cas_number: Optional[str] = None):
    result = []
    items = [inventory[cas_number]] if cas_number and cas_number in inventory else inventory.values()
    for item in items:
        data = item.model_dump()
        result.append(sanitize_for_export(data))
    return result

@app.get("/applications", response_model=List[Dict[str, Any]])
def get_applications(status: Optional[RecordStatus] = None):
    result = []
    for app in applications.values():
        if status and app.status != status:
            continue
        data = app.model_dump()
        result.append(sanitize_for_export(data))
    return result

@app.get("/export/{data_type}", response_model=Dict[str, Any])
def export_data(data_type: str):
    export_functions = {
        "inventory": lambda: [sanitize_for_export(item.model_dump()) for item in inventory.values()],
        "applications": lambda: [sanitize_for_export(app.model_dump()) for app in applications.values()],
        "approvals": lambda: [sanitize_for_export(a.model_dump()) for a in approvals.values()],
        "logs": lambda: [log.model_dump() for log in operation_logs],
        "bad_records": lambda: [{
            "row_number": br.row_number,
            "original_data": sanitize_for_export(br.original_data),
            "error_reason": br.error_reason,
            "suggestion": br.suggestion,
            "import_batch": br.import_batch
        } for br in bad_records]
    }
    
    if data_type not in export_functions:
        raise HTTPException(status_code=404, detail="不支持的导出类型")
    
    return {
        "data_type": data_type,
        "export_time": datetime.now().isoformat(),
        "data": export_functions[data_type]()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
