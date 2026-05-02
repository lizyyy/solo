import json
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class STLFile:
    filename: str
    tooth_number: str
    file_type: str
    case_id: str


def parse_stl_files(json_path: str) -> List[STLFile]:
    stl_files = []
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        for item in data:
            stl_file = STLFile(
                filename=item.get("filename", "").strip(),
                tooth_number=item.get("tooth_number", "").strip(),
                file_type=item.get("type", "").strip(),
                case_id=item.get("case_id", "").strip()
            )
            stl_files.append(stl_file)
    return stl_files
