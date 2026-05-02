import json
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class BoundingBox:
    xmin: float
    ymin: float
    xmax: float
    ymax: float


@dataclass
class Annotation:
    annotation_id: str
    image_id: str
    category_id: str
    bbox: Optional[BoundingBox] = None
    is_empty: bool = False


def parse_labels_jsonl(jsonl_path: str) -> Dict[str, List[Annotation]]:
    annotations = {}
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            
            bbox = None
            is_empty = False
            
            if "bbox" in obj and obj["bbox"]:
                bbox_data = obj["bbox"]
                bbox = BoundingBox(
                    xmin=float(bbox_data[0]),
                    ymin=float(bbox_data[1]),
                    xmax=float(bbox_data[0] + bbox_data[2]),
                    ymax=float(bbox_data[1] + bbox_data[3])
                )
            else:
                is_empty = True
            
            annotation = Annotation(
                annotation_id=obj["annotation_id"],
                image_id=obj["image_id"],
                category_id=obj["category_id"],
                bbox=bbox,
                is_empty=is_empty
            )
            
            if obj["image_id"] not in annotations:
                annotations[obj["image_id"]] = []
            annotations[obj["image_id"]].append(annotation)
    
    return annotations


def get_all_category_ids(annotations: Dict[str, List[Annotation]]) -> set:
    categories = set()
    for image_anns in annotations.values():
        for ann in image_anns:
            categories.add(ann.category_id)
    return categories