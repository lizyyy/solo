from __future__ import annotations
import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any

from .models import (
    CurtainWallNode,
    OpinionRecord,
    OpinionSource,
    HumanOverride,
    JudgmentStatus,
    MaterialBatch,
    ExceptionRecord,
    ExceptionType,
    HandleStatus,
    SceneLabel,
    SIDE_NOTE_MAP,
    EXCEPTION_NOTE_MAP,
)


KEYWORD_CONFLICT_PAIRS: List[Tuple[str, str]] = [
    ("加大焊缝", "维持原焊缝"),
    ("焊缝高度加大至", "焊缝高度按"),
    ("焊缝高度由", "焊缝高度按"),
    ("加大焊缝高度", "不需加大焊缝"),
    ("焊缝高度加大", "焊缝维持原"),
    ("加大至", "不需加大"),
    ("更换螺栓等级", "维持原螺栓等级"),
    ("更换为M", "螺栓维持"),
    ("螺栓M10", "螺栓M12不满足"),
    ("增加锚栓数量", "锚栓数量不变"),
    ("锚栓增加", "锚栓不变"),
    ("锚栓数量增加", "锚栓数量不变"),
    ("加厚埋板", "埋板厚度不变"),
    ("玻璃改为夹胶", "玻璃维持单片"),
    ("改为夹胶", "维持单片"),
    ("玻璃夹胶", "玻璃单片"),
    ("夹胶配置", "单片方案"),
    ("胶缝宽度加大至", "胶缝维持"),
    ("胶缝从", "胶缝宽度维持"),
    ("胶缝宽度从", "胶缝宽度维持"),
    ("胶缝从15mm加大至20mm", "胶缝宽度维持15mm"),
    ("扩至", "不需扩至"),
    ("胶缝加大", "胶缝不变"),
    ("焊缝不", "焊缝加大"),
]


class MeetingMinuteTracker:
    def __init__(self) -> None:
        self.minute_log: List[Dict[str, Any]] = []
        self.missing_warnings: List[str] = []

    def ingest_minutes(
        self,
        node_map: Dict[str, CurtainWallNode],
        minutes_data: List[Dict[str, Any]],
    ) -> List[str]:
        warnings: List[str] = []
        by_node: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for m in minutes_data:
            code = m.get("node_code") or m.get("节点编号")
            if code:
                by_node[code].append(m)
            self.minute_log.append(m)

        for code, items in by_node.items():
            if code not in node_map:
                warnings.append(
                    f"[会议纪要追踪] 会议纪要出现节点编号 {code}，但交底清单中未登记该节点，可能漏项"
                )
                continue
            node = node_map[code]
            existing_ids = {o.opinion_id for o in node.opinions}
            existing_contents = {o.content for o in node.opinions}
            previous_opinions = list(node.opinions)

            items_sorted = sorted(
                items,
                key=lambda x: (
                    x.get("meeting_round") or 0,
                    x.get("meeting_date") or "",
                ),
            )

            for m in items_sorted:
                content = (m.get("opinion") or m.get("意见") or "").strip()
                if not content:
                    continue
                if content in existing_contents:
                    dup = next((o for o in node.opinions if o.content == content), None)
                    if dup:
                        dup.trace_note = (
                            f"{dup.trace_note} | 已在会议纪要[{m.get('meeting_round')}]轮核对，非漏项"
                        ).strip(" |")
                    continue

                source_val = m.get("source", OpinionSource.MEETING_MINUTE.value)
                try:
                    source = OpinionSource(source_val)
                except ValueError:
                    source = OpinionSource.MEETING_MINUTE

                record = OpinionRecord(
                    source=source,
                    source_ref=m.get("source_ref", m.get("来源引用", "")),
                    meeting_date=m.get("meeting_date"),
                    meeting_round=m.get("meeting_round"),
                    content=content,
                    proposer=m.get("proposer", m.get("提出人", "")),
                    linked_opinion_ids=[],
                    trace_note=f"录入自会议纪要第{m.get('meeting_round')}轮",
                )

                conflict_pair = self._find_conflict(content, previous_opinions)
                if conflict_pair:
                    old_op, kw_old, kw_new = conflict_pair
                    record.linked_opinion_ids.append(old_op.opinion_id)
                    if old_op.opinion_id not in record.linked_opinion_ids:
                        record.linked_opinion_ids.append(old_op.opinion_id)
                    old_op.linked_opinion_ids.append(record.opinion_id)
                    old_op.trace_note = (
                        f"{old_op.trace_note} | 与新意见[{record.opinion_id}]冲突，已挂冲突待澄清"
                    ).strip(" |")
                    record.trace_note += f"，与历史意见[{old_op.opinion_id}]冲突，已生成异常"
                    node.register_opinion_conflict(record, old_op)
                    warnings.append(
                        f"[会议纪要追踪] 节点{code} 检测到新旧意见冲突："
                        f"旧[{old_op.opinion_id}]('{kw_old}') ↔ 新[{record.opinion_id}]('{kw_new}')"
                    )

                node.opinions.append(record)
                existing_ids.add(record.opinion_id)
                existing_contents.add(content)

            unresolved_olds = [
                o for o in previous_opinions
                if not o.is_resolved and o.source == OpinionSource.PREVIOUS_REVIEW
            ]
            for uo in unresolved_olds:
                latest_round = max((m.get("meeting_round", 0) for m in items_sorted), default=0)
                mentioned = any(
                    uo.content in (m.get("opinion") or "") or uo.opinion_id in (m.get("ref_ids") or [])
                    for m in items_sorted
                )
                if not mentioned:
                    uo.trace_note = (
                        f"{uo.trace_note} | ⚠ 最新第{latest_round}轮会议纪要未重新提及，可能漏项，已标红提醒"
                    ).strip(" |")
                    warnings.append(
                        f"[会议纪要追踪] 节点{code} 历史意见[{uo.opinion_id}]未在最新会议纪要中出现，请核实是否遗漏"
                    )

        self.missing_warnings.extend(warnings)
        return warnings

    def _find_conflict(
        self,
        new_content: str,
        old_ops: List[OpinionRecord],
    ) -> Optional[Tuple[OpinionRecord, str, str]]:
        for kw_new, kw_old in KEYWORD_CONFLICT_PAIRS:
            if kw_new in new_content:
                for old in old_ops:
                    if kw_old in old.content:
                        return old, kw_old, kw_new
            if kw_old in new_content:
                for old in old_ops:
                    if kw_new in old.content:
                        return old, kw_new, kw_old
        return None


