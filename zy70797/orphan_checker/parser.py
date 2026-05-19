import csv
import os
import re
from pathlib import Path
from typing import List, Optional, Tuple, Dict
import yaml
from .models import ServiceEntry, SourceLocation


class ParseError(Exception):
    pass


class ServiceCatalogParser:
    def __init__(self, file_path: str):
        self.file_path = os.path.abspath(file_path)
        self.file_ext = Path(file_path).suffix.lower()

    def parse(self) -> Tuple[List[ServiceEntry], List[ServiceEntry]]:
        valid_entries: List[ServiceEntry] = []
        invalid_entries: List[ServiceEntry] = []

        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Service catalog file not found: {self.file_path}")

        if self.file_ext in [".yaml", ".yml"]:
            valid, invalid = self._parse_yaml()
        elif self.file_ext == ".csv":
            valid, invalid = self._parse_csv()
        else:
            raise ParseError(f"Unsupported file format: {self.file_ext}")

        valid_entries.extend(valid)
        invalid_entries.extend(invalid)

        valid_entries.sort(key=lambda e: e.get_stable_id())
        invalid_entries.sort(key=lambda e: e.get_stable_id())

        return valid_entries, invalid_entries

    def _parse_yaml(self) -> Tuple[List[ServiceEntry], List[ServiceEntry]]:
        valid_entries: List[ServiceEntry] = []
        invalid_entries: List[ServiceEntry] = []

        with open(self.file_path, "r", encoding="utf-8") as f:
            raw_lines = f.readlines()
            f.seek(0)
            try:
                data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                raise ParseError(f"YAML parse error: {str(e)}")

        if not isinstance(data, list):
            raise ParseError("YAML root must be a list of service entries")

        line_numbers = self._find_yaml_list_item_lines(raw_lines)

        for idx, item in enumerate(data):
            line_num = line_numbers[idx] if idx < len(line_numbers) else None
            raw_content = self._extract_yaml_item_content(raw_lines, line_num) if line_num else str(item)
            
            source = SourceLocation(
                file_path=self.file_path,
                line_number=line_num,
                raw_content=raw_content,
            )

            try:
                entry = self._parse_yaml_item(item, source)
                if entry.is_valid:
                    valid_entries.append(entry)
                else:
                    invalid_entries.append(entry)
            except Exception as e:
                invalid_entry = ServiceEntry(
                    service_name=f"invalid_entry_{line_num or idx}",
                    is_valid=False,
                    parse_error=str(e),
                    source=source,
                )
                invalid_entries.append(invalid_entry)

        return valid_entries, invalid_entries

    def _find_yaml_list_item_lines(self, lines: List[str]) -> List[int]:
        line_numbers = []
        for line_num, line in enumerate(lines, start=1):
            stripped = line.lstrip()
            indent = len(line) - len(stripped)
            if indent == 0 and stripped.startswith("- ") and not stripped.startswith("- #"):
                line_numbers.append(line_num)
        return line_numbers

    def _extract_yaml_item_content(self, lines: List[str], start_line: int) -> str:
        if start_line is None or start_line < 1:
            return ""
        
        start_idx = start_line - 1
        if start_idx >= len(lines):
            return ""
        
        first_line = lines[start_idx]
        first_indent = len(first_line) - len(first_line.lstrip())
        
        content_lines = [first_line.rstrip()]
        for i in range(start_idx + 1, len(lines)):
            line = lines[i]
            if not line.strip():
                content_lines.append("")
                continue
            
            current_indent = len(line) - len(line.lstrip())
            if current_indent <= first_indent and (line.lstrip().startswith("- ") or line.lstrip().startswith("#")):
                break
            
            if line.lstrip().startswith("- ") and current_indent <= first_indent + 2:
                break
                
            content_lines.append(line.rstrip())
        
        return "\n".join(content_lines)

    def _parse_yaml_item(self, item: dict, source: SourceLocation) -> ServiceEntry:
        if not isinstance(item, dict):
            return ServiceEntry(
                service_name=f"invalid_type_{type(item).__name__}",
                is_valid=False,
                parse_error="Item must be a dictionary",
                source=source,
            )

        service_name = item.get("service_name", "").strip()
        if not service_name:
            return ServiceEntry(
                service_name="unnamed_service",
                is_valid=False,
                parse_error="service_name is required",
                source=source,
                extra_fields=item,
            )

        repository = item.get("repository")
        owners = self._normalize_owners(item.get("owners", []))
        alert_rules = self._normalize_list(item.get("alert_rules", []))

        extra_fields = {k: v for k, v in item.items() if k not in [
            "service_name", "repository", "owners", "alert_rules"
        ]}

        return ServiceEntry(
            service_name=service_name,
            repository=repository,
            owners=owners,
            alert_rules=alert_rules,
            source=source,
            extra_fields=extra_fields,
        )

    def _parse_csv(self) -> Tuple[List[ServiceEntry], List[ServiceEntry]]:
        valid_entries: List[ServiceEntry] = []
        invalid_entries: List[ServiceEntry] = []

        with open(self.file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, [])

            for line_num, row in enumerate(reader, start=2):
                raw_content = ",".join(row)
                source = SourceLocation(
                    file_path=self.file_path,
                    line_number=line_num,
                    raw_content=raw_content,
                )

                try:
                    row_dict = self._parse_csv_row_dict_robust(headers, row)
                    entry = self._parse_csv_row(row_dict, source)
                    if entry.is_valid:
                        valid_entries.append(entry)
                    else:
                        invalid_entries.append(entry)
                except Exception as e:
                    invalid_entry = ServiceEntry(
                        service_name=f"csv_row_{line_num}",
                        is_valid=False,
                        parse_error=str(e),
                        source=source,
                    )
                    invalid_entries.append(invalid_entry)

        return valid_entries, invalid_entries

    def _parse_csv_row_dict_robust(self, headers: List[str], row: List[str]) -> Dict[str, str]:
        row_dict = {header: "" for header in headers}
        
        if not row:
            return row_dict

        header_to_idx = {header: i for i, header in enumerate(headers)}
        
        service_name_idx = header_to_idx.get("service_name", 0)
        repository_idx = header_to_idx.get("repository", 1)
        owners_idx = header_to_idx.get("owners", 2)
        alert_rules_idx = header_to_idx.get("alert_rules", 3)

        if service_name_idx < len(row):
            row_dict["service_name"] = row[service_name_idx].strip()
        
        if repository_idx < len(row):
            row_dict["repository"] = row[repository_idx].strip()

        candidate_values = []
        for i in range(min(owners_idx, len(row)), len(row)):
            val = row[i].strip()
            if val:
                candidate_values.append(val)

        owners_list, alerts_list = self._classify_and_separate_values(candidate_values)
        row_dict["owners"] = ",".join(owners_list)
        row_dict["alert_rules"] = ",".join(alerts_list)

        return row_dict

    def _classify_and_separate_values(self, values: List[str]) -> Tuple[List[str], List[str]]:
        if not values:
            return [], []

        email_owners = []
        other_owners = []
        alerts = []

        for val in values:
            if "@" in val:
                email_owners.append(val)
            elif self._looks_like_alert_rule(val):
                alerts.append(val)
            elif self._looks_like_owner(val):
                other_owners.append(val)
            else:
                if val[0].isupper() and (len(val) > 10 or "_" in val):
                    alerts.append(val)
                else:
                    other_owners.append(val)

        all_owners = email_owners + other_owners
        return all_owners, alerts

    def _looks_like_alert_rule(self, val: str) -> bool:
        if not val:
            return False
        
        has_uppercase = any(c.isupper() for c in val)
        has_alert_keywords = any(kw in val.lower() for kw in [
            "alert", "error", "high", "latency", "rate", "traffic", "threshold",
            "warning", "critical", "down", "up", "timeout", "fail"
        ])
        
        return has_alert_keywords or (has_uppercase and "_" in val)

    def _looks_like_owner(self, val: str) -> bool:
        if not val:
            return False
        
        if "@" in val:
            return True
        
        if val.islower() and len(val) <= 20 and "_" not in val and "." not in val:
            return True
        
        return False

    def _parse_csv_row(self, row: dict, source: SourceLocation) -> ServiceEntry:
        service_name = row.get("service_name", "").strip()
        if not service_name:
            return ServiceEntry(
                service_name=f"unnamed_row_{source.line_number}",
                is_valid=False,
                parse_error="service_name column is required",
                source=source,
                extra_fields=row,
            )

        repository = row.get("repository")
        owners = self._normalize_owners(row.get("owners", ""))
        alert_rules = self._normalize_list(row.get("alert_rules", ""))

        extra_fields = {k: v for k, v in row.items() if k not in [
            "service_name", "repository", "owners", "alert_rules"
        ]}

        return ServiceEntry(
            service_name=service_name,
            repository=repository,
            owners=owners,
            alert_rules=alert_rules,
            source=source,
            extra_fields=extra_fields,
        )

    def _normalize_owners(self, owners) -> List[str]:
        if isinstance(owners, str):
            owners = [o.strip() for o in owners.split(",") if o.strip()]
        elif isinstance(owners, list):
            owners = [str(o).strip() for o in owners if str(o).strip()]
        return sorted(set(owners))

    def _normalize_list(self, items) -> List[str]:
        if isinstance(items, str):
            items = [i.strip() for i in items.split(",") if i.strip()]
        elif isinstance(items, list):
            items = [str(i).strip() for i in items if str(i).strip()]
        return sorted(set(items))
