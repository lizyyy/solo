from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class ProcessingStatus(str, Enum):
    PENDING = "待处理"
    PASSED = "已放行"
    NEED_EVIDENCE = "待补证据"
    MANUALLY_REVISED = "人工改过"
    ABNORMAL = "异常"


class RecordStatus(str, Enum):
    PASSED = "已放行"
    NEED_EVIDENCE = "待补证据"
    MANUALLY_REVISED = "人工改过"
    ABNORMAL = "异常"


@dataclass
class FosteringRegistration:
    registration_id: str
    pet_aliases: List[str]
    pet_type: str
    owner_name: str
    owner_phone: str
    fostering_period: str
    original_statement: str
    submitted_at: datetime
    source_channel: str = "前台登记"
    batch_number: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "登记表编号": self.registration_id,
            "宠物别名": "、".join(self.pet_aliases),
            "宠物种类": self.pet_type,
            "寄养人姓名": self.owner_name,
            "联系电话": self.owner_phone,
            "寄养时段": self.fostering_period,
            "原始说法": self.original_statement,
            "提交时间": self.submitted_at.strftime("%Y-%m-%d %H:%M:%S"),
            "登记渠道": self.source_channel,
            "批次号": self.batch_number,
        }


@dataclass
class EvidenceMaterial:
    evidence_id: str
    evidence_type: str
    file_path: str
    description: str
    uploaded_at: datetime
    uploaded_by: str
    hash_value: Optional[str] = None
    source_chat: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "证据编号": self.evidence_id,
            "证据类型": self.evidence_type,
            "文件路径": self.file_path,
            "描述": self.description,
            "上传时间": self.uploaded_at.strftime("%Y-%m-%d %H:%M:%S"),
            "上传人": self.uploaded_by,
            "哈希校验": self.hash_value,
            "来源聊天": self.source_chat,
        }


@dataclass
class ProcessingHistory:
    history_id: str
    timestamp: datetime
    previous_status: ProcessingStatus
    new_status: ProcessingStatus
    operator: str
    reason: str
    previous_evidence_ids: List[str] = field(default_factory=list)
    new_evidence_ids: List[str] = field(default_factory=list)
    previous_notes: str = ""
    new_notes: str = ""
    revision_snapshot: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "历史编号": self.history_id,
            "时间": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "变更前状态": self.previous_status.value,
            "变更后状态": self.new_status.value,
            "操作人": self.operator,
            "改判原因": self.reason,
            "原材料": "、".join(self.previous_evidence_ids) if self.previous_evidence_ids else "无",
            "新材料": "、".join(self.new_evidence_ids) if self.new_evidence_ids else "无",
            "原备注": self.previous_notes or "无",
            "新备注": self.new_notes or "无",
        }


@dataclass
class DuplicateAliasIssue:
    alias: str
    related_registration_ids: List[str]
    first_found_index: int
    severity: str = "high"
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "重复别名": self.alias,
            "涉及登记表": "、".join(self.related_registration_ids),
            "首次出现行号": f"第{self.first_found_index}行",
            "严重程度": "高" if self.severity == "high" else "中",
            "问题描述": self.description or f"别名「{self.alias}」在多张寄养登记表中重复出现",
        }

    def format_exit_message(self) -> str:
        registries = "、".join(self.related_registration_ids)
        return (
            f"❌ 宠物别名重复异常：\n"
            f"   重复别名: 「{self.alias}」\n"
            f"   卡在第 {self.first_found_index} 行首次出现\n"
            f"   涉及登记表: {registries}\n"
            f"   处理要求: 标记为异常，禁止默默放行，请人工确认归属后再放行"
        )


