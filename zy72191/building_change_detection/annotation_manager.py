import os
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import (
    AnnotationMaterial, MaterialSource, EvaluationRecord,
    VerificationStatus
)


class AnnotationManager:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.annotation_dir = os.path.join(data_dir, "annotation_tables")
        self.threshold_dir = os.path.join(data_dir, "threshold_notes")
        self.conflict_dir = os.path.join(data_dir, "conflict_cases")
        self._ensure_directories()

    def _ensure_directories(self):
        for d in [self.annotation_dir, self.threshold_dir, self.conflict_dir]:
            os.makedirs(d, exist_ok=True)

    def load_annotation_materials(self, caliber_version: Optional[str] = None) -> Dict[str, List[AnnotationMaterial]]:
        materials_by_record: Dict[str, List[AnnotationMaterial]] = {}

        if not os.path.exists(self.annotation_dir):
            return materials_by_record

        for filename in os.listdir(self.annotation_dir):
            if filename.endswith(('.json', '.csv', '.xlsx')):
                file_path = os.path.join(self.annotation_dir, filename)
                materials = self._parse_annotation_file(file_path)
                for mat in materials:
                    if caliber_version and mat.caliber_version != caliber_version:
                        continue
                    if mat.record_id not in materials_by_record:
                        materials_by_record[mat.record_id] = []
                    materials_by_record[mat.record_id].append(mat)

        return materials_by_record

    def _parse_annotation_file(self, file_path: str) -> List[AnnotationMaterial]:
        ext = os.path.splitext(file_path)[1].lower()

        if ext == '.json':
            return self._parse_annotation_json(file_path)
        elif ext == '.csv':
            return self._parse_annotation_csv(file_path)
        elif ext == '.xlsx':
            return self._parse_annotation_excel(file_path)
        else:
            return []

    def _parse_annotation_json(self, file_path: str) -> List[AnnotationMaterial]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        materials = []
        items = data if isinstance(data, list) else [data]

        for item in items:
            material = self._dict_to_material(item)
            if material:
                materials.append(material)

        return materials

    def _parse_annotation_csv(self, file_path: str) -> List[AnnotationMaterial]:
        df = pd.read_csv(file_path)
        return self._df_to_materials(df)

    def _parse_annotation_excel(self, file_path: str) -> List[AnnotationMaterial]:
        df = pd.read_excel(file_path)
        return self._df_to_materials(df)

    def _df_to_materials(self, df: pd.DataFrame) -> List[AnnotationMaterial]:
        materials = []
        for _, row in df.iterrows():
            item = row.to_dict()
            material = self._dict_to_material(item)
            if material:
                materials.append(material)
        return materials

    def _dict_to_material(self, data: Dict) -> Optional[AnnotationMaterial]:
        try:
            material_id = data.get('material_id', data.get('id', ''))
            record_id = data.get('record_id', '')
            if not record_id:
                return None

            source_type = self._parse_source_type(data.get('source_type', ''))
            created_at = data.get('created_at', datetime.now().isoformat())
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))

            return AnnotationMaterial(
                material_id=str(material_id) if material_id else f"mat_{record_id}_{int(datetime.now().timestamp())}",
                record_id=str(record_id),
                source_type=source_type,
                content=str(data.get('content', data.get('标注内容', ''))),
                caliber_version=str(data.get('caliber_version', data.get('口径版本', 'v1.0'))),
                is_active=bool(data.get('is_active', True)),
                created_at=created_at,
                note=data.get('note')
            )
        except Exception as e:
            print(f"解析标注材料失败: {e}")
            return None

    def _parse_source_type(self, value: str) -> MaterialSource:
        value = str(value).lower()
        mapping = {
            '评测日志': MaterialSource.EVAL_LOG,
            'eval_log': MaterialSource.EVAL_LOG,
            '标注表': MaterialSource.ANNOTATION_TABLE,
            'annotation': MaterialSource.ANNOTATION_TABLE,
            '阈值备注': MaterialSource.THRESHOLD_NOTE,
            'threshold': MaterialSource.THRESHOLD_NOTE,
            '冲突案例': MaterialSource.CONFLICT_CASE,
            'conflict': MaterialSource.CONFLICT_CASE,
            '历史报告': MaterialSource.OLD_REPORT,
            'old_report': MaterialSource.OLD_REPORT,
        }
        return mapping.get(value, MaterialSource.ANNOTATION_TABLE)

    def apply_old_caliber(self, records: List[EvaluationRecord], old_caliber_version: str) -> List[EvaluationRecord]:
        annotation_materials = self.load_annotation_materials(old_caliber_version)
        updated_records = []

        for record in records:
            materials = annotation_materials.get(record.record_id, [])
            active_materials = [m for m in materials if m.is_active]

            if active_materials and record.verify_status != VerificationStatus.PASSED:
                record.old_caliber_note = f"沿用{old_caliber_version}口径标注: {active_materials[0].content}"
                record.verify_status = VerificationStatus.OLD_CALIBER
                if MaterialSource.ANNOTATION_TABLE not in record.material_sources:
                    record.material_sources.append(MaterialSource.ANNOTATION_TABLE)
            elif active_materials:
                if MaterialSource.ANNOTATION_TABLE not in record.material_sources:
                    record.material_sources.append(MaterialSource.ANNOTATION_TABLE)

            updated_records.append(record)

        return updated_records

    def check_missing_references(self, records: List[EvaluationRecord]) -> Tuple[List[EvaluationRecord], List[str]]:
        annotation_materials = self.load_annotation_materials()
        missing_records = []
        missing_ids = []

        for record in records:
            materials = annotation_materials.get(record.record_id, [])
            has_annotation = any(m.is_active for m in materials)

            if record.verify_status in [VerificationStatus.PASSED, VerificationStatus.FAILED]:
                if not has_annotation and not record.old_caliber_note:
                    record.has_missing_reference = True
                    record.missing_reference_note = "报告结论缺少标注材料引用，请补充标注后再确认"
                    missing_records.append(record)
                    missing_ids.append(record.record_id)

        return records, missing_ids

    def load_threshold_notes(self) -> Dict[str, str]:
        thresholds = {}

        if not os.path.exists(self.threshold_dir):
            return thresholds

        for filename in os.listdir(self.threshold_dir):
            if filename.endswith(('.json', '.txt')):
                file_path = os.path.join(self.threshold_dir, filename)
                thresholds.update(self._parse_threshold_file(file_path))

        return thresholds

    def _parse_threshold_file(self, file_path: str) -> Dict[str, str]:
        ext = os.path.splitext(file_path)[1].lower()

        if ext == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {str(k): str(v) for k, v in data.items()}
        else:
            thresholds = {}
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if '=' in line:
                        key, value = line.strip().split('=', 1)
                        thresholds[key.strip()] = value.strip()
            return thresholds

    def apply_threshold_notes(self, records: List[EvaluationRecord]) -> List[EvaluationRecord]:
        thresholds = self.load_threshold_notes()

        for record in records:
            threshold_key = f"{record.city}_{record.change_type}"
            if threshold_key in thresholds:
                record.threshold_applied = thresholds[threshold_key]
                if MaterialSource.THRESHOLD_NOTE not in record.material_sources:
                    record.material_sources.append(MaterialSource.THRESHOLD_NOTE)

        return records

    def load_conflict_cases(self) -> List[Dict]:
        conflicts = []

        if not os.path.exists(self.conflict_dir):
            return conflicts

        for filename in os.listdir(self.conflict_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(self.conflict_dir, filename)
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        conflicts.extend(data)
                    else:
                        conflicts.append(data)

        return conflicts

    def mark_conflict_records(self, records: List[EvaluationRecord]) -> Tuple[List[EvaluationRecord], List[str]]:
        conflict_cases = self.load_conflict_cases()
        conflict_ids = set()

        for case in conflict_cases:
            record_ids = case.get('record_ids', [])
            for rid in record_ids:
                conflict_ids.add(rid)

        conflict_record_ids = []
        for record in records:
            if record.record_id in conflict_ids:
                record.conflict_note = f"存在冲突案例，请人工复核"
                if MaterialSource.CONFLICT_CASE not in record.material_sources:
                    record.material_sources.append(MaterialSource.CONFLICT_CASE)
                conflict_record_ids.append(record.record_id)

        return records, conflict_record_ids
