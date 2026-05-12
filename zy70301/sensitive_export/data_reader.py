import csv
import json
import os
from typing import Any, Dict, List


class DataReader:
    def read_csv(self, file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)

    def read_json(self, file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                if 'data' in data and isinstance(data['data'], list):
                    return data['data']
                if 'items' in data and isinstance(data['items'], list):
                    return data['items']
                return [data]
            else:
                raise ValueError("JSON file must contain a list of objects or a dict with 'data'/'items' array")

    def read(self, file_path: str) -> List[Dict[str, Any]]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            return self.read_csv(file_path)
        elif ext == '.json':
            return self.read_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}. Only CSV and JSON are supported.")

    def get_columns(self, file_path: str) -> List[str]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                return reader.fieldnames or []
        elif ext == '.json':
            data = self.read_json(file_path)
            if data:
                return list(data[0].keys())
            return []
        return []


class DataWriter:
    def write_csv(self, file_path: str, data: List[Dict[str, Any]]) -> None:
        if not data:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('')
            return
        
        fieldnames = list(data[0].keys())
        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

    def write_json(self, file_path: str, data: List[Dict[str, Any]]) -> None:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def write(self, file_path: str, data: List[Dict[str, Any]], format: str = 'csv') -> None:
        if format == 'csv':
            self.write_csv(file_path, data)
        elif format == 'json':
            self.write_json(file_path, data)
        else:
            raise ValueError(f"Unsupported output format: {format}")
