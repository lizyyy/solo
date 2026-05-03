import csv
import json
from pathlib import Path
from typing import Any, Dict, List

import yaml


def read_csv(file_path: Path) -> List[Dict[str, Any]]:
    """读取 CSV 文件，返回字典列表"""
    records = []
    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append({k.strip(): v.strip() for k, v in row.items() if k is not None})
    return records


def read_jsonl(file_path: Path) -> List[Dict[str, Any]]:
    """读取 JSONL 文件，返回字典列表"""
    records = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, 1):
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as e:
                    raise ValueError(f"JSONL 文件第 {line_number} 行解析错误: {e}")
    return records


def read_yaml(file_path: Path) -> Dict[str, Any]:
    """读取 YAML 文件，返回字典"""
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            return yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            raise ValueError(f"YAML 文件解析错误: {e}")


def parse_formulas(file_path: Path) -> List[Dict[str, Any]]:
    """解析产品配方 CSV，处理过敏原字段"""
    records = read_csv(file_path)
    for record in records:
        if "allergens" in record:
            allergens = [
                a.strip() for a in record["allergens"].split(",") 
                if a.strip() and a.strip() not in ["无", "none", "None", "NONE", ""]
            ]
            record["allergens"] = allergens
        else:
            record["allergens"] = []
    return records


def parse_cleaning_records(file_path: Path) -> List[Dict[str, Any]]:
    """解析清洁验证记录 CSV"""
    records = read_csv(file_path)
    return records


def parse_production_batches(file_path: Path) -> List[Dict[str, Any]]:
    """解析产线批次 JSONL"""
    return read_jsonl(file_path)


def parse_rules(file_path: Path) -> Dict[str, Any]:
    """解析规则 YAML"""
    return read_yaml(file_path)


def load_all_data(
    formulas_path: Path,
    batches_path: Path,
    cleaning_path: Path,
    rules_path: Path,
) -> Dict[str, Any]:
    """加载所有数据文件"""
    return {
        "formulas": parse_formulas(formulas_path),
        "batches": parse_production_batches(batches_path),
        "cleaning_records": parse_cleaning_records(cleaning_path),
        "rules": parse_rules(rules_path),
    }
