import click
import json
import csv
import os
from tabulate import tabulate
from db import init_db, DB_PATH
from core import (
    import_complaints, lao_ma_review_photo, inspector_resolve_alias,
    generate_daily_summary, get_single_source, get_audit_log,
    add_community_alias, get_alias_list, rollback_record_field, ALIAS_RULES,
    rollback_last_operation, build_export_package, seed_default_aliases,
    get_alias_list, DEFAULT_COMMUNITY_ALIASES
)


@click.group()
def cli():
    """医院急诊入口疏导 - 居民投诉处理系统"""
    init_db()


@cli.command(name="seed-aliases")
@click.option("--operator", default="system", help="操作人")
@click.option("--force/--no-force", default=False, help="即使已有映射也重新注入")
def seed_aliases_cmd(operator, force):
    """首次初始化：注入常见小区新旧名映射（阳光花园↔阳光花园小区 等5对）"""
    if force:
        from db import get_conn
        conn = get_conn()
        c = conn.cursor()
        c.execute("DELETE FROM community_aliases")
        conn.commit()
        conn.close()
    injected = seed_default_aliases(operator)
    if injected > 0:
        click.echo("✅ 已自动注入 {} 对常见小区新旧名映射（保证冲突能被标记）:".format(injected))
        for old, new in DEFAULT_COMMUNITY_ALIASES[:injected]:
            click.echo("   · {} ↔ {}".format(old, new))
    else:
        click.echo("ℹ️  别名映射表已有内容，未重复注入。可加 --force 强制重置")
    click.echo("查看全部: python cli.py list-aliases")


@cli.command()
@click.option("--csv", "csv_file", type=click.Path(exists=True), help="投诉数据CSV路径")
@click.option("--batch", "batch_id", help="批次号，不指定则自动生成")
@click.option("--operator", default="system", help="操作人")
@click.option("--seed-aliases/--no-seed-aliases", default=True,
              help="干净库是否自动注入常见小区新旧名映射（默认开启）")
