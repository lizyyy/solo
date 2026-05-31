#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cs_knowledge_hit.importer import Importer
from cs_knowledge_hit.analyzer import Analyzer
from cs_knowledge_hit.reviewer import Reviewer
from cs_knowledge_hit.history import HistoryStore
from cs_knowledge_hit.exporter import Exporter
from cs_knowledge_hit.report_generator import ReportGenerator
from cs_knowledge_hit.errors import get_error


def cmd_import(args):
    importer = Importer()
    conv_result = importer.import_conversations(args.conversations)
    print(conv_result.summary)
    for w in conv_result.warnings:
        print(f"  ⚠ {w}")
    for e in conv_result.errors:
        print(f"  ✗ {e}")

    kb_result = importer.import_knowledge_base(args.knowledge_base)
    print(kb_result.summary)
    for w in kb_result.warnings:
        print(f"  ⚠ {w}")
    for e in kb_result.errors:
        print(f"  ✗ {e}")

    if conv_result.has_errors and kb_result.has_errors:
        print("\n导入失败，请检查文件后重试。")
        return

    import_data = {
        "conversations": [
            {
                "id": c.id, "timestamp": c.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "customer_id": c.customer_id, "agent_id": c.agent_id,
                "messages": [{"role": m.role, "content": m.content} for m in c.messages],
                "source": c.source.value, "manual_label": c.manual_label,
            }
            for c in conv_result.conversations
        ],
        "knowledge_items": [
            {
                "id": k.id, "title": k.title, "content": k.content,
                "keywords": k.keywords, "category": k.category, "active": k.active,
            }
            for k in kb_result.knowledge_items
        ],
    }

    cache_path = args.cache or "output/.last_import.json"
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(import_data, f, ensure_ascii=False)
    print(f"\n导入数据已缓存到 {cache_path}")


