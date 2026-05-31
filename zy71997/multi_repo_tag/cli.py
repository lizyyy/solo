from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .exporter import LedgerExporter
from .models import ServiceError
from .service import MultiRepoTagService


def cmd_import_repo(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        repo = svc.import_repo(args.path, name=args.name)
        print(f"OK 仓库已导入: {repo.name} ({repo.path})")
        print(f"   状态: {repo.status.value} | 分支: {repo.git_branch} | HEAD: {repo.git_head_short}")
        if repo.error_detail:
            print(f"   异常: {repo.error_detail}")
    except ServiceError as e:
        print(f"ERROR [{e.code}] {e.message}", file=sys.stderr)
        sys.exit(1)
    finally:
        svc.close()


def cmd_import_order(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        if args.file:
            data = json.loads(Path(args.file).read_text(encoding="utf-8"))
            order_id = data.get("order_id", args.order_id)
            entries = data.get("entries", [])
        else:
            order_id = args.order_id
            entries = json.loads(args.entries)

        result = svc.import_change_order(order_id, entries, args.operator)
        print(f"OK 变更单 {result.change_order.order_id} v{result.change_order.version}")
        if result.is_reupload:
            if result.warning:
                print(f"WARNING: {result.warning}")
            if result.diff:
                print(f"  差异ID: {result.diff.id}")
                print(f"  v{result.diff.old_version} -> v{result.diff.new_version}")
                if result.diff.added_entries:
                    print(f"  新增: {', '.join(e.repo_path for e in result.diff.added_entries)}")
                if result.diff.removed_entries:
                    print(f"  移除: {', '.join(e.repo_path for e in result.diff.removed_entries)}")
                if result.diff.modified_entries:
                    for old, new in result.diff.modified_entries:
                        print(f"  变更: {new.repo_path}: {old.tag_name} -> {new.tag_name}")
        print(f"  共 {len(result.change_order.entries)} 条记录")
    except ServiceError as e:
        print(f"ERROR [{e.code}] {e.message}", file=sys.stderr)
        sys.exit(1)
    finally:
        svc.close()


def cmd_apply_tag(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        if args.order_id:
            tags = svc.apply_tags_from_order(args.order_id, operator=args.operator)
            print(f"OK 变更单 {args.order_id} 打标签完成，共 {len(tags)} 个")
            for t in tags:
                print(f"  {t.tag_name} (id={t.id})")
        else:
            tag = svc.apply_tag(args.repo_id, args.tag_name, args.message)
            print(f"OK 标签已创建: {tag.tag_name} (id={tag.id})")
    except ServiceError as e:
        print(f"ERROR [{e.code}] {e.message}", file=sys.stderr)
        if e.detail:
            print(f"  详情: {e.detail}", file=sys.stderr)
        sys.exit(1)
    finally:
        svc.close()


def cmd_review(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        data = svc.review_tags(repo_id=args.repo_id)
        for r in data:
            status_mark = {"ready": "[OK]", "tagged": "[TAG]", "needs_review": "[!!]", "path_missing": "[XX]", "not_git_repo": "[??]"}.get(r["status"], "[??]")
            print(f"{status_mark} {r['repo_name']} ({r['repo_path']})")
            print(f"    状态: {r['status']} | 当前标签: {r['current_tag'] or '无'} | 分支: {r['git_branch'] or '?'} | HEAD: {r['git_head_short'] or '?'}")
            if r["error_detail"]:
                print(f"    异常: {r['error_detail']}")
            for t in r["tags"]:
                confirmed = "已确认" if t["confirmed"] else "待确认"
                superseded = " (已废弃)" if t["superseded_by"] else ""
                print(f"    - {t['tag_name']} [{confirmed}]{superseded} 操作人: {t['operator']}")
    finally:
        svc.close()


def cmd_confirm(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        if args.all and args.repo_id:
            confirmed = svc.confirm_all_tags(args.repo_id)
            print(f"OK 已确认 {len(confirmed)} 个标签")
        else:
            tag = svc.confirm_tag(args.tag_id)
            print(f"OK 标签 {tag.tag_name} 已确认")
    except ServiceError as e:
        print(f"ERROR [{e.code}] {e.message}", file=sys.stderr)
        sys.exit(1)
    finally:
        svc.close()


def cmd_correct(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        tag = svc.correct_tag(args.repo_id, args.old_tag, args.new_tag, args.reason)
        print(f"OK 标签已修正: {args.old_tag} -> {tag.tag_name}")
    except ServiceError as e:
        print(f"ERROR [{e.code}] {e.message}", file=sys.stderr)
        if e.detail:
            print(f"  详情: {e.detail}", file=sys.stderr)
        sys.exit(1)
    finally:
        svc.close()


def cmd_diffs(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        if args.acknowledge:
            diff = svc.acknowledge_diff(args.acknowledge, args.operator)
            print(f"OK 差异 {diff.id} 已确认 (变更单 {diff.order_id} v{diff.old_version}->v{diff.new_version})")
        else:
            diffs = svc.get_unacknowledged_diffs()
            if not diffs:
                print("无未确认的变更差异")
            for d in diffs:
                print(f"!! 变更单 {d.order_id}: v{d.old_version} -> v{d.new_version} (id={d.id})")
                for e in d.added_entries:
                    print(f"   + 新增: {e.repo_path} = {e.tag_name}")
                for e in d.removed_entries:
                    print(f"   - 移除: {e.repo_path} = {e.tag_name}")
                for old, new in d.modified_entries:
                    print(f"   ~ 变更: {new.repo_path}: {old.tag_name} -> {new.tag_name}")
    except ServiceError as e:
        print(f"ERROR [{e.code}] {e.message}", file=sys.stderr)
        sys.exit(1)
    finally:
        svc.close()


def cmd_ledger(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        exporter = LedgerExporter(svc.store)
        if args.handoff:
            content = exporter.export_handoff_report()
        elif args.format == "json":
            content = exporter.export_json(since=args.since, until=args.until)
        else:
            content = exporter.export_text(since=args.since, until=args.until)

        if args.output:
            path = exporter.write_to_file(content, args.output)
            print(f"OK 已导出到: {path}")
        else:
            print(content)
    finally:
        svc.close()


def cmd_history(args):
    svc = MultiRepoTagService(db_path=args.db, operator=args.operator)
    try:
        versions = svc.get_order_history(args.order_id)
        if not versions:
            print(f"变更单 {args.order_id} 无历史版本")
            return
        for v in versions:
            superseded = " (已废弃)" if v.superseded else " (当前)"
            print(f"v{v.version}{superseded} | hash={v.content_hash} | 操作人: {v.operator} | 时间: {v.uploaded_at}")
            for e in v.entries:
                print(f"  {e.repo_path} = {e.tag_name} ({e.description})")
    finally:
        svc.close()


def main():
    parser = argparse.ArgumentParser(prog="multi-repo-tag", description="多仓库版本标记")
    parser.add_argument("--db", default="multi_repo_tag.db", help="数据库路径")
    parser.add_argument("--operator", default="", help="操作人")

    sub = parser.add_subparsers(dest="command", help="子命令")

    p_import = sub.add_parser("import-repo", help="导入仓库")
    p_import.add_argument("path", help="仓库路径(支持空格)")
    p_import.add_argument("--name", help="仓库名称")

    p_order = sub.add_parser("import-order", help="导入变更单")
    p_order.add_argument("order_id", help="变更单ID")
    p_order.add_argument("--entries", help="变更条目JSON")
    p_order.add_argument("--file", "-f", help="变更单文件路径")

    p_apply = sub.add_parser("apply", help="打标签")
    p_apply.add_argument("--repo-id", help="仓库ID")
    p_apply.add_argument("--tag-name", help="标签名")
    p_apply.add_argument("--message", default="", help="标签消息")
    p_apply.add_argument("--order-id", help="变更单ID(批量)")

    p_review = sub.add_parser("review", help="复核状态")
    p_review.add_argument("--repo-id", help="指定仓库ID")

    p_confirm = sub.add_parser("confirm", help="确认标签")
    p_confirm.add_argument("--tag-id", help="标签ID")
    p_confirm.add_argument("--repo-id", help="仓库ID(配合--all)")
    p_confirm.add_argument("--all", action="store_true", help="确认仓库所有标签")

    p_correct = sub.add_parser("correct", help="修正标签")
    p_correct.add_argument("--repo-id", required=True, help="仓库ID")
    p_correct.add_argument("--old-tag", required=True, help="原标签名")
    p_correct.add_argument("--new-tag", required=True, help="新标签名")
    p_correct.add_argument("--reason", default="", help="修正原因")

    p_diffs = sub.add_parser("diffs", help="查看/确认变更差异")
    p_diffs.add_argument("--acknowledge", help="确认差异ID")

    p_ledger = sub.add_parser("ledger", help="查看/导出运行账本")
    p_ledger.add_argument("--format", choices=["text", "json"], default="text")
    p_ledger.add_argument("--output", "-o", help="输出文件路径")
    p_ledger.add_argument("--handoff", action="store_true", help="导出交接报告")
    p_ledger.add_argument("--since", help="起始时间 ISO格式")
    p_ledger.add_argument("--until", help="截止时间 ISO格式")

    p_history = sub.add_parser("history", help="变更单历史版本")
    p_history.add_argument("order_id", help="变更单ID")

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return

    commands = {
        "import-repo": cmd_import_repo,
        "import-order": cmd_import_order,
        "apply": cmd_apply_tag,
        "review": cmd_review,
        "confirm": cmd_confirm,
        "correct": cmd_correct,
        "diffs": cmd_diffs,
        "ledger": cmd_ledger,
        "history": cmd_history,
    }
    cmd_fn = commands.get(args.command)
    if cmd_fn:
        cmd_fn(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