class UnifiedAnnotationEngine:
    def sync_all(self, nodes: List[CurtainWallNode]) -> List[Dict[str, str]]:
        diffs: List[Dict[str, str]] = []
        for node in nodes:
            prev_scene = node._scene_label_synced
            prev_side = node._side_note_synced
            node.sync_unified_labels()
            if node._scene_label_synced != prev_scene or node._side_note_synced != prev_side:
                diffs.append({
                    "节点": node.code,
                    "场景标注(统一)": node._scene_label_synced,
                    "侧边说明(统一)": node._side_note_synced,
                })
            for exc in node.exceptions:
                exc.ensure_unified_notes()
        return diffs

    def consistency_check(self, nodes: List[CurtainWallNode]) -> List[str]:
        errors: List[str] = []
        for node in nodes:
            expected_scene = node.scene.value
            expected_side = SIDE_NOTE_MAP.get(node.scene, "")
            if node._scene_label_synced != expected_scene:
                errors.append(f"[三统一检查] {node.code} 场景标注未同步：节点场景={expected_scene}，标注={node._scene_label_synced}")
            if node.side_note != expected_side:
                errors.append(f"[三统一检查] {node.code} 侧边说明不一致：应为『{expected_side}』实际『{node.side_note}』")
            for exc in node.exceptions:
                if exc.unified_scene_label != expected_scene:
                    errors.append(
                        f"[三统一检查] {node.code} 异常{exc.exc_id} 场景标注与节点不一致，"
                        f"队列说明与场景应是同一套话"
                    )
                expected_queue = EXCEPTION_NOTE_MAP.get(exc.exc_type, exc.description)
                if exc.unified_queue_note != expected_queue:
                    errors.append(
                        f"[三统一检查] {node.code} 异常{exc.exc_id} 队列说明未按标准模板输出"
                    )
        return errors


