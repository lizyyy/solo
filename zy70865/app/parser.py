import pandas as pd
import json
from typing import List
from datetime import datetime
from .models import WashItem, RecycleItem, RoomTypeConfig


def parse_wash_csv(csv_content: str) -> List[WashItem]:
    from io import StringIO
    df = pd.read_csv(StringIO(csv_content))
    
    items = []
    for _, row in df.iterrows():
        item = WashItem(
            batch_id=str(row.get('batch_id', '')),
            item_type=str(row.get('item_type', '')),
            quantity=int(row.get('quantity', 0)),
            room_type=str(row.get('room_type', '')) if pd.notna(row.get('room_type')) else None,
            send_time=datetime.fromisoformat(str(row.get('send_time', datetime.now().isoformat()))),
            laundry_factory=str(row.get('laundry_factory', ''))
        )
        items.append(item)
    
    return items


def parse_recycle_json(json_content: str) -> List[RecycleItem]:
    data = json.loads(json_content)
    
    items = []
    for item_data in data:
        item = RecycleItem(
            batch_id=str(item_data.get('batch_id', '')),
            item_type=str(item_data.get('item_type', '')),
            quantity=int(item_data.get('quantity', 0)),
            room_type=str(item_data.get('room_type', '')) if item_data.get('room_type') else None,
            recycle_time=datetime.fromisoformat(item_data.get('recycle_time', datetime.now().isoformat())),
            damage_quantity=int(item_data.get('damage_quantity', 0)),
            damage_type=item_data.get('damage_type'),
            damage_note=item_data.get('damage_note')
        )
        items.append(item)
    
    return items


def parse_room_config_json(json_content: str) -> List[RoomTypeConfig]:
    data = json.loads(json_content)
    
    configs = []
    for config_data in data:
        config = RoomTypeConfig(
            room_type=str(config_data.get('room_type', '')),
            linen_config=config_data.get('linen_config', {})
        )
        configs.append(config)
    
    return configs
