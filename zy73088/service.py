from __future__ import annotations

import copy
from dataclasses import asdict
from typing import Dict, List, Optional, Tuple, Any

from models import (
    _now,
    AuditLog,
    CollisionPoint,
    Conclusion,
    HistoryVersion,
    MaterialReviewItem,
    OperationType,
    PendingConfirmItem,
    RecordStatus,
    SchemeComparisonRecord,
    ViewPoint,
)


# =============================================================================
# 模块 1：碰撞点去重检测 + 挂起 + 结论牵动分析
# =============================================================================


class CollisionDedupService:
    """碰撞点去重检测：同一element_id + 同视角 + 同描述 = 重复"""

    @staticmethod
    def scan_duplicates(materials: List[MaterialReviewItem]) -> Dict[str, List[CollisionPoint]]:
        """扫描所有材料中的碰撞点，返回 {dedup_key: [collision_list]}"""
        buckets: Dict[str, List[CollisionPoint]] = {}
        for mat in materials:
            for cp in mat.collision_points:
                key = cp.dedup_key()
                buckets.setdefault(key, []).append(cp)
        return {k: v for k, v in buckets.items() if len(v) > 1}

    @staticmethod
    def analyze_impact(record: SchemeComparisonRecord, dup_ids: List[str]) -> Tuple[str, List[str]]:
        """分析重复碰撞点会牵动哪些结论"""
        affected: List[str] = []
        reasons: List[str] = []

        for dup_id in dup_ids:
            for mat in record.materials:
                for cp in mat.collision_points:
                    if cp.collision_id == dup_id:
                        affected.append(f"材料:{mat.material_name}({mat.item_id})-碰撞:{cp.description}")
                        if cp.severity == "high":
                            reasons.append(f"高危碰撞点 [{cp.description}] 重复，直接影响材料用量核算")
                        elif cp.severity == "medium":
                            reasons.append(f"中危碰撞点 [{cp.description}] 重复，可能影响方案承载力校核")
                        else:
                            reasons.append(f"低危碰撞点 [{cp.description}] 重复，需确认是否为同一处")

        if record.conclusion:
            reasons.append(f"当前结论为「{record.conclusion.value}」，待确认后可能发生改判")

        return "；".join(reasons) if reasons else "暂无明确牵动影响，需人工复核", affected


class SuspensionService:
    """挂起服务：发现重复后，将记录挂起并进入待确认队列"""

    @staticmethod
    def suspend_for_duplicates(
        record: SchemeComparisonRecord,
        operator: str,
    ) -> List[PendingConfirmItem]:
        duplicates = CollisionDedupService.scan_duplicates(record.materials)
        created: List[PendingConfirmItem] = []

        for _key, cp_list in duplicates.items():
            dup_ids = [c.collision_id for c in cp_list]
            mat_ids = list({
                m.item_id
                for m in record.materials
                for c in m.collision_points
                if c.collision_id in dup_ids
            })
            impact, affected = CollisionDedupService.analyze_impact(record, dup_ids)

            pending = PendingConfirmItem(
                record_id=record.record_id,
                material_item_id=",".join(mat_ids),
                duplicate_collision_ids=dup_ids,
                impact_analysis=impact,
                affected_conclusions=affected,
                suspended_by=operator,
            )
            record.pending_queue.append(pending)
            created.append(pending)

        if created:
            record.status = RecordStatus.PENDING_CONFIRM
            AuditService.log(
                record,
                operator,
                OperationType.SUSPEND,
                f"检测到 {len(created)} 组重复碰撞点，记录挂起并移入待确认",
                field_changes={
                    "status": {"old": RecordStatus.ACTIVE, "new": RecordStatus.PENDING_CONFIRM},
                    "pending_items": {"count": len(created)},
                },
            )

        return created

    @staticmethod
    def resolve_pending(
        record: SchemeComparisonRecord,
        pending_id: str,
        operator: str,
        resolution: str,
        keep_collision_id: Optional[str] = None,
    ) -> bool:
        """解决待确认项：选择保留的碰撞点，其余去重；记录状态恢复"""
        for p in record.pending_queue:
            if p.pending_id == pending_id and p.resolved_at is None:
                p.resolved_at = _now()
                p.resolved_by = operator
                p.resolution = resolution

                if keep_collision_id:
                    for mat in record.materials:
                        mat.collision_points = [
                            c for c in mat.collision_points
                            if c.collision_id == keep_collision_id
                            or c.collision_id not in p.duplicate_collision_ids
                        ]

                unresolved = any(x.resolved_at is None for x in record.pending_queue)
                if not unresolved:
                    record.status = RecordStatus.CONFIRMED

                AuditService.log(
                    record,
                    operator,
                    OperationType.CONFIRM,
                    f"待确认项 {pending_id} 已解决：{resolution}",
                    field_changes={
                        "pending_id": {"value": pending_id},
                        "resolution": {"value": resolution},
                    },
                )
                return True
        return False


