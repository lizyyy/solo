from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import pandas as pd
import json
import hashlib
from datetime import datetime
import io

app = FastAPI(title="法务审批API", description="合同盖章、授权审批和快递寄出统一处理接口")

processed_batches = set()

class ContractMetadata(BaseModel):
    contract_id: str
    contract_name: str
    contract_type: str
    amount: float
    department: str
    applicant: str
    approver_level: int
    has_attachment: bool = False
    status: str = "draft"

class SealRule(BaseModel):
    rule_id: str
    rule_name: str
    rule_type: str
    condition: Dict[str, Any]
    action: str
    suggestion: str

class ApprovalRequest(BaseModel):
    batch_id: str
    application_type: str
    applicant: str
    department: str
    contract_id: str
    seal_type: str
    approver: str
    approval_level: int
    has_attachment: bool = False
    is_resubmit: bool = False
    remark: Optional[str] = None
    extra_fields: Dict[str, Any] = Field(default_factory=dict)

class ProcessResult(BaseModel):
    record_id: str
    status: str
    original_data: Dict[str, Any]
    matched_rules: List[str]
    suggestion: str
    explanation: str

class BatchResponse(BaseModel):
    batch_id: str
    processed_at: str
    total_count: int
    normal: List[ProcessResult]
    need_confirm: List[ProcessResult]
    failed: List[ProcessResult]

def generate_record_id(data: Dict[str, Any]) -> str:
    data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(data_str.encode()).hexdigest()[:12]

def check_duplicate_batch(batch_id: str) -> bool:
    return batch_id in processed_batches

def mark_batch_processed(batch_id: str):
    processed_batches.add(batch_id)

def parse_csv(file_content: bytes) -> List[Dict[str, Any]]:
    df = pd.read_csv(io.BytesIO(file_content))
    return df.to_dict('records')

def load_default_seal_rules() -> List[SealRule]:
    return [
        SealRule(
            rule_id="R001",
            rule_name="越权盖章检测",
            rule_type="authorization",
            condition={
                "approval_level": {"$lt": 3},
                "amount": {"$gt": 1000000}
            },
            action="REJECT",
            suggestion="合同金额超过100万，审批级别不足3级，需升级至副总裁及以上审批"
        ),
        SealRule(
            rule_id="R002",
            rule_name="补盖附件要求",
            rule_type="attachment",
            condition={
                "has_attachment": False,
                "contract_type": {"$in": ["采购合同", "服务合同", "技术合同"]}
            },
            action="NEED_CONFIRM",
            suggestion="该合同类型必须附上附件，请补充盖章页、资质证明等扫描件后重新提交"
        ),
        SealRule(
            rule_id="R003",
            rule_name="撤回重提审批",
            rule_type="resubmit",
            condition={
                "is_resubmit": True,
                "approval_level": {"$lte": 2}
            },
            action="NEED_CONFIRM",
            suggestion="撤回重提的合同需原审批人重新确认，审批级别需保持或提升"
        ),
        SealRule(
            rule_id="R004",
            rule_name="跨部门盖章审批",
            rule_type="department",
            condition={
                "department": {"$ne": "${contract_department}"}
            },
            action="NEED_CONFIRM",
            suggestion="申请部门与合同归属部门不一致，需双方部门负责人会签"
        ),
        SealRule(
            rule_id="R005",
            rule_name="特殊印章授权",
            rule_type="seal_type",
            condition={
                "seal_type": {"$in": ["公章", "合同专用章"]},
                "approval_level": {"$lt": 2}
            },
            action="REJECT",
            suggestion="使用公章或合同专用章需至少部门经理级（2级）审批"
        ),
        SealRule(
            rule_id="R006",
            rule_name="快递寄出确认",
            rule_type="delivery",
            condition={
                "application_type": "快递寄出",
                "has_attachment": False
            },
            action="NEED_CONFIRM",
            suggestion="快递寄出需上传盖章完成的扫描件作为凭证"
        )
    ]

