from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import re
from collections import defaultdict


# ============================================================
# 1. 数据模型
# ============================================================

ALIAS_TABLE = {
    "配电柜A": ["PDG-A", "一号配电柜", "主回路配电柜", "1#配电柜"],
    "配电柜B": ["PDG-B", "二号配电柜", "备用配电柜", "2#配电柜"],
    "配电柜C": ["PDG-C", "三号配电柜", "电容补偿柜", "3#配电柜"],
}

def canonical_name(raw_name: str) -> str:
    """将别名归一化为标准名称"""
    raw = raw_name.strip()
    for canon, aliases in ALIAS_TABLE.items():
        if raw == canon or raw in aliases:
            return canon
    return raw


@dataclass
class SensorLog:
    """传感器日志"""
    timestamp: str
    location: str
    temperature: float
    threshold: float
    part_model: Optional[str] = None
    raw_text: str = ""


@dataclass
class Material:
    """材料附件"""
    material_id: str
    material_type: str  # sensor_log / manual_note / supplementary
    title: str
    detail: str
    mismatch_flag: bool = False  # 标题与明细是否对不上
    mismatch_detail: str = ""
    uploaded_at: str = ""
    operator: str = ""


@dataclass
class HistoryEntry:
    """历史追溯条目"""
    version: int
    timestamp: str
    event: str  # create / append_material / modify_conclusion / block_flag / resolve_block
    conclusion_before: Optional[str]
    conclusion_after: Optional[str]
    materials_before: List[str]
    materials_after: List[str]
    remark: str = ""
    operator: str = ""


@dataclass
class WarningRecord:
    """预警主记录"""
    record_id: str
    canonical_object: str  # 归一化后的对象名
    display_name: str       # 本次提交使用的称呼
    conclusion: str         # pending / normal / abnormal / blocked
    block_reason: str = ""
    block_level: str = ""   # soft / hard
    hold_results: List[str] = field(default_factory=list)
    materials: List[Material] = field(default_factory=list)
    history: List[HistoryEntry] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    is_supplemented: bool = False    # 是否补录过
    is_judgment_changed: bool = False  # 是否改判过
    version: int = 1
    dedup_key: str = ""  # 去重键：canonical_object + 日期

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["has_block"] = bool(self.block_reason)
        d["material_count"] = len(self.materials)
        d["history_count"] = len(self.history)
        return d


class WarningRepository:
    """仓储层：内存存储 + 去重索引"""

    def __init__(self):
        self._records: Dict[str, WarningRecord] = {}
        self._dedup_index: Dict[str, str] = {}  # dedup_key -> record_id

    def _make_dedup_key(self, canonical: str, date_str: str) -> str:
        return f"{canonical}|{date_str}"

    def find_by_dedup(self, raw_name: str, date_str: str) -> Optional[WarningRecord]:
        canon = canonical_name(raw_name)
        key = self._make_dedup_key(canon, date_str)
        rid = self._dedup_index.get(key)
        return self._records.get(rid) if rid else None

    def save(self, record: WarningRecord) -> None:
        self._records[record.record_id] = record
        if record.dedup_key:
            self._dedup_index[record.dedup_key] = record.record_id

    def get(self, record_id: str) -> Optional[WarningRecord]:
        return self._records.get(record_id)

    def all(self) -> List[WarningRecord]:
        return list(self._records.values())


# ============================================================
# 2. 核心业务逻辑
# ============================================================

class DuplicateChecker:
    """去重检查器：识别同一对象换称呼的重复提交"""

    def __init__(self, repo: WarningRepository):
        self.repo = repo

    def check(self, raw_name: str, date_str: str) -> Dict[str, Any]:
        canon = canonical_name(raw_name)
        existing = self.repo.find_by_dedup(raw_name, date_str)
        return {
            "is_duplicate": existing is not None,
            "canonical_object": canon,
            "submitted_name": raw_name,
            "existing_record_id": existing.record_id if existing else None,
            "existing_display_name": existing.display_name if existing else None,
            "message": (
                f"检测到重复提交：'{raw_name}' 与已存在的 "
                f"'{existing.display_name}'（标准名：{canon}）为同一对象，已合并"
                if existing
                else f"新记录：{canon}（提交名：{raw_name}）"
            )
        }


