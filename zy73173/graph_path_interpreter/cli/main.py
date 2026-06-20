#!/usr/bin/env python3
import argparse
import json
import sys
import os
from datetime import datetime
from typing import List, Dict, Any

from ..core.graph import GraphPathCalculator
from ..core.validator import ValidationIssue
from ..parser.data_parser import DataParser, ParseResult, RowStatus
from ..history.timeline import HistoryTimeline, EventType
from ..history.persistence import PersistenceManager
from ..models.params import ParameterTable, ParameterVersion
from ..models.recall import RecallRecord
from ..models.note import VerbalNote


class CLIFormatter:
    @staticmethod
    def separator(char: str = "=", length: int = 60) -> str:
        return char * length

    @classmethod
    def print_header(cls, title: str) -> None:
        print()
        print(cls.separator("="))
        print(f"  {title}")
        print(cls.separator("="))

    @classmethod
    def print_section(cls, title: str) -> None:
        print()
        print(cls.separator("-"))
        print(f"  {title}")
        print(cls.separator("-"))

    @staticmethod
    def print_stat(label: str, value: Any, indent: int = 2) -> None:
        prefix = " " * indent
        print(f"{prefix}{label}: {value}")

    @classmethod
    def print_row_summary(cls, parse_result: ParseResult) -> None:
        cls.print_section("数据行分类统计")
        cls.print_stat("总行数", parse_result.total_rows)
        print()
        cls.print_stat("已处理行", f"{parse_result.processed_count} 行", indent=4)
        cls.print_stat("坏行", f"{parse_result.bad_row_count} 行 (格式错误)", indent=4)
        cls.print_stat("跳过行", f"{parse_result.skipped_count} 行 (未知类型)", indent=4)
        cls.print_stat("单位缺失行", f"{parse_result.missing_unit_count} 行 (单独拎出)", indent=4)
        cls.print_stat("撤回记录", f"{parse_result.recalled_count} 条", indent=4)
        cls.print_stat("旧版参数表", f"{parse_result.old_param_count} 条", indent=4)
        cls.print_stat("口头备注", f"{parse_result.verbal_note_count} 条", indent=4)

    @classmethod
    def print_path_result(cls, source: str, target: str, result) -> None:
        cls.print_section(f"路径计算结果: {source} -> {target}")

        if not result.is_valid:
            print("  状态: 无效 - 无法计算路径")
            if not result.path:
                print("  原因: 起点和终点之间没有可达路径")
            return

        print(f"  状态: 有效")
        print(f"  路径: {' -> '.join(result.path)}")
        print(f"  距离: {result.distance} {result.unit}")
        print(f"  节点数: {result.node_count}")
        print(f"  边数: {result.edge_count}")
        print(f"  途经节点: {', '.join(result.intermediate_nodes) if result.intermediate_nodes else '无'}")

        if result.has_missing_unit:
            print()
            print(f"  ⚠  警告: 有 {len(result.missing_unit_edges)} 条边因单位缺失未参与计算")
            print(f"     缺失单位的边: {', '.join(result.missing_unit_edges)}")

    @classmethod
    def print_validation_result(cls, validation_result) -> None:
        cls.print_section("输入校验结果")

        if validation_result.is_valid:
            print("  状态: 通过 ✓")
        else:
            print("  状态: 未通过 ✗")

        if validation_result.issues:
            print()
            print("  问题:")
            for issue in validation_result.issues:
                detail = validation_result.details.get("issue_details", {}).get(issue, "")
                print(f"    - {issue}: {detail}")

        if validation_result.warnings:
            print()
            print("  警告:")
            for warning in validation_result.warnings:
                detail = validation_result.details.get("warning_details", {}).get(warning, "")
                print(f"    - {warning}: {detail}")

        if ValidationIssue.EMPTY_COLLECTION in validation_result.issues:
            print()
            print("  说明: 空集合不会被当成正常输入，已单独标注")

    @classmethod
    def print_missing_unit_records(cls, records: List[dict]) -> None:
        if not records:
            return
        cls.print_section("单位缺失记录（单独拎出）")
        for i, record in enumerate(records, 1):
            edge_id = record.get("edge_id", f"record_{i}")
            source = record.get("source", "?")
            target = record.get("target", "?")
            print(f"  {i}. {edge_id}: {source} -> {target} (单位缺失)")

    @classmethod
    def print_timeline_event(cls, event, index: int = None) -> None:
        prefix = f"  {index}. " if index else "  "
        time_str = event.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        print(f"{prefix}[{time_str}] {event.event_type.value}: {event.description}")
        if event.related_note_ids:
            print(f"     关联备注: {', '.join(event.related_note_ids)}")
        if event.operator != "system":
            print(f"     操作人: {event.operator}")

    @classmethod
    def print_timeline(cls, timeline: HistoryTimeline) -> None:
        cls.print_header("历史时间线")
        summary = timeline.get_timeline_summary()
        print(f"  总事件数: {summary['total_events']}")
        print()

        if not timeline.events:
            print("  暂无历史记录")
            return

        for i, event in enumerate(timeline.events, 1):
            cls.print_timeline_event(event, i)

    @classmethod
    def print_conclusion_chain(cls, timeline: HistoryTimeline) -> None:
        cls.print_section("结论变更时间线")
        calc_events = timeline.get_events_by_type(EventType.CALCULATION_RUN)
        if not calc_events:
            print("  暂无计算结论")
            return

        for i, event in enumerate(calc_events, 1):
            cls.print_timeline_event(event, i)
            details = event.details
            if "result_summary" in details:
                print(f"     结论摘要: {details['result_summary']}")

    @classmethod
    def print_recall_records(cls, records: List[dict]) -> None:
        if not records:
            return
        cls.print_section("撤回记录清单")
        for i, record in enumerate(records, 1):
            print(f"  {i}. 记录ID: {record.get('record_id', 'N/A')}")
            print(f"     原记录: {record.get('original_row_id', 'N/A')}")
            print(f"     原因: {record.get('reason', 'N/A')}")
            print(f"     操作人: {record.get('recalled_by', 'N/A')}")

    @classmethod
    def print_verbal_notes(cls, notes: List[dict]) -> None:
        if not notes:
            return
        cls.print_section("口头备注清单")
        for i, note in enumerate(notes, 1):
            print(f"  {i}. 备注ID: {note.get('note_id', 'N/A')}")
            print(f"     内容: {note.get('content', 'N/A')}")
            print(f"     作者: {note.get('author', 'N/A')}")

    @classmethod
    def print_param_versions(cls, versions: List[dict]) -> None:
        if not versions:
            return
        cls.print_section("参数表版本清单")
        for i, v in enumerate(versions, 1):
            status = " [当前激活]" if v.get("is_active") else " [旧版]"
            print(f"  {i}. 版本: {v.get('version', 'N/A')}{status}")
            print(f"     描述: {v.get('description', 'N/A')}")


