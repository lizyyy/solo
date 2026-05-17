import re
import json
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from models import Invoice, ReimbursementSheet

def parse_filename(filename: str) -> Dict[str, Optional[str]]:
    result = {
        "invoice_code": None,
        "invoice_number": None,
        "reimbursement_id": None,
        "amount": None
    }
    
    patterns = [
        r'(?:发票代码|invoice_code|code)[:：]?\s*(\d{10,12})',
        r'(\d{12})(?=\D|$)',
    ]
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            result["invoice_code"] = match.group(1)
            break
    
    patterns = [
        r'(?:发票号码|invoice_number|number|NO)[:：]?\s*(\d{8,10})',
        r'_(\d{8})_',
        r'_(\d{8})(?=\D|$)',
    ]
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            matched_num = match.group(1)
            if not result["invoice_code"] or matched_num != result["invoice_code"][-8:]:
                result["invoice_number"] = matched_num
                break
    
    patterns = [
        r'(BX\d{6,12})',
        r'(RX\d{6,12})',
        r'(?:报销单号|reimbursement_id|BAOXIAO)[:：]?\s*([A-Z0-9-]{6,20})',
    ]
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            result["reimbursement_id"] = match.group(1).upper()
            break
    
    patterns = [
        r'(?:金额|amount|￥|CNY|¥)[:：]?\s*(\d+(?:\.\d{1,2})?)',
        r'_(\d+\.\d{2})_',
        r'(\d+\.\d{2})(?=\D|$)',
        r'(\d+(?:\.\d{1,2})?)\s*(?:元|￥|CNY|¥)',
    ]
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            try:
                val = float(match.group(1))
                if val < 1000000:
                    result["amount"] = val
                    break
            except ValueError:
                pass
    
    return result

def detect_duplicates(invoices: List[Invoice]) -> Dict[int, List[int]]:
    duplicates = {}
    seen = {}
    
    for invoice in invoices:
        key_parts = []
        if invoice.invoice_code and invoice.invoice_number:
            key_parts.append(f"code_{invoice.invoice_code}_num_{invoice.invoice_number}")
        if invoice.amount:
            key_parts.append(f"amt_{invoice.amount}")
        
        for key in key_parts:
            if key in seen:
                if invoice.id not in duplicates:
                    duplicates[invoice.id] = []
                duplicates[invoice.id].append(seen[key])
                if seen[key] not in duplicates:
                    duplicates[seen[key]] = []
                duplicates[seen[key]].append(invoice.id)
            else:
                seen[key] = invoice.id
    
    return duplicates

def match_with_reimbursement(
    invoice: Invoice,
    reimbursements: List[ReimbursementSheet]
) -> Tuple[str, List[str]]:
    missing_fields = []
    if not invoice.invoice_code:
        missing_fields.append("invoice_code")
    if not invoice.invoice_number:
        missing_fields.append("invoice_number")
    if not invoice.amount:
        missing_fields.append("amount")
    if not invoice.reimbursement_id:
        missing_fields.append("reimbursement_id")
    
    if missing_fields:
        return "missing_fields", missing_fields
    
    matched = None
    for r in reimbursements:
        code_match = (r.invoice_code == invoice.invoice_code) if r.invoice_code else False
        num_match = (r.invoice_number == invoice.invoice_number) if r.invoice_number else False
        amt_match = (abs(r.amount - invoice.amount) < 0.01) if r.amount and invoice.amount else False
        reimburse_match = (r.reimbursement_id == invoice.reimbursement_id) if r.reimbursement_id else False
        
        if (code_match and num_match and amt_match) or reimburse_match:
            matched = r
            break
    
    if matched:
        if abs(matched.amount - invoice.amount) >= 0.01:
            return "amount_mismatch", ["amount"]
        return "matched", []
    else:
        return "not_found", ["reimbursement_record"]

def get_missing_fields(invoice: Invoice) -> List[str]:
    missing = []
    if not invoice.invoice_code:
        missing.append("invoice_code")
    if not invoice.invoice_number:
        missing.append("invoice_number")
    if not invoice.amount:
        missing.append("amount")
    if not invoice.reimbursement_id:
        missing.append("reimbursement_id")
    return missing

def generate_archive_report(
    directory_id: int,
    invoices: List[Invoice],
    reimbursements: List[ReimbursementSheet]
) -> Dict:
    total_files = len(invoices)
    matched_count = sum(1 for inv in invoices if inv.match_status == "matched")
    duplicate_count = sum(1 for inv in invoices if inv.is_duplicate)
    missing_count = sum(1 for inv in invoices if inv.match_status == "missing_fields")
    
    matched_list = []
    duplicate_list = []
    missing_list = []
    mismatch_list = []
    
    for inv in invoices:
        if inv.is_duplicate:
            duplicate_list.append({
                "invoice_id": inv.id,
                "filename": inv.original_filename,
                "duplicate_with": inv.duplicate_with
            })
        elif inv.match_status == "matched":
            matched_list.append({
                "invoice_id": inv.id,
                "filename": inv.original_filename,
                "invoice_code": inv.invoice_code,
                "invoice_number": inv.invoice_number,
                "amount": inv.amount,
                "reimbursement_id": inv.reimbursement_id
            })
        elif inv.match_status == "missing_fields":
            missing_list.append({
                "invoice_id": inv.id,
                "filename": inv.original_filename,
                "missing_fields": get_missing_fields(inv)
            })
        elif inv.match_status == "amount_mismatch":
            mismatch_list.append({
                "invoice_id": inv.id,
                "filename": inv.original_filename,
                "invoice_amount": inv.amount,
                "reimbursement_id": inv.reimbursement_id
            })
    
    report_content = json.dumps({
        "directory_id": directory_id,
        "summary": {
            "total_files": total_files,
            "matched_count": matched_count,
            "duplicate_count": duplicate_count,
            "missing_count": missing_count
        },
        "matched_invoices": matched_list,
        "duplicate_invoices": duplicate_list,
        "missing_invoices": missing_list,
        "mismatch_invoices": mismatch_list
    }, ensure_ascii=False, indent=2)
    
    return {
        "report_content": report_content,
        "total_files": total_files,
        "matched_count": matched_count,
        "duplicate_count": duplicate_count,
        "missing_count": missing_count
    }
