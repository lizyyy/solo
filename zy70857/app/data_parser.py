import pandas as pd
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
from io import StringIO, BytesIO


def parse_date(date_str: str) -> datetime:
    if not date_str or pd.isna(date_str):
        return None
    if isinstance(date_str, datetime):
        return date_str
    date_formats = [
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d",
        "%Y/%m/%d %H:%M:%S",
        "%m-%d-%Y",
        "%d-%m-%Y",
    ]
    for fmt in date_formats:
        try:
            return datetime.strptime(str(date_str).strip(), fmt)
        except (ValueError, TypeError):
            continue
    return None


def parse_int(value: Any, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(value)
    except (ValueError, TypeError):
        return default


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if pd.isna(value):
        return False
    return str(value).lower() in ["true", "1", "yes", "是", "涉密"]


def parse_csv(content: bytes, filename: str = None) -> List[Dict[str, Any]]:
    try:
        df = pd.read_csv(BytesIO(content))
        df = df.where(pd.notnull(df), None)
        records = []
        for _, row in df.iterrows():
            record = row.to_dict()
            record = {k: v if not pd.isna(v) else None for k, v in record.items()}
            records.append(record)
        return records
    except Exception as e:
        raise ValueError(f"CSV解析失败: {str(e)}")


def parse_json(content: bytes, filename: str = None) -> List[Dict[str, Any]]:
    try:
        data = json.loads(content.decode("utf-8"))
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            return [data]
        else:
            raise ValueError("JSON格式不正确，需要数组或对象")
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {str(e)}")


def parse_cases_from_json(content: bytes) -> List[Dict[str, Any]]:
    records = parse_json(content)
    cases = []
    for rec in records:
        case = {
            "case_no": str(rec.get("case_no", rec.get("案号", ""))).strip(),
            "case_name": str(rec.get("case_name", rec.get("案件名称", ""))).strip(),
            "case_type": str(rec.get("case_type", rec.get("案件类型", ""))).strip(),
            "is_secret": parse_bool(rec.get("is_secret", rec.get("是否涉密", False))),
            "secret_level": str(rec.get("secret_level", rec.get("密级", "") or "")).strip(),
            "create_date": parse_date(rec.get("create_date", rec.get("立案日期"))),
        }
        if not case["case_no"]:
            continue
        cases.append(case)
    return cases


def parse_persons_from_json(content: bytes) -> List[Dict[str, Any]]:
    records = parse_json(content)
    persons = []
    for rec in records:
        person = {
            "person_id": str(rec.get("person_id", rec.get("人员编号", ""))).strip(),
            "name": str(rec.get("name", rec.get("姓名", ""))).strip(),
            "department": str(rec.get("department", rec.get("部门", ""))).strip(),
            "position": str(rec.get("position", rec.get("职位", ""))).strip(),
            "permission_level": parse_int(rec.get("permission_level", rec.get("权限等级", 1))),
            "can_access_secret": parse_bool(rec.get("can_access_secret", rec.get("可访问涉密", False))),
        }
        if not person["person_id"] or not person["name"]:
            continue
        persons.append(person)
    return persons


def parse_borrow_records(content: bytes, content_type: str = "csv") -> List[Dict[str, Any]]:
    if content_type == "csv":
        raw_records = parse_csv(content)
    else:
        raw_records = parse_json(content)

    borrow_records = []
    for idx, rec in enumerate(raw_records):
        record_no = str(rec.get("record_no", rec.get("记录编号", idx + 1)) or idx + 1).strip()

        borrow_date = parse_date(rec.get("borrow_date", rec.get("借阅日期")))
        due_date = parse_date(rec.get("due_date", rec.get("应还日期")))
        return_date = parse_date(rec.get("return_date", rec.get("归还日期")))

        borrow = {
            "record_no": record_no,
            "case_no": str(rec.get("case_no", rec.get("案号", ""))).strip(),
            "person_id": str(rec.get("person_id", rec.get("人员编号", ""))).strip(),
            "person_name": str(rec.get("person_name", rec.get("人员姓名", ""))).strip(),
            "borrow_date": borrow_date,
            "due_date": due_date,
            "return_date": return_date,
            "renew_count": parse_int(rec.get("renew_count", rec.get("续借次数", 0))),
            "action_type": str(rec.get("action_type", rec.get("操作类型", "borrow")) or "borrow").strip().lower(),
            "_raw": rec,
        }
        borrow_records.append(borrow)

    return borrow_records


def get_file_type(filename: str) -> str:
    if filename.endswith(".csv"):
        return "csv"
    elif filename.endswith(".json"):
        return "json"
    else:
        raise ValueError(f"不支持的文件格式: {filename}")