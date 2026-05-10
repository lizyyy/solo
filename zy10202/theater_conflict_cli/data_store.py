"""数据存储管理"""

import json
import os
from typing import Any, Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
DATA_FILES = {
    "rooms": "rooms.json",
    "equipment": "equipment.json",
    "contacts": "contacts.json",
    "bookings": "bookings.json",
    "reschedule_history": "reschedule_history.json",
    "key_records": "key_records.json",
}


def ensure_data_dir():
    """确保数据目录存在"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def load_data(entity: str) -> List[Dict[str, Any]]:
    """加载指定实体的数据"""
    ensure_data_dir()
    file_path = os.path.join(DATA_DIR, DATA_FILES[entity])
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(entity: str, data: List[Dict[str, Any]]):
    """保存指定实体的数据"""
    ensure_data_dir()
    file_path = os.path.join(DATA_DIR, DATA_FILES[entity])
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def generate_id(existing_ids: List[str]) -> str:
    """生成唯一ID"""
    import uuid
    return str(uuid.uuid4())[:8]


def get_by_id(entity: str, item_id: str) -> Optional[Dict[str, Any]]:
    """根据ID获取数据项"""
    data = load_data(entity)
    for item in data:
        if item.get("id") == item_id:
            return item
    return None


def add_item(entity: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """添加数据项"""
    data = load_data(entity)
    if "id" not in item:
        item["id"] = generate_id([d.get("id", "") for d in data])
    data.append(item)
    save_data(entity, data)
    return item


def update_item(entity: str, item_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """更新数据项"""
    data = load_data(entity)
    for i, item in enumerate(data):
        if item.get("id") == item_id:
            data[i].update(updates)
            save_data(entity, data)
            return data[i]
    return None


def delete_item(entity: str, item_id: str) -> bool:
    """删除数据项"""
    data = load_data(entity)
    for i, item in enumerate(data):
        if item.get("id") == item_id:
            del data[i]
            save_data(entity, data)
            return True
    return False
