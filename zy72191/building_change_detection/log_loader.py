import os
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import (
    EvaluationRecord, VerificationStatus, ConfidenceLevel,
    ChangeType, MaterialSource
)


class LogLoader:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self._ensure_directories()

    def _ensure_directories(self):
        dirs = [
            self.data_dir,
            os.path.join(self.data_dir, "eval_logs"),
            os.path.join(self.data_dir, "annotation_tables"),
            os.path.join(self.data_dir, "threshold_notes"),
            os.path.join(self.data_dir, "conflict_cases"),
            os.path.join(self.data_dir, "reports"),
        ]
        for d in dirs:
            os.makedirs(d, exist_ok=True)

    def load_eval_logs(self, model_version: str, log_file: Optional[str] = None) -> List[EvaluationRecord]:
        log_dir = os.path.join(self.data_dir, "eval_logs", model_version)
        os.makedirs(log_dir, exist_ok=True)

        records = []

        if log_file:
            file_path = os.path.join(log_dir, log_file)
            if os.path.exists(file_path):
                records.extend(self._parse_file(file_path, model_version))
        else:
            if os.path.exists(log_dir):
                for filename in os.listdir(log_dir):
                    if filename.endswith(('.json', '.csv', '.xlsx')):
                        file_path = os.path.join(log_dir, filename)
                        records.extend(self._parse_file(file_path, model_version))

        return records

    def _parse_file(self, file_path: str, model_version: str) -> List[EvaluationRecord]:
        ext = os.path.splitext(file_path)[1].lower()

        if ext == '.json':
            return self._parse_json(file_path, model_version)
        elif ext == '.csv':
            return self._parse_csv(file_path, model_version)
        elif ext == '.xlsx':
            return self._parse_excel(file_path, model_version)
        else:
            return []

    def _parse_json(self, file_path: str, model_version: str) -> List[EvaluationRecord]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        records = []
        items = data if isinstance(data, list) else [data]

        for item in items:
            record = self._dict_to_record(item, model_version)
            if record:
                records.append(record)

        return records

    def _parse_csv(self, file_path: str, model_version: str) -> List[EvaluationRecord]:
        df = pd.read_csv(file_path)
        return self._df_to_records(df, model_version)

    def _parse_excel(self, file_path: str, model_version: str) -> List[EvaluationRecord]:
        df = pd.read_excel(file_path)
        return self._df_to_records(df, model_version)

    def _df_to_records(self, df: pd.DataFrame, model_version: str) -> List[EvaluationRecord]:
        records = []
        for _, row in df.iterrows():
            item = row.to_dict()
            record = self._dict_to_record(item, model_version)
            if record:
                records.append(record)
        return records

    def _dict_to_record(self, data: Dict[str, Any], model_version: str) -> Optional[EvaluationRecord]:
        try:
            record_id = data.get('record_id', data.get('id', ''))
            if not record_id:
                return None

            change_type = self._parse_change_type(data.get('change_type', ''))
            confidence = self._parse_confidence(data.get('confidence', ''))
            verify_status = self._parse_verify_status(data.get('verify_status', ''))
            material_sources = self._parse_material_sources(data.get('material_sources', []))

            eval_timestamp = data.get('eval_timestamp', data.get('timestamp', datetime.now().isoformat()))
            if isinstance(eval_timestamp, str):
                eval_timestamp = datetime.fromisoformat(eval_timestamp.replace('Z', '+00:00'))

            return EvaluationRecord(
                record_id=str(record_id),
                city=str(data.get('city', data.get('城市', '未知城市'))),
                district=str(data.get('district', data.get('区域', '未知区域'))),
                grid_id=str(data.get('grid_id', data.get('网格ID', ''))),
                change_type=change_type,
                confidence=confidence,
                verify_status=verify_status,
                material_sources=material_sources,
                has_missing_reference=bool(data.get('has_missing_reference', False)),
                missing_reference_note=data.get('missing_reference_note'),
                threshold_applied=data.get('threshold_applied'),
                model_version=str(data.get('model_version', model_version)),
                eval_timestamp=eval_timestamp,
                old_caliber_note=data.get('old_caliber_note'),
                conflict_note=data.get('conflict_note'),
                is_duplicate=bool(data.get('is_duplicate', False)),
                duplicate_of=data.get('duplicate_of'),
                raw_data=data
            )
        except Exception as e:
            print(f"解析记录失败: {e}, data: {data}")
            return None

    def _parse_change_type(self, value: Any) -> ChangeType:
        if isinstance(value, ChangeType):
            return value
        value = str(value).lower()
        mapping = {
            '新增': ChangeType.NEW_BUILDING,
            '新增建筑': ChangeType.NEW_BUILDING,
            'new_building': ChangeType.NEW_BUILDING,
            '拆除': ChangeType.DEMOLISHED,
            '拆除建筑': ChangeType.DEMOLISHED,
            'demolished': ChangeType.DEMOLISHED,
            '扩建': ChangeType.EXPANDED,
            'expanded': ChangeType.EXPANDED,
            '改建': ChangeType.MODIFIED,
            'modified': ChangeType.MODIFIED,
            '无变化': ChangeType.NO_CHANGE,
            'no_change': ChangeType.NO_CHANGE,
        }
        return mapping.get(value, ChangeType.UNKNOWN)

    def _parse_confidence(self, value: Any) -> ConfidenceLevel:
        if isinstance(value, ConfidenceLevel):
            return value
        value = str(value).lower()
        mapping = {
            '高': ConfidenceLevel.HIGH,
            'high': ConfidenceLevel.HIGH,
            'h': ConfidenceLevel.HIGH,
            '中': ConfidenceLevel.MEDIUM,
            'medium': ConfidenceLevel.MEDIUM,
            'm': ConfidenceLevel.MEDIUM,
            '低': ConfidenceLevel.LOW,
            'low': ConfidenceLevel.LOW,
            'l': ConfidenceLevel.LOW,
        }
        return mapping.get(value, ConfidenceLevel.LOW)

    def _parse_verify_status(self, value: Any) -> VerificationStatus:
        if isinstance(value, VerificationStatus):
            return value
        value = str(value)
        mapping = {
            '通过': VerificationStatus.PASSED,
            'passed': VerificationStatus.PASSED,
            '待人工确认': VerificationStatus.NEED_MANUAL_CHECK,
            '待确认': VerificationStatus.NEED_MANUAL_CHECK,
            'need_check': VerificationStatus.NEED_MANUAL_CHECK,
            '不通过': VerificationStatus.FAILED,
            'failed': VerificationStatus.FAILED,
            '旧口径': VerificationStatus.OLD_CALIBER,
            '旧口径沿用': VerificationStatus.OLD_CALIBER,
            'old_caliber': VerificationStatus.OLD_CALIBER,
            '边界': VerificationStatus.BORDERLINE,
            '边界记录': VerificationStatus.BORDERLINE,
            'borderline': VerificationStatus.BORDERLINE,
            '缺失': VerificationStatus.MISSING_DATA,
            '数据缺失': VerificationStatus.MISSING_DATA,
            '重复': VerificationStatus.DUPLICATE,
            '重复记录': VerificationStatus.DUPLICATE,
        }
        return mapping.get(value, VerificationStatus.NEED_MANUAL_CHECK)

    def _parse_material_sources(self, sources: Any) -> List[MaterialSource]:
        if isinstance(sources, list):
            result = []
            for s in sources:
                if isinstance(s, MaterialSource):
                    result.append(s)
                else:
                    parsed = self._parse_material_source(str(s))
                    if parsed:
                        result.append(parsed)
            return result
        elif isinstance(sources, str):
            parsed = self._parse_material_source(sources)
            return [parsed] if parsed else []
        return []

    def _parse_material_source(self, value: str) -> Optional[MaterialSource]:
        value = value.lower()
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
        return mapping.get(value)
