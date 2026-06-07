import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
from models import Sample, DemoDataset, WorkflowStep, BatchImportResult
from core import ConfidenceAnalyzer


class DataStore:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.samples_dir = self.data_dir / "samples"
        self.exports_dir = self.data_dir / "exports"
        self._ensure_dirs()

    def _ensure_dirs(self):
        self.samples_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def save_sample(self, sample: Sample) -> str:
        file_path = self.samples_dir / f"{sample.sample_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(sample.model_dump(mode="json"), f, ensure_ascii=False, indent=2)
        return str(file_path)

    def load_sample(self, sample_id: str) -> Optional[Sample]:
        file_path = self.samples_dir / f"{sample_id}.json"
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return Sample(**data)

    def load_all_samples(self) -> List[Sample]:
        samples = []
        for file_path in self.samples_dir.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                samples.append(Sample(**data))
        return samples

    def delete_sample(self, sample_id: str) -> bool:
        file_path = self.samples_dir / f"{sample_id}.json"
        if file_path.exists():
            file_path.unlink()
            return True
        return False

    def import_samples(self, samples_data: List[Dict[str, Any]]) -> BatchImportResult:
        success_count = 0
        failed_count = 0
        sample_ids = []
        samples = []

        for data in samples_data:
            try:
                sample = Sample(**data)
                samples.append(sample)
                success_count += 1
                sample_ids.append(sample.sample_id)
            except Exception as e:
                failed_count += 1
                print(f"导入失败: {e}")

        samples, low_conf_count, hidden_by_avg_count = ConfidenceAnalyzer.analyze_confidence(samples)

        for sample in samples:
            self.save_sample(sample)

        return BatchImportResult(
            total=len(samples_data),
            success=success_count,
            failed=failed_count,
            low_confidence_count=low_conf_count,
            hidden_by_avg_count=hidden_by_avg_count,
            sample_ids=sample_ids
        )

    def export_samples(self, sample_ids: Optional[List[str]] = None, export_format: str = "json") -> str:
        if sample_ids:
            samples = [self.load_sample(sid) for sid in sample_ids]
            samples = [s for s in samples if s is not None]
        else:
            samples = self.load_all_samples()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"export_{timestamp}.{export_format}"
        file_path = self.exports_dir / file_name

        with open(file_path, "w", encoding="utf-8") as f:
            if export_format == "json":
                json.dump(
                    [s.model_dump(mode="json") for s in samples],
                    f, ensure_ascii=False, indent=2
                )

        return str(file_path)

    def get_stats(self) -> Dict[str, Any]:
        samples = self.load_all_samples()
        total = len(samples)
        by_status = {}
        by_confidence = {}
        hidden_by_avg = 0

        for s in samples:
            status = s.status.value
            by_status[status] = by_status.get(status, 0) + 1
            conf = s.confidence_level.value
            by_confidence[conf] = by_confidence.get(conf, 0) + 1
            if s.hidden_by_avg:
                hidden_by_avg += 1

        return {
            "total_samples": total,
            "by_status": by_status,
            "by_confidence": by_confidence,
            "hidden_by_avg_count": hidden_by_avg
        }