class BlockageDetector:
    """卡点检测器：传感器日志出现备件型号替换时标出疑点；有校准通过凭证时解除"""

    PART_REPLACEMENT_PATTERNS = [
        re.compile(r"型号由\s*([A-Za-z0-9\-]+)\s*更换为\s*([A-Za-z0-9\-]+)"),
        re.compile(r"替换备件[：:]\s*(\S+)\s*→\s*(\S+)"),
        re.compile(r"part\s+change[d]?\s+(\S+)\s+to\s+(\S+)", re.IGNORECASE),
    ]

    CALIBRATION_PASS_KEYWORDS = [
        "校准通过", "校准确认", "偏差<", "偏差小于", "验证通过",
        "卡点解除", "解除卡点", "校准已验证", "第三方校准",
    ]

    @classmethod
    def scan_sensor_log(cls, log: SensorLog) -> Optional[Dict[str, Any]]:
        findings = []
        for pattern in cls.PART_REPLACEMENT_PATTERNS:
            m = pattern.search(log.raw_text)
            if m:
                findings.append({
                    "old_model": m.group(1),
                    "new_model": m.group(2),
                    "matched_at": log.timestamp,
                    "location": log.location,
                })
        if findings:
            return {
                "has_replacement": True,
                "findings": findings,
                "block_reason": (
                    f"传感器日志中检测到备件型号替换（共{len(findings)}处）："
                    + "；".join(
                        f"{f['old_model']}→{f['new_model']}@{f['location']}"
                        for f in findings
                    )
                ),
                "hold_results": [
                    f"温升结论因{f['old_model']}→{f['new_model']}型号变更暂不放行，待确认传感器校准状态"
                    for f in findings
                ],
            }
        return None

    @classmethod
    def scan_calibration_pass(cls, text: str) -> Optional[Dict[str, Any]]:
        """扫描是否包含校准通过/卡点解除的关键词"""
        hits = [kw for kw in cls.CALIBRATION_PASS_KEYWORDS if kw in text]
        if hits:
            return {
                "calibrated": True,
                "evidences": hits,
                "resolve_note": f"检测到校准确认凭证（{len(hits)}项）：{'、'.join(hits)}",
            }
        return None


class ConclusionTracker:
    """结论变更追踪：记录旧材料、新备注、改判原因"""

    @staticmethod
    def make_snapshot(record: WarningRecord) -> Dict[str, Any]:
        return {
            "conclusion": record.conclusion,
            "materials": [m.material_id for m in record.materials],
            "version": record.version,
        }

    @staticmethod
    def commit_change(
        record: WarningRecord,
        event: str,
        before: Dict[str, Any],
        after_conclusion: Optional[str],
        remark: str = "",
        operator: str = "",
    ) -> None:
        after_materials = [m.material_id for m in record.materials]
        entry = HistoryEntry(
            version=record.version,
            timestamp=datetime.now().isoformat(timespec="seconds"),
            event=event,
            conclusion_before=before["conclusion"],
            conclusion_after=after_conclusion or record.conclusion,
            materials_before=before["materials"],
            materials_after=after_materials,
            remark=remark,
            operator=operator,
        )
        record.history.append(entry)
        if before["conclusion"] != (after_conclusion or record.conclusion):
            record.is_judgment_changed = True
        record.version += 1
        record.updated_at = entry.timestamp


# ============================================================
# 3. 应用服务层（接口模拟）
# ============================================================