class OverrideTraceEngine:
    def build_trace_chain(self, node: CurtainWallNode) -> List[Dict[str, str]]:
        chain: List[Dict[str, str]] = []
        chain.append({
            "步骤": "0-系统自动判定",
            "判定结果": node.auto_judgment.value,
            "依据": "、".join(node.judgment_reason_chain[:1]) or "默认",
            "操作人": "系统",
            "影响最终判断": "是(起点)",
            "时间": "-",
        })
        for idx, ov in enumerate(node.overrides, 1):
            chain.append({
                "步骤": f"{idx}-人工改判[{ov.override_id}]",
                "判定结果": f"{ov.original_status.value} → {ov.overridden_status.value}",
                "依据": ov.reason,
                "操作人": ov.operator,
                "影响最终判断": "是" if idx == len(node.overrides) else "部分",
                "时间": ov.operated_at,
            })
        chain.append({
            "步骤": f"{len(node.overrides) + 1}-最终输出",
            "判定结果": node.final_judgment.value,
            "依据": "、".join(node.judgment_reason_chain),
            "操作人": "-",
            "影响最终判断": "最终结果",
            "时间": "-",
        })
        return chain

    def impact_report(self, nodes: List[CurtainWallNode]) -> List[Dict[str, str]]:
        rows: List[Dict[str, str]] = []
        for node in nodes:
            if not node.overrides:
                continue
            for ov in node.overrides:
                rows.append({
                    "节点编号": node.code,
                    "节点名称": node.name,
                    "改判号": ov.override_id,
                    "原判定": ov.original_status.value,
                    "改判为": ov.overridden_status.value,
                    "改判理由": ov.reason,
                    "操作人": ov.operator,
                    "操作时间": ov.operated_at,
                    "最终判定变化": (
                        "直接决定最终结果"
                        if node.overrides[-1].override_id == ov.override_id
                        else "被后续改判覆盖"
                    ),
                })
        return rows


class MaterialGateEngine:
    def enforce_hang_on_missing(self, node: CurtainWallNode) -> List[str]:
        notes: List[str] = []
        node.register_material_pending()
        if node.material_missing():
            if (
                node.final_judgment not in (JudgmentStatus.PENDING, JudgmentStatus.OVERRIDDEN_STABLE, JudgmentStatus.OVERRIDDEN_UNSTABLE)
                and not node.overrides
            ):
                node.final_judgment = JudgmentStatus.PENDING
                notes.append(
                    f"[材料挂起] 节点{node.code} 存在材料批次缺失，强制从{node.auto_judgment.value}改为『待确认(挂起)』，"
                    f"不得输出假稳定结论"
                )
            if node.overrides and node.final_judgment == JudgmentStatus.OVERRIDDEN_STABLE:
                notes.append(
                    f"[材料挂起-警示] 节点{node.code} 材料缺失本应挂起，但存在人工改判为稳定，请确认改判是否已覆盖材料问题"
                )
        return notes

    def missing_list(self, nodes: List[CurtainWallNode]) -> List[Dict[str, str]]:
        rows: List[Dict[str, str]] = []
        for node in nodes:
            for m in node.materials:
                if m.missing:
                    rows.append({
                        "节点编号": node.code,
                        "材料名称": m.material_name,
                        "规格": m.spec,
                        "当前状态": "批次缺失/无质保书",
                        "处理建议": "请现场老师提供入库单、质量证明文件，确认后解除挂起",
                        "挂起影响": "节点最终判定已被强制挂起，禁止输出稳定结论",
                    })
        return rows


class SummaryLinkageEngine:
    def build_summary_with_pull_markers(
        self, nodes: List[CurtainWallNode]
    ) -> Tuple[List[Dict[str, str]], Dict[str, List[ExceptionRecord]]]:
        summary_rows: List[Dict[str, str]] = []
        pull_map: Dict[str, List[ExceptionRecord]] = {}
        for node in nodes:
            row = node.to_summary_row()
            pulling = node.get_pulling_exceptions()
            if pulling:
                pull_map[node.code] = pulling
                row["拉动汇总的异常明细定位"] = " → ".join(
                    f"异常{e.exc_id}[{e.exc_type.value}]" for e in pulling
                )
            else:
                row["拉动汇总的异常明细定位"] = "-"
            summary_rows.append(row)
        return summary_rows, pull_map

    def aggregate_metrics(self, nodes: List[CurtainWallNode]) -> Dict[str, Any]:
        total = len(nodes)
        stable = sum(1 for n in nodes if n.final_judgment == JudgmentStatus.STABLE)
        ov_stable = sum(1 for n in nodes if n.final_judgment == JudgmentStatus.OVERRIDDEN_STABLE)
        unstable = sum(1 for n in nodes if n.final_judgment == JudgmentStatus.UNSTABLE)
        ov_unstable = sum(1 for n in nodes if n.final_judgment == JudgmentStatus.OVERRIDDEN_UNSTABLE)
        pending = sum(1 for n in nodes if n.final_judgment == JudgmentStatus.PENDING)
        total_exc = sum(len(n.exceptions) for n in nodes)
        pulling_exc = sum(len(n.get_pulling_exceptions()) for n in nodes)
        override_count = sum(len(n.overrides) for n in nodes)
        missing_material_nodes = sum(1 for n in nodes if n.material_missing())
        return {
            "节点总数": total,
            "自动稳定": stable,
            "人工改判-稳定": ov_stable,
            "自动不稳定": unstable,
            "人工改判-不稳定": ov_unstable,
            "挂起待确认": pending,
            "异常总数": total_exc,
            "拉动汇总的异常数": pulling_exc,
            "人工改判总数": override_count,
            "材料缺失节点数": missing_material_nodes,
        }


