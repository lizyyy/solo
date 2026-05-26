import pandas as pd
import json
from typing import List, Dict, Any, Tuple
from datetime import datetime
from io import StringIO
from .privacy import calculate_file_hash, generate_trace_id


def parse_csv(content: bytes, filename: str = "") -> Tuple[List[Dict[str, Any]], str]:
    file_hash = calculate_file_hash(content)
    try:
        df = pd.read_csv(StringIO(content.decode("utf-8")))
        records = df.to_dict("records")
        return records, file_hash
    except Exception as e:
        try:
            df = pd.read_csv(StringIO(content.decode("gbk")))
            records = df.to_dict("records")
            return records, file_hash
        except Exception as e2:
            raise ValueError(f"CSV解析失败: {str(e)} / {str(e2)}")


def parse_json(content: bytes) -> Tuple[List[Dict[str, Any]], str]:
    file_hash = calculate_file_hash(content)
    try:
        data = json.loads(content.decode("utf-8"))
        if isinstance(data, dict):
            if "data" in data and isinstance(data["data"], list):
                return data["data"], file_hash
            return [data], file_hash
        elif isinstance(data, list):
            return data, file_hash
        else:
            raise ValueError("JSON格式不正确，需要是对象或数组")
    except Exception as e:
        raise ValueError(f"JSON解析失败: {str(e)}")


def normalize_purchase_record(record: Dict[str, Any], idx: int) -> Dict[str, Any]:
    normalized = {}
    key_mapping = {
        "record_id": ["record_id", "id", "流水号", "记录ID", "购药记录ID"],
        "customer_id": ["customer_id", "会员ID", "患者ID", "customerId", "member_id"],
        "drug_name": ["drug_name", "药品名称", "药品名", "drugName", "name"],
        "drug_spec": ["drug_spec", "规格", "药品规格", "spec", "specification"],
        "purchase_date": ["purchase_date", "购药日期", "日期", "购买日期", "date"],
        "quantity": ["quantity", "数量", "购买数量", "qty", "amount"],
        "dosage": ["dosage", "用法用量", "剂量", "用法", "usage"],
        "doctor": ["doctor", "医生", "医师", "开方医生", "prescriber"],
    }

    for target_key, possible_keys in key_mapping.items():
        for key in possible_keys:
            if key in record and record[key] is not None and record[key] != "":
                if isinstance(record[key], float) and pd.isna(record[key]):
                    continue
                normalized[target_key] = record[key]
                break

    if "record_id" not in normalized:
        normalized["record_id"] = f"PUR_{datetime.now().strftime('%Y%m%d%H%M%S')}_{idx:04d}"

    if "purchase_date" in normalized:
        try:
            if isinstance(normalized["purchase_date"], (int, float)):
                normalized["purchase_date"] = datetime.fromtimestamp(normalized["purchase_date"]).strftime("%Y-%m-%d")
            else:
                parsed = pd.to_datetime(normalized["purchase_date"])
                normalized["purchase_date"] = parsed.strftime("%Y-%m-%d")
        except Exception:
            pass

    normalized["_raw"] = record
    normalized["_trace_id"] = generate_trace_id(
        normalized.get("record_id"),
        normalized.get("customer_id"),
        normalized.get("drug_name"),
        normalized.get("purchase_date"),
    )
    return normalized


def normalize_customer_record(record: Dict[str, Any], idx: int) -> Dict[str, Any]:
    normalized = {}
    key_mapping = {
        "customer_id": ["customer_id", "id", "会员ID", "患者ID", "customerId", "member_id"],
        "name": ["name", "姓名", "患者姓名", "customer_name", "member_name"],
        "phone": ["phone", "手机号", "电话", "手机号码", "mobile", "telephone"],
        "id_card": ["id_card", "身份证号", "身份证", "idCard", "id_number"],
        "disease_type": ["disease_type", "病种", "疾病类型", "诊断", "disease", "diagnosis"],
        "birthday": ["birthday", "生日", "出生日期", "出生年月", "birth"],
        "address": ["address", "地址", "居住地址", "住址", "location"],
    }

    for target_key, possible_keys in key_mapping.items():
        for key in possible_keys:
            if key in record and record[key] is not None and record[key] != "":
                if isinstance(record[key], float) and pd.isna(record[key]):
                    continue
                normalized[target_key] = record[key]
                break

    if "customer_id" not in normalized:
        normalized["customer_id"] = f"CUST_{datetime.now().strftime('%Y%m%d%H%M%S')}_{idx:04d}"

    normalized["_raw"] = record
    normalized["_trace_id"] = generate_trace_id(
        normalized.get("customer_id"),
        normalized.get("name"),
        normalized.get("phone"),
    )
    return normalized


def normalize_rule_record(record: Dict[str, Any], idx: int) -> Dict[str, Any]:
    normalized = {}
    key_mapping = {
        "rule_id": ["rule_id", "id", "规则ID", "ruleId"],
        "rule_type": ["rule_type", "规则类型", "类型", "type", "ruleType"],
        "disease_type": ["disease_type", "适用病种", "病种", "disease"],
        "drug_name": ["drug_name", "药品名称", "关联药品", "drugName"],
        "interval_days": ["interval_days", "间隔天数", "随访间隔", "interval", "days"],
        "forbidden_drugs": ["forbidden_drugs", "禁忌药品", "禁用药品", "禁忌药"],
        "description": ["description", "描述", "说明", "备注", "desc"],
    }

    for target_key, possible_keys in key_mapping.items():
        for key in possible_keys:
            if key in record and record[key] is not None and record[key] != "":
                if isinstance(record[key], float) and pd.isna(record[key]):
                    continue
                normalized[target_key] = record[key]
                break

    if "rule_id" not in normalized:
        normalized["rule_id"] = f"RULE_{datetime.now().strftime('%Y%m%d%H%M%S')}_{idx:04d}"

    if "forbidden_drugs" in normalized and isinstance(normalized["forbidden_drugs"], str):
        normalized["forbidden_drugs"] = [d.strip() for d in normalized["forbidden_drugs"].split(",") if d.strip()]

    normalized["_raw"] = record
    normalized["_trace_id"] = generate_trace_id(
        normalized.get("rule_id"),
        normalized.get("rule_type"),
    )
    return normalized
