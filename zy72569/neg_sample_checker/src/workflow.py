import pandas as pd
import yaml
import os
import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .data_models import (
    WorkflowStep, CheckResult, ConflictEvidence, NegSampleDataset,
    RunHistory, BatchInfo, ExportRecord, generate_trace_id
)
from .checks import (
    check_duplicates,
    check_minority_class_masking,
    check_export_consistency,
    check_conflict_between_neg_and_recall
)


def _df_checksum(df: pd.DataFrame, cols: List[str] = None) -> str:
    if df.empty:
        return hashlib.md5(b"").hexdigest()
    data = df if cols is None else df[cols]
    h = hashlib.md5()
    h.update(data.to_csv(index=False).encode("utf-8"))
    return h.hexdigest()


class WorkflowEngine:
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.steps: Dict[str, WorkflowStep] = {}
        self.neg_dataset: Optional[NegSampleDataset] = None
        self.recall_dataset: Optional[NegSampleDataset] = None
        self.history: List[RunHistory] = []
        self.export_records: List[ExportRecord] = []
        self.last_saved_state: Dict = {}
        self.current_threshold: float = self.config.get('threshold', {}).get('default', 0.5)
        self.export_dir: str = os.path.join(os.path.dirname(os.path.dirname(config_path)), 'exports')
        os.makedirs(self.export_dir, exist_ok=True)
        self._init_steps()

    def _load_config(self, config_path: str) -> Dict:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _init_steps(self) -> None:
        default_steps = [
            {'id': 'step1_import', 'name': '负样本列表导入'},
            {'id': 'step2_compare', 'name': '召回候选表对比'},
            {'id': 'step3_playback', 'name': '阈值回放更新'},
            {'id': 'step4_export', 'name': '导出与一致性核验'},
        ]
        workflow_config = self.config.get('workflow', {})
        step_cfgs = workflow_config.get('steps', [])
        if not step_cfgs:
            step_cfgs = default_steps
        for step_cfg in step_cfgs:
            step = WorkflowStep(
                step_id=step_cfg['id'],
                step_name=step_cfg['name']
            )
            self.steps[step.step_id] = step
        if 'step4_export' not in self.steps:
            s = WorkflowStep(step_id='step4_export', step_name='导出与一致性核验')
            self.steps['step4_export'] = s

    def get_all_batches(self) -> List[Dict]:
        if not self.neg_dataset:
            return []
        return [
            {
                'batch_id': b.batch_id,
                'batch_type': b.batch_type,
                'source_path': b.source_path,
                'created_at': b.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'record_count': b.record_count,
                'record_start_idx': b.record_start_idx,
                'record_end_idx': b.record_end_idx,
                'parent_batch_id': b.parent_batch_id,
                'note': b.note
            }
            for b in self.neg_dataset.batches
        ]

    def get_export_history(self) -> List[Dict]:
        return [
            {
                'export_id': e.export_id,
                'export_time': e.export_time.strftime('%Y-%m-%d %H:%M:%S'),
                'export_path': e.export_path,
                'source_batch_ids': e.source_batch_ids,
                'record_count': e.record_count,
                'checksum': e.checksum,
                'exported_by': e.exported_by
            }
            for e in self.export_records
        ]

    def trace_record(self, trace_id: str) -> Optional[Dict]:
        if not self.neg_dataset:
            return None
        rec = self.neg_dataset.get_record_by_trace_id(trace_id)
        if not rec:
            return None
        batch_id = rec.get('_batch_id', '')
        batch_info = None
        for b in self.neg_dataset.batches:
            if b.batch_id == batch_id:
                batch_info = {
                    'batch_id': b.batch_id,
                    'batch_type': b.batch_type,
                    'created_at': b.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    'source_path': b.source_path,
                    'note': b.note
                }
                break
        return {
            'record': {k: v for k, v in rec.items() if not k.startswith('_')},
            'trace_id': trace_id,
            'batch_id': batch_id,
            'batch_info': batch_info,
            'row_idx': rec.get('_row_idx')
        }

    def run_step1_import(self, neg_sample_path: str, batch_note: str = "") -> WorkflowStep:
        step = self.steps['step1_import']
        step.status = 'running'
        step.started_at = datetime.now()

        try:
            if not self.neg_dataset:
                self.neg_dataset = NegSampleDataset('负样本列表')
            batch_info = self.neg_dataset.load_from_csv(neg_sample_path)
            if batch_note:
                batch_info.note = batch_note
                self.neg_dataset.batches[-1].note = batch_note
            step.batch_id = batch_info.batch_id
            step.data_version = self.neg_dataset.version

            key_fields = self.config.get('checks', {}).get('duplicate_detection', {}).get('key_fields', ['user_id', 'item_id', 'timestamp'])

            dup_result = check_duplicates(self.neg_dataset.df, key_fields)
            dup_result.batch_id = batch_info.batch_id
            dup_result.details.update({
                'batch_id': batch_info.batch_id,
                'this_batch_record_count': batch_info.record_count,
                'previous_total_records': batch_info.record_start_idx,
                'current_total_records': batch_info.record_end_idx,
                'cross_batch_duplicates_note': '跨批次重复会与所有历史批次联合检查'
            })
            step.results.append(dup_result)

            minority_cfg = self.config.get('checks', {}).get('minority_class_detection', {})
            minority_result = check_minority_class_masking(
                self.neg_dataset.df,
                minority_threshold=minority_cfg.get('minority_threshold', 0.05),
                metric_fields=minority_cfg.get('metric_fields', ['click_rate', 'conversion_rate'])
            )
            minority_result.batch_id = batch_info.batch_id
            ms = self.neg_dataset.get_minority_samples()
            if not ms.empty:
                ms_with_trace = []
                for _, row in ms.head(10).iterrows():
                    rd = row.to_dict()
                    trace_cols = {k: v for k, v in rd.items() if k.startswith('_')}
                    data_cols = {k: v for k, v in rd.items() if not k.startswith('_')}
                    data_cols['_trace_id'] = trace_cols.get('_trace_id', '')
                    data_cols['_batch_id'] = trace_cols.get('_batch_id', '')
                    ms_with_trace.append(data_cols)
                minority_result.details['minority_samples_with_trace'] = ms_with_trace
            step.results.append(minority_result)

            step.status = 'completed'
            step.completed_at = datetime.now()
            self._save_history('step1', neg_sample_path, note=f"导入批次 {batch_info.batch_id}")

        except Exception as e:
            step.status = 'failed'
            step.completed_at = datetime.now()
            step.results.append(CheckResult(
                check_name="导入异常",
                passed=False,
                details={"error": str(e)},
                severity="error",
                suggestion="请检查文件路径和格式"
            ))

        return step

    def run_step2_compare(self, recall_candidate_path: str, recall_batch_note: str = "") -> WorkflowStep:
        step = self.steps['step2_compare']
        step.status = 'running'
        step.started_at = datetime.now()

        try:
            if not self.neg_dataset or self.neg_dataset.df.empty:
                raise ValueError("请先执行步骤1：负样本列表导入")

            if not self.recall_dataset:
                self.recall_dataset = NegSampleDataset('召回候选表')
            recall_batch = self.recall_dataset.load_from_csv(recall_candidate_path)
            if recall_batch_note:
                recall_batch.note = recall_batch_note
                self.recall_dataset.batches[-1].note = recall_batch_note
            step.batch_id = recall_batch.batch_id
            step.data_version = self.recall_dataset.version

            conflicts = check_conflict_between_neg_and_recall(
                self.neg_dataset.df,
                self.recall_dataset.df
            )

            key_fields = self.config.get('checks', {}).get('duplicate_detection', {}).get(
                'key_fields', ['user_id', 'item_id', 'timestamp'])
            for c in conflicts:
                matched = False
                for _, row in self.neg_dataset.df.iterrows():
                    ok = True
                    for k in key_fields:
                        if k in c.neg_sample_data and str(row.get(k)) != str(c.neg_sample_data.get(k, '')):
                            ok = False
                            break
                    if ok:
                        c.record_trace_id = row.get('_trace_id', '')
                        c.neg_sample_data['_trace_id'] = row.get('_trace_id', '')
                        c.neg_sample_data['_batch_id'] = row.get('_batch_id', '')
                        matched = True
                        break
                if not matched:
                    for _, row in self.neg_dataset.df.iterrows():
                        all_eq = all(
                            k not in c.neg_sample_data or str(row.get(k)) == str(v)
                            for k, v in c.neg_sample_data.items()
                        )
                        if all_eq:
                            c.record_trace_id = row.get('_trace_id', '')
                            c.neg_sample_data['_trace_id'] = row.get('_trace_id', '')
                            c.neg_sample_data['_batch_id'] = row.get('_batch_id', '')
                            break

            step.conflicts = conflicts

            if conflicts:
                detail_conflicts = []
                for c in conflicts[:10]:
                    detail_conflicts.append({
                        'conflict_id': c.conflict_id,
                        'description': c.description,
                        'record_trace_id': c.record_trace_id,
                        'neg_label': c.neg_sample_data.get('label'),
                        'recall_label': c.recall_candidate_data.get('label'),
                        'neg_trace_id': c.neg_sample_data.get('_trace_id', ''),
                        'resolution': c.resolution
                    })
                step.results.append(CheckResult(
                    check_name="负样本与召回候选表一致性检查",
                    passed=False,
                    details={
                        "conflict_count": len(conflicts),
                        "recall_batch_id": recall_batch.batch_id,
                        "conflicts_detail": detail_conflicts,
                        "resolution_guide": "请数据科学家林姐逐条确认或驳回，并填写理由"
                    },
                    severity="warning",
                    suggestion="检测到标签冲突，请数据科学家林姐确认或驳回，不要自动拍板。请在确认/驳回时填写理由。"
                ))
            else:
                step.results.append(CheckResult(
                    check_name="负样本与召回候选表一致性检查",
                    passed=True,
                    details={
                        "message": "未检测到标签冲突",
                        "recall_batch_id": recall_batch.batch_id
                    },
                    severity="info"
                ))

            step.status = 'completed'
            step.completed_at = datetime.now()
            self._save_history('step2', recall_candidate_path, note=f"召回对比批次 {recall_batch.batch_id}")

        except Exception as e:
            step.status = 'failed'
            step.completed_at = datetime.now()
            step.results.append(CheckResult(
                check_name="对比异常",
                passed=False,
                details={"error": str(e)},
                severity="error",
                suggestion="请检查召回候选表文件"
            ))

        return step

    def run_step3_playback(self, new_threshold: Optional[float] = None) -> WorkflowStep:
        step = self.steps['step3_playback']
        step.status = 'running'
        step.started_at = datetime.now()

        try:
            if not self.neg_dataset or self.neg_dataset.df.empty:
                raise ValueError("请先执行步骤1：负样本列表导入")

            old_threshold = self.current_threshold
            if new_threshold is not None:
                self.current_threshold = new_threshold

            metrics = self._calculate_metrics(self.current_threshold)
            history_metrics = []
            for hist in self.history:
                history_metrics.append({
                    "run_id": hist.run_id,
                    "timestamp": hist.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "threshold": hist.threshold,
                    "metrics": hist.metrics,
                    "note": hist.note
                })

            minority_samples = self.neg_dataset.get_minority_samples(
                minority_threshold=self.config.get('checks', {}).get('minority_class_detection', {}).get('minority_threshold', 0.05)
            )

            threshold_match = self._check_threshold_history_match(metrics, history_metrics)

            minority_traced = []
            if not minority_samples.empty:
                for _, row in minority_samples.head(10).iterrows():
                    rd = row.to_dict()
                    minority_traced.append({
                        'trace_id': rd.get('_trace_id', ''),
                        'batch_id': rd.get('_batch_id', ''),
                        'user_id': rd.get('user_id'),
                        'item_id': rd.get('item_id'),
                        'label': rd.get('label'),
                        'click_rate': rd.get('click_rate'),
                        'conversion_rate': rd.get('conversion_rate')
                    })

            step.results.append(CheckResult(
                check_name="阈值回放检查",
                passed=threshold_match,
                details={
                    "old_threshold": old_threshold,
                    "new_threshold": self.current_threshold,
                    "current_metrics": metrics,
                    "history_count": len(history_metrics),
                    "history_metrics": history_metrics[-5:],
                    "minority_sample_count": len(minority_samples),
                    "minority_samples_traceable": minority_traced,
                    "trace_guide": "通过 trace_id 可在报告、历史、导出中反查同一条记录"
                },
                severity="info" if threshold_match else "warning",
                suggestion="" if threshold_match else "历史记录与当前计算结果存在差异，请复核。点击trace_id可反查记录"
            ))

            if not minority_samples.empty:
                step.results.append(CheckResult(
                    check_name="少数类样本复核提醒",
                    passed=False,
                    details={
                        "count": len(minority_samples),
                        "samples_traceable": minority_traced,
                        "decision_guide": "少数类样本被总指标盖住，请勿直接归为正常，留给算法工程师复核并填写理由"
                    },
                    severity="warning",
                    suggestion="少数类样本请勿直接归为正常，留给算法工程师复核。点击trace_id可反查同一条样例。"
                ))

            step.status = 'completed'
            step.completed_at = datetime.now()
            self._save_history('step3', f"threshold_{self.current_threshold}",
                             note=f"阈值回放 {old_threshold}→{self.current_threshold}")

        except Exception as e:
            step.status = 'failed'
            step.completed_at = datetime.now()
            step.results.append(CheckResult(
                check_name="阈值回放异常",
                passed=False,
                details={"error": str(e)},
                severity="error",
                suggestion="请检查阈值参数"
            ))

        return step

    def run_step4_export(self, export_name: str = None, include_trace: bool = True) -> WorkflowStep:
        step = self.steps['step4_export']
        step.status = 'running'
        step.started_at = datetime.now()

        try:
            if not self.neg_dataset or self.neg_dataset.df.empty:
                raise ValueError("请先执行步骤1：负样本列表导入")

            if not export_name:
                export_name = f"neg_samples_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            export_path = os.path.join(self.export_dir, f"{export_name}.csv")

            self.neg_dataset.export_to_csv(export_path, include_trace_cols=include_trace)
            exported_df = pd.read_csv(export_path)

            check_fields = self.config.get('checks', {}).get('export_consistency', {}).get(
                'check_fields', ['user_id', 'item_id', 'label']
            )
            if include_trace:
                check_fields = list(check_fields) + ['_trace_id', '_batch_id']

            consistency_result = check_export_consistency(
                self.neg_dataset.df, exported_df, check_fields
            )
            consistency_result.details.update({
                'export_path': export_path,
                'export_record_count': len(exported_df),
                'original_record_count': len(self.neg_dataset.df),
                'check_fields': check_fields,
                'included_trace_columns': include_trace,
                'source_batch_ids': self.neg_dataset.get_current_batch_ids(),
                'reverse_lookup_guide': '通过 _trace_id 可在报告、历史、内存数据中反查到同一条原始记录；通过 _batch_id 可反查导入批次'
            })
            step.results.append(consistency_result)

            export_record = ExportRecord(
                export_id=f"exp_{uuid.uuid4().hex[:12]}",
                export_time=datetime.now(),
                export_path=export_path,
                source_batch_ids=self.neg_dataset.get_current_batch_ids(),
                record_count=len(exported_df),
                checksum=_df_checksum(exported_df, check_fields),
                exported_by='system'
            )
            self.export_records.append(export_record)
            step.export_path = export_path

            if consistency_result.passed:
                step.results.append(CheckResult(
                    check_name="导出校验和生成",
                    passed=True,
                    details={
                        'export_id': export_record.export_id,
                        'checksum': export_record.checksum,
                        'export_time': export_record.export_time.strftime('%Y-%m-%d %H:%M:%S'),
                        'next_export_will_compare': '下次导出会对比历史校验和，防止数据漂移'
                    },
                    severity="info"
                ))
            else:
                step.results.append(CheckResult(
                    check_name="导出校验和生成",
                    passed=False,
                    details={'export_path': export_path},
                    severity="error",
                    suggestion="导出一致检查未通过，请先修复再使用导出文件"
                ))

            step.status = 'completed' if consistency_result.passed else 'completed_with_warnings'
            step.completed_at = datetime.now()
            self._save_history('step4', export_path, note=f"导出 {export_record.export_id}")

        except Exception as e:
            step.status = 'failed'
            step.completed_at = datetime.now()
            step.results.append(CheckResult(
                check_name="导出异常",
                passed=False,
                details={"error": str(e)},
                severity="error",
                suggestion="请检查导出路径和数据完整性"
            ))

        return step

    def apply_supplement(self, supplement_path: str, note: str = "", rerun_compare_path: str = None) -> Tuple[bool, int, Dict]:
        if not self.neg_dataset:
            return False, 0, {}

        try:
            success_result = self.neg_dataset.append_supplement_from_csv(supplement_path, note=note)
            added_count, batch_info = success_result

            key_fields = self.config.get('checks', {}).get('duplicate_detection', {}).get('key_fields', ['user_id', 'item_id', 'timestamp'])
            dup_result = check_duplicates(self.neg_dataset.df, key_fields)
            dup_result.batch_id = batch_info.batch_id
            dup_result.details['supplement_batch_id'] = batch_info.batch_id

            minority_cfg = self.config.get('checks', {}).get('minority_class_detection', {})
            minority_result = check_minority_class_masking(
                self.neg_dataset.df,
                minority_threshold=minority_cfg.get('minority_threshold', 0.05),
                metric_fields=minority_cfg.get('metric_fields', ['click_rate', 'conversion_rate'])
            )
            minority_result.batch_id = batch_info.batch_id

            if self.steps['step1_import'].status in ('completed', 'completed_with_warnings'):
                self.steps['step1_import'].results.extend([dup_result, minority_result])
                self.steps['step1_import'].data_version = self.neg_dataset.version

            rerun_results = {}
            if rerun_compare_path and self.recall_dataset is not None:
                self.run_step2_compare(rerun_compare_path)
                rerun_results['step2'] = 'rerun'
            self.run_step3_playback()
            rerun_results['step3'] = 'rerun'

            self._save_history('supplement', supplement_path,
                             note=f"补录批次 {batch_info.batch_id} +{added_count} 条")

            result_info = {
                'batch_id': batch_info.batch_id,
                'note_applied': bool(note),
                'steps_rerun': rerun_results
            }
            return True, added_count, result_info

        except Exception as e:
            return False, 0, {'error': str(e)}

    def resolve_conflict(self, conflict_id: str, resolution: str,
                        resolved_by: str = "林姐", reason: str = "") -> bool:
        for step in self.steps.values():
            for conflict in step.conflicts:
                if conflict.conflict_id == conflict_id:
                    conflict.resolution = resolution
                    conflict.resolved_by = resolved_by
                    conflict.resolved_at = datetime.now()
                    conflict.resolution_reason = reason
                    return True
        return False

    def save_snapshot(self, note: str = "") -> Dict:
        snapshot = {
            'saved_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'threshold': self.current_threshold,
            'batch_ids': self.neg_dataset.get_current_batch_ids() if self.neg_dataset else [],
            'conflicts_resolution': [],
            'note': note
        }
        for step in self.steps.values():
            for c in step.conflicts:
                snapshot['conflicts_resolution'].append({
                    'conflict_id': c.conflict_id,
                    'resolution': c.resolution,
                    'resolved_by': c.resolved_by,
                    'resolution_reason': c.resolution_reason
                })
        self.last_saved_state = snapshot
        self._save_history('save', 'snapshot', note=note or "保存快照")
        return snapshot

    def refresh_results(self) -> Dict:
        if self.neg_dataset and not self.neg_dataset.df.empty:
            key_fields = self.config.get('checks', {}).get('duplicate_detection', {}).get(
                'key_fields', ['user_id', 'item_id', 'timestamp'])
            self.steps['step1_import'].results = [
                r for r in self.steps['step1_import'].results
                if r.check_name not in ('重复导入检查', '少数类样本被总指标盖住检查')
            ]
            dup = check_duplicates(self.neg_dataset.df, key_fields)
            ms_cfg = self.config.get('checks', {}).get('minority_class_detection', {})
            ms = check_minority_class_masking(
                self.neg_dataset.df,
                minority_threshold=ms_cfg.get('minority_threshold', 0.05),
                metric_fields=ms_cfg.get('metric_fields', ['click_rate', 'conversion_rate'])
            )
            self.steps['step1_import'].results.extend([dup, ms])
            self.run_step3_playback()
        self._save_history('refresh', 'refresh_results', note="刷新结果")
        return self.get_summary()

    def get_run_history_table(self) -> List[Dict]:
        return [
            {
                'run_id': h.run_id,
                'timestamp': h.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'data_source': h.data_source,
                'threshold': h.threshold,
                'precision': h.metrics.get('precision', 'N/A'),
                'recall': h.metrics.get('recall', 'N/A'),
                'row_count': h.metrics.get('row_count', h.metrics.get('positive_count', 0) + h.metrics.get('negative_count', 0)),
                'batch_ids': h.batch_ids,
                'export_paths': h.export_paths,
                'note': h.note,
                'minority_sample_ids': [s.get('_trace_id', s.get('user_id', '')) for s in h.minority_samples[:5]]
            }
            for h in self.history
        ]

    def _calculate_metrics(self, threshold: float) -> Dict:
        if not self.neg_dataset or self.neg_dataset.df.empty:
            return {}
        df = self.neg_dataset.df
        if 'score' in df.columns:
            predicted = (df['score'] >= threshold).astype(int)
            if 'label' in df.columns:
                tp = int(((predicted == 1) & (df['label'] == 1)).sum())
                fp = int(((predicted == 1) & (df['label'] == 0)).sum())
                fn = int(((predicted == 0) & (df['label'] == 1)).sum())
                precision = tp / (tp + fp) if (tp + fp) > 0 else 0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 0
                return {
                    "threshold": threshold,
                    "precision": float(precision),
                    "recall": float(recall),
                    "positive_count": int(predicted.sum()),
                    "negative_count": int((predicted == 0).sum())
                }
        return {"threshold": threshold, "row_count": len(df)}

    def _check_threshold_history_match(self, current_metrics: Dict, history_metrics: List[Dict]) -> bool:
        for hm in history_metrics:
            if abs(hm.get('threshold', 0) - self.current_threshold) < 1e-6:
                hist_precision = hm.get('metrics', {}).get('precision', -1)
                curr_precision = current_metrics.get('precision', -2)
                return abs(hist_precision - curr_precision) < 0.01
        return True

    def _save_history(self, source: str, data_path: str, note: str = "") -> None:
        metrics = self._calculate_metrics(self.current_threshold)
        step_results = {sid: s.status == 'completed' or s.status == 'completed_with_warnings'
                       for sid, s in self.steps.items()}
        minority_samples = []
        batch_ids = []
        export_paths = []
        if self.neg_dataset:
            ms = self.neg_dataset.get_minority_samples()
            if not ms.empty:
                for _, row in ms.head(10).iterrows():
                    rd = row.to_dict()
                    minority_samples.append({
                        k: v for k, v in rd.items() if not k.startswith('_')
                    } | {'_trace_id': rd.get('_trace_id', ''), '_batch_id': rd.get('_batch_id', '')})
            batch_ids = self.neg_dataset.get_current_batch_ids()
        if self.export_records:
            export_paths = [e.export_path for e in self.export_records[-3:]]

        self.history.append(RunHistory(
            run_id=f"run_{len(self.history) + 1}_{uuid.uuid4().hex[:6]}",
            timestamp=datetime.now(),
            data_source=data_path,
            threshold=self.current_threshold,
            metrics=metrics,
            step_results=step_results,
            batch_ids=batch_ids,
            export_paths=export_paths,
            minority_samples=minority_samples,
            note=note
        ))

    def run_all_checks(self, neg_sample_path: str, recall_candidate_path: str,
                      threshold: float = None, do_export: bool = True,
                      export_name: str = None) -> Dict:
        self.run_step1_import(neg_sample_path)
        self.run_step2_compare(recall_candidate_path)
        self.run_step3_playback(threshold)
        if do_export:
            self.run_step4_export(export_name=export_name)
        return self.get_summary()

    def get_summary(self) -> Dict:
        return {
            "project": self.config.get('project', {}).get('name', ''),
            "version": self.config.get('project', {}).get('version', ''),
            "current_threshold": self.current_threshold,
            "export_dir": self.export_dir,
            "steps": {
                sid: {
                    "name": s.step_name,
                    "status": s.status,
                    "batch_id": s.batch_id,
                    "export_path": s.export_path,
                    "passed_count": sum(1 for r in s.results if r.passed),
                    "warning_count": sum(1 for r in s.results if r.severity == 'warning'),
                    "error_count": sum(1 for r in s.results if r.severity == 'error'),
                    "conflict_count": len(s.conflicts),
                    "pending_conflicts": sum(1 for c in s.conflicts if c.resolution == 'pending'),
                    "confirmed_conflicts": sum(1 for c in s.conflicts if c.resolution == 'confirmed'),
                    "rejected_conflicts": sum(1 for c in s.conflicts if c.resolution == 'rejected'),
                    "checks": [
                        {
                            "check_id": r.check_id,
                            "name": r.check_name,
                            "passed": r.passed,
                            "severity": r.severity,
                            "suggestion": r.suggestion,
                            "batch_id": r.batch_id
                        }
                        for r in s.results
                    ]
                }
                for sid, s in self.steps.items()
            },
            "batches": self.get_all_batches(),
            "export_history": self.get_export_history(),
            "history_count": len(self.history)
        }