class ExceptionQueueEngine:
    def build_queue(
        self, nodes: List[CurtainWallNode]
    ) -> Tuple[List[Dict[str, str]], Dict[str, List[Dict[str, str]]]]:
        queue_rows: List[Dict[str, str]] = []
        override_details: Dict[str, List[Dict[str, str]]] = {}
        for node in nodes:
            for exc in node.exceptions:
                row = exc.to_queue_row()
                linked_ov = next((o for o in node.overrides if o.override_id == exc.linked_override_id), None)
                if linked_ov:
                    override_details.setdefault(exc.exc_id, []).append({
                        "改判号": linked_ov.override_id,
                        "原判定": linked_ov.original_status.value,
                        "改判为": linked_ov.overridden_status.value,
                        "理由": linked_ov.reason,
                        "操作人": linked_ov.operator,
                        "时间": linked_ov.operated_at,
                    })
                    row["人工改判详情"] = linked_ov.impact_summary()
                else:
                    row["人工改判详情"] = "-"
                if exc.handle_status == HandleStatus.OPEN:
                    row["下一步动作"] = "请现场老师/设计确认后更新处理状态"
                elif exc.handle_status == HandleStatus.HUNG:
                    row["下一步动作"] = "等待现场补齐材料批次证明后解除挂起"
                elif exc.handle_status == HandleStatus.RESOLVED:
                    row["下一步动作"] = "已闭环，留档备查"
                else:
                    row["下一步动作"] = "跟进确认人反馈"
                queue_rows.append(row)
        return queue_rows, override_details

    def status_summary(self, nodes: List[CurtainWallNode]) -> Dict[str, int]:
        counter: Dict[str, int] = defaultdict(int)
        for node in nodes:
            for exc in node.exceptions:
                counter[exc.handle_status.value] += 1
        return dict(counter)


class CurtainWallChecklist:
    def __init__(self) -> None:
        self.nodes: Dict[str, CurtainWallNode] = {}
        self.minute_tracker = MeetingMinuteTracker()
        self.annotation = UnifiedAnnotationEngine()
        self.override_trace = OverrideTraceEngine()
        self.material_gate = MaterialGateEngine()
        self.summary_linkage = SummaryLinkageEngine()
        self.exception_queue = ExceptionQueueEngine()
        self.global_warnings: List[str] = []

    def add_node(self, node: CurtainWallNode) -> None:
        self.nodes[node.code] = node

    def import_meeting_minutes(self, minutes_data: List[Dict[str, Any]]) -> List[str]:
        return self.minute_tracker.ingest_minutes(self.nodes, minutes_data)

    def run_pipeline(self) -> Dict[str, Any]:
        self.global_warnings.clear()

        for node in self.nodes.values():
            node.sync_unified_labels()

        for node in self.nodes.values():
            node.apply_auto_judgment()

        for node in self.nodes.values():
            notes = self.material_gate.enforce_hang_on_missing(node)
            self.global_warnings.extend(notes)

        diffs = self.annotation.sync_all(list(self.nodes.values()))
        cons_errs = self.annotation.consistency_check(list(self.nodes.values()))
        self.global_warnings.extend(cons_errs)

        summary_rows, pull_map = self.summary_linkage.build_summary_with_pull_markers(
            list(self.nodes.values())
        )
        queue_rows, ov_details = self.exception_queue.build_queue(list(self.nodes.values()))
        metrics = self.summary_linkage.aggregate_metrics(list(self.nodes.values()))
        qs = self.exception_queue.status_summary(list(self.nodes.values()))

        opinion_audit: List[Dict[str, str]] = []
        for node in self.nodes.values():
            for op in node.opinions:
                row = op.to_audit_row()
                row["节点编号"] = node.code
                opinion_audit.append(row)

        material_missing = self.material_gate.missing_list(list(self.nodes.values()))

        override_impact = self.override_trace.impact_report(list(self.nodes.values()))

        node_trace_chains: Dict[str, List[Dict[str, str]]] = {}
        for node in self.nodes.values():
            node_trace_chains[node.code] = self.override_trace.build_trace_chain(node)

        return {
            "metrics": metrics,
            "queue_status": qs,
            "summary_rows": summary_rows,
            "pull_map": {k: [e.exc_id for e in v] for k, v in pull_map.items()},
            "queue_rows": queue_rows,
            "override_details": ov_details,
            "opinion_audit": opinion_audit,
            "material_missing": material_missing,
            "override_impact": override_impact,
            "trace_chains": node_trace_chains,
            "annotation_diffs": diffs,
            "warnings": self.global_warnings + self.minute_tracker.missing_warnings,
        }


