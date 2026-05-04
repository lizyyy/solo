"""数据导入模块"""

import csv
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from collections import defaultdict
from dataclasses import dataclass

import pandas as pd
import numpy as np

from ..config import get_config
from ..features.image_features import extract_image_features, ImageFeatures
from ..features.text_features import extract_text_features, TextFeatures
from ..analysis.grouping import SampleData


@dataclass
class ImportResult:
    batch_id: str
    samples: List[SampleData]
    temperature_data: Dict[str, Dict]
    notes_data: Dict[str, str]
    errors: List[str]
    warnings: List[str]

    def to_dict(self) -> Dict:
        return {
            "batch_id": self.batch_id,
            "total_samples": len(self.samples),
            "errors": self.errors,
            "warnings": self.warnings,
        }


class DataImporter:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.image_config = self.config.image

    def scan_image_directory(
        self,
        image_dir: str,
        batch_id: Optional[str] = None
    ) -> Tuple[List[Path], List[str]]:
        image_path = Path(image_dir)
        if not image_path.exists():
            return [], [f"图片目录不存在: {image_dir}"]

        if not image_path.is_dir():
            return [], [f"路径不是目录: {image_dir}"]

        images = []
        warnings = []

        supported_formats = [ext.lower() for ext in self.image_config.supported_formats]

        for file_path in image_path.iterdir():
            if file_path.is_file():
                ext = file_path.suffix.lower()
                if ext in supported_formats:
                    images.append(file_path)
                else:
                    warnings.append(f"跳过不支持的文件格式: {file_path.name}")

        if not images:
            warnings.append(f"在目录中未找到支持的图片文件: {image_dir}")

        images.sort()
        return images, warnings

    def extract_sample_id_from_filename(
        self,
        filename: str,
        pattern: Optional[str] = None
    ) -> str:
        if pattern:
            match = re.search(pattern, filename)
            if match:
                return match.group(0)

        name = Path(filename).stem

        patterns = [
            r'sample[_-]?(\d+)',
            r'S(\d+)',
            r'(\d{3,})',
        ]

        for p in patterns:
            match = re.search(p, name, re.IGNORECASE)
            if match:
                return match.group(1) if match.lastindex else match.group(0)

        return name

    def extract_formula_from_filename(
        self,
        filename: str,
        formula_map: Optional[Dict[str, str]] = None
    ) -> str:
        name = Path(filename).stem.lower()

        formula_patterns = [
            r'formula[_-]?(\w+)',
            r'f(\d+)',
            r'配方[_-]?(\w+)',
        ]

        for p in formula_patterns:
            match = re.search(p, name)
            if match:
                formula = match.group(1)
                if formula_map and formula in formula_map:
                    return formula_map[formula]
                return formula

        if formula_map:
            for key, value in formula_map.items():
                if key.lower() in name:
                    return value

        return "default"

    def load_temperature_csv(
        self,
        csv_path: str,
        sample_id_column: Optional[str] = None,
        temp_column: Optional[str] = None
    ) -> Tuple[Dict[str, Dict], List[str]]:
        path = Path(csv_path)
        if not path.exists():
            return {}, [f"温度 CSV 文件不存在: {csv_path}"]

        errors = []
        temp_data = {}

        try:
            df = pd.read_csv(csv_path)
        except Exception as e:
            return {}, [f"读取 CSV 文件失败: {e}"]

        columns = df.columns.tolist()

        if sample_id_column is None:
            sample_id_candidates = ['sample_id', 'sample', 'id', '编号', '试样号', '序号']
            for col in sample_id_candidates:
                if col in columns:
                    sample_id_column = col
                    break
            if sample_id_column is None:
                sample_id_column = columns[0] if columns else None

        if temp_column is None:
            temp_candidates = ['temperature', 'temp', '温度', '窑温', '炉温']
            for col in temp_candidates:
                if col in columns:
                    temp_column = col
                    break
            if temp_column is None:
                numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
                if numeric_cols:
                    temp_column = numeric_cols[0]

        if sample_id_column is None or temp_column is None:
            return {}, ["无法确定试样ID列或温度列"]

        for idx, row in df.iterrows():
            sample_id = str(row[sample_id_column]).strip()
            temp_values = []

            if isinstance(row[temp_column], (int, float)):
                temp_values = [float(row[temp_column])]
            elif isinstance(row[temp_column], str):
                try:
                    temp_values = [float(x.strip()) for x in row[temp_column].split(',')]
                except:
                    pass

            if temp_values:
                temp_data[sample_id] = {
                    "temperatures": temp_values,
                    "avg_temp": float(np.mean(temp_values)),
                    "min_temp": float(np.min(temp_values)),
                    "max_temp": float(np.max(temp_values)),
                    "std_temp": float(np.std(temp_values)) if len(temp_values) > 1 else 0.0,
                    "source_file": csv_path,
                }

        return temp_data, errors

    def load_notes_file(
        self,
        notes_path: str,
        format_type: str = "auto"
    ) -> Tuple[Dict[str, str], List[str]]:
        path = Path(notes_path)
        if not path.exists():
            return {}, [f"备注文件不存在: {notes_path}"]

        errors = []
        notes_data = {}

        ext = path.suffix.lower()

        if format_type == "auto":
            if ext == ".csv":
                format_type = "csv"
            elif ext == ".json":
                format_type = "json"
            else:
                format_type = "text"

        try:
            if format_type == "csv":
                df = pd.read_csv(notes_path)
                id_col = None
                note_col = None

                for col in df.columns:
                    col_lower = col.lower()
                    if 'sample' in col_lower or 'id' in col_lower or '编号' in col:
                        id_col = col
                    if 'note' in col_lower or 'remark' in col_lower or '备注' in col:
                        note_col = col

                if id_col is None:
                    id_col = df.columns[0]
                if note_col is None:
                    note_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]

                for idx, row in df.iterrows():
                    sample_id = str(row[id_col]).strip()
                    note = str(row[note_col]).strip() if pd.notna(row[note_col]) else ""
                    if note:
                        notes_data[sample_id] = note

            elif format_type == "json":
                import json
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    notes_data = {str(k).strip(): str(v).strip() for k, v in data.items()}
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            sample_id = item.get('sample_id') or item.get('id')
                            note = item.get('notes') or item.get('note') or item.get('remark')
                            if sample_id and note:
                                notes_data[str(sample_id).strip()] = str(note).strip()

            else:
                with open(path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()

                current_sample = None
                current_note = []

                for line in lines:
                    line = line.rstrip('\n')

                    match = re.match(r'^(\d+)[：:]\s*(.*)$', line)
                    if match:
                        if current_sample and current_note:
                            notes_data[current_sample] = '\n'.join(current_note).strip()

                        current_sample = match.group(1)
                        current_note = [match.group(2)] if match.group(2) else []
                    elif current_sample:
                        current_note.append(line)

                if current_sample and current_note:
                    notes_data[current_sample] = '\n'.join(current_note).strip()

        except Exception as e:
            errors.append(f"读取备注文件失败: {e}")

        return notes_data, errors

    def import_batch(
        self,
        image_dir: str,
        batch_id: Optional[str] = None,
        temperature_csv: Optional[str] = None,
        notes_file: Optional[str] = None,
        formula_map: Optional[Dict[str, str]] = None,
        sample_id_pattern: Optional[str] = None
    ) -> ImportResult:
        all_errors = []
        all_warnings = []

        if batch_id is None:
            batch_id = Path(image_dir).name or "unknown_batch"

        images, img_warnings = self.scan_image_directory(image_dir, batch_id)
        all_warnings.extend(img_warnings)

        if not images:
            all_errors.append(f"没有找到任何图片文件在目录: {image_dir}")
            return ImportResult(
                batch_id=batch_id,
                samples=[],
                temperature_data={},
                notes_data={},
                errors=all_errors,
                warnings=all_warnings
            )

        temp_data = {}
        if temperature_csv:
            temp_data, temp_errors = self.load_temperature_csv(temperature_csv)
            all_errors.extend(temp_errors)

        notes_data = {}
        if notes_file:
            notes_data, note_errors = self.load_notes_file(notes_file)
            all_errors.extend(note_errors)

        samples = []

        for idx, img_path in enumerate(images):
            sample_id = self.extract_sample_id_from_filename(
                img_path.name,
                sample_id_pattern
            )

            if not sample_id or sample_id.strip() == "":
                sample_id = f"S_{idx + 1:03d}"

            formula = self.extract_formula_from_filename(
                img_path.name,
                formula_map
            )

            try:
                image_features = extract_image_features(str(img_path))
            except Exception as e:
                all_errors.append(f"处理图片 {img_path.name} 时出错: {e}")
                continue

            notes = notes_data.get(sample_id, "")
            text_features = None
            if notes:
                try:
                    text_features = extract_text_features(notes)
                except Exception as e:
                    all_warnings.append(f"处理备注 {sample_id} 时出错: {e}")

            sample_temp_data = temp_data.get(sample_id)

            sample = SampleData(
                sample_id=sample_id,
                image_path=str(img_path),
                batch_id=batch_id,
                formula=formula,
                image_features=image_features,
                text_features=text_features,
                kiln_temperature_data=sample_temp_data,
                notes=notes,
                metadata={
                    "original_filename": img_path.name,
                    "import_order": idx,
                }
            )
            samples.append(sample)

        if not samples:
            all_errors.append("没有成功导入任何试样")

        return ImportResult(
            batch_id=batch_id,
            samples=samples,
            temperature_data=temp_data,
            notes_data=notes_data,
            errors=all_errors,
            warnings=all_warnings
        )


def import_batch_data(
    image_dir: str,
    batch_id: Optional[str] = None,
    temperature_csv: Optional[str] = None,
    notes_file: Optional[str] = None,
    config=None
) -> ImportResult:
    importer = DataImporter(config)
    return importer.import_batch(
        image_dir=image_dir,
        batch_id=batch_id,
        temperature_csv=temperature_csv,
        notes_file=notes_file
    )
