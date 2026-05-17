import csv
from pathlib import Path
from typing import List, Tuple, Dict, Any

from .models import (
    CarModel,
    MaintenanceItem,
    PartInventory,
    AlternativePart,
    BadLine,
    SourceLocation,
)


class CSVParser:
    def __init__(self, encoding: str = "utf-8"):
        self.encoding = encoding

    def parse_car_models(self, file_path: str) -> Tuple[List[CarModel], List[BadLine]]:
        car_models: List[CarModel] = []
        bad_lines: List[BadLine] = []
        file_path = str(Path(file_path).resolve())

        with open(file_path, "r", encoding=self.encoding) as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                original_line = ",".join(f'"{v}"' for v in row.values())
                try:
                    car_model = CarModel(
                        model_id=row["model_id"].strip(),
                        brand=row["brand"].strip(),
                        series=row["series"].strip(),
                        year=int(row["year"].strip()),
                        engine=row["engine"].strip(),
                        source_location=SourceLocation(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                        ),
                    )
                    car_models.append(car_model)
                except Exception as e:
                    bad_lines.append(
                        BadLine(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                            error_message=str(e),
                        )
                    )

        car_models.sort(key=lambda x: x.model_id)
        return car_models, bad_lines

    def parse_maintenance(self, file_path: str) -> Tuple[List[MaintenanceItem], List[BadLine]]:
        maintenance_items: List[MaintenanceItem] = []
        bad_lines: List[BadLine] = []
        file_path = str(Path(file_path).resolve())

        with open(file_path, "r", encoding=self.encoding) as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                original_line = ",".join(f'"{v}"' for v in row.values())
                try:
                    parts_str = row["required_parts"].strip()
                    parts_dict = self._parse_parts_dict(parts_str)
                    models_str = row["applicable_models"].strip()
                    applicable_models = [m.strip() for m in models_str.split(";") if m.strip()]

                    maintenance = MaintenanceItem(
                        maintenance_id=row["maintenance_id"].strip(),
                        name=row["name"].strip(),
                        required_parts=parts_dict,
                        applicable_models=applicable_models,
                        source_location=SourceLocation(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                        ),
                    )
                    maintenance_items.append(maintenance)
                except Exception as e:
                    bad_lines.append(
                        BadLine(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                            error_message=str(e),
                        )
                    )

        maintenance_items.sort(key=lambda x: x.maintenance_id)
        return maintenance_items, bad_lines

    def parse_inventory(self, file_path: str) -> Tuple[List[PartInventory], List[BadLine]]:
        inventory: List[PartInventory] = []
        bad_lines: List[BadLine] = []
        file_path = str(Path(file_path).resolve())

        with open(file_path, "r", encoding=self.encoding) as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                original_line = ",".join(f'"{v}"' for v in row.values())
                try:
                    part = PartInventory(
                        part_number=row["part_number"].strip(),
                        part_name=row["part_name"].strip(),
                        quantity=int(row["quantity"].strip()),
                        location=row["location"].strip(),
                        source_location=SourceLocation(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                        ),
                    )
                    inventory.append(part)
                except Exception as e:
                    bad_lines.append(
                        BadLine(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                            error_message=str(e),
                        )
                    )

        inventory.sort(key=lambda x: x.part_number)
        return inventory, bad_lines

    def parse_alternatives(self, file_path: str) -> Tuple[List[AlternativePart], List[BadLine]]:
        alternatives: List[AlternativePart] = []
        bad_lines: List[BadLine] = []
        file_path = str(Path(file_path).resolve())

        with open(file_path, "r", encoding=self.encoding) as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                original_line = ",".join(f'"{v}"' for v in row.values())
                try:
                    models_str = row.get("applicable_models", "").strip()
                    applicable_models = None
                    if models_str:
                        applicable_models = [m.strip() for m in models_str.split(";") if m.strip()]

                    alt = AlternativePart(
                        original_part=row["original_part"].strip(),
                        alternative_part=row["alternative_part"].strip(),
                        priority=int(row["priority"].strip()),
                        applicable_models=applicable_models,
                        source_location=SourceLocation(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                        ),
                    )
                    alternatives.append(alt)
                except Exception as e:
                    bad_lines.append(
                        BadLine(
                            file_path=file_path,
                            line_number=line_num,
                            original_line=original_line,
                            error_message=str(e),
                        )
                    )

        alternatives.sort(key=lambda x: (x.original_part, x.priority))
        return alternatives, bad_lines

    def _parse_parts_dict(self, parts_str: str) -> Dict[str, int]:
        parts_dict: Dict[str, int] = {}
        if not parts_str:
            return parts_dict

        for part_entry in parts_str.split(";"):
            if ":" in part_entry:
                part_num, qty = part_entry.split(":", 1)
                parts_dict[part_num.strip()] = int(qty.strip())
        return parts_dict
