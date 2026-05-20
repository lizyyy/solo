import pandas as pd
from datetime import datetime, date
from typing import List, Dict, Any
import json

def parse_equipment_excel(file_path: str) -> List[Dict[str, Any]]:
    df = pd.read_excel(file_path)
    df.columns = [str(col).strip() for col in df.columns]
    
    equipment_list = []
    for _, row in df.iterrows():
        equipment = {
            "equipment_code": str(row.get("设备编号", row.get("equipment_code", ""))).strip(),
            "equipment_name": str(row.get("设备名称", row.get("equipment_name", ""))).strip(),
            "equipment_type": str(row.get("设备类型", row.get("equipment_type", ""))).strip(),
            "location": str(row.get("位置", row.get("location", ""))).strip(),
            "last_maintenance_date": parse_date(row.get("上次维保日期", row.get("last_maintenance_date"))),
            "next_maintenance_date": parse_date(row.get("下次维保日期", row.get("next_maintenance_date"))),
            "maintenance_company": str(row.get("维保公司", row.get("maintenance_company", ""))).strip(),
        }
        if equipment["equipment_code"]:
            equipment_list.append(equipment)
    return equipment_list

def parse_photo_excel(file_path: str) -> List[Dict[str, Any]]:
    df = pd.read_excel(file_path)
    df.columns = [str(col).strip() for col in df.columns]
    
    photo_list = []
    for _, row in df.iterrows():
        photo = {
            "equipment_code": str(row.get("设备编号", row.get("equipment_code", ""))).strip(),
            "photo_name": str(row.get("照片名称", row.get("photo_name", ""))).strip(),
            "photo_path": str(row.get("照片路径", row.get("photo_path", ""))).strip(),
            "upload_date": parse_date(row.get("上传日期", row.get("upload_date"))),
            "inspector": str(row.get("巡检人", row.get("inspector", ""))).strip(),
        }
        if photo["equipment_code"] and photo["photo_name"]:
            photo_list.append(photo)
    return photo_list

def parse_contract_excel(file_path: str) -> List[Dict[str, Any]]:
    df = pd.read_excel(file_path)
    df.columns = [str(col).strip() for col in df.columns]
    
    contract_list = []
    for _, row in df.iterrows():
        contract = {
            "contract_no": str(row.get("合同编号", row.get("contract_no", ""))).strip(),
            "equipment_code": str(row.get("设备编号", row.get("equipment_code", ""))).strip(),
            "contractor": str(row.get("乙方", row.get("contractor", ""))).strip(),
            "start_date": parse_date(row.get("开始日期", row.get("start_date"))),
            "end_date": parse_date(row.get("结束日期", row.get("end_date"))),
            "contract_amount": str(row.get("合同金额", row.get("contract_amount", ""))).strip(),
        }
        if contract["equipment_code"]:
            contract_list.append(contract)
    return contract_list

def parse_date(value) -> datetime.date:
    if pd.isna(value) or value is None or str(value).strip() == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, pd.Timestamp):
        return value.date()
    try:
        return pd.to_datetime(value).date()
    except:
        return None

def to_json_str(data: Dict[str, Any]) -> str:
    def default_converter(o):
        if isinstance(o, (date, datetime)):
            return o.isoformat()
        return str(o)
    return json.dumps(data, default=default_converter, ensure_ascii=False)