# =============================================================================
# 模块 2：历史版本链 —— 修改自动快照，保留旧材料/新备注/改判原因
# =============================================================================


class HistoryService:
    """历史版本管理：每次变更产生新版本，形成可追溯的版本链"""

    @staticmethod
    def _snapshot_materials(record: SchemeComparisonRecord) -> Dict[str, Any]:
        return {
            "materials": [asdict(m) for m in copy.deepcopy(record.materials)],
            "conclusion": record.conclusion.value if record.conclusion else None,
            "confidence": record.confidence,
            "status": record.status.value,
        }

    @staticmethod
    def create_version(
        record: SchemeComparisonRecord,
        operator: str,
        revise_reason: str = "",
        old_conclusion: Optional[Conclusion] = None,
        new_conclusion: Optional[Conclusion] = None,
        new_remarks: Optional[List[Dict[str, str]]] = None,
    ) -> HistoryVersion:
        """创建新历史版本快照（操作前调用）"""
        parent = record.history_chain[-1] if record.history_chain else None
        version = HistoryVersion(
            version_no=record.current_version,
            parent_id=parent.version_id if parent else None,
            snapshot_material=HistoryService._snapshot_materials(record),
            new_remarks=new_remarks or [],
            old_conclusion=old_conclusion,
            new_conclusion=new_conclusion,
            revise_reason=revise_reason,
            operator=operator,
        )
        record.history_chain.append(version)
        record.current_version += 1
        record.updated_at = _now()
        return version

    @staticmethod
    def get_version(record: SchemeComparisonRecord, version_no: int) -> Optional[HistoryVersion]:
        return next((v for v in record.history_chain if v.version_no == version_no), None)

    @staticmethod
    def trace_revisions_by_operator(
        record: SchemeComparisonRecord, operator: str
    ) -> List[HistoryVersion]:
        """按操作人追溯改判记录（例：施工经理阿乔的所有临时改判）"""
        return [
            v for v in record.history_chain
            if v.operator == operator and v.old_conclusion != v.new_conclusion
        ]

    @staticmethod
    def diff_versions(
        v1: HistoryVersion, v2: HistoryVersion
    ) -> Dict[str, Any]:
        """对比两个版本的差异，输出旧材料/新备注/改判原因"""
        changes: Dict[str, Any] = {
            "conclusion_changed": v1.new_conclusion != v2.new_conclusion,
            "old_conclusion": v1.new_conclusion.value if v1.new_conclusion else None,
            "new_conclusion": v2.new_conclusion.value if v2.new_conclusion else None,
            "revise_reason": v2.revise_reason,
            "new_remarks_in_v2": v2.new_remarks,
            "operator": v2.operator,
            "operated_at": v2.operated_at,
        }

        mat1_ids = {m["item_id"] for m in (v1.snapshot_material or {}).get("materials", [])}
        mat2 = {m["item_id"]: m for m in (v2.snapshot_material or {}).get("materials", [])}
        changes["material_changes"] = {
            mid: mat2[mid] for mid in mat2 if mid not in mat1_ids
        }
        return changes


# =============================================================================
# 模块 3：统一数据源 —— 场景标注 / 侧边说明 / 接口返回 共用同一渲染源
# =============================================================================