def import_data(csv_file, batch_id, operator, seed_aliases):
    """第一步：导入居民投诉编号（干净库会先自动注入5对常见小区别名映射）"""
    if seed_aliases:
        injected = seed_default_aliases(operator)
        if injected > 0:
            click.echo("=" * 60)
            click.echo("⚠️  【首次运行】别名映射表为空，已自动注入 {} 对常见小区别名:".format(injected))
            for old, new in DEFAULT_COMMUNITY_ALIASES[:injected]:
                click.echo("   · {} ↔ {}".format(old, new))
            click.echo("   这样阳光花园/阳光花园小区等新旧名记录才会被标记冲突")
            click.echo("   关闭此行为请加 --no-seed-aliases")
            click.echo("=" * 60)
    records = []
    with open(csv_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            records.append({
                "line_no": idx,
                "complaint_no": row.get("投诉编号", row.get("complaint_no", "")),
                "community_name": row.get("小区名称", row.get("community_name", "")),
                "address": row.get("地址", row.get("address", "")),
                "complaint_content": row.get("投诉内容", row.get("complaint_content", "")),
            })
    batch, info = import_complaints(records, operator, batch_id, seed_aliases=False)
    click.echo("✅ 导入完成")
    click.echo("   批次号: {}".format(batch))
    click.echo("   记录总数: {}".format(info["total"]))
    click.echo("   标记新旧名冲突: {} 条".format(info["conflicts_marked"]))
    if info["conflicts_marked"] == 0:
        click.echo("   ⚠️  0条冲突标记 = 后续不会有留给巡检员复核的记录")
        click.echo("      请先运行: python cli.py seed-aliases")
    else:
        click.echo("   🎯 这些冲突记录老马审核后会 → PENDING_INSPECTOR 留给巡检员复核")


@cli.command()
@click.argument("complaint_no")
@click.argument("batch_id")
@click.argument("photo_remark")
@click.option("--operator", default="traffic_laoma", help="操作人")
def lao_ma_review(complaint_no, batch_id, photo_remark, operator):
    """第二步：交通协管老马补看路口照片（有冲突→自动转巡检员复核，不归正常）"""
    ok = lao_ma_review_photo(complaint_no, batch_id, photo_remark, operator)
    if ok:
        from core import get_record_by_complaint_no
        rec = get_record_by_complaint_no(complaint_no, batch_id)
        click.echo("✅ 老马已完成照片审核，备注已保存")
        click.echo("   当前状态: {}".format(rec["status"]))
        if rec["has_alias_conflict"]:
            click.echo("   🛑 存在小区新旧名冲突 → 已转 PENDING_INSPECTOR 留给市政巡检员复核")
            click.echo("      巡检员复核命令: python cli.py inspector-review {} {} --use-new-name".format(
                complaint_no, batch_id))
        else:
            click.echo("   ✅ 无冲突 → PHOTO_REVIEWED")
    else:
        click.echo("❌ 未找到该投诉记录")


@cli.command()
@click.argument("complaint_no")
@click.argument("batch_id")
@click.option("--use-new-name/--use-old-name", default=True, help="采用新名还是旧名")
@click.option("--operator", default="muni_inspector", help="操作人")
def inspector_review(complaint_no, batch_id, use_new_name, operator):
    """市政巡检员复核小区新旧名冲突（一次操作原子：改name/conflict/status三个字段）"""
    ok = inspector_resolve_alias(complaint_no, batch_id, use_new_name, operator)
    if ok:
        click.echo("✅ 巡检员已复核，冲突已解决，采用{}".format("新名" if use_new_name else "旧名"))
        click.echo("   ℹ️  此操作同时修改了 community_name / has_alias_conflict / status 三个字段")
        click.echo("      如需整体撤销，用: python cli.py rollback-op <记录ID>")
        click.echo("      查询记录ID: python cli.py list")
    else:
        click.echo("❌ 未找到记录或该记录无冲突")


@cli.command()
@click.option("--operator", default="summary_bot", help="操作人")
def summary(operator):
    """第三步：生成给街道会看的摘要（含冲突分组溯源、待复核原始行号、仅改备注受影响清单）"""
    result = generate_daily_summary(operator)
    click.echo("📊 今日街道会摘要：")
    click.echo("   报告日期: {}".format(result["report_date"]))
    click.echo("   总记录数: {}".format(result["total_records"]))
    click.echo("   待巡检员复核: {} 条".format(result["pending_inspector"]))
    click.echo("")
    click.echo("🔍 待复核明细（含原始行号，可追回材料）:")
    for pt in result["pending_trace"]:
        click.echo("   · {} | 原始行{} | {} | 备注: {}".format(
            pt["complaint_no"], pt["original_line_no"],
            pt["community_name"], pt["photo_remark"] or ""))
    click.echo("")
    click.echo("🌳 冲突分组溯源（阳光花园↔阳光花园小区等可追回原始行号）:")
    for key, items in result["conflict_groups"].items():
        click.echo("   【{}】".format(key))
        for it in items:
            click.echo("     · {} | 原始行{} | 批次…{} | 状态: {}".format(
                it["complaint_no"], it["original_line_no"],
                it["import_batch_id"][-6:], it["status"]))
    click.echo("")
    click.echo("📝 仅修改照片备注（当日需巡检员复核）:")
    click.echo("   共 {} 条受影响:".format(result["remark_only_affected"]))
    for it in result["remark_only_list"]:
        click.echo("   · {} [{}] 行{}: {}".format(
            it["complaint_no"], it["community_name"],
            it["original_line_no"], it["remark"] or ""))
    click.echo("")
    click.echo("💡 摘要备注: {}".format(result["summary_note"]))


@cli.command(name="list")
@click.option("--batch", "batch_id", help="按批次筛选")
@click.option("--format", "output_format", type=click.Choice(["table", "json", "csv"]), default="table")
def list_records(batch_id, output_format):
    """查看记录（单一数据源，导出/页面/接口都读这个）"""
    records = get_single_source(batch_id)
    if output_format == "json":
        click.echo(json.dumps(records, ensure_ascii=False, indent=2))
    elif output_format == "csv":
        if records:
            keys = records[0].keys()
            click.echo(",".join(keys))
            for r in records:
                click.echo(",".join('"{}"'.format(str(r[k]).replace('"', '""')) for k in keys))
    else:
        display = []
        for r in records:
            display.append({
                "ID": r["id"],
                "原始行号": r["original_line_no"],
                "投诉编号": r["complaint_no"],
                "小区": r["community_name"],
                "状态": r["status"],
                "新旧名冲突": "是" if r["has_alias_conflict"] else "否",
                "照片备注": (r["photo_remark"] or "")[:20],
                "批次": r["import_batch_id"][-8:],
            })
        click.echo(tabulate(display, headers="keys", tablefmt="simple"))


@cli.command()
@click.argument("record_id", type=int)
def audit(record_id):
    """查看单条记录的审计日志（可回溯证据：原话、修改人、原因、时间）"""
    logs = get_audit_log(record_id)
    if not logs:
        click.echo("无审计记录")
        return
    click.echo("🔍 记录 ID={} 的完整审计轨迹（按时间排序，回滚也在其中）:".format(record_id))
    display = []
    for l in logs:
        display.append({
            "时间": l["changed_at"],
            "操作人": l["changed_by"],
            "字段": l["field_name"],
            "原值": (l["old_value"] or "")[:20],
            "新值": (l["new_value"] or "")[:20],
            "原因": (l["change_reason"] or "")[:30],
        })
    click.echo(tabulate(display, headers="keys", tablefmt="simple"))


@cli.command()
@click.argument("old_name")
@click.argument("new_name")
@click.option("--operator", default="admin", help="操作人")
def add_alias(old_name, new_name, operator):
    """添加小区新旧名映射"""
    aid = add_community_alias(old_name, new_name, operator)
    if aid > 0:
        click.echo("✅ 已添加映射 #{}: {} -> {}".format(aid, old_name, new_name))
    else:
        click.echo("❌ 添加失败")


@cli.command(name="list-aliases")
def list_aliases_cmd():
    """列出所有小区新旧名映射"""
    aliases = get_alias_list()
    if not aliases:
        click.echo("⚠️  当前无任何别名映射！阳光花园/阳光花园小区等记录不会被标记冲突")
        click.echo("   解决: python cli.py seed-aliases")
        return
    display = []
    for a in aliases:
        display.append({
            "ID": a["id"],
            "旧名": a["old_name"],
            "新名": a["new_name"],
            "启用": "是" if a["is_active"] else "否",
            "创建时间": a["created_at"],
        })
    click.echo(tabulate(display, headers="keys", tablefmt="simple"))


@cli.command()
@click.argument("record_id", type=int)
@click.argument("field_name")
@click.option("--operator", default="admin", help="操作人")
def rollback(record_id, field_name, operator):
    """回滚某记录的单个字段到上一个值（⚠️ 巡检员复核建议用 rollback-op 整体回滚）"""
    ok = rollback_record_field(record_id, field_name, operator)
    if ok:
        click.echo("✅ 已回滚记录{}的{}字段".format(record_id, field_name))
        click.echo("   ⚠️  若此次巡检员复核，建议用 rollback-op 整体回滚，避免name回了但status没回")
    else:
        click.echo("❌ 回滚失败，无历史记录")


@cli.command(name="rollback-op")
@click.argument("record_id", type=int)
@click.option("--operator", default="admin", help="操作人")
def rollback_operation(record_id, operator):
    """按操作原子整体回滚：撤销记录上一次完整操作（name/status/conflict三者一起回）"""
    result = rollback_last_operation(record_id, operator)
    if result["success"]:
        click.echo("✅ 已整体回滚记录 {} 的上一次操作".format(record_id))
        click.echo("   原始操作原因: {}".format(result["original_reason"] or "未知"))
        click.echo("   同步回滚的字段: {}".format(", ".join(result["fields_rolled_back"])))
        click.echo("   🔍 验证: python cli.py audit {}".format(record_id))
    else:
        click.echo("❌ 回滚失败: {}".format(result["reason"]))


@cli.command()
@click.option("--batch", "batch_id", help="按批次导出，不填则全部")
@click.option("--outdir", default="exports", help="输出目录")
@click.option("--format", "fmt", type=click.Choice(["json", "csv", "all"]), default="all")
def export(batch_id, outdir, fmt):
    """
    导出明细（断点补实）：
    - Sheet1/detailed.csv：每条记录含原值、终值、小区名修改历史、备注修改历史、状态历史
    - Sheet2/audit.csv：所有字段修改的原话、修改人、修改原因
    - Sheet3/conflict_index.csv：阳光花园↔阳光花园小区等冲突分组→原始行号索引
    - Sheet4/pending_index.csv：留给巡检员复核的待办清单+回滚提示
    """
    os.makedirs(outdir, exist_ok=True)
    pkg = build_export_package(batch_id)
    ts = pkg["meta"]["exported_at"].replace(" ", "_").replace(":", "-")
    base = "export_{}_B{}".format(ts, pkg["meta"]["batch_id"])

    def write_csv(path, rows):
        if not rows:
            with open(path, "w", encoding="utf-8-sig") as f:
                f.write("（无数据）\n")
            return
        keys = list(rows[0].keys())
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            for r in rows:
                w.writerow(r)

    paths = {}
    if fmt in ("all", "csv"):
        p1 = os.path.join(outdir, base + "_1detailed.csv")
        write_csv(p1, pkg["detailed_rows"])
        p2 = os.path.join(outdir, base + "_2audit.csv")
        write_csv(p2, pkg["audit_rows"])
        p3 = os.path.join(outdir, base + "_3conflict_index.csv")
        write_csv(p3, pkg["conflict_index"])
        p4 = os.path.join(outdir, base + "_4pending_index.csv")
        write_csv(p4, pkg["pending_index"])
        paths.update({"detailed": p1, "audit": p2,
                      "conflict_idx": p3, "pending_idx": p4})
    if fmt in ("all", "json"):
        pj = os.path.join(outdir, base + "_full.json")
        with open(pj, "w", encoding="utf-8") as f:
            json.dump(pkg, f, ensure_ascii=False, indent=2)
        paths["json_full"] = pj

    click.echo("📦 导出完成（断点补实）")
    click.echo("   元信息: {} 记录 / {} 审计条 / 批次: {}".format(
        pkg["meta"]["record_count"], pkg["meta"]["audit_count"], pkg["meta"]["batch_id"]))
    for k, v in paths.items():
        click.echo("   📄 [{}] {}".format(k, v))
    click.echo("")
    click.echo("🔗 溯源说明：")
    click.echo("   · 从【阳光花园↔阳光花园小区】追回：看 _3conflict_index.csv 的 conflict_pair + original_line_no")
    click.echo("   · 从【留给巡检员复核】追回：看 _4pending_index.csv，含 photo_remark 原话和 batch_id")
    click.echo("   · 历史原话/修改人/修改原因：看 _2audit.csv 或 detailed.csv 里的 xxx_history JSON列")
    click.echo("   · 回滚前后的值也在 _2audit.csv 里（字段名同，原因含「回滚」字样）")


@cli.command(name="rules")
def show_rules():
    """显示边界规则（写死在代码里，不靠口头约定）"""
    click.echo(ALIAS_RULES)


@cli.command()
def info():
    """显示系统信息"""
    click.echo("数据库路径: {}".format(DB_PATH))
    click.echo("核心原则: 单一数据源 + 全链路审计 + 可重放命令")
    aliases = get_alias_list()
    click.echo("当前别名映射对数: {}".format(len(aliases)))
    if len(aliases) == 0:
        click.echo("   ⚠️  0 对别名 = 阳光花园/阳光花园小区 等不会被标记冲突")
        click.echo("      解决: python cli.py seed-aliases")


if __name__ == "__main__":
    cli()