@dataclass
class PetRecord:
    record_id: str
    fostering_registration: FosteringRegistration
    initial_weight: float
    current_weight: float
    target_weight: float
    evidence_materials: List[EvidenceMaterial] = field(default_factory=list)
    current_status: ProcessingStatus = ProcessingStatus.PENDING
    processing_history: List[ProcessingHistory] = field(default_factory=list)
    duplicate_issues: List[DuplicateAliasIssue] = field(default_factory=list)
    operator_notes: str = ""
    is_manually_modified: bool = False

    @property
    def weight_loss_kg(self) -> float:
        return round(self.initial_weight - self.current_weight, 2)

    @property
    def weight_loss_percentage(self) -> float:
        if self.initial_weight <= 0:
            return 0.0
        return round((self.weight_loss_kg / self.initial_weight) * 100, 2)

    @property
    def is_target_met(self) -> bool:
        return self.current_weight <= self.target_weight

    def add_evidence(
        self,
        evidence: EvidenceMaterial,
        operator: str,
        reason: str,
        notes: str = "",
    ) -> ProcessingHistory:
        old_status = self.current_status
        old_evidence_ids = [e.evidence_id for e in self.evidence_materials]
        old_notes = self.operator_notes

        self.evidence_materials.append(evidence)
        self.operator_notes = notes

        new_status = self._reevaluate_status()
        if new_status != old_status:
            self.is_manually_modified = True
            self.current_status = new_status

        history = ProcessingHistory(
            history_id=f"HIST_{datetime.now().strftime('%Y%m%d%H%M%S')}_{self.record_id}",
            timestamp=datetime.now(),
            previous_status=old_status,
            new_status=self.current_status,
            operator=operator,
            reason=reason,
            previous_evidence_ids=old_evidence_ids,
            new_evidence_ids=[e.evidence_id for e in self.evidence_materials],
            previous_notes=old_notes,
            new_notes=notes,
            revision_snapshot={
                "old_status": old_status.value,
                "new_status": self.current_status.value,
                "weight_before": self.current_weight,
            },
        )
        self.processing_history.append(history)
        return history

    def _reevaluate_status(self) -> ProcessingStatus:
        if self.duplicate_issues:
            return ProcessingStatus.ABNORMAL
        if not self.evidence_materials:
            return ProcessingStatus.NEED_EVIDENCE
        if self.is_target_met:
            return ProcessingStatus.PASSED
        return ProcessingStatus.NEED_EVIDENCE

    def mark_duplicate_issue(self, issue: DuplicateAliasIssue) -> None:
        self.duplicate_issues.append(issue)
        self.current_status = ProcessingStatus.ABNORMAL

    def to_dict(self) -> Dict[str, Any]:
        return {
            "记录编号": self.record_id,
            "登记表编号": self.fostering_registration.registration_id,
            "宠物别名": "、".join(self.fostering_registration.pet_aliases),
            "初始体重(kg)": self.initial_weight,
            "当前体重(kg)": self.current_weight,
            "目标体重(kg)": self.target_weight,
            "减重(kg)": self.weight_loss_kg,
            "减重百分比(%)": self.weight_loss_percentage,
            "是否达标": "是" if self.is_target_met else "否",
            "处理状态": self.current_status.value,
            "是否人工改过": "是" if self.is_manually_modified else "否",
            "证据数量": len(self.evidence_materials),
            "异常项数量": len(self.duplicate_issues),
            "操作备注": self.operator_notes or "无",
        }


@dataclass
class WeightReport:
    report_id: str
    generated_at: datetime
    records: List[PetRecord] = field(default_factory=list)
    all_duplicate_issues: List[DuplicateAliasIssue] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    raw_registration_mapping: Dict[str, str] = field(default_factory=dict)

    def get_records_by_status(self, status: ProcessingStatus) -> List[PetRecord]:
        return [r for r in self.records if r.current_status == status]

    def get_summary(self) -> Dict[str, Any]:
        if self.summary:
            return self.summary
        total = len(self.records)
        passed = len(self.get_records_by_status(ProcessingStatus.PASSED))
        need_evidence = len(self.get_records_by_status(ProcessingStatus.NEED_EVIDENCE))
        manually_revised = sum(1 for r in self.records if r.is_manually_modified)
        abnormal = len(self.get_records_by_status(ProcessingStatus.ABNORMAL))
        self.summary = {
            "报告编号": self.report_id,
            "生成时间": self.generated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "总记录数": total,
            "已放行": passed,
            "待补证据": need_evidence,
            "人工改过": manually_revised,
            "异常记录": abnormal,
            "重复别名问题数": len(self.all_duplicate_issues),
        }
        return self.summary
