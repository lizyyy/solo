"""Parser layer for survey data files."""

import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Union

import yaml


class CSVParser:
    @staticmethod
    def parse(filepath: Union[str, Path]) -> List[Dict[str, Any]]:
        with open(filepath, newline="", encoding="utf-8") as f:
            return list(csv.DictReader(f))


class YAMLParser:
    @staticmethod
    def parse(filepath: Union[str, Path]) -> Dict[str, Any]:
        with open(filepath, encoding="utf-8") as f:
            return yaml.safe_load(f)


class GeoJSONParser:
    @staticmethod
    def parse(filepath: Union[str, Path]) -> Dict[str, Any]:
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
        if data.get("type") == "FeatureCollection" and "features" in data:
            return data
        if data.get("type") == "Feature":
            return {"type": "FeatureCollection", "features": [data]}
        raise ValueError(f"Invalid GeoJSON structure in {filepath}")


class JSONLParser:
    @staticmethod
    def parse(filepath: Union[str, Path]) -> List[Dict[str, Any]]:
        results = []
        with open(filepath, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    results.append(json.loads(line))
        return results


def parse_photo_list(csv_path: Union[str, Path]) -> List[Dict[str, Any]]:
    return CSVParser.parse(csv_path)


def parse_rules(yaml_path: Union[str, Path]) -> Dict[str, Any]:
    return YAMLParser.parse(yaml_path)


def parse_flight_lines(geojson_path: Union[str, Path]) -> Dict[str, Any]:
    return GeoJSONParser.parse(geojson_path)


def parse_exif(jsonl_path: Union[str, Path]) -> List[Dict[str, Any]]:
    return JSONLParser.parse(jsonl_path)
