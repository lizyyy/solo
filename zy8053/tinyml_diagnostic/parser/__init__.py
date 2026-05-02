"""Parser module for TinyML diagnostic."""
import json
import csv
from pathlib import Path
from typing import Dict, List, Any


class ParseError(Exception):
    pass


def parse_predictions(jsonl_path: str) -> Dict[str, Dict[str, float]]:
    """Parse JSONL prediction file.

    Expected format per line:
        {"sample_id": "xxx", "predictions": {"class_a": 0.9, "class_b": 0.1}}
    """
    predictions = {}
    path = Path(jsonl_path)
    if not path.exists():
        raise ParseError(f"Prediction file not found: {jsonl_path}")

    with open(path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError as e:
                raise ParseError(f"Invalid JSON at line {line_num}: {e}")

            sample_id = data.get('sample_id')
            if not sample_id:
                raise ParseError(f"Missing sample_id at line {line_num}")

            preds = data.get('predictions')
            if not isinstance(preds, dict):
                raise ParseError(f"Invalid predictions format at line {line_num}")

            for cls, conf in preds.items():
                if not isinstance(conf, (int, float)):
                    raise ParseError(f"Non-numeric confidence for class {cls} at line {line_num}")

            predictions[str(sample_id)] = preds

    return predictions


def parse_labels(csv_path: str) -> Dict[str, str]:
    """Parse labels CSV file.

    Expected format:
        sample_id,label
        or
        sample_id,class
    """
    labels = {}
    path = Path(csv_path)
    if not path.exists():
        raise ParseError(f"Labels file not found: {csv_path}")

    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        if not fieldnames:
            raise ParseError(f"Empty labels file: {csv_path}")

        if 'sample_id' not in fieldnames:
            raise ParseError(f"Missing 'sample_id' column in {csv_path}")

        label_col = None
        for col in ['label', 'class', 'category', 'ground_truth']:
            if col in fieldnames:
                label_col = col
                break

        if not label_col:
            available = [f for f in fieldnames if f != 'sample_id']
            if available:
                label_col = available[0]
            else:
                raise ParseError(f"No label column found in {csv_path}")

        for row in reader:
            sample_id = row.get('sample_id')
            if not sample_id:
                continue
            labels[str(sample_id)] = str(row[label_col])

    return labels


def parse_thresholds(yaml_path: str) -> Dict[str, float]:
    """Parse quantization thresholds YAML file.

    Expected format:
        class_a: 1.5
        class_b: 2.0
    """
    try:
        import yaml
    except ImportError:
        raise ParseError("PyYAML is required. Install with: pip install pyyaml")

    path = Path(yaml_path)
    if not path.exists():
        raise ParseError(f"Thresholds file not found: {yaml_path}")

    with open(path, 'r', encoding='utf-8') as f:
        try:
            data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise ParseError(f"Invalid YAML: {e}")

    if not isinstance(data, dict):
        raise ParseError(f"Thresholds must be a mapping, got {type(data).__name__}")

    thresholds = {}
    for cls, threshold in data.items():
        if not isinstance(threshold, (int, float)):
            raise ParseError(f"Non-numeric threshold for class {cls}: {threshold}")
        thresholds[str(cls)] = float(threshold)

    return thresholds