import csv
import json
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TemperaturePoint:
    timestamp: datetime
    temperature: float
    kiln_id: str
    probe_id: str
    is_valid: bool = True


@dataclass
class KilnBatch:
    batch_id: str
    kiln_id: str
    recipe_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str = "unknown"
    target_temp: float = 1250.0
    operator: str = ""
    notes: List[str] = field(default_factory=list)


@dataclass
class RecipeRule:
    name: str
    phases: List[Dict[str, Any]]
    max_heating_rate: float
    min_holding_time: float
    valid_temp_range: tuple


@dataclass
class OperatorNote:
    note_id: str
    batch_id: str
    timestamp: datetime
    content: str
    author: str


class DataParser:
    def __init__(self):
        self.batches: Dict[str, KilnBatch] = {}
        self.temperature_data: Dict[str, List[TemperaturePoint]] = {}
        self.recipes: Dict[str, RecipeRule] = {}
        self.operator_notes: Dict[str, List[OperatorNote]] = {}

    def parse_kiln_batches(self, filepath: str) -> Dict[str, KilnBatch]:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                batch = KilnBatch(
                    batch_id=row['batch_id'],
                    kiln_id=row['kiln_id'],
                    recipe_name=row['recipe_name'],
                    start_time=datetime.fromisoformat(row['start_time']),
                    target_temp=float(row.get('target_temp', 1250.0)),
                    operator=row.get('operator', '')
                )
                if row.get('end_time'):
                    batch.end_time = datetime.fromisoformat(row['end_time'])
                if row.get('status'):
                    batch.status = row['status']
                self.batches[batch.batch_id] = batch
        return self.batches

    def parse_temperature_log(self, filepath: str) -> Dict[str, List[TemperaturePoint]]:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                point = TemperaturePoint(
                    timestamp=datetime.fromisoformat(record['timestamp']),
                    temperature=float(record['temperature']),
                    kiln_id=record['kiln_id'],
                    probe_id=record['probe_id'],
                    is_valid=record.get('is_valid', True)
                )
                key = f"{point.kiln_id}_{point.probe_id}"
                if key not in self.temperature_data:
                    self.temperature_data[key] = []
                self.temperature_data[key].append(point)
        
        for key in self.temperature_data:
            self.temperature_data[key].sort(key=lambda x: x.timestamp)
        
        return self.temperature_data

    def parse_recipe_rules(self, filepath: str) -> Dict[str, RecipeRule]:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        for recipe_name, recipe_data in data.get('recipes', {}).items():
            phases = []
            for phase in recipe_data.get('phases', []):
                phases.append({
                    'name': phase.get('name', 'unknown'),
                    'type': phase.get('type', 'heating'),
                    'duration_min': phase.get('duration_min', 0),
                    'start_temp': phase.get('start_temp', 0),
                    'end_temp': phase.get('end_temp', 0),
                    'rate_limit': phase.get('rate_limit', None)
                })
            
            recipe = RecipeRule(
                name=recipe_name,
                phases=phases,
                max_heating_rate=recipe_data.get('max_heating_rate', 150.0),
                min_holding_time=recipe_data.get('min_holding_time', 30.0),
                valid_temp_range=tuple(recipe_data.get('valid_temp_range', (0, 1400)))
            )
            self.recipes[recipe_name] = recipe
        
        return self.recipes

    def parse_operator_notes(self, filepath: str) -> Dict[str, List[OperatorNote]]:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                note = OperatorNote(
                    note_id=row['note_id'],
                    batch_id=row['batch_id'],
                    timestamp=datetime.fromisoformat(row['timestamp']),
                    content=row['content'],
                    author=row.get('author', '')
                )
                if note.batch_id not in self.operator_notes:
                    self.operator_notes[note.batch_id] = []
                self.operator_notes[note.batch_id].append(note)
        
        for batch_id in self.operator_notes:
            self.operator_notes[batch_id].sort(key=lambda x: x.timestamp)
        
        return self.operator_notes

    def get_batch_temperature_data(self, batch_id: str) -> List[TemperaturePoint]:
        if batch_id not in self.batches:
            return []
        
        batch = self.batches[batch_id]
        result = []
        
        start_time = batch.start_time
        end_time = batch.end_time if batch.end_time else start_time + timedelta(hours=24)
        
        for key, points in self.temperature_data.items():
            if key.startswith(f"{batch.kiln_id}_"):
                for p in points:
                    if start_time <= p.timestamp <= end_time:
                        result.append(p)
        
        result.sort(key=lambda x: x.timestamp)
        return result

    def get_unique_kilns(self) -> List[str]:
        kilns = set()
        for batch in self.batches.values():
            kilns.add(batch.kiln_id)
        return sorted(list(kilns))

    def get_batches_by_kiln(self, kiln_id: str) -> List[KilnBatch]:
        return [b for b in self.batches.values() if b.kiln_id == kiln_id]

    def load_all_data(self, 
                     batches_path: str = None,
                     temp_log_path: str = None,
                     recipes_path: str = None,
                     notes_path: str = None):
        if batches_path and Path(batches_path).exists():
            self.parse_kiln_batches(batches_path)
        if temp_log_path and Path(temp_log_path).exists():
            self.parse_temperature_log(temp_log_path)
        if recipes_path and Path(recipes_path).exists():
            self.parse_recipe_rules(recipes_path)
        if notes_path and Path(notes_path).exists():
            self.parse_operator_notes(notes_path)