def evaluate_rule(rule: SealRule, record: Dict[str, Any], contract: Optional[Dict[str, Any]] = None) -> tuple[bool, str]:
    condition = rule.condition
    explanation_parts = []
    
    for key, cond in condition.items():
        if key == "amount" and isinstance(cond, dict):
            if "$gt" in cond:
                val = contract.get("amount", 0) if contract else record.get("amount", 0)
                if val > cond["$gt"]:
                    explanation_parts.append(f"金额({val:.0f}元)超过阈值({cond['$gt']}元)")
                else:
                    return False, ""
            if "$lt" in cond:
                val = contract.get("amount", 0) if contract else record.get("amount", 0)
                if val < cond["$lt"]:
                    explanation_parts.append(f"金额({val:.0f}元)低于阈值({cond['$lt']}元)")
                else:
                    return False, ""
        
        elif key == "approval_level" and isinstance(cond, dict):
            val = record.get("approval_level", 0)
            if "$lt" in cond and val < cond["$lt"]:
                explanation_parts.append(f"审批级别({val}级)低于要求级别({cond['$lt']}级)")
            elif "$lte" in cond and val <= cond["$lte"]:
                explanation_parts.append(f"审批级别({val}级)未超过要求级别({cond['$lte']}级)")
            elif "$gt" in cond and val > cond["$gt"]:
                explanation_parts.append(f"审批级别({val}级)高于阈值({cond['$gt']}级)")
            else:
                return False, ""
        
        elif key == "has_attachment":
            val = record.get("has_attachment", False)
            if val == cond:
                explanation_parts.append(f"未检测到附件" if not val else "已检测到附件")
            else:
                return False, ""
        
        elif key == "is_resubmit":
            val = record.get("is_resubmit", False)
            if val == cond:
                explanation_parts.append("该申请为撤回后重新提交")
            else:
                return False, ""
        
        elif key == "contract_type" and isinstance(cond, dict) and "$in" in cond:
            val = contract.get("contract_type", "") if contract else record.get("contract_type", "")
            if val in cond["$in"]:
                explanation_parts.append(f"合同类型为「{val}」属于需附件类型")
            else:
                return False, ""
        
        elif key == "seal_type" and isinstance(cond, dict) and "$in" in cond:
            val = record.get("seal_type", "")
            if val in cond["$in"]:
                explanation_parts.append(f"使用「{val}」")
            else:
                return False, ""
        
        elif key == "department" and isinstance(cond, dict) and "$ne" in cond:
            val = record.get("department", "")
            contract_dept = contract.get("department", "") if contract else ""
            if val != contract_dept:
                explanation_parts.append(f"申请部门「{val}」与合同归属部门「{contract_dept}」不一致")
            else:
                return False, ""
        
        elif key == "application_type":
            val = record.get("application_type", "")
            if val == cond:
                explanation_parts.append(f"申请类型为「{val}」")
            else:
                return False, ""
    
    return True, "；".join(explanation_parts)

def process_single_record(record: Dict[str, Any], contracts: Dict[str, Dict[str, Any]], rules: List[SealRule]) -> ProcessResult:
    record_id = generate_record_id(record)
    contract_id = record.get("contract_id", "")
    contract = contracts.get(contract_id)
    
    matched_rules = []
    suggestions = []
    explanations = []
    final_status = "NORMAL"
    
    for rule in rules:
        matched, explanation = evaluate_rule(rule, record, contract)
        if matched:
            matched_rules.append(rule.rule_name)
            suggestions.append(rule.suggestion)
            explanations.append(f"[{rule.rule_name}] {explanation}")
            
            if rule.action == "REJECT":
                final_status = "FAILED"
            elif rule.action == "NEED_CONFIRM" and final_status != "FAILED":
                final_status = "NEED_CONFIRM"
    
    if final_status == "NORMAL":
        explanation = "审批材料完整，符合印章使用规则，可正常放行"
        suggestion = "流程正常，可安排盖章/寄出"
    else:
        explanation = "；".join(explanations)
        suggestion = "；".join(suggestions)
    
    return ProcessResult(
        record_id=record_id,
        status=final_status,
        original_data=record,
        matched_rules=matched_rules,
        suggestion=suggestion,
        explanation=explanation
    )

@app.post("/api/approval/process", response_model=BatchResponse)
async def process_approval(
    batch_id: str = Form(...),
    csv_file: UploadFile = File(...),
    contracts_json: UploadFile = File(...),
    rules_json: Optional[UploadFile] = File(None)
):
    if check_duplicate_batch(batch_id):
        raise HTTPException(
            status_code=400,
            detail=f"批次 {batch_id} 已处理过，请勿重复提交。如需重新处理，请使用新的批次号。"
        )
    
    try:
        csv_content = await csv_file.read()
        records = parse_csv(csv_content)
        
        contracts_content = await contracts_json.read()
        contracts_data = json.loads(contracts_content)
        contracts_dict = {c["contract_id"]: c for c in contracts_data}
        
        if rules_json:
            rules_content = await rules_json.read()
            rules_data = json.loads(rules_content)
            rules = [SealRule(**r) for r in rules_data]
        else:
            rules = load_default_seal_rules()
        
        normal_results = []
        confirm_results = []
        failed_results = []
        
        for record in records:
            result = process_single_record(record, contracts_dict, rules)
            if result.status == "NORMAL":
                normal_results.append(result)
            elif result.status == "NEED_CONFIRM":
                confirm_results.append(result)
            else:
                failed_results.append(result)
        
        mark_batch_processed(batch_id)
        
        return BatchResponse(
            batch_id=batch_id,
            processed_at=datetime.now().isoformat(),
            total_count=len(records),
            normal=normal_results,
            need_confirm=confirm_results,
            failed=failed_results
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

@app.get("/api/rules", response_model=List[SealRule])
async def get_default_rules():
    return load_default_seal_rules()

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