def load_data_file(file_path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(file_path):
        print(f"错误: 文件不存在: {file_path}")
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8") as f:
        if file_path.endswith(".json"):
            data = json.load(f)
            if isinstance(data, list):
                return data
            return [data]
        elif file_path.endswith(".jsonl"):
            data = []
            for line in f:
                line = line.strip()
                if line:
                    data.append(json.loads(line))
            return data
        else:
            print(f"错误: 不支持的文件格式: {file_path}")
            sys.exit(1)


def run_calculation_command(args):
    formatter = CLIFormatter()
    formatter.print_header("图论路径图表解释")

    data_dir = getattr(args, "data_dir", "./data")
    persistence = PersistenceManager(data_dir)

    recovered = persistence.service_restart_recover()
    if recovered["recovered"]:
        print("  检测到历史状态，已自动恢复")
    else:
        print("  首次运行，新建状态")

    timeline = HistoryTimeline()
    param_table = ParameterTable()
    recall_records = []
    verbal_notes = []

    if recovered["recovered"]:
        state = recovered["state"]
        timeline = HistoryTimeline.from_dict(state["timeline"])
        param_table = ParameterTable.from_dict(state["param_table"])
        recall_records = [RecallRecord.from_dict(r) for r in state.get("recall_records", [])]
        verbal_notes = [VerbalNote.from_dict(n) for n in state.get("verbal_notes", [])]

    if recovered["recovered"]:
        timeline.add_event(
            event_type=EventType.SERVICE_RESTART,
            description="服务重启，已恢复历史状态",
            details={"recovered_from": "latest_state"},
            operator="system",
        )

    if args.input:
        raw_data = load_data_file(args.input)

        timeline.add_event(
            event_type=EventType.DATA_IMPORT,
            description=f"导入数据文件: {os.path.basename(args.input)}",
            details={"file": args.input, "record_count": len(raw_data)},
            operator="user",
        )

        parse_result = DataParser.parse(raw_data)

        formatter.print_row_summary(parse_result)

        formatter.print_missing_unit_records(
            [r.data for r in parse_result.get_rows_by_status(RowStatus.MISSING_UNIT)]
        )

        if parse_result.recall_records:
            existing_recall_ids = {r.record_id for r in recall_records}
            new_recalls = []
            for r in parse_result.recall_records:
                rid = r.get("id", f"recall_{int(datetime.now().timestamp())}")
                if rid not in existing_recall_ids:
                    recall = RecallRecord(
                        record_id=rid,
                        original_row_id=r.get("original_id", ""),
                        reason=r.get("reason", "未说明原因"),
                        recalled_by=r.get("author", "unknown"),
                        note=r.get("note"),
                    )
                    recall_records.append(recall)
                    new_recalls.append(recall)
                    existing_recall_ids.add(rid)

            if new_recalls:
                timeline.add_event(
                    event_type=EventType.RECALL_ADD,
                    description=f"导入 {len(new_recalls)} 条撤回记录",
                    details={"count": len(new_recalls)},
                    operator="user",
                )

        if parse_result.verbal_notes:
            existing_note_ids = {n.note_id for n in verbal_notes}
            note_ids = []
            note_contents = []
            new_notes = []
            for n in parse_result.verbal_notes:
                nid = n.get("id", f"note_{int(datetime.now().timestamp())}_{len(verbal_notes)}")
                if nid not in existing_note_ids:
                    note = VerbalNote(
                        note_id=nid,
                        content=n.get("content", ""),
                        author=n.get("author", "unknown"),
                        related_record_id=n.get("related_record_id"),
                        related_event=n.get("related_event"),
                    )
                    verbal_notes.append(note)
                    new_notes.append(note)
                    note_ids.append(note.note_id)
                    note_contents.append(f"[{note.author}] {note.content}")
                    existing_note_ids.add(nid)

            if new_notes:
                timeline.add_event(
                    event_type=EventType.NOTE_ADD,
                    description=f"导入 {len(new_notes)} 条口头备注",
                    details={"count": len(new_notes), "notes": note_contents},
                    related_note_ids=note_ids,
                    operator="user",
                )

        if parse_result.param_versions:
            existing_versions = {v.version for v in param_table.versions}
            new_versions = []
            for p in parse_result.param_versions:
                vname = p.get("version", "unknown")
                if vname not in existing_versions:
                    version = ParameterVersion(
                        version=vname,
                        description=p.get("description", ""),
                        params=p.get("params", {}),
                        is_active=p.get("is_active", False),
                    )
                    param_table.add_version(version)
                    new_versions.append(version)
                    existing_versions.add(vname)
                elif p.get("is_active"):
                    param_table.activate_version(vname)

            if new_versions:
                timeline.add_event(
                    event_type=EventType.PARAM_VERSION_CHANGE,
                    description=f"导入 {len(new_versions)} 个参数表版本",
                    details={"count": len(new_versions)},
                    operator="user",
                )

        formatter.print_recall_records([r.to_dict() for r in recall_records])
        formatter.print_verbal_notes([n.to_dict() for n in verbal_notes])
        formatter.print_param_versions([v.to_dict() for v in param_table.versions])

        all_recalled_ids = {r.original_row_id for r in recall_records if r.is_effective}
        filtered_edges = [
            e for e in parse_result.graph_data["edges"]
            if e.get("row_id") not in all_recalled_ids
        ]
        recall_applied = len(parse_result.graph_data["edges"]) - len(filtered_edges)

        filtered_graph_data = {
            "nodes": parse_result.graph_data["nodes"],
            "edges": filtered_edges,
        }

        calculator = GraphPathCalculator()
        validation = calculator.load_graph(filtered_graph_data)

        if recall_applied > 0:
            validation.add_warning(
                "recall_applied",
                f"已应用 {recall_applied} 条撤回记录，对应边已排除"
            )
            validation.details["recall_applied_count"] = recall_applied

        formatter.print_validation_result(validation)

        if args.source and args.target:
            result = calculator.shortest_path(args.source, args.target)
            formatter.print_path_result(args.source, args.target, result)

            result_summary = (
                f"路径: {' -> '.join(result.path) if result.path else '无路径'}, "
                f"距离: {result.distance} {result.unit}"
            )

            calc_event = timeline.add_event(
                event_type=EventType.CALCULATION_RUN,
                description=f"计算最短路径: {args.source} -> {args.target}",
                details={
                    "source": args.source,
                    "target": args.target,
                    "result_summary": result_summary,
                    "result": result.to_dict(),
                    "parse_stats": {
                        "total_rows": parse_result.total_rows,
                        "processed": parse_result.processed_count,
                        "bad_rows": parse_result.bad_row_count,
                        "skipped": parse_result.skipped_count,
                        "missing_unit": parse_result.missing_unit_count,
                        "recalled": parse_result.recalled_count,
                    },
                },
                operator="user",
            )

            result_id = calc_event.event_id
            persistence.save_calculation_result(
                {
                    "result": result.to_dict(),
                    "parse_result": parse_result.to_dict(),
                    "validation": {
                        "is_valid": validation.is_valid,
                        "issues": validation.issues,
                        "warnings": validation.warnings,
                        "details": validation.details,
                    },
                },
                result_id,
            )
        elif validation.is_valid:
            print()
            formatter.print_section("图统计信息")
            stats = calculator.get_statistics()
            formatter.print_stat("总节点数", stats["total_nodes"])
            formatter.print_stat("总边数", stats["total_edges"])
            formatter.print_stat("有效边数", stats["valid_edges"])
            formatter.print_stat("单位缺失边数", stats["missing_unit_edges"])

    persistence.save_state(timeline, param_table, recall_records, verbal_notes, "latest")
    persistence.save_timeline_snapshot(timeline, f"snapshot_{int(datetime.now().timestamp())}")

    print()
    formatter.print_section("影响结论的因素分析")
    factors = []

    effective_recall_count = sum(1 for r in recall_records if r.is_effective)
    if effective_recall_count > 0:
        factors.append(f"撤回记录 ({effective_recall_count} 条) - 影响数据范围，已排除对应边")

    old_param_count = sum(1 for v in param_table.versions if not v.is_active)
    if old_param_count > 0:
        factors.append(f"旧版参数表 ({old_param_count} 条) - 不影响当前计算")

    if len(verbal_notes) > 0:
        factors.append(f"口头备注 ({len(verbal_notes)} 条) - 辅助说明，不影响计算")

    if parse_result.missing_unit_count > 0:
        factors.append(f"单位缺失 ({parse_result.missing_unit_count} 行) - 已单独拎出，不参与正常统计")

    if parse_result.bad_row_count > 0:
        factors.append(f"坏行 ({parse_result.bad_row_count} 行) - 已排除")

    if parse_result.skipped_count > 0:
        factors.append(f"跳过行 ({parse_result.skipped_count} 行) - 未知类型，已忽略")

    if factors:
        for f in factors:
            print(f"  - {f}")
    else:
        print("  无特殊影响因素")

    print()
    print("  数据已持久化保存，服务重启后可恢复历史时间线")


def timeline_command(args):
    formatter = CLIFormatter()
    data_dir = getattr(args, "data_dir", "./data")
    persistence = PersistenceManager(data_dir)

    recovered = persistence.service_restart_recover()
    if not recovered["recovered"]:
        print("暂无历史记录")
        return

    state = recovered["state"]
    timeline = HistoryTimeline.from_dict(state["timeline"])

    if args.search:
        formatter.print_header(f"历史时间线 - 搜索: {args.search}")
        events = timeline.search_by_note_keyword(args.search)
        if events:
            for i, event in enumerate(events, 1):
                formatter.print_timeline_event(event, i)
        else:
            print("  未找到匹配的记录")
    elif args.conclusions:
        formatter.print_header("结论变更时间线")
        calc_events = timeline.get_events_by_type(EventType.CALCULATION_RUN)
        if calc_events:
            for i, event in enumerate(calc_events, 1):
                formatter.print_timeline_event(event, i)
                if "result_summary" in event.details:
                    print(f"     结论摘要: {event.details['result_summary']}")
        else:
            print("  暂无计算结论")
    else:
        formatter.print_timeline(timeline)


def recall_command(args):
    formatter = CLIFormatter()
    data_dir = getattr(args, "data_dir", "./data")
    persistence = PersistenceManager(data_dir)

    recovered = persistence.service_restart_recover()
    state = recovered["state"] if recovered["recovered"] else None

    timeline = HistoryTimeline.from_dict(state["timeline"]) if state else HistoryTimeline()
    param_table = ParameterTable.from_dict(state["param_table"]) if state else ParameterTable()
    recall_records = [RecallRecord.from_dict(r) for r in state.get("recall_records", [])] if state else []
    verbal_notes = [VerbalNote.from_dict(n) for n in state.get("verbal_notes", [])] if state else []

    if state:
        timeline.add_event(
            event_type=EventType.SERVICE_RESTART,
            description="服务重启，已恢复历史状态",
            details={"recovered_from": "latest_state"},
            operator="system",
        )

    if args.add:
        recall = RecallRecord(
            record_id=f"recall_{int(datetime.now().timestamp())}",
            original_row_id=args.original_id or "",
            reason=args.reason or "人工撤回",
            recalled_by=args.author or "user",
            note=args.note,
        )
        recall_records.append(recall)

        timeline.add_event(
            event_type=EventType.RECALL_ADD,
            description=f"添加撤回记录: {recall.record_id}",
            details={
                "original_row_id": recall.original_row_id,
                "reason": recall.reason,
            },
            operator=args.author or "user",
        )

        persistence.save_state(timeline, param_table, recall_records, verbal_notes, "latest")
        print(f"已添加撤回记录: {recall.record_id}")
    elif args.list:
        formatter.print_header("撤回记录列表")
        if recall_records:
            for i, r in enumerate(recall_records, 1):
                print(f"  {i}. {r.record_id}")
                print(f"     原记录: {r.original_row_id}")
                print(f"     原因: {r.reason}")
                print(f"     操作人: {r.recalled_by}")
                print(f"     时间: {r.recalled_at.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            print("  暂无撤回记录")


def main():
    parser = argparse.ArgumentParser(
        description="图论路径图表解释 - 灰度发布版",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s calc --input data/sample.json --source A --target D
  %(prog)s timeline
  %(prog)s timeline --search "备注关键词"
  %(prog)s timeline --conclusions
  %(prog)s recall --add --original-id edge_003 --reason "数据有误" --author "老叶"
        """,
    )

    parser.add_argument("--data-dir", default="./data", help="数据目录 (默认: ./data)")

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    calc_parser = subparsers.add_parser("calc", help="执行图论路径计算")
    calc_parser.add_argument("--input", "-i", required=True, help="输入数据文件 (JSON/JSONL)")
    calc_parser.add_argument("--source", "-s", help="起点节点")
    calc_parser.add_argument("--target", "-t", help="终点节点")

    timeline_parser = subparsers.add_parser("timeline", help="查看历史时间线")
    timeline_parser.add_argument("--search", help="按关键词搜索备注和事件")
    timeline_parser.add_argument("--conclusions", action="store_true", help="只看结论变更")

    recall_parser = subparsers.add_parser("recall", help="管理撤回记录")
    recall_parser.add_argument("--add", action="store_true", help="添加撤回记录")
    recall_parser.add_argument("--list", action="store_true", help="列出撤回记录")
    recall_parser.add_argument("--original-id", help="原记录ID")
    recall_parser.add_argument("--reason", help="撤回原因")
    recall_parser.add_argument("--author", help="操作人")
    recall_parser.add_argument("--note", help="附加说明")

    args = parser.parse_args()

    if args.command == "calc":
        run_calculation_command(args)
    elif args.command == "timeline":
        timeline_command(args)
    elif args.command == "recall":
        recall_command(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