class UnifiedRenderSource:
    """
    统一渲染源：
    - scene_annotations  ← 从 render_source 派生
    - side_notes         ← 从 render_source 派生
    - api_response       ← 从 render_source 派生
    保证换视角后三者不会"三套话"
    """

    SOURCE_VERSION = "1.0"

    @classmethod
    def build(cls, record: SchemeComparisonRecord) -> Dict[str, Any]:
        """构建唯一的渲染源对象，所有输出都从它派生"""
        materials_summary = [
            {
                "item_id": m.item_id,
                "material_name": m.material_name,
                "specification": m.specification,
                "collision_count": len(m.collision_points),
                "remarks_count": len(m.remarks),
            }
            for m in record.materials
        ]
        collisions_with_vp = [
            {
                "collision_id": c.collision_id,
                "element_id": c.element_id,
                "description": c.description,
                "severity": c.severity,
                "screenshot": c.screenshot_path,
                "viewpoint_fingerprint": c.viewpoint.fingerprint(),
                "camera": asdict(c.viewpoint),
                "historical_screenshots": c.historical_screenshots,
            }
            for m in record.materials for c in m.collision_points
        ]
        source: Dict[str, Any] = {
            "source_version": cls.SOURCE_VERSION,
            "source_id": record.render_source_id,
            "generated_at": _now(),
            "record_id": record.record_id,
            "project": {
                "name": record.project_name,
                "code": record.project_code,
                "element": record.structural_element,
            },
            "status": record.status.value,
            "conclusion": record.conclusion.value if record.conclusion else None,
            "confidence": record.confidence,
            "materials": materials_summary,
            "collisions": collisions_with_vp,
            "pending_count": sum(1 for p in record.pending_queue if p.resolved_at is None),
            "version": record.current_version,
        }
        return source

    @staticmethod
    def render_scene_annotations(source: Dict[str, Any]) -> str:
        """从统一渲染源派生场景标注（标注框文字）"""
        lines = [f"【{source['project']['name']}】{source['project']['element']}"]
        for col in source["collisions"]:
            lines.append(
                f"[{col['severity'].upper()}] {col['description']} "
                f"(元素:{col['element_id']})  [VP:{col['viewpoint_fingerprint'][:20]}...]"
            )
        if source["pending_count"] > 0:
            lines.append(f"⚠ 待确认冲突 {source['pending_count']} 组")
        return "\n".join(lines)

    @staticmethod
    def render_side_notes(source: Dict[str, Any]) -> str:
        """从统一渲染源派生侧边说明"""
        buf: List[str] = []
        buf.append(f"方案比选版本 V{source['version']}  |  状态：{source['status']}")
        buf.append(f"结论：{source['conclusion'] or '未出具'}  （置信度 {source['confidence']:.0%}）")
        buf.append("")
        buf.append(f"材料送审项：{len(source['materials'])} 项")
        for m in source["materials"]:
            buf.append(
                f"  · {m['material_name']} {m['specification']} — "
                f"碰撞点 {m['collision_count']} 处，备注 {m['remarks_count']} 条"
            )
        buf.append("")
        buf.append(f"碰撞点总数：{len(source['collisions'])}")
        for c in source["collisions"]:
            buf.append(
                f"  · [{c['severity']}] {c['description']}  截图：{c['screenshot']}"
            )
        if source["pending_count"]:
            buf.append("")
            buf.append(f"待确认队列：{source['pending_count']} 组，请先处理后再导出")
        return "\n".join(buf)

    @staticmethod
    def render_api_response(source: Dict[str, Any]) -> Dict[str, Any]:
        """从统一渲染源派生接口返回（对外 API 格式）"""
        return {
            "code": 200,
            "message": "ok",
            "source_version": source["source_version"],
            "source_id": source["source_id"],
            "data": {
                "record_id": source["record_id"],
                "project": source["project"],
                "status": source["status"],
                "conclusion": source["conclusion"],
                "confidence": source["confidence"],
                "version": source["version"],
                "materials": source["materials"],
                "collisions": [
                    {k: c[k] for k in ("collision_id", "element_id", "description", "severity", "camera")}
                    for c in source["collisions"]
                ],
                "pending_count": source["pending_count"],
                "generated_at": source["generated_at"],
            },
        }

    @classmethod
    def apply_to_record(cls, record: SchemeComparisonRecord) -> None:
        """
        一次生成，三处同步。
        调用此方法保证 scene_annotations / side_notes / api_response 不会三套话。
        """
        if not record.render_source_id:
            record.render_source_id = f"RS-{record.record_id}"
        source = cls.build(record)
        record.scene_annotations = cls.render_scene_annotations(source)
        record.side_notes = cls.render_side_notes(source)
        record.api_response = cls.render_api_response(source)
        record.updated_at = _now()


