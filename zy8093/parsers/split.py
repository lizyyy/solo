import yaml
from typing import Dict, List


def parse_split_yaml(yaml_path: str) -> Dict[str, List[str]]:
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return {
        "train": data.get("train", []),
        "val": data.get("val", []),
        "test": data.get("test", [])
    }


def get_all_split_image_ids(split_data: Dict[str, List[str]]) -> set:
    all_ids = set()
    for split in ["train", "val", "test"]:
        all_ids.update(split_data.get(split, []))
    return all_ids