class WarningAppService:
    """对外接口：导入材料、补录、查询（含负责人视图）"""

    def __init__(self, repo=None):
        self.repo = repo if repo is not None else WarningRepository()
        self.dup_checker = DuplicateChecker(self.repo)

    # ---------- 接口1：导入/创建预警记录 ----------
    def import_warning(
        self,
        object_name: str,
        submit_date: str,
        materials: List[Dict[str, Any]],
        initial_conclusion: str = "pending",
        operator: str = "system",
    ) -> Dict[str, Any]:
        dup_result = self.dup_checker.check(object_name, submit_date)

        if dup_result["is_duplicate"]:
            # 重复提交：合并材料到已存在记录，不创建新记录
            record = self.repo.get(dup_result["existing_record_id"])
            snapshot = ConclusionTracker.make_snapshot(record)
            added = self._append_materials(record, materials, operator)
            record.is_supplemented = True
            ConclusionTracker.commit_change(
                record,
                event="append_material",
                before=snapshot,
                after_conclusion=record.conclusion,
                remark=f"重复提交合并：{object_name}→{record.display_name}，新增材料{added}条",
                operator=operator,
            )
            self.repo.save(record)
            return {
                "action": "merged",
                "duplicate_info": dup_result,
                "materials_added": added,
                "record_id": record.record_id,
                "record": record.to_dict(),
            }

        # 新记录
        record_id = f"WR-{submit_date}-{uuid.uuid4().hex[:6].upper()}"
        canon = canonical_name(object_name)
        dedup_key = f"{canon}|{submit_date}"
        now = datetime.now().isoformat(timespec="seconds")

        record = WarningRecord(
            record_id=record_id,
            canonical_object=canon,
            display_name=object_name,
            conclusion=initial_conclusion,
            materials=[],
            history=[],
            created_at=now,
            updated_at=now,
            dedup_key=dedup_key,
        )
        snapshot = ConclusionTracker.make_snapshot(record)
        self._append_materials(record, materials, operator)
        ConclusionTracker.commit_change(
            record,
            event="create",
            before=snapshot,
            after_conclusion=initial_conclusion,
            remark=f"创建预警记录：{canon}",
            operator=operator,
        )

        # 初次扫描卡点
        self._rescan_blockage(record, operator)
        self.repo.save(record)
        return {
            "action": "created",
            "duplicate_info": dup_result,
            "record_id": record_id,
            "record": record.to_dict(),
        }

    # ---------- 接口2：补录材料 ----------
    def supplement_material(
        self,
        record_id: str,
        materials: List[Dict[str, Any]],
        new_conclusion: Optional[str] = None,
        change_reason: str = "",
        operator: str = "安全员",
    ) -> Dict[str, Any]:
        record = self.repo.get(record_id)
        if not record:
            return {"error": f"记录不存在: {record_id}"}

        snapshot = ConclusionTracker.make_snapshot(record)
        added = self._append_materials(record, materials, operator)
        record.is_supplemented = True

        # 如果补录后给出新结论 → 改判
        final_conclusion = record.conclusion
        if new_conclusion and new_conclusion != record.conclusion:
            final_conclusion = new_conclusion
            record.is_judgment_changed = True

        # 重新扫描卡点
        self._rescan_blockage(record, operator)
        if record.block_level == "hard":
            final_conclusion = "blocked"
        else:
            if not new_conclusion and snapshot["conclusion"] != record.conclusion:
                final_conclusion = record.conclusion

        record.conclusion = final_conclusion
        ConclusionTracker.commit_change(
            record,
            event="modify_conclusion" if new_conclusion else "append_material",
            before=snapshot,
            after_conclusion=final_conclusion,
            remark=(
                f"补录材料{added}条"
                + (f"；改判原因：{change_reason}" if change_reason else "")
                + (f"；结论变更：{snapshot['conclusion']}→{final_conclusion}"
                   if snapshot["conclusion"] != final_conclusion else "")
            ),
            operator=operator,
        )
        self.repo.save(record)
        return {
            "action": "supplemented",
            "materials_added": added,
            "conclusion_changed": snapshot["conclusion"] != final_conclusion,
            "conclusion_before": snapshot["conclusion"],
            "conclusion_after": final_conclusion,
            "record": record.to_dict(),
        }

    # ---------- 接口3：负责人视图查询（标记补录/改判/卡点） ----------
    def query_for_manager(self, record_id: Optional[str] = None) -> Dict[str, Any]:
        records = [self.repo.get(record_id)] if record_id else self.repo.all()
        records = [r for r in records if r]

        result_list = []
        for r in records:
            manager_view = {
                "record_id": r.record_id,
                "对象标准名": r.canonical_object,
                "本次提交名称": r.display_name,
                "当前结论": self._conclusion_label(r.conclusion),
                "结论标记": self._conclusion_flags(r),
                "是否补录过": "✅ 是" if r.is_supplemented else "➖ 否",
                "是否改判过": "✅ 是" if r.is_judgment_changed else "➖ 否",
                "卡点状态": self._block_info(r),
                "暂不放行项": r.hold_results,
                "材料清单": self._material_summary(r),
                "历史追溯摘要": self._history_summary(r),
                "版本": r.version,
                "更新时间": r.updated_at,
            }
            result_list.append(manager_view)

        return {
            "total_records": len(result_list),
            "duplicate_merged_count": sum(
                sum(1 for h in r.history if "重复提交合并" in h.remark)
                for r in records
            ),
            "records": result_list,
        }

    # ---------- 辅助方法 ----------
    def _append_materials(
        self, record: WarningRecord,
        raw_materials: List[Dict[str, Any]],
        operator: str,
    ) -> int:
        count = 0
        now = datetime.now().isoformat(timespec="seconds")
        for m in raw_materials:
            mat = Material(
                material_id=m.get("material_id") or f"M-{uuid.uuid4().hex[:8].upper()}",
                material_type=m["material_type"],
                title=m["title"],
                detail=m["detail"],
                mismatch_flag=m.get("mismatch_flag", False),
                mismatch_detail=m.get("mismatch_detail", ""),
                uploaded_at=now,
                operator=operator,
            )
            record.materials.append(mat)
            count += 1
        return count

    def _rescan_blockage(self, record: WarningRecord, operator: str) -> None:
        all_findings = []
        first_replacement_idx = None
        for idx, mat in enumerate(record.materials):
            if mat.material_type == "sensor_log":
                log = SensorLog(
                    timestamp=mat.uploaded_at,
                    location=record.canonical_object,
                    temperature=0.0,
                    threshold=0.0,
                    raw_text=mat.detail,
                )
                f = BlockageDetector.scan_sensor_log(log)
                if f:
                    all_findings.append(f)
                    if first_replacement_idx is None:
                        first_replacement_idx = idx

        # 检查卡点之后的材料中是否存在校准通过凭证
        calibration_evidences = []
        if all_findings and first_replacement_idx is not None:
            for mat in record.materials[first_replacement_idx + 1:]:
                combined_text = f"{mat.title} {mat.detail}"
                c = BlockageDetector.scan_calibration_pass(combined_text)
                if c:
                    calibration_evidences.append({
                        "material_id": mat.material_id,
                        "title": mat.title,
                        "note": c["resolve_note"],
                    })

        if all_findings and not calibration_evidences:
            merged_reason = " | ".join(f["block_reason"] for f in all_findings)
            merged_hold = []
            for f in all_findings:
                merged_hold.extend(f["hold_results"])
            record.block_reason = merged_reason
            record.block_level = "hard"
            record.hold_results = list(dict.fromkeys(merged_hold))
            record.conclusion = "blocked"
        else:
            if calibration_evidences:
                resolve_notes = "；".join(e["note"] for e in calibration_evidences)
                record.block_reason = f"（卡点已解除）{resolve_notes}"
                record.block_level = ""
                record.hold_results = []
                if record.conclusion == "blocked":
                    record.conclusion = "pending"
            else:
                record.block_reason = ""
                record.block_level = ""
                record.hold_results = []
                if record.conclusion == "blocked":
                    record.conclusion = "pending"

    @staticmethod
    def _conclusion_label(c: str) -> str:
        return {
            "pending": "🟡 待审核",
            "normal": "🟢 正常",
            "abnormal": "🔴 异常",
            "blocked": "⛔ 卡点阻塞",
        }.get(c, c)

    @staticmethod
    def _conclusion_flags(r: WarningRecord) -> List[str]:
        flags = []
        if r.is_supplemented:
            flags.append("📝 有补录")
        if r.is_judgment_changed:
            flags.append("🔄 有改判")
        if r.block_reason:
            flags.append("⚠️ 有卡点")
        return flags or ["➖ 无特殊标记"]

    @staticmethod
    def _block_info(r: WarningRecord) -> str:
        if not r.block_reason:
            return "✅ 无卡点"
        return f"⛔ {r.block_reason}"

    @staticmethod
    def _material_summary(r: WarningRecord) -> List[Dict[str, str]]:
        summary = []
        for m in r.materials:
            tag = []
            if m.material_type == "sensor_log":
                tag.append("📊传感器日志")
            elif m.material_type == "manual_note":
                tag.append("📋人工备注")
            elif m.material_type == "supplementary":
                tag.append("📎后补说明")
            if m.mismatch_flag:
                tag.append("⚠️标题明细不符")
            summary.append({
                "类型/标记": " | ".join(tag),
                "标题": m.title,
                "明细摘要": m.detail[:60] + ("..." if len(m.detail) > 60 else ""),
                "标题不符说明": m.mismatch_detail or "➖",
            })
        return summary

    @staticmethod
    def _history_summary(r: WarningRecord) -> List[Dict[str, str]]:
        items = []
        for h in r.history:
            event_label = {
                "create": "🆕 创建",
                "append_material": "➕ 材料追加",
                "modify_conclusion": "🔄 结论改判",
                "block_flag": "⛔ 卡点标记",
                "resolve_block": "✅ 卡点解除",
            }.get(h.event, h.event)
            conc = (
                f"{h.conclusion_before or '无'} → {h.conclusion_after or '无'}"
                if h.conclusion_before != h.conclusion_after
                else (h.conclusion_after or "不变")
            )
            items.append({
                "事件": f"v{h.version} {event_label}",
                "结论变化": conc,
                "材料变化": f"{len(h.materials_before)}件 → {len(h.materials_after)}件",
                "备注/原因": h.remark or "➖",
                "操作人": h.operator or "➖",
                "时间": h.timestamp,
            })
        return items
