import csv
from typing import List, Dict, Set
from pathlib import Path
from collections import defaultdict
from .models import (
    MaterialItem,
    BoxAssignment,
    MissingItem,
    AccessoryDependency,
    SeverityLevel,
    MissingType,
    CheckResult,
)


class RuleEngine:
    def __init__(self):
        self.dependencies: List[AccessoryDependency] = []
        self._load_default_dependencies()

    def _load_default_dependencies(self):
        default_deps = [
            ("海报", "支架", 1, SeverityLevel.CRITICAL),
            ("海报", "电源线", 1, SeverityLevel.CRITICAL),
            ("展架", "支架", 1, SeverityLevel.CRITICAL),
            ("灯箱", "电源线", 1, SeverityLevel.HIGH),
            ("电子屏", "电源线", 1, SeverityLevel.CRITICAL),
            ("音响", "电源线", 1, SeverityLevel.HIGH),
            ("投影仪", "电源线", 1, SeverityLevel.CRITICAL),
        ]
        for main, acc, ratio, sev in default_deps:
            self.dependencies.append(
                AccessoryDependency(
                    main_item=main,
                    required_accessory=acc,
                    ratio=ratio,
                    severity=sev,
                )
            )

    def add_dependency(self, main_item: str, accessory: str, ratio: int = 1, severity: SeverityLevel = SeverityLevel.CRITICAL):
        self.dependencies.append(
            AccessoryDependency(
                main_item=main_item,
                required_accessory=accessory,
                ratio=ratio,
                severity=severity,
            )
        )

    def load_dependencies_from_csv(self, file_path: str, clear_existing: bool = False, encoding: str = "utf-8") -> int:
        if clear_existing:
            self.dependencies = []

        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"依赖配置文件不存在: {file_path}")

        loaded_count = 0
        invalid_rows = []

        with open(path, "r", encoding=encoding, newline="") as f:
            reader = csv.reader(f)
            header = next(reader, None)

            if header:
                header_lower = [h.strip().lower() for h in header]
                has_header = any(keyword in header_lower for keyword in ["主物料", "配件", "主配件"])
                if has_header:
                    pass
                else:
                    f.seek(0)
                    reader = csv.reader(f)

            for row_num, row in enumerate(reader, start=1):
                    if not row or not any(cell.strip() for cell in row):
                        continue

                    if len(row) < 2:
                        invalid_rows.append(row_num)
                        continue

                    main_item = row[0].strip()
                    accessory = row[1].strip()

                    if not main_item or not accessory:
                        invalid_rows.append(row_num)
                        continue

                    ratio = 1
                    if len(row) >= 3 and row[2].strip():
                        try:
                            ratio = int(row[2].strip())
                        except ValueError:
                            pass

                    severity = SeverityLevel.CRITICAL
                    if len(row) >= 4 and row[3].strip():
                        severity_str = row[3].strip().upper()
                        for sev in SeverityLevel:
                            if sev.value == severity_str or severity_str in sev.value:
                                severity = sev
                                break

                    self.add_dependency(main_item, accessory, ratio, severity)
                    loaded_count += 1

        return loaded_count

    def clear_dependencies(self):
        self.dependencies = []

    def get_dependency_count(self) -> int:
        return len(self.dependencies)

    def list_dependencies(self) -> List[Dict]:
        return [
            {
                "main_item": dep.main_item,
                "required_accessory": dep.required_accessory,
                "ratio": dep.ratio,
                "severity": dep.severity.value,
            }
            for dep in self.dependencies
        ]

    def process(self, materials: List[MaterialItem], invalid_rows: List[MaterialItem]) -> CheckResult:
        result = CheckResult()
        result.materials = materials
        result.invalid_rows = invalid_rows

        city_materials = self._group_by_city(materials)

        for city in sorted(city_materials.keys()):
            city_items = city_materials[city]
            box_assignments = self._assign_box_numbers(city, city_items)
            result.box_assignments.update(box_assignments)

            missing = self._check_dependencies(city, city_items)
            result.missing_items.extend(missing)

        result.missing_items.sort(key=lambda x: (x.severity.value, x.city, x.material_name))

        result.city_summary = self._generate_city_summary(city_materials, result.missing_items)

        return result

    def _group_by_city(self, materials: List[MaterialItem]) -> Dict[str, List[MaterialItem]]:
        city_map = defaultdict(list)
        for m in materials:
            city_map[m.city].append(m)
        return dict(city_map)

    def _assign_box_numbers(self, city: str, materials: List[MaterialItem]) -> Dict[str, BoxAssignment]:
        assignments: Dict[str, BoxAssignment] = {}
        unassigned: List[MaterialItem] = []

        for mat in materials:
            if mat.box_number:
                if mat.box_number not in assignments:
                    assignments[mat.box_number] = BoxAssignment(
                        box_number=mat.box_number, city=city
                    )
                assignments[mat.box_number].add_material(mat)
            else:
                unassigned.append(mat)

        if unassigned:
            default_box = f"{city}-默认箱"
            if default_box not in assignments:
                assignments[default_box] = BoxAssignment(
                    box_number=default_box, city=city
                )
            for mat in unassigned:
                assignments[default_box].add_material(mat)

        return assignments

    def _check_dependencies(self, city: str, materials: List[MaterialItem]) -> List[MissingItem]:
        missing_items: List[MissingItem] = []

        material_counts: Dict[str, int] = defaultdict(int)
        material_lines: Dict[str, int] = {}
        material_boxes: Dict[str, str] = {}

        for mat in materials:
            material_counts[mat.material_name] += mat.quantity
            if mat.material_name not in material_lines or mat.line_number < material_lines[mat.material_name]:
                material_lines[mat.material_name] = mat.line_number
            if mat.box_number:
                material_boxes[mat.material_name] = mat.box_number

        for dep in self.dependencies:
            main_count = 0
            for mat_name, count in material_counts.items():
                if dep.main_item in mat_name:
                    main_count += count

            if main_count > 0:
                required = main_count * dep.ratio
                actual = 0
                for mat_name, count in material_counts.items():
                    if dep.required_accessory in mat_name:
                        actual += count

                if actual < required:
                    source_line = material_lines.get(dep.main_item, 0)
                    source_box = material_boxes.get(dep.main_item, "")

                    missing_items.append(
                        MissingItem(
                            city=city,
                            material_name=dep.required_accessory,
                            missing_type=MissingType.DEPENDENCY,
                            severity=dep.severity,
                            required_quantity=required,
                            actual_quantity=actual,
                            source_line=source_line,
                            source_box=source_box,
                            depends_on=dep.main_item,
                            notes=f"每{dep.main_item}需要{dep.ratio}个{dep.required_accessory}",
                        )
                    )

        return missing_items

    def _generate_city_summary(self, city_materials: Dict[str, List[MaterialItem]], missing_items: List[MissingItem]) -> Dict[str, Dict]:
        summary = {}
        missing_by_city = defaultdict(list)
        for m in missing_items:
            missing_by_city[m.city].append(m)

        for city, materials in city_materials.items():
            city_missing = missing_by_city.get(city, [])
            critical_count = sum(1 for m in city_missing if m.severity == SeverityLevel.CRITICAL)
            high_count = sum(1 for m in city_missing if m.severity == SeverityLevel.HIGH)
            medium_count = sum(1 for m in city_missing if m.severity == SeverityLevel.MEDIUM)
            low_count = sum(1 for m in city_missing if m.severity == SeverityLevel.LOW)

            summary[city] = {
                "material_count": len(materials),
                "total_quantity": sum(m.quantity for m in materials),
                "missing_total": len(city_missing),
                "missing_critical": critical_count,
                "missing_high": high_count,
                "missing_medium": medium_count,
                "missing_low": low_count,
            }

        return summary