class DemoDataGenerator:
    @staticmethod
    def create_demo_dataset() -> DemoDataset:
        now = datetime.now()

        sample1 = Sample(
            sample_id="DEMO-001",
            original_text="市民张先生（身份证号110101199001011234来电反映：位于朝阳区建国路88号小区物业乱收费，物业电话010-12345678，要求相关部门尽快处理",
            hotline_number="12345",
            call_time=datetime(2024, 1, 15, 9, 30),
            created_at=now,
            updated_at=now
        )

        sample1.model_outputs.extend([
            {
                "model_version": "v1.0",
                "summary": "市民反映小区收费问题",
                "confidence": 0.92,
                "entities": [{"type": "location", "value": "朝阳区"}],
                "mask_details": [],
                "timestamp": datetime(2024, 1, 15, 9, 35),
                "raw_output": "model_v1_output_xxx"
            },
            {
                "model_version": "v2.0",
                "summary": "市民反映朝阳区建国路88号小区物业乱收费",
                "confidence": 0.52,
                "entities": [{"type": "location", "value": "朝阳区建国路88号"}],
                "mask_details": [{"type": "id_card", "masked": "110***********1234"}],
                "timestamp": datetime(2024, 1, 15, 10, 0),
                "raw_output": "model_v2_output_xxx"
            }
        ])

        sample1.annotations.append({
            "annotator": "标注员小王",
            "corrected_summary": "市民反映朝阳区建国路88号小区物业乱收费问题，已记录诉求。",
            "comment": "v2版本摘要太简略，关键信息有遗漏，身份证号未完全脱敏。",
            "error_type": "信息遗漏+脱敏不完整",
            "timestamp": datetime(2024, 1, 15, 14, 0)
        })

        sample2 = Sample(
            sample_id="DEMO-002",
            original_text="李女士（手机号13800138000）投诉：海淀区中关村大街1号楼下噪音扰民，每天晚上施工到11点，影响休息",
            hotline_number="12345",
            call_time=datetime(2024, 1, 15, 10, 15),
            created_at=now,
            updated_at=now
        )

        sample2.model_outputs.extend([
            {
                "model_version": "v1.0",
                "summary": "市民投诉噪音扰民问题",
                "confidence": 0.88,
                "entities": [],
                "mask_details": [],
                "timestamp": datetime(2024, 1, 15, 10, 20)
            },
            {
                "model_version": "v2.0",
                "summary": "李女士投诉海淀区中关村大街1号夜间施工噪音扰民",
                "confidence": 0.48,
                "entities": [{"type": "location", "value": "海淀区中关村大街1号"}],
                "mask_details": [{"type": "phone", "masked": "138****8000"}],
                "timestamp": datetime(2024, 1, 15, 10, 25)
            }
        ])

        sample2.annotations.append({
            "annotator": "标注员小李",
            "corrected_summary": "市民李女士反映海淀区中关村大街1号夜间施工噪音扰民，建议转城管部门处理。",
            "comment": "摘要内容基本准确，但置信度偏低，需要模型优化。",
            "timestamp": datetime(2024, 1, 15, 15, 30)
        })

        sample2.supplements.append({
            "operator": "算法运营老唐",
            "model_output_snippet": "[ENTITY: 海淀区中关村大街1号 [MASK:PHONE:138****8000",
            "reason": "补录v2版本原始输出片段，确认脱敏规则命中情况",
            "additional_notes": "模型在位置实体识别上有提升，但整体置信度下降明显",
            "timestamp": datetime(2024, 1, 16, 9, 0)
        })

        sample3 = Sample(
            sample_id="DEMO-003",
            original_text="王先生来电感谢：西城区西单北大街100号井盖缺失，存在安全隐患，希望尽快修复",
            hotline_number="12345",
            call_time=datetime(2024, 1, 15, 11, 0),
            created_at=now,
            updated_at=now
        )

        sample3.model_outputs.append({
            "model_version": "v2.0",
            "summary": "市民反映西城区西单北大街100号井盖缺失问题",
            "confidence": 0.95,
            "entities": [{"type": "location", "value": "西城区西单北大街100号"}],
            "mask_details": [],
            "timestamp": datetime(2024, 1, 15, 11, 5)
        })

        samples = [sample1, sample2, sample3]

        workflow_steps = [
            WorkflowStep(
                step_name="第一步：数据导入",
                operator="系统自动",
                timestamp=datetime(2024, 1, 15, 9, 0),
                action="导入3条政务热线样本",
                notes="系统自动检测到2条低置信度样本，其中1条被平均指标掩盖"
            ),
            WorkflowStep(
                step_name="第二步：标注员标注",
                operator="标注员小王、小李",
                timestamp=datetime(2024, 1, 15, 16, 0),
                action="完成3条样本的人工标注和留言",
                notes="DEMO-001标注为信息遗漏+脱敏不完整"
            ),
            WorkflowStep(
                step_name="第三步：算法运营补录",
                operator="算法运营老唐",
                timestamp=datetime(2024, 1, 16, 10, 0),
                action="补录模型输出原始片段",
                notes="重点查看被平均指标掩盖的低置信度样本"
            ),
            WorkflowStep(
                step_name="第四步：模型版本对比",
                operator="系统自动",
                timestamp=datetime(2024, 1, 16, 11, 0),
                action="生成v1.0 vs v2.0版本对比报告",
                notes="DEMO-001需要知识库编辑复核，DEMO-002需要模型重训优化"
            )
        ]

        return DemoDataset(
            name="政务热线摘要脱敏演示数据集",
            description="包含标注员留言、模型输出片段、一次人工修正和一次重跑的完整演示流程",
            samples=samples,
            workflow_steps=workflow_steps,
            model_versions=["v1.0", "v2.0"]
        )

    @staticmethod
    def save_demo_dataset(dataset: DemoDataset, output_path: str = "data/demo_dataset.json"):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(dataset.model_dump(mode="json"), f, ensure_ascii=False, indent=2)
        return output_path
