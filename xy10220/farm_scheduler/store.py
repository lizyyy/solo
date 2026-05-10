import json
import os
from typing import List, Optional, Dict
from datetime import datetime
from .models import Plot, Harvester, Schedule


class DataStore:
    def __init__(self, data_dir: str = "./farm_data"):
        self.data_dir = data_dir
        self.plots_file = os.path.join(data_dir, "plots.json")
        self.harvesters_file = os.path.join(data_dir, "harvesters.json")
        self.schedules_file = os.path.join(data_dir, "schedules.json")
        self.history_file = os.path.join(data_dir, "history.json")
        
        self.plots: Dict[str, Plot] = {}
        self.harvesters: Dict[str, Harvester] = {}
        self.schedules: Dict[str, Schedule] = {}
        self.history: List[Dict] = []
    
    def initialize(self):
        os.makedirs(self.data_dir, exist_ok=True)
        self._load_all()
    
    def _load_all(self):
        self.plots = self._load_file(self.plots_file, Plot, 'plot_id')
        self.harvesters = self._load_file(self.harvesters_file, Harvester, 'harvester_id')
        self.schedules = self._load_file(self.schedules_file, Schedule, 'schedule_id')
        self.history = self._load_history(self.history_file)
    
    def _load_file(self, filepath, model_class, id_key):
        if not os.path.exists(filepath):
            return {}
        with open(filepath, 'r', encoding='utf-8') as f:
            items = json.load(f)
        return {item[id_key]: model_class.from_dict(item) for item in items}
    
    def _load_history(self, filepath):
        if not os.path.exists(filepath):
            return []
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _save_file(self, filepath, items_dict):
        items_list = [item.to_dict() for item in items_dict.values()]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(items_list, f, ensure_ascii=False, indent=2)
    
    def _save_history(self):
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)
    
    def add_plot(self, plot: Plot, source: str = "manual"):
        old = self.plots.get(plot.plot_id)
        self.plots[plot.plot_id] = plot
        self._save_file(self.plots_file, self.plots)
        self._log_history(
            entity_type="plot",
            entity_id=plot.plot_id,
            action="create" if not old else "update",
            old_value=old.to_dict() if old else None,
            new_value=plot.to_dict(),
            source=source
        )
    
    def add_harvester(self, harvester: Harvester, source: str = "manual"):
        old = self.harvesters.get(harvester.harvester_id)
        self.harvesters[harvester.harvester_id] = harvester
        self._save_file(self.harvesters_file, self.harvesters)
        self._log_history(
            entity_type="harvester",
            entity_id=harvester.harvester_id,
            action="create" if not old else "update",
            old_value=old.to_dict() if old else None,
            new_value=harvester.to_dict(),
            source=source
        )
    
    def add_schedule(self, schedule: Schedule, source: str = "manual"):
        old = self.schedules.get(schedule.schedule_id)
        self.schedules[schedule.schedule_id] = schedule
        self._save_file(self.schedules_file, self.schedules)
        self._log_history(
            entity_type="schedule",
            entity_id=schedule.schedule_id,
            action="create" if not old else "update",
            old_value=old.to_dict() if old else None,
            new_value=schedule.to_dict(),
            source=source
        )
    
    def delete_schedule(self, schedule_id: str, source: str = "manual"):
        old = self.schedules.pop(schedule_id, None)
        if old:
            self._save_file(self.schedules_file, self.schedules)
            self._log_history(
                entity_type="schedule",
                entity_id=schedule_id,
                action="delete",
                old_value=old.to_dict(),
                new_value=None,
                source=source
            )
            return True
        return False
    
    def _log_history(self, entity_type: str, entity_id: str, action: str, 
                    old_value: Optional[Dict], new_value: Optional[Dict], source: str):
        record = {
            "timestamp": datetime.now().isoformat(),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "old_value": old_value,
            "new_value": new_value,
            "source": source
        }
        self.history.append(record)
        self._save_history()
    
    def get_history(self, entity_type: Optional[str] = None, entity_id: Optional[str] = None):
        records = self.history
        if entity_type:
            records = [r for r in records if r['entity_type'] == entity_type]
        if entity_id:
            records = [r for r in records if r['entity_id'] == entity_id]
        return records
