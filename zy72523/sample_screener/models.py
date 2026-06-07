from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class SampleStatus(str, Enum):
    PENDING_REVIEW = "待运营复核"
    NORMAL = "正常"
    LOW_QUALITY = "低质"
    NEED_MORE_INFO = "补充材料中"
    RESOLVED = "已闭环"


class NextAction(str, Enum):
    CONTACT_OPERATIONS = "找运营复核人"
    CONTACT_ALGO_OPS = "找算法运营老唐"
    WAIT_FOR_MATERIALS = "等补充材料"
    RERUN_MODEL = "重跑模型"


@dataclass
class ModelOutput:
    sample_id: str
    model_version: str
    conclusion: str
    confidence: float
    output_time: datetime
    raw_fragment: str


@dataclass
class ManualCorrection:
    sample_id: str
    corrected_by: str
    corrected_conclusion: str
    correction_time: datetime
    reason: str
    source: str = "人工改判表"


@dataclass
class ReviewNote:
    sample_id: str
    reviewer: str
    note: str
    note_time: datetime
    tag: Optional[str] = None


@dataclass
class SampleRecord:
    sample_id: str
    first_import_time: datetime
    model_outputs: List[ModelOutput] = field(default_factory=list)
    manual_corrections: List[ManualCorrection] = field(default_factory=list)
    review_notes: List[ReviewNote] = field(default_factory=list)
    status: SampleStatus = SampleStatus.PENDING_REVIEW
    next_action: Optional[NextAction] = None
    missing_materials: List[str] = field(default_factory=list)
    keep_reason: Optional[str] = None
    version_conflict: bool = False
    latest_model_version: Optional[str] = None
    rerun_count: int = 0

    def add_model_output(self, output: ModelOutput) -> None:
        existing_versions = {o.model_version for o in self.model_outputs}
        if output.model_version not in existing_versions and self.model_outputs:
            self.version_conflict = True
        self.model_outputs.append(output)
        self.latest_model_version = output.model_version

    def add_manual_correction(self, correction: ManualCorrection) -> None:
        self.manual_corrections.append(correction)

    def add_review_note(self, note: ReviewNote) -> None:
        self.review_notes.append(note)

    def get_latest_model_output(self) -> Optional[ModelOutput]:
        if not self.model_outputs:
            return None
        return sorted(self.model_outputs, key=lambda x: x.output_time)[-1]

    def get_latest_manual_correction(self) -> Optional[ManualCorrection]:
        if not self.manual_corrections:
            return None
        return sorted(self.manual_corrections, key=lambda x: x.correction_time)[-1]


@dataclass
class ScreeningSession:
    session_id: str
    created_at: datetime
    samples: Dict[str, SampleRecord] = field(default_factory=dict)
    run_commands: List[str] = field(default_factory=list)

    def add_run_command(self, cmd: str) -> None:
        self.run_commands.append(cmd)