# =============================================================================
# 模块 4：审计日志 + 操作追溯
# =============================================================================


class AuditService:
    """审计日志：记录谁、什么时间、做了什么、改了什么字段"""

    @staticmethod
    def log(
        record: SchemeComparisonRecord,
        operator: str,
        op_type: OperationType,
        detail: str,
        field_changes: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> AuditLog:
        log = AuditLog(
            record_id=record.record_id,
            operator=operator,
            operation_type=op_type,
            operation_detail=detail,
            timestamp=_now(),
            field_changes=field_changes or {},
        )
        record.audit_logs.append(log)
        return log

    @staticmethod
    def filter_logs(
        record: SchemeComparisonRecord,
        operator: Optional[str] = None,
        op_type: Optional[OperationType] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[AuditLog]:
        """按操作人/类型/时间/关键词筛选日志"""
        result = record.audit_logs
        if operator:
            result = [l for l in result if l.operator == operator]
        if op_type:
            result = [l for l in result if l.operation_type == op_type]
        if since:
            result = [l for l in result if l.timestamp >= since]
        if until:
            result = [l for l in result if l.timestamp <= until]
        if keyword:
            result = [
                l for l in result
                if keyword in l.operation_detail
                or any(keyword in str(v) for v in l.field_changes.values())
            ]
        return result

    @staticmethod
    def trace_revise_reason(
        record: SchemeComparisonRecord, target_version: int
    ) -> Optional[Dict[str, Any]]:
        """追溯指定版本的改判原因和当时操作人"""
        hist = HistoryService.get_version(record, target_version)
        if not hist:
            return None
        related_logs = AuditService.filter_logs(
            record,
            operator=hist.operator,
            op_type=OperationType.REVISE_CONCLUSION,
            since=hist.operated_at[:10],
        )
        return {
            "version": hist.version_no,
            "operator": hist.operator,
            "operated_at": hist.operated_at,
            "old_conclusion": hist.old_conclusion.value if hist.old_conclusion else None,
            "new_conclusion": hist.new_conclusion.value if hist.new_conclusion else None,
            "revise_reason": hist.revise_reason,
            "new_remarks": hist.new_remarks,
            "related_audit_logs": [asdict(l) for l in related_logs],
        }


# =============================================================================
# 模块 5：三栏对账视图 —— 材料送审表 / 处理记录 / 接口返回 对照
# =============================================================================


class ReconciliationView:
    """
    三栏对账视图：施工经理阿乔可以拿着它去跟任何一方对账
    左：材料送审表（含备注/碰撞点/旧截图）
    中：处理记录（历史版本+审计日志）
    右：接口返回（统一渲染源派生）
    """

    @staticmethod
    def build(record: SchemeComparisonRecord) -> Dict[str, Any]:
        source = UnifiedRenderSource.build(record)
        return {
            "record_id": record.record_id,
            "generated_at": _now(),
            "render_source_id": record.render_source_id,
            "left_material_review": [
                {
                    "item_id": m.item_id,
                    "material_name": m.material_name,
                    "specification": m.specification,
                    "supplier": m.supplier,
                    "batch_no": m.batch_no,
                    "quantity": m.quantity,
                    "unit": m.unit,
                    "collision_points": [
                        {
                            "collision_id": c.collision_id,
                            "description": c.description,
                            "severity": c.severity,
                            "screenshot": c.screenshot_path,
                            "historical_screenshots": c.historical_screenshots,
                            "viewpoint_fingerprint": c.viewpoint.fingerprint(),
                        }
                        for c in m.collision_points
                    ],
                    "remarks": m.remarks,
                    "created_at": m.created_at,
                    "created_by": m.created_by,
                }
                for m in record.materials
            ],
            "middle_processing": {
                "history_chain": [
                    {
                        "version_no": h.version_no,
                        "operator": h.operator,
                        "operated_at": h.operated_at,
                        "old_conclusion": h.old_conclusion.value if h.old_conclusion else None,
                        "new_conclusion": h.new_conclusion.value if h.new_conclusion else None,
                        "revise_reason": h.revise_reason,
                        "new_remarks_count": len(h.new_remarks),
                    }
                    for h in record.history_chain
                ],
                "audit_logs": [asdict(l) for l in record.audit_logs],
                "pending_queue": [
                    {
                        "pending_id": p.pending_id,
                        "status": "待处理" if p.resolved_at is None else "已解决",
                        "impact_analysis": p.impact_analysis,
                        "affected": p.affected_conclusions,
                        "suspended_by": p.suspended_by,
                        "suspended_at": p.suspended_at,
                        "resolved_by": p.resolved_by,
                        "resolved_at": p.resolved_at,
                        "resolution": p.resolution,
                    }
                    for p in record.pending_queue
                ],
            },
            "right_api_response": UnifiedRenderSource.render_api_response(source),
        }

    @staticmethod
    def to_text(record: SchemeComparisonRecord) -> str:
        """输出纯文本版对账视图，阿乔直接复制粘贴就能给人看"""
        view = ReconciliationView.build(record)
        buf: List[str] = []
        buf.append("=" * 72)
        buf.append(f"结构加固方案比选 - 三栏对账单   记录号：{view['record_id']}")
        buf.append(f"生成时间：{view['generated_at']}   渲染源：{view['render_source_id']}")
        buf.append("=" * 72)

        buf.append("\n【左栏 · 材料送审表】")
        for i, m in enumerate(view["left_material_review"], 1):
            buf.append(
                f"\n  {i}. {m['material_name']} {m['specification']}  "
                f"(批号:{m['batch_no']}  数量:{m['quantity']}{m['unit']})"
            )
            buf.append(f"     供应商：{m['supplier']}   录入：{m['created_by']} @ {m['created_at']}")
            if m["collision_points"]:
                buf.append(f"     碰撞点 {len(m['collision_points'])} 处：")
                for c in m["collision_points"]:
                    buf.append(
                        f"       · [{c['severity']}] {c['description']}  "
                        f"截图={c['screenshot']}  VP={c['viewpoint_fingerprint'][:24]}..."
                    )
                    if c["historical_screenshots"]:
                        buf.append(
                            f"         历史截图 {len(c['historical_screenshots'])} 张已保留"
                        )
            if m["remarks"]:
                buf.append(f"     备注 {len(m['remarks'])} 条：")
                for r in m["remarks"]:
                    buf.append(
                        f"       · [{r['timestamp']}] {r['operator']}: {r['content']}"
                    )

        buf.append("\n" + "-" * 72)
        buf.append("【中栏 · 处理记录】")
        for h in view["middle_processing"]["history_chain"]:
            tag = "（改判）" if h["old_conclusion"] != h["new_conclusion"] else ""
            buf.append(
                f"  · V{h['version_no']:02d}{tag} {h['operated_at']}  "
                f"{h['operator']}: {h['old_conclusion']} → {h['new_conclusion']}"
            )
            if h["revise_reason"]:
                buf.append(f"      原因：{h['revise_reason']}")
        if view["middle_processing"]["pending_queue"]:
            buf.append("  待确认队列：")
            for p in view["middle_processing"]["pending_queue"]:
                buf.append(
                    f"    [{p['status']}] {p['pending_id']}  "
                    f"挂起人:{p['suspended_by']} @ {p['suspended_at']}"
                )
                buf.append(f"      影响分析：{p['impact_analysis']}")
                if p["resolution"]:
                    buf.append(f"      解决：{p['resolved_by']} — {p['resolution']}")

        buf.append("\n" + "-" * 72)
        buf.append("【右栏 · 接口返回】")
        r = view["right_api_response"]["data"]
        buf.append(f"  record_id   : {r['record_id']}")
        buf.append(f"  project     : {r['project']['name']} / {r['project']['element']}")
        buf.append(f"  status      : {r['status']}")
        buf.append(f"  conclusion  : {r['conclusion']} (置信度 {r['confidence']:.0%})")
        buf.append(f"  version     : V{r['version']}")
        buf.append(f"  materials   : {len(r['materials'])} 项")
        buf.append(f"  collisions  : {len(r['collisions'])} 处")
        buf.append(f"  pending_cnt : {r['pending_count']}")

        buf.append("\n" + "=" * 72)
        buf.append("▲ 左=材料送审表   中=处理记录   右=接口返回   三处同源，一套话")
        buf.append("=" * 72)
        return "\n".join(buf)


# =============================================================================
# 模块 6：补录 / 改判 门面 —— 把历史快照、日志、统一渲染串起来
# =============================================================================


class SchemeComparisonFacade:
    """对外门面：所有写操作都走这里，确保历史/日志/渲染同步"""

    @staticmethod
    def create_record(
        project_name: str,
        project_code: str,
        structural_element: str,
        operator: str,
    ) -> SchemeComparisonRecord:
        record = SchemeComparisonRecord(
            project_name=project_name,
            project_code=project_code,
            structural_element=structural_element,
            created_by=operator,
        )
        HistoryService.create_version(record, operator, revise_reason="初始创建")
        AuditService.log(record, operator, OperationType.CREATE, "创建方案比选记录")
        UnifiedRenderSource.apply_to_record(record)
        return record

    @staticmethod
    def add_material(
        record: SchemeComparisonRecord,
        material: MaterialReviewItem,
        operator: str,
    ) -> None:
        HistoryService.create_version(record, operator, revise_reason=f"新增材料：{material.material_name}")
        record.materials.append(material)
        AuditService.log(
            record, operator, OperationType.UPDATE,
            f"新增材料送审项 {material.item_id}: {material.material_name}",
            field_changes={"materials": {"added": material.item_id}},
        )
        SuspensionService.suspend_for_duplicates(record, operator)
        UnifiedRenderSource.apply_to_record(record)

    @staticmethod
    def supplement_remark(
        record: SchemeComparisonRecord,
        material_item_id: str,
        remark_content: str,
        operator: str,
    ) -> bool:
        """补录备注：自动生成新版本，把新备注带入历史"""
        target = next((m for m in record.materials if m.item_id == material_item_id), None)
        if not target:
            return False
        target.add_remark(remark_content, operator)
        new_remark_entry = target.remarks[-1]
        HistoryService.create_version(
            record, operator,
            revise_reason=f"补录备注（材料 {material_item_id}）",
            new_remarks=[new_remark_entry],
        )
        AuditService.log(
            record, operator, OperationType.SUPPLEMENT,
            f"材料 {material_item_id} 补录备注：{remark_content}",
        )
        UnifiedRenderSource.apply_to_record(record)
        return True

    @staticmethod
    def revise_conclusion(
        record: SchemeComparisonRecord,
        new_conclusion: Conclusion,
        revise_reason: str,
        operator: str,
        new_confidence: Optional[float] = None,
        extra_remarks: Optional[List[Dict[str, str]]] = None,
    ) -> None:
        """改判结论：旧材料/新备注/改判原因全部进入历史"""
        old = record.conclusion
        HistoryService.create_version(
            record, operator,
            revise_reason=revise_reason,
            old_conclusion=old,
            new_conclusion=new_conclusion,
            new_remarks=extra_remarks or [],
        )
        record.conclusion = new_conclusion
        if new_confidence is not None:
            record.confidence = new_confidence
        AuditService.log(
            record, operator, OperationType.REVISE_CONCLUSION,
            f"结论改判：{old.value if old else '无'} → {new_conclusion.value}；原因：{revise_reason}",
            field_changes={
                "conclusion": {"old": old.value if old else None, "new": new_conclusion.value},
                "confidence": {"old": record.confidence, "new": new_confidence or record.confidence},
            },
        )
        UnifiedRenderSource.apply_to_record(record)

    @staticmethod
    def export_record(record: SchemeComparisonRecord, operator: str) -> Dict[str, Any]:
        """导出：若存在待确认项则警告；三处同步后再导出"""
        UnifiedRenderSource.apply_to_record(record)
        has_pending = any(p.resolved_at is None for p in record.pending_queue)
        payload = {
            "record_id": record.record_id,
            "export_at": _now(),
            "exported_by": operator,
            "warnings": [
                "存在未解决的待确认碰撞点，导出数据含挂起标记，请先确认"
            ] if has_pending else [],
            "render_source_id": record.render_source_id,
            "scene_annotations": record.scene_annotations,
            "side_notes": record.side_notes,
            "api_response": record.api_response,
            "reconciliation_text": ReconciliationView.to_text(record),
            "history_count": len(record.history_chain),
            "audit_count": len(record.audit_logs),
        }
        AuditService.log(
            record, operator, OperationType.EXPORT,
            f"导出记录（含待确认警告）" if has_pending else "导出记录",
        )
        return payload
