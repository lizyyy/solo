import pandas as pd
import json
from datetime import datetime, date
from typing import List, Dict, Set, Tuple, Optional
from io import StringIO
from .models import Sample, TestPlan, ChamberRecord, ValidationResult, ItemStatus
from .rules import RuleEngine


class DedupManager:
    def __init__(self):
        self._processed_batches: Set[Tuple[str, str, str]] = set()

    def generate_batch_key(self, sample: Sample) -> Tuple[str, str, str]:
        return (sample.batch_id, sample.material_code, sample.test_type)

    def is_duplicate(self, sample: Sample) -> bool:
        key = self.generate_batch_key(sample)
        return key in self._processed_batches

    def mark_processed(self, sample: Sample) -> None:
        key = self.generate_batch_key(sample)
        self._processed_batches.add(key)

    def mark_batch_processed(self, batch_id: str, material_code: str, test_type: str) -> None:
        self._processed_batches.add((batch_id, material_code, test_type))

    def get_processed_count(self) -> int:
        return len(self._processed_batches)


class DataParser:
    @staticmethod
    def parse_samples_csv(content: str) -> List[Sample]:
        df = pd.read_csv(StringIO(content))
        samples: List[Sample] = []

        for _, row in df.iterrows():
            raw_data = row.to_dict()
            sample_date = pd.to_datetime(row.get('sample_date', row.get('取样日期', ''))).date()
            submitted_at = datetime.now()

            sample = Sample(
                sample_id=str(row.get('sample_id', row.get('样品ID', ''))),
                batch_id=str(row.get('batch_id', row.get('批次号', ''))),
                material_code=str(row.get('material_code', row.get('物料编码', ''))),
                sample_date=sample_date,
                sample_time=str(row.get('sample_time', row.get('取样时间', ''))) if pd.notna(row.get('sample_time')) else None,
                test_type=str(row.get('test_type', row.get('试验类型', ''))),
                chamber_id=str(row.get('chamber_id', row.get('环境箱编号', ''))) if pd.notna(row.get('chamber_id')) else None,
                extension_approved=bool(row.get('extension_approved', row.get('延期审批', False))) if pd.notna(row.get('extension_approved')) else None,
                extension_days=int(row.get('extension_days', row.get('延期天数', 0))) if pd.notna(row.get('extension_days')) else 0,
                submitted_at=submitted_at,
                raw_data=raw_data
            )
            samples.append(sample)

        return samples

    @staticmethod
    def parse_test_plans_json(content: str) -> List[TestPlan]:
        data = json.loads(content)
        plans: List[TestPlan] = []

        for item in data:
            plan = TestPlan(
                plan_id=str(item.get('plan_id', item.get('方案ID', ''))),
                test_type=str(item.get('test_type', item.get('试验类型', ''))),
                material_code=str(item.get('material_code', item.get('物料编码', ''))),
                sampling_window_days=int(item.get('sampling_window_days', item.get('取样窗口天数', 0))),
                sampling_start_date=datetime.fromisoformat(item.get('sampling_start_date', item.get('取样起始日期', ''))).date(),
                required_temperature_min=float(item.get('required_temperature_min', item.get('最低温度', 0))),
                required_temperature_max=float(item.get('required_temperature_max', item.get('最高温度', 0))),
                test_duration_days=int(item.get('test_duration_days', item.get('试验天数', 0))),
                extension_allowed=bool(item.get('extension_allowed', item.get('允许延期', True))),
                max_extension_days=int(item.get('max_extension_days', item.get('最大延期天数', 30)))
            )
            plans.append(plan)

        return plans

    @staticmethod
    def parse_chamber_records(content: str) -> List[ChamberRecord]:
        if content.strip().startswith('['):
            data = json.loads(content)
            records: List[ChamberRecord] = []
            for item in data:
                record = ChamberRecord(
                    chamber_id=str(item.get('chamber_id', item.get('环境箱编号', ''))),
                    record_time=datetime.fromisoformat(str(item.get('record_time', item.get('记录时间', '')))),
                    temperature=float(item.get('temperature', item.get('温度', 0))),
                    humidity=float(item.get('humidity', item.get('湿度', 0))) if item.get('humidity') else None,
                    sample_id=str(item.get('sample_id', item.get('样品ID', ''))) if item.get('sample_id') else None
                )
                records.append(record)
            return records
        else:
            df = pd.read_csv(StringIO(content))
            records: List[ChamberRecord] = []
            for _, row in df.iterrows():
                record = ChamberRecord(
                    chamber_id=str(row.get('chamber_id', row.get('环境箱编号', ''))),
                    record_time=pd.to_datetime(row.get('record_time', row.get('记录时间', ''))),
                    temperature=float(row.get('temperature', row.get('温度', 0))),
                    humidity=float(row.get('humidity', row.get('湿度', 0))) if pd.notna(row.get('humidity')) else None,
                    sample_id=str(row.get('sample_id', row.get('样品ID', ''))) if pd.notna(row.get('sample_id')) else None
                )
                records.append(record)
            return records


class SampleProcessor:
    def __init__(self):
        self.dedup_manager = DedupManager()

    def process(self, samples: List[Sample], plans: List[TestPlan],
                chamber_records: List[ChamberRecord],
                check_duplicate: bool = True) -> ValidationResult:
        valid_samples: List[Sample] = []
        duplicates_skipped: List[str] = []

        for sample in samples:
            if check_duplicate and self.dedup_manager.is_duplicate(sample):
                duplicates_skipped.append(f"{sample.batch_id}-{sample.material_code}-{sample.test_type}")
            else:
                valid_samples.append(sample)

        result_items = RuleEngine.process_samples(valid_samples, plans, chamber_records)

        for item in result_items:
            if item.status == ItemStatus.NORMAL:
                sample = next(s for s in valid_samples if s.sample_id == item.sample_id)
                self.dedup_manager.mark_processed(sample)

        normal = [r for r in result_items if r.status == ItemStatus.NORMAL]
        pending = [r for r in result_items if r.status == ItemStatus.PENDING_CONFIRMATION]
        failed = [r for r in result_items if r.status == ItemStatus.FAILED]

        summary = {
            "total_submitted": len(samples),
            "total_processed": len(result_items),
            "normal_count": len(normal),
            "pending_confirmation_count": len(pending),
            "failed_count": len(failed),
            "duplicates_skipped_count": len(duplicates_skipped),
            "processed_at": datetime.now().isoformat()
        }

        return ValidationResult(
            normal=normal,
            pending_confirmation=pending,
            failed=failed,
            summary=summary,
            duplicates_skipped=duplicates_skipped
        )
