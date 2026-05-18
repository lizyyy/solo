import os
import hashlib
import json
import shutil
import re
import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple
from collections import defaultdict

from PIL import Image
import imagehash
import yaml


class SampleAppealProcessor:
    def __init__(self, input_path: str, rules_file: str, output_dir: str, 
                 dry_run: bool = False, overwrite: bool = False):
        self.input_path = Path(input_path)
        self.rules_file = Path(rules_file)
        self.output_dir = Path(output_dir)
        self.dry_run = dry_run
        self.overwrite = overwrite
        
        self.rules = self._load_rules()
        self.samples: List[Dict[str, Any]] = []
        self.thumbnail_samples: List[Dict[str, Any]] = []
        self.duplicate_samples: List[Dict[str, Any]] = []
        self.model_version_samples: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
    def _load_rules(self) -> Dict[str, Any]:
        with open(self.rules_file, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def _calculate_image_hash(self, image_path: Path) -> str:
        try:
            with Image.open(image_path) as img:
                return str(imagehash.phash(img))
        except Exception:
            return ""
    
    def _is_thumbnail(self, image_path: Path) -> Tuple[bool, Dict[str, Any]]:
        try:
            with Image.open(image_path) as img:
                width, height = img.size
                max_dimension = self.rules.get('thumbnail_max_size', 200)
                is_thumb = width <= max_dimension or height <= max_dimension
                reason = ""
                if is_thumb:
                    if width <= max_dimension and height <= max_dimension:
                        reason = f"尺寸过小 ({width}x{height})"
                    elif width <= max_dimension:
                        reason = f"宽度过小 ({width}px)"
                    else:
                        reason = f"高度过小 ({height}px)"
                return is_thumb, {
                    "width": width,
                    "height": height,
                    "reason": reason
                }
        except Exception as e:
            return False, {"error": str(e)}
    
    def _extract_model_version(self, filename: str) -> str:
        patterns = self.rules.get('model_version_patterns', [
            r'v(\d+\.\d+)',
            r'ver(\d+)',
            r'model_(\w+)',
            r'_v(\d+)'
        ])
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return match.group(1)
        return "unknown"
    
    def scan_samples(self):
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        
        for root, _, files in os.walk(self.input_path):
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() not in image_extensions:
                    continue
                    
                sample_info = {
                    "filename": file,
                    "relative_path": str(file_path.relative_to(self.input_path)),
                    "absolute_path": str(file_path),
                    "file_size": file_path.stat().st_size,
                    "file_hash": self._calculate_file_hash(file_path),
                    "image_hash": self._calculate_image_hash(file_path),
                    "model_version": self._extract_model_version(file)
                }
                
                is_thumb, thumb_info = self._is_thumbnail(file_path)
                sample_info["is_thumbnail"] = is_thumb
                sample_info["thumbnail_info"] = thumb_info
                
                self.samples.append(sample_info)
                
                if is_thumb:
                    self.thumbnail_samples.append(sample_info)
                
                if sample_info["model_version"] != "unknown":
                    self.model_version_samples[sample_info["model_version"]].append(sample_info)
        
        self._detect_duplicates()
    
    def _detect_duplicates(self):
        image_hash_groups = defaultdict(list)
        file_hash_groups = defaultdict(list)
        
        for sample in self.samples:
            if sample["image_hash"]:
                image_hash_groups[sample["image_hash"]].append(sample)
            file_hash_groups[sample["file_hash"]].append(sample)
        
        for group in image_hash_groups.values():
            if len(group) > 1:
                for sample in group:
                    if sample not in self.duplicate_samples:
                        sample["duplicate_type"] = "image_content"
                        sample["duplicate_group_size"] = len(group)
                        self.duplicate_samples.append(sample)
        
        for group in file_hash_groups.values():
            if len(group) > 1:
                for sample in group:
                    if sample not in self.duplicate_samples:
                        sample["duplicate_type"] = "file_exact"
                        sample["duplicate_group_size"] = len(group)
                        self.duplicate_samples.append(sample)
    
    def _sort_samples(self, samples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return sorted(samples, key=lambda x: (
            x.get("model_version", ""),
            x.get("is_thumbnail", False),
            x["relative_path"]
        ))
    
    def generate_report(self) -> Dict[str, Any]:
        normal_samples = [s for s in self.samples 
                         if not s["is_thumbnail"] and s not in self.duplicate_samples]
        
        from . import __version__
        report = {
            "tool_name": "审核样本目录误封申诉整理",
            "version": __version__,
            "scan_time": datetime.datetime.now().isoformat(),
            "input_path": str(self.input_path),
            "rules_file": str(self.rules_file),
            "summary": {
                "total_samples": len(self.samples),
                "normal_samples": len(normal_samples),
                "thumbnail_samples": len(self.thumbnail_samples),
                "duplicate_samples": len(self.duplicate_samples),
                "model_version_count": len(self.model_version_samples)
            },
            "details": {
                "normal_samples": self._sort_samples(normal_samples),
                "thumbnail_samples": self._sort_samples(self.thumbnail_samples),
                "duplicate_samples": self._sort_samples(self.duplicate_samples),
                "model_version_groups": {
                    k: self._sort_samples(v) 
                    for k, v in sorted(self.model_version_samples.items())
                }
            }
        }
        return report
    
    def create_appeal_package(self):
        if not self.dry_run:
            if self.output_dir.exists():
                if not self.overwrite:
                    raise FileExistsError(f"输出目录已存在: {self.output_dir}")
                shutil.rmtree(self.output_dir)
            self.output_dir.mkdir(parents=True)
            
            (self.output_dir / "normal_samples").mkdir()
            (self.output_dir / "thumbnail_samples").mkdir()
            (self.output_dir / "duplicate_samples").mkdir()
            (self.output_dir / "model_version_groups").mkdir()
            
            for sample in self._sort_samples([s for s in self.samples if not s["is_thumbnail"] and s not in self.duplicate_samples]):
                shutil.copy2(sample["absolute_path"], 
                            self.output_dir / "normal_samples" / sample["filename"])
            
            for sample in self._sort_samples(self.thumbnail_samples):
                shutil.copy2(sample["absolute_path"], 
                            self.output_dir / "thumbnail_samples" / sample["filename"])
            
            for sample in self._sort_samples(self.duplicate_samples):
                shutil.copy2(sample["absolute_path"], 
                            self.output_dir / "duplicate_samples" / sample["filename"])
            
            for version, samples in self.model_version_samples.items():
                version_dir = self.output_dir / "model_version_groups" / f"v{version}"
                version_dir.mkdir(exist_ok=True)
                for sample in self._sort_samples(samples):
                    shutil.copy2(sample["absolute_path"], version_dir / sample["filename"])
        
        report = self.generate_report()
        
        if not self.dry_run:
            with open(self.output_dir / "appeal_report.json", 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
        
        return report
