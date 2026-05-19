import csv
import os
from pathlib import Path
from typing import List, Optional, Tuple
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
            try:
                data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                raise ParseError(f"YAML parse error: {str(e)}")

        if not isinstance(data, list):
            raise ParseError("YAML root must be a list of service entries")

        for idx, item in enumerate(data):
            line_num = idx + 1
            source = SourceLocation(
                file_path=self.file_path,
                line_number=line_num,
                raw_content=yaml.dump(item) if isinstance(item, dict) else str(item),
            )

            try:
                entry = self._parse_yaml_item(item, source)
                if entry.is_valid:
                    valid_entries.append(entry)
                else:
                    invalid_entries.append(entry)
            except Exception as e:
                invalid_entry = ServiceEntry(
                    service_name=f"invalid_entry_{idx}",
                    is_valid=False,
                    parse_error=str(e),
                    source=source,
                )
                invalid_entries.append(invalid_entry)

        return valid_entries, invalid_entries

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
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                raw_content = ",".join([f"{k}={v}" for k, v in row.items()])
                source = SourceLocation(
                    file_path=self.file_path,
                    line_number=line_num,
                    raw_content=raw_content,
                )

                try:
                    entry = self._parse_csv_row(row, source)
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
