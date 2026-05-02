import csv
import json
import yaml
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional


def to_mm(value: float, unit: Optional[str] = None) -> float:
    if unit == 'cm':
        return value * 10.0
    return value


def parse_plan_dose(csv_path: Path) -> Tuple[np.ndarray, Dict]:
    data = []
    metadata = {}
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            x = to_mm(float(row.get('x', row.get('X', 0))), row.get('unit', row.get('Unit')))
            y = to_mm(float(row.get('y', row.get('Y', 0))), row.get('unit', row.get('Unit')))
            z = to_mm(float(row.get('z', row.get('Z', 0))), row.get('unit', row.get('Unit')))
            dose = float(row.get('dose', row.get('Dose', 0)))
            data.append([x, y, z, dose])
    arr = np.array(data)
    coords = arr[:, :3]
    doses = arr[:, 3]
    return doses, {
        'x_min': coords[:, 0].min(), 'x_max': coords[:, 0].max(),
        'y_min': coords[:, 1].min(), 'y_max': coords[:, 1].max(),
        'z_min': coords[:, 2].min(), 'z_max': coords[:, 2].max(),
        'coords': coords
    }


def parse_measurements(jsonl_path: Path) -> List[Dict]:
    pts = []
    with open(jsonl_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                p = json.loads(line)
                x = to_mm(float(p.get('x', p.get('X', 0))), p.get('unit'))
                y = to_mm(float(p.get('y', p.get('Y', 0))), p.get('unit'))
                z = to_mm(float(p.get('z', p.get('Z', 0))), p.get('unit'))
                pts.append({
                    'x': x, 'y': y, 'z': z,
                    'measured_dose': float(p.get('dose', p.get('Dose', 0))),
                    'id': p.get('id', p.get('ID', len(pts)))
                })
            except Exception as e:
                continue
    return pts


def parse_structures(json_path: Path) -> Dict:
    with open(json_path, 'r') as f:
        data = json.load(f)
    structures = {}
    for name, struct in data.items():
        if not struct or 'contours' not in struct or not struct['contours']:
            structures[name] = None
            continue
        contours = []
        for c in struct['contours']:
            pts = []
            for p in c:
                x = to_mm(float(p[0]))
                y = to_mm(float(p[1]))
                z = to_mm(float(p[2])) if len(p) > 2 else 0.0
                pts.append([x, y, z])
            contours.append(np.array(pts))
        structures[name] = {
            'contours': contours,
            'color': struct.get('color', '#808080')
        }
    return structures


def parse_thresholds(yaml_path: Path) -> Dict:
    with open(yaml_path, 'r') as f:
        return yaml.safe_load(f)
