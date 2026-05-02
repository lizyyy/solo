"""解析模块 - 支持 CSV、JSONL、YAML 格式解析"""

import csv
import json
from pathlib import Path
from typing import Any

import yaml


class CandidatesParser:
    def parse(self, path: Path) -> list[dict[str, Any]]:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return [row for row in reader]


class NotesParser:
    def parse(self, path: Path) -> list[dict[str, Any]]:
        notes = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    notes.append(json.loads(line))
        return notes


class RulesParser:
    def parse(self, path: Path) -> dict[str, Any]:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)


class CompetencyDictParser:
    def parse(self, path: Path) -> dict[str, list[str]]:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict):
            if "competencies" in data:
                competencies = data["competencies"]
                result = {}
                for comp_name, comp_data in competencies.items():
                    if isinstance(comp_data, dict) and "keywords" in comp_data:
                        result[comp_name] = comp_data["keywords"]
                    elif isinstance(comp_data, list):
                        result[comp_name] = comp_data
                return result
            return data
        return {}
