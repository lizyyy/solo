import csv
import json
import yaml
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from .models import Yard, YardInventory, VesselDemand, TruckSlot


def load_yards_from_inventory(csv_path: str) -> Dict[str, Yard]:
    yards = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            yard_id = row['yard_id']
            if yard_id not in yards:
                yards[yard_id] = Yard(
                    id=yard_id,
                    name=row.get('yard_name', yard_id),
                    distance_to_port=int(row.get('distance_to_port', 0))
                )
    return yards


def load_inventory(csv_path: str) -> Tuple[Dict[str, Yard], Dict[str, Dict[str, int]]]:
    yards = load_yards_from_inventory(csv_path)
    inventory: Dict[str, Dict[str, int]] = {}
    
    for yard_id in yards:
        inventory[yard_id] = {}
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            yard_id = row['yard_id']
            ct = row['container_type']
            qty = int(row['quantity'])
            inventory[yard_id][ct] = qty
    
    return yards, inventory


def load_vessel_demands(json_path: str) -> List[VesselDemand]:
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    demands = []
    for item in data:
        eta = datetime.fromisoformat(item['eta'])
        etd = datetime.fromisoformat(item['etd'])
        demands.append(VesselDemand(
            vessel_id=item['vessel_id'],
            vessel_name=item['vessel_name'],
            eta=eta,
            etd=etd,
            demands=item['demands'],
            berth=item.get('berth', 'A')
        ))
    return demands


def load_truck_slots(csv_path: str) -> List[TruckSlot]:
    slots = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            start = datetime.fromisoformat(row['start_time'])
            end = datetime.fromisoformat(row['end_time'])
            slots.append(TruckSlot(
                slot_id=row['slot_id'],
                start_time=start,
                end_time=end,
                capacity=int(row['capacity'])
            ))
    return slots


def load_strategy(yaml_path: str) -> Dict:
    with open(yaml_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)