def cmd_analyze(args):
    cache_path = args.cache or "output/.last_import.json"
    if not os.path.exists(cache_path):
        print("还没有导入数据，请先运行 import 命令。")
        return

    with open(cache_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    from cs_knowledge_hit.models import Conversation, KnowledgeItem, Message, ConversationSource
    conversations = []
    for c in data["conversations"]:
        messages = [Message(role=m["role"], content=m["content"]) for m in c.get("messages", [])]
        conversations.append(Conversation(
            id=c["id"],
            timestamp=datetime.strptime(c["timestamp"], "%Y-%m-%d %H:%M:%S"),
            customer_id=c["customer_id"], agent_id=c["agent_id"],
            messages=messages,
            source=ConversationSource(c.get("source", "normal")),
            manual_label=c.get("manual_label"),
        ))

    knowledge_items = []
    for k in data["knowledge_items"]:
        knowledge_items.append(KnowledgeItem(
            id=k["id"], title=k["title"], content=k["content"],
            keywords=k.get("keywords", []), category=k.get("category", ""),
            active=k.get("active", True),
        ))

    history = HistoryStore(args.db or "output/history.db")
    previous_overrides = history.load_latest_overrides()

    analyzer = Analyzer(knowledge_items, previous_overrides)
    result = analyzer.analyze(conversations)

    print(f"\n分析完成：共 {result.stats['total']} 条")
    print(f"  精确命中：{result.stats['exact']}")
    print(f"  部分命中：{result.stats['partial']}")
    print(f"  未命中：{result.stats['miss']}")
    print(f"  重复改判：{result.stats['duplicate']}")
    print(f"  边界情况：{result.stats['boundary']}")
    print(f"  待复核：{result.stats['pending_review']}")
    print(f"  低置信度：{result.stats['low_confidence']}")

    if result.warnings:
        print(f"\n提示（{len(result.warnings)} 条）：")
        for w in result.warnings[:10]:
            print(f"  ⚠ [{w.conversation_id or '全局'}] {w.message}")
        if len(result.warnings) > 10:
            print(f"  ... 还有 {len(result.warnings) - 10} 条提示")

    operator = args.operator or os.environ.get("USER", "unknown")
    session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    from cs_knowledge_hit.models import ReviewSession
    session = ReviewSession(
        id=session_id,
        created_at=datetime.now(),
        operator=operator,
        total_count=result.stats["total"],
        pending_count=result.stats["pending_review"],
    )
    history.save_session(session)
    history.save_hits(result.hits, session_id)
    print(f"\n已保存到批次 {session_id}")

    report_gen = ReportGenerator()
    report_gen.set_data(conversations, knowledge_items)

    report_path = args.output or f"output/report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    report_gen.generate(result.hits, result.warnings, result.stats, session, report_path)
    print(f"报告已生成：{report_path}")

    analyze_cache = {
        "session_id": session_id,
        "hits": Reviewer.hits_to_dicts(result.hits),
        "stats": result.stats,
    }
    analyze_cache_path = "output/.last_analysis.json"
    with open(analyze_cache_path, "w", encoding="utf-8") as f:
        json.dump(analyze_cache, f, ensure_ascii=False)


def cmd_review(args):
    analyze_cache_path = "output/.last_analysis.json"
    if not os.path.exists(analyze_cache_path):
        print("还没有分析结果，请先运行 analyze 命令。")
        return

    with open(analyze_cache_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    session_id = data.get("session_id", "")
    hits = Reviewer.dicts_to_hits(data.get("hits", []))

    operator = args.operator or os.environ.get("USER", "unknown")
    reviewer_obj = Reviewer(operator)

    if args.action == "list-pending":
        pending = reviewer_obj.get_pending_hits(hits)
        if not pending:
            print("当前没有待复核的条目。")
            return
        print(f"待复核条目（{len(pending)} 条）：")
        for h in pending:
            print(f"  {h.conversation_id}  {h.hit_type.value}  置信度={h.confidence:.0%}  {h.detail[:40]}")

    elif args.action == "confirm":
        if not args.ids:
            print("请指定要确认的对话ID，用逗号分隔。")
            return
        ids = [i.strip() for i in args.ids.split(",")]
        target_hits = [h for h in hits if h.conversation_id in ids and h.status.value == "pending_review"]
        if not target_hits:
            print("没有找到匹配的待复核条目。")
            return
        for h in target_hits:
            reviewer_obj.review_hit(h, "confirm", note=args.note or "", session_id=session_id)
            print(f"  ✓ 已确认 {h.conversation_id}")

    elif args.action == "override":
        if not args.ids:
            print("请指定要改判的对话ID。")
            return
        ids = [i.strip() for i in args.ids.split(",")]
        from cs_knowledge_hit.models import HitType
        new_type = HitType(args.new_type) if args.new_type else None

        target_hits = [h for h in hits if h.conversation_id in ids]
        if not target_hits:
            print("没有找到匹配的条目。")
            return
        for h in target_hits:
            reviewer_obj.review_hit(h, "override", note=args.note or "",
                                    new_knowledge_id=args.new_kb_id, new_hit_type=new_type,
                                    session_id=session_id)
            print(f"  ✓ 已改判 {h.conversation_id} → {h.hit_type.value}")

    elif args.action == "batch-confirm":
        pending = reviewer_obj.get_pending_hits(hits)
        if not pending:
            print("没有待复核条目。")
            return
        confirmed = reviewer_obj.batch_review(pending, "confirm", note=args.note or "批量确认", session_id=session_id)
        print(f"已批量确认 {len(confirmed)} 条。")

    else:
        print(f"未知操作「{args.action}」，可选：list-pending / confirm / override / batch-confirm")
        return

    history = HistoryStore(args.db or "output/history.db")
    history.save_hits(hits, session_id)

    data["hits"] = Reviewer.hits_to_dicts(hits)
    with open(analyze_cache_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    cache_path = "output/.last_import.json"
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            import_data = json.load(f)
        from cs_knowledge_hit.models import Conversation, KnowledgeItem, Message, ConversationSource
        conversations = []
        for c in import_data["conversations"]:
            messages = [Message(role=m["role"], content=m["content"]) for m in c.get("messages", [])]
            conversations.append(Conversation(
                id=c["id"],
                timestamp=datetime.strptime(c["timestamp"], "%Y-%m-%d %H:%M:%S"),
                customer_id=c["customer_id"], agent_id=c["agent_id"],
                messages=messages,
                source=ConversationSource(c.get("source", "normal")),
                manual_label=c.get("manual_label"),
            ))
        knowledge_items = [
            KnowledgeItem(id=k["id"], title=k["title"], content=k["content"],
                          keywords=k.get("keywords", []), category=k.get("category", ""),
                          active=k.get("active", True))
            for k in import_data["knowledge_items"]
        ]

        stats = data.get("stats", {})
        report_gen = ReportGenerator()
        report_gen.set_data(conversations, knowledge_items)
        report_path = f"output/report_reviewed_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        session_obj = history.load_session(session_id)
        report_gen.generate(hits, [], stats, session_obj, report_path)
        print(f"更新后的报告：{report_path}")


def cmd_history(args):
    history = HistoryStore(args.db or "output/history.db")
    sessions = history.list_sessions(limit=args.limit or 20)

    if not sessions:
        print("暂无历史记录。")
        return

    print(f"历史批次（最近 {len(sessions)} 个）：")
    print(f"{'批次ID':<30} {'创建时间':<20} {'操作人':<12} {'已复核':<8} {'待复核':<8}")
    print("-" * 80)
    for s in sessions:
        print(f"{s.id:<30} {s.created_at.strftime('%Y-%m-%d %H:%M'):<20} {s.operator:<12} {s.reviewed_count:<8} {s.pending_count:<8}")

    if args.session_id:
        hits = history.load_hits_by_session(args.session_id)
        if not hits:
            print(f"\n批次 {args.session_id} 没有命中记录。")
            return
        print(f"\n批次 {args.session_id} 命中记录（{len(hits)} 条）：")
        for h in hits[:20]:
            print(f"  {h.conversation_id}  {h.hit_type.value}  {h.status.value}  {h.detail[:30]}")
        if len(hits) > 20:
            print(f"  ... 共 {len(hits)} 条")


def cmd_export(args):
    history = HistoryStore(args.db or "output/history.db")

    session_id = args.session_id
    if session_id:
        hits = history.load_hits_by_session(session_id)
    else:
        analyze_cache_path = "output/.last_analysis.json"
        if os.path.exists(analyze_cache_path):
            with open(analyze_cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            session_id = data.get("session_id", "")
            hits = Reviewer.dicts_to_hits(data.get("hits", []))
        else:
            hits = history.load_hits_for_export()

    if not hits:
        print("没有可导出的数据，请先完成分析。")
        return

    session_obj = history.load_session(session_id) if session_id else None

    exporter = Exporter()
    fmt = args.format or "csv"
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    if fmt == "csv":
        output_path = args.output or f"output/质检周报_{ts}.csv"
        exporter.export_weekly_report_csv(hits, session_obj, output_path)
    else:
        output_path = args.output or f"output/质检周报_{ts}.json"
        exporter.export_weekly_report_json(hits, session_obj, output_path)

    print(f"已导出到 {output_path}")


def cmd_report(args):
    cache_path = args.cache or "output/.last_import.json"
    analyze_cache_path = "output/.last_analysis.json"

    if not os.path.exists(cache_path) or not os.path.exists(analyze_cache_path):
        print("请先运行 import 和 analyze 命令。")
        return

    with open(cache_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    with open(analyze_cache_path, "r", encoding="utf-8") as f:
        analyze_data = json.load(f)

    from cs_knowledge_hit.models import Conversation, KnowledgeItem, Message, ConversationSource
    conversations = []
    for c in data["conversations"]:
        messages = [Message(role=m["role"], content=m["content"]) for m in c.get("messages", [])]
        conversations.append(Conversation(
            id=c["id"],
            timestamp=datetime.strptime(c["timestamp"], "%Y-%m-%d %H:%M:%S"),
            customer_id=c["customer_id"], agent_id=c["agent_id"],
            messages=messages,
            source=ConversationSource(c.get("source", "normal")),
            manual_label=c.get("manual_label"),
        ))
    knowledge_items = [
        KnowledgeItem(id=k["id"], title=k["title"], content=k["content"],
                      keywords=k.get("keywords", []), category=k.get("category", ""),
                      active=k.get("active", True))
        for k in data["knowledge_items"]
    ]

    hits = Reviewer.dicts_to_hits(analyze_data.get("hits", []))
    stats = analyze_data.get("stats", {})
    session_id = analyze_data.get("session_id", "")

    history = HistoryStore(args.db or "output/history.db")
    session_obj = history.load_session(session_id) if session_id else None

    report_gen = ReportGenerator()
    report_gen.set_data(conversations, knowledge_items)

    report_path = args.output or f"output/report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    report_gen.generate(hits, [], stats, session_obj, report_path)
    print(f"报告已生成：{report_path}")


def cmd_run(args):
    print("=" * 60)
    print("客服知识命中 - 一键全流程")
    print("=" * 60)

    conv_file = args.conversations or "data/conversations/sample_conversations.json"
    kb_file = args.knowledge_base or "data/knowledge_base/sample_knowledge_base.json"

    print("\n[1/5] 导入数据...")
    importer = Importer()
    conv_result = importer.import_conversations(conv_file)
    kb_result = importer.import_knowledge_base(kb_file)
    print(f"  对话：{conv_result.summary}")
    print(f"  知识库：{kb_result.summary}")
    for w in conv_result.warnings + kb_result.warnings:
        print(f"  ⚠ {w}")
    for e in conv_result.errors + kb_result.errors:
        print(f"  ✗ {e}")

    if conv_result.has_errors or kb_result.has_errors:
        print("\n导入环节有问题，已停止。")
        return

    from cs_knowledge_hit.models import Conversation, KnowledgeItem, Message, ConversationSource, ReviewSession
    conversations = conv_result.conversations
    knowledge_items = kb_result.knowledge_items

    print(f"\n[2/5] 分析命中...")
    history = HistoryStore(args.db or "output/history.db")
    previous_overrides = history.load_latest_overrides()

    analyzer = Analyzer(knowledge_items, previous_overrides)
    result = analyzer.analyze(conversations)

    print(f"  共 {result.stats['total']} 条")
    print(f"  精确命中：{result.stats['exact']}  部分命中：{result.stats['partial']}")
    print(f"  未命中：{result.stats['miss']}  重复改判：{result.stats['duplicate']}")
    print(f"  边界情况：{result.stats['boundary']}  待复核：{result.stats['pending_review']}")

    if result.warnings:
        print(f"\n  提示（{len(result.warnings)} 条，显示前5条）：")
        for w in result.warnings[:5]:
            print(f"    ⚠ [{w.conversation_id or '全局'}] {w.message}")

    operator = args.operator or os.environ.get("USER", "unknown")
    session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    session = ReviewSession(
        id=session_id, created_at=datetime.now(), operator=operator,
        total_count=result.stats["total"], pending_count=result.stats["pending_review"],
    )

    print(f"\n[3/5] 保存历史...")
    history.save_session(session)
    history.save_hits(result.hits, session_id)
    print(f"  批次 {session_id}")

    import_data = {
        "conversations": [
            {
                "id": c.id, "timestamp": c.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "customer_id": c.customer_id, "agent_id": c.agent_id,
                "messages": [{"role": m.role, "content": m.content} for m in c.messages],
                "source": c.source.value, "manual_label": c.manual_label,
            }
            for c in conversations
        ],
        "knowledge_items": [
            {
                "id": k.id, "title": k.title, "content": k.content,
                "keywords": k.keywords, "category": k.category, "active": k.active,
            }
            for k in knowledge_items
        ],
    }
    with open("output/.last_import.json", "w", encoding="utf-8") as f:
        json.dump(import_data, f, ensure_ascii=False)
    with open("output/.last_analysis.json", "w", encoding="utf-8") as f:
        json.dump({"session_id": session_id, "hits": Reviewer.hits_to_dicts(result.hits), "stats": result.stats}, f, ensure_ascii=False)

    print(f"\n[4/5] 生成HTML报告...")
    report_gen = ReportGenerator()
    report_gen.set_data(conversations, knowledge_items)
    report_path = f"output/report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    report_gen.generate(result.hits, result.warnings, result.stats, session, report_path)
    print(f"  {report_path}")

    print(f"\n[5/5] 导出质检周报...")
    exporter = Exporter()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = f"output/质检周报_{ts}.csv"
    json_path = f"output/质检周报_{ts}.json"
    exporter.export_weekly_report_csv(result.hits, session, csv_path)
    exporter.export_weekly_report_json(result.hits, session, json_path)
    print(f"  {csv_path}")
    print(f"  {json_path}")

    print(f"\n{'=' * 60}")
    print(f"全部完成！批次号：{session_id}")
    print(f"请用浏览器打开报告进行复核：{report_path}")
    print(f"复核完成后用 run.py review 命令提交改判结果")
    print(f"导出周报用 run.py export 命令")
    print(f"{'=' * 60}")


def main():
    parser = argparse.ArgumentParser(
        description="客服知识命中 - 分析与质检工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例：
  一键全流程：  python run.py run
  分步执行：    python run.py import -c data/conversations/xxx.json -k data/knowledge_base/xxx.json
               python run.py analyze
               python run.py review list-pending
               python run.py review confirm --ids conv_001,conv_002 --note "已确认"
               python run.py review override --ids conv_007 --new-type miss --note "知识库缺少此内容"
               python run.py export --format csv
               python run.py history
        """,
    )
    parser.add_argument("--db", help="历史数据库路径（默认 output/history.db）")
    parser.add_argument("--operator", help="操作人姓名（默认取系统用户名）")

    sub = parser.add_subparsers(dest="command")

    p_import = sub.add_parser("import", help="导入对话和知识库数据")
    p_import.add_argument("-c", "--conversations", required=True, help="对话记录文件路径（CSV或JSON）")
    p_import.add_argument("-k", "--knowledge-base", required=True, help="知识库文件路径（CSV或JSON）")
    p_import.add_argument("--cache", help="导入缓存路径（默认 output/.last_import.json）")

    p_analyze = sub.add_parser("analyze", help="分析知识命中")
    p_analyze.add_argument("--cache", help="导入缓存路径")
    p_analyze.add_argument("-o", "--output", help="HTML报告输出路径")
    p_analyze.add_argument("--operator", help="操作人")

    p_review = sub.add_parser("review", help="复核与改判")
    p_review.add_argument("action", help="操作：list-pending / confirm / override / batch-confirm")
    p_review.add_argument("--ids", help="对话ID，多个用逗号分隔")
    p_review.add_argument("--note", help="备注")
    p_review.add_argument("--new-type", help="改判后的命中类型（exact/partial/miss/boundary）")
    p_review.add_argument("--new-kb-id", help="改判后关联的知识ID")

    p_history = sub.add_parser("history", help="查看历史记录")
    p_history.add_argument("--session-id", help="查看指定批次的详情")
    p_history.add_argument("--limit", type=int, default=20, help="显示条数")

    p_export = sub.add_parser("export", help="导出质检周报")
    p_export.add_argument("--format", choices=["csv", "json"], default="csv", help="导出格式")
    p_export.add_argument("--session-id", help="指定导出批次")
    p_export.add_argument("-o", "--output", help="输出文件路径")

    p_report = sub.add_parser("report", help="重新生成HTML报告")
    p_report.add_argument("--cache", help="导入缓存路径")
    p_report.add_argument("-o", "--output", help="输出路径")

    p_run = sub.add_parser("run", help="一键全流程（导入→分析→历史→报告→导出）")
    p_run.add_argument("-c", "--conversations", help="对话记录文件路径")
    p_run.add_argument("-k", "--knowledge-base", help="知识库文件路径")
    p_run.add_argument("-o", "--output", help="报告输出路径")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    commands = {
        "import": cmd_import,
        "analyze": cmd_analyze,
        "review": cmd_review,
        "history": cmd_history,
        "export": cmd_export,
        "report": cmd_report,
        "run": cmd_run,
    }

    try:
        commands[args.command](args)
    except Exception as e:
        print(f"\n出错了：{get_error('GENERAL', detail=str(e))}")
        if os.environ.get("CS_DEBUG"):
            raise


if __name__ == "__main__":
    main()
