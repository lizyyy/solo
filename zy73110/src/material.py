import os
import json
import csv
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
from datetime import datetime


MATERIAL_TYPES = {
    "visa": "现场签证单",
    "withdrawal": "撤回记录",
    "oral": "临时口头说明",
    "drawing": "变更图纸",
}


@dataclass
class MaterialItem:
    material_id: str
    material_type: str
    batch_no: int
    version: int
    title: str
    content: str
    submit_time: str = ""
    submitter: str = "阿宁"
    related_to: str = ""

    def key(self) -> str:
        return f"{self.material_type}:{self.material_id}"

    def signature(self) -> str:
        base = f"{self.title}|{self.content}|{self.related_to}"
        return str(hash(base))


def load_materials_from_dir(batch_dir: str) -> List[MaterialItem]:
    items = []
    if not os.path.isdir(batch_dir):
        return items

    for fname in sorted(os.listdir(batch_dir)):
        fpath = os.path.join(batch_dir, fname)
        if not os.path.isfile(fpath):
            continue
        if fname.endswith(".json"):
            items.extend(_load_json(fpath))
        elif fname.endswith(".csv"):
            items.extend(_load_csv(fpath))
    return items


def _load_json(fpath: str) -> List[MaterialItem]:
    items = []
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    raw_list = data if isinstance(data, list) else data.get("materials", [])
    batch_no = int(os.path.basename(os.path.dirname(fpath)).split("_")[-1])
    for raw in raw_list:
        items.append(MaterialItem(
            material_id=raw.get("material_id", ""),
            material_type=raw.get("material_type", ""),
            batch_no=raw.get("batch_no", batch_no),
            version=raw.get("version", 1),
            title=raw.get("title", ""),
            content=raw.get("content", ""),
            submit_time=raw.get("submit_time", ""),
            submitter=raw.get("submitter", "阿宁"),
            related_to=raw.get("related_to", ""),
        ))
    return items


def _load_csv(fpath: str) -> List[MaterialItem]:
    items = []
    batch_no = int(os.path.basename(os.path.dirname(fpath)).split("_")[-1])
    with open(fpath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            items.append(MaterialItem(
                material_id=row.get("material_id", ""),
                material_type=row.get("material_type", ""),
                batch_no=int(row.get("batch_no", batch_no)),
                version=int(row.get("version", 1)),
                title=row.get("title", ""),
                content=row.get("content", ""),
                submit_time=row.get("submit_time", ""),
                submitter=row.get("submitter", "阿宁"),
                related_to=row.get("related_to", ""),
            ))
    return items
