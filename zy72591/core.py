import yaml
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from models import (
    RollbackRecord, EvalSlice, ParamsYaml, ManualCorrection,
    RerunRecord, AnomalySample, RecordStatus
)


class RollbackStore:
    def __init__(self):
        self.records: Dict[str, RollbackRecord] = {}
        self.eval_slices: Dict[str, EvalSlice] = {}
        self.params_yamls: Dict[str, ParamsYaml] = {}
        self.manual_corrections: Dict[str, ManualCorrection] = {}
        self.reruns: Dict[str, RerunRecord] = {}
        self.anomaly_samples: Dict[str, AnomalySample] = {}

    def import_params_yaml(self, file_path: str, imported_by: str) -> ParamsYaml:
        with open(file_path, 'r', encoding='utf-8') as f:
            raw_content = f.read()
            content = yaml.safe_load(raw_content)

        yaml_id = f"yaml_{uuid.uuid4().hex[:8]}"
        params = ParamsYaml(
            yaml_id=yaml_id,
            file_path=file_path,
            imported_at=datetime.now(),
            content=content,
            raw_content=raw_content
        )
        self.params_yamls[yaml_id] = params
        return params

    def import_eval_slice(self, file_path: str) -> EvalSlice:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        slice_obj = EvalSlice(
            slice_id=data["slice_id"],
            slice_name=data["slice_name"],
            created_at=datetime.fromisoformat(data["created_at"]),
            raw_remark=data["raw_remark"],
            data_points=data.get("data_points", []),
            tags=data.get("tags", [])
        )
        self.eval_slices[slice_obj.slice_id] = slice_obj
        return slice_obj

    def detect_time_leakage(self, record: RollbackRecord) -> Tuple[bool, str]:
        has_leakage = False
        reasons = []

        if record.eval_window_start <= record.training_window_end:
            has_leakage = True
            reasons.append("评测窗口与训练窗口存在重叠")

        for slice_id in record.eval_slice_ids:
            if slice_id in self.eval_slices:
                slice_obj = self.eval_slices[slice_id]
                if "时间窗穿越" in slice_obj.tags or "label延迟" in slice_obj.tags:
                    has_leakage = True
                    reasons.append(f"评测切片[{slice_obj.slice_name}]含时间窗穿越标记")

        return has_leakage, "; ".join(reasons)

    def create_record(self,
                      model_version: str,
                      training_window: Tuple[str, str],
                      eval_window: Tuple[str, str],
                      metrics: Dict[str, float],
                      created_by: str,
                      params_yaml_id: Optional[str] = None,
                      raw_remarks: str = "") -> RollbackRecord:

        record_id = f"rec_{uuid.uuid4().hex[:8]}"
        record = RollbackRecord(
            record_id=record_id,
            model_version=model_version,
            training_window_start=datetime.fromisoformat(training_window[0]),
            training_window_end=datetime.fromisoformat(training_window[1]),
            eval_window_start=datetime.fromisoformat(eval_window[0]),
            eval_window_end=datetime.fromisoformat(eval_window[1]),
            metrics=metrics,
            status=RecordStatus.SUCCESS,
            created_at=datetime.now(),
            created_by=created_by,
            params_yaml_id=params_yaml_id,
            raw_remarks=raw_remarks
        )

        has_leakage, reason = self.detect_time_leakage(record)
        if has_leakage:
            record.status = RecordStatus.TIME_LEAKAGE_SUSPECTED
            record.raw_remarks += f"\n[系统检测] 疑似时间窗穿越: {reason}"

        self.records[record_id] = record
        return record

    def attach_eval_slice(self, record_id: str, slice_id: str) -> RollbackRecord:
        if record_id not in self.records:
            raise ValueError(f"记录 {record_id} 不存在")
        if slice_id not in self.eval_slices:
            raise ValueError(f"评测切片 {slice_id} 不存在")

        record = self.records[record_id]
        if slice_id not in record.eval_slice_ids:
            record.eval_slice_ids.append(slice_id)

        has_leakage, reason = self.detect_time_leakage(record)
        if has_leakage and record.status == RecordStatus.SUCCESS:
            record.status = RecordStatus.TIME_LEAKAGE_SUSPECTED
            record.raw_remarks += f"\n[补录切片后检测] 发现时间窗穿越风险: {reason}"

        self._update_anomaly_samples_from_slice(record, slice_id)
        return record

    def _update_anomaly_samples_from_slice(self, record: RollbackRecord, slice_id: str):
        slice_obj = self.eval_slices[slice_id]
        for dp in slice_obj.data_points:
            sample_id = f"{record.record_id}_{dp['sample_id']}"
            if sample_id not in self.anomaly_samples:
                sample = AnomalySample(
                    sample_id=sample_id,
                    record_id=record.record_id,
                    features={"amount": dp.get("amount", 0)},
                    predicted=0.5,
                    actual=float(dp.get("is_fraud", dp.get("is_fraud_new_caliber", 0))),
                    anomaly_score=0.8,
                    is_from_eval_slice=True,
                    source_slice_id=slice_id
                )
                self.anomaly_samples[sample_id] = sample
                if sample_id not in record.anomaly_sample_ids:
                    record.anomaly_sample_ids.append(sample_id)

    def supplement_old_caliber(self, record_id: str, slice_id: str) -> RollbackRecord:
        record = self.attach_eval_slice(record_id, slice_id)
        if record.status != RecordStatus.TIME_LEAKAGE_SUSPECTED:
            record.status = RecordStatus.OLD_CALIBER_SUPPLEMENTED
        record.raw_remarks += f"\n[旧口径补录] 从评测切片[{slice_id}]补入旧口径数据，仅供对照参考"
        return record

    def add_manual_correction(self,
                              record_id: str,
                              operator: str,
                              correction_type: str,
                              before_value: any,
                              after_value: any,
                              reason: str) -> ManualCorrection:

        correction_id = f"corr_{uuid.uuid4().hex[:8]}"
        correction = ManualCorrection(
            correction_id=correction_id,
            created_at=datetime.now(),
            operator=operator,
            correction_type=correction_type,
            before_value=before_value,
            after_value=after_value,
            reason=reason,
            target_record_id=record_id
        )
        self.manual_corrections[correction_id] = correction

        if record_id in self.records:
            self.records[record_id].manual_correction_ids.append(correction_id)

        return correction

    def add_rerun(self,
                  original_record_id: str,
                  triggered_by: str,
                  params_snapshot: Dict,
                  result_before: Dict,
                  result_after: Dict) -> RerunRecord:

        rerun_id = f"rerun_{uuid.uuid4().hex[:8]}"
        rerun = RerunRecord(
            rerun_id=rerun_id,
            original_record_id=original_record_id,
            triggered_at=datetime.now(),
            triggered_by=triggered_by,
            params_snapshot=params_snapshot,
            result_before=result_before,
            result_after=result_after
        )
        self.reruns[rerun_id] = rerun

        if original_record_id in self.records:
            self.records[original_record_id].rerun_ids.append(rerun_id)

        return rerun

    def submit_for_review(self, record_id: str, reviewer: str) -> RollbackRecord:
        if record_id not in self.records:
            raise ValueError(f"记录 {record_id} 不存在")
        record = self.records[record_id]
        record.status = RecordStatus.PENDING_REVIEW
        record.raw_remarks += f"\n[提交复核] 由 {reviewer} 提交实验平台负责人复核"
        return record

    def review_record(self, record_id: str, reviewer: str, note: str, approve: bool) -> RollbackRecord:
        if record_id not in self.records:
            raise ValueError(f"记录 {record_id} 不存在")
        record = self.records[record_id]
        record.reviewed_by = reviewer
        record.reviewed_at = datetime.now()
        record.review_note = note
        if approve:
            record.status = RecordStatus.REVIEWED
            record.raw_remarks += f"\n[复核通过] {reviewer}: {note}"
        else:
            record.raw_remarks += f"\n[复核驳回] {reviewer}: {note}"
        return record

    def get_record_anomalies(self, record_id: str) -> List[AnomalySample]:
        if record_id not in self.records:
            return []
        record = self.records[record_id]
        return [self.anomaly_samples[sid] for sid in record.anomaly_sample_ids
                if sid in self.anomaly_samples]