def write_csv(path: Path, rows: List[Dict[str, str]]) -> None:
    if not rows:
        path.write_text("(无数据)\n", encoding="utf-8")
        return
    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, obj: Any) -> None:
    path.write_text(
        json.dumps(obj, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def export_all(result: Dict[str, Any], out_dir: Path) -> Dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)

    overview = {
        "整体指标": result["metrics"],
        "异常队列状态分布": result["queue_status"],
        "汇总-异常拉动关系": result["pull_map"],
        "检查警告": result["warnings"],
    }
    write_json(out_dir / "00_总览指标.json", overview)

    write_csv(out_dir / "01_幕墙节点交底清单_汇总表.csv", result["summary_rows"])
    write_csv(out_dir / "02_异常队列_含处理状态与改判记录.csv", result["queue_rows"])
    write_csv(out_dir / "03_会议纪要意见追溯清单.csv", result["opinion_audit"])
    write_csv(out_dir / "04_人工改判影响报告.csv", result["override_impact"])
    write_csv(out_dir / "05_材料批次缺失挂起清单.csv", result["material_missing"])

    trace_dir = out_dir / "06_各节点判定追溯链"
    trace_dir.mkdir(exist_ok=True)
    for code, chain in result["trace_chains"].items():
        write_csv(trace_dir / f"{code}_判定追溯链.csv", chain)

    write_csv(out_dir / "07_三统一标注同步记录.csv", result["annotation_diffs"])

    warnings_file = out_dir / "README_现场老师请先看.txt"
    lines = ["== 现场老师操作指引 ==\n"]
    lines.append("第一步：打开 05_材料批次缺失挂起清单.csv，核对并补齐所有缺失的材料批次证明；")
    lines.append("第二步：打开 02_异常队列_含处理状态与改判记录.csv，按『下一步动作』列逐项确认；")
    lines.append("第三步：打开 01_幕墙节点交底清单_汇总表.csv，查看『拉动异常编号』列定位到具体异常；")
    lines.append("第四步：如需追溯人工改判过程，打开 04_人工改判影响报告.csv；")
    lines.append("第五步：如需核对会议纪要漏项情况，打开 03_会议纪要意见追溯清单.csv 查看追溯说明列。\n")
    if result["warnings"]:
        lines.append("【本次运行重点提醒】")
        for i, w in enumerate(result["warnings"], 1):
            lines.append(f"  {i}. {w}")
    else:
        lines.append("【本次运行未触发重点提醒】")
    warnings_file.write_text("\n".join(lines), encoding="utf-8")

    return {
        "总览指标": "00_总览指标.json",
        "汇总表": "01_幕墙节点交底清单_汇总表.csv",
        "异常队列": "02_异常队列_含处理状态与改判记录.csv",
        "会议纪要追溯": "03_会议纪要意见追溯清单.csv",
        "改判影响": "04_人工改判影响报告.csv",
        "材料挂起": "05_材料批次缺失挂起清单.csv",
        "判定追溯链目录": "06_各节点判定追溯链/",
        "三统一同步": "07_三统一标注同步记录.csv",
        "操作指引": "README_现场老师请先看.txt",
    }
