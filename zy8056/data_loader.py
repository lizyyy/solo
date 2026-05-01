
import json
import csv
import yaml
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class Colony:
    colony_id: str
    x: int
    y: int
    width: int
    height: int
    confidence: float


@dataclass
class SampleImage:
    image_id: str
    batch_id: str
    image_path: str
    colonies: List[Colony]
    image_exists: bool = True


class DataLoader:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.images_dir = self.data_dir / "images"
        self.detections_path = self.data_dir / "detections.jsonl"
        self.batches_path = self.data_dir / "batches.csv"
        self.rules_path = self.data_dir / "rules.yaml"
        
        self.images: Dict[str, SampleImage] = {}
        self.batches: Dict[str, List[str]] = {}
        self.rules: Dict = {}
        
    def load_all(self) -> Tuple[Dict[str, SampleImage], Dict[str, List[str]], Dict]:
        self.load_rules()
        self.load_batches()
        self.load_detections()
        return self.images, self.batches, self.rules
    
    def load_rules(self) -> Dict:
        if self.rules_path.exists():
            with open(self.rules_path, 'r', encoding='utf-8') as f:
                self.rules = yaml.safe_load(f) or {}
        return self.rules
    
    def load_batches(self) -> Dict[str, List[str]]:
        if self.batches_path.exists():
            with open(self.batches_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    batch_id = row.get('batch_id', 'default')
                    image_id = row.get('image_id', '')
                    if image_id:
                        if batch_id not in self.batches:
                            self.batches[batch_id] = []
                        self.batches[batch_id].append(image_id)
        return self.batches
    
    def load_detections(self) -> Dict[str, SampleImage]:
        if not self.detections_path.exists():
            return self.images
        
        colony_id_counter: Dict[str, int] = {}
        
        with open(self.detections_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    image_id = data.get('image_id', '')
                    if not image_id:
                        continue
                    
                    colony = self._parse_colony(data, colony_id_counter)
                    if colony:
                        if image_id not in self.images:
                            image_path = str(self.images_dir / f"{image_id}.jpg")
                            image_exists = os.path.exists(image_path)
                            if not image_exists:
                                for ext in ['.png', '.jpeg', '.bmp']:
                                    image_path = str(self.images_dir / f"{image_id}{ext}")
                                    if os.path.exists(image_path):
                                        image_exists = True
                                        break
                            self.images[image_id] = SampleImage(
                                image_id=image_id,
                                batch_id=self._get_batch_for_image(image_id),
                                image_path=image_path,
                                colonies=[],
                                image_exists=image_exists
                            )
                        self.images[image_id].colonies.append(colony)
                except json.JSONDecodeError:
                    continue
        
        return self.images
    
    def _parse_colony(self, data: Dict, colony_id_counter: Dict[str, int]) -&gt; Optional[Colony]:
        colony_id = data.get('colony_id', '')
        
        if colony_id in colony_id_counter:
            colony_id_counter[colony_id] += 1
            colony_id = f"{colony_id}_dup{colony_id_counter[colony_id]}"
        else:
            colony_id_counter[colony_id] = 0
        
        bbox = data.get('bbox', [])
        if len(bbox) &gt;= 4:
            x, y, w, h = bbox[:4]
            return Colony(
                colony_id=colony_id,
                x=int(x),
                y=int(y),
                width=int(w),
                height=int(h),
                confidence=float(data.get('confidence', 0.0))
            )
        return None
    
    def _get_batch_for_image(self, image_id: str) -&gt; str:
        for batch_id, image_ids in self.batches.items():
            if image_id in image_ids:
                return batch_id
        return 'default'

