import click
import json
import sys
import os
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from dp_strategy.importer import (
    import_formula_screenshots,
    manual_edit_record,
    get_record_history,
    compare_versions,
    get_record_detail,
    list_records,
    export_records,
    generate_report,
    submit_review,
)
from dp_strategy.boundary_rules import (
    init_boundary_rules,
    rollback_batch,
    get_abnormal_records,
)


@click.group()
def cli():
    """动态规划补货策略 - 数据复核追踪系统 CLI"""
    pass


@cli.command("import-file")
@click.argument("file_path")
@click.option("--imported-by", default="阿兰", help="导入人姓名")
@click.option("--sheet-name", default=None, help="Excel工作表名称")
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def import_file_cmd(
    file_path: str, imported_by: str, sheet_name: Optional[str], json_output: bool
):
    result = import_formula_screenshots(file_path, imported_by, sheet_name)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        click.echo(f"{'='*60}")
        click.echo(f"  导入结果: {result['message']}")
        if result["success"]:
            bs = result.get("batch_summary", {})
            click.echo(f"  批次ID:     {result.get('batch_id', '-')}")
            click.echo(f"  总记录数:   {bs.get('total_records', '-')}")
            click.echo(f"  正常待处理: {bs.get('pending_count', '-')}")
            click.echo(f"  异常待复核: {bs.get('abnormal_count', '-')}")
            abnormals = result.get("abnormal_records", [])
            if abnormals:
                click.echo(f"\n  异常记录明细 (共{len(abnormals)}条):")
                for r in abnormals:
                    click.echo(
                        f"    - #{r['id']} 行号{r['original_row_number']} "
                        f"{r['sku_code']} {r['product_name']} | "
                        f"分母={r['denominator_value']} 结果='{r['result_value']}' "
                        f"[{r.get('abnormal_type_label', r.get('abnormal_type'))}]"
                    )
        else:
            click.echo(f"  原因: {result.get('message', '-')}")
            if result.get("existing_batch"):
                click.echo(f"  原批次: {result['existing_batch']}")
        click.echo(f"{'='*60}")


@cli.command()
@click.argument("screenshot_id", type=int)
@click.argument("field_name")
@click.argument("new_value")
@click.option("--edited-by", default="阿兰", help="编辑人姓名")
@click.option("--reason", required=True, help="修改原因")
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def edit(
    screenshot_id: int,
    field_name: str,
    new_value: str,
    edited_by: str,
    reason: str,
    json_output: bool,
):
    result = manual_edit_record(screenshot_id, field_name, new_value, edited_by, reason)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        click.echo(result.get("message", "完成"))
        if result["success"]:
            r = result.get("latest_record", {})
            click.echo(
                f"  记录#{r.get('id')} 状态: {r.get('status_label', r.get('status'))} | "
                f"版本: v{result.get('new_version')} | "
                f"字段 {result.get('field')}: '{result.get('old_value')}' -> '{result.get('new_value')}'"
            )
            bs = result.get("batch_summary", {})
            if bs:
                click.echo(
                    f"  批次统计同步: 异常待复核={bs.get('abnormal_count')} "
                    f"已通过={bs.get('approved_count')} 复核中={bs.get('reviewing_count')}"
                )


@cli.command()
@click.argument("screenshot_id", type=int)
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def history(screenshot_id: int, json_output: bool):
    result = get_record_history(screenshot_id)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        click.echo(f"记录 #{screenshot_id} 历史版本 (共{len(result)}个):")
        for h in result:
            click.echo(
                f"\n  v{h['version']} [{h['change_type']}] {h['change_time']} by {h['changed_by']}"
            )
            click.echo(f"    原因: {h.get('change_reason', '')}")
            click.echo(f"    变更字段: {', '.join(h.get('diff_fields', [])) or '无'}")


@cli.command()
@click.argument("screenshot_id", type=int)
@click.argument("version1", type=int)
@click.argument("version2", type=int)
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def diff(
    screenshot_id: int, version1: int, version2: int, json_output: bool
):
    result = compare_versions(screenshot_id, version1, version2)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        if not result["success"]:
            click.echo(result.get("message"))
            return
        click.echo(
            f"记录 #{screenshot_id} 版本对比: v{version1} vs v{version2}"
        )
        diffs = result.get("diff", {})
        if not diffs:
            click.echo("  无差异")
        for field, vals in diffs.items():
            click.echo(f"\n  字段: {field}")
            click.echo(f"    v{version1}: {vals['version1']}")
            click.echo(f"    v{version2}: {vals['version2']}")


@cli.command()
@click.argument("screenshot_id", type=int)
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def detail(screenshot_id: int, json_output: bool):
    result = get_record_detail(screenshot_id)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        if not result["success"]:
            click.echo(result.get("message"))
            return
        r = result["screenshot"]
        click.echo(f"{'='*60}")
        click.echo(f"  记录详情 #{r['id']}")
        click.echo(f"{'='*60}")
        click.echo(f"  SKU/商品:   {r['sku_code']} / {r['product_name']}")
        click.echo(f"  批次/行号:  {r['batch_id']} | 原始行号 {r['original_row_number']}")
        click.echo(f"  公式:       {r['formula_expression']}")
        click.echo(f"  分子/分母:  {r['numerator_value']} / {r['denominator_value']}")
        click.echo(f"  原始结果:   '{r['original_result'] or '(空字符串)'}'")
        click.echo(f"  当前结果:   '{r['result_value'] or '(空字符串)'}'")
        click.echo(f"  状态:       {r.get('status_label', r['status'])} (v{r['current_version']})")
        if r.get("abnormal_type"):
            click.echo(f"  异常类型:   {r.get('abnormal_type_label', r['abnormal_type'])}")
        if r.get("abnormal_note"):
            click.echo(f"  异常说明:   {r['abnormal_note']}")
        click.echo(f"\n  --- 人工复核信息 ---")
        if r.get("original_statement"):
            click.echo(f"  原始说法:   {r['original_statement']}")
        if r.get("corrected_value") is not None:
            click.echo(f"  改后的值:   {r['corrected_value']}")
        if r.get("review_reason"):
            click.echo(f"  处理原因:   {r['review_reason']}")
        if r.get("next_handler"):
            click.echo(f"  下一步找谁:  {r['next_handler']}")
        if r.get("reviewed_by"):
            click.echo(f"  复核人/时间: {r['reviewed_by']} @ {r['reviewed_at']}")
            click.echo(f"  复核结论:   {r.get('review_decision_detail') or r.get('review_decision')}")
        if r.get("boundary_rules_triggered"):
            click.echo(f"\n  --- 触发的边界规则 ---")
            for br in r["boundary_rules_triggered"]:
                click.echo(f"    - {br['rule_name']} [{br['rule_type']}] priority={br.get('priority', 0)}")
        hist = r.get("history", [])
        if hist:
            click.echo(f"\n  --- 版本历史 ({len(hist)}条) ---")
            for h in hist:
                click.echo(
                    f"    v{h['version']} [{h['change_type']}] by {h['changed_by']} - {h.get('change_reason', '')}"
                )
        reviews = r.get("reviews", [])
        if reviews:
            click.echo(f"\n  --- 复核记录 ({len(reviews)}条) ---")
            for rv in reviews:
                click.echo(
                    f"    [{rv['review_decision']}] {rv['reviewer']} @ {rv['review_time']} - {rv.get('review_comment', '')}"
                )


@cli.command()
@click.argument("screenshot_id", type=int)
@click.option(
    "--decision",
    type=click.Choice(
        ["approve_as_is", "approve_with_correction", "reject_need_rework", "escalate"]
    ),
    required=True,
    help="复核结论",
)
@click.option("--reviewer", required=True, help="复核人姓名")
@click.option("--comment", default="", help="复核意见")
@click.option("--corrected-value", default=None, help="修正后的值（用于approve_with_correction）")
@click.option("--review-reason", default=None, help="处理原因")
@click.option("--next-handler", default=None, help="下一步处理人")
@click.option("--original-statement", default=None, help="重新记录原始说法（可选）")
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def review(
    screenshot_id: int,
    decision: str,
    reviewer: str,
    comment: str,
    corrected_value: Optional[str],
    review_reason: Optional[str],
    next_handler: Optional[str],
    original_statement: Optional[str],
    json_output: bool,
):
    result = submit_review(
        screenshot_id,
        reviewer,
        decision,
        comment,
        original_statement,
        corrected_value,
        review_reason,
        next_handler,
    )
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        if not result["success"]:
            click.echo(result.get("message"))
            return
        r = result.get("latest_record", {})
        click.echo(f"✅ 复核提交成功！")
        click.echo(f"  记录 #{screenshot_id} 新状态: {r.get('status_label', r.get('status'))}")
        click.echo(f"  复核结论: {decision}")
        if corrected_value is not None:
            click.echo(f"  结果值修正为: '{corrected_value}'")
        if next_handler:
            click.echo(f"  下一步处理人: {next_handler}")
        bs = result.get("batch_summary", {})
        if bs:
            click.echo(
                f"\n  批次统计同步更新: 异常待复核={bs.get('abnormal_count')} "
                f"已通过={bs.get('approved_count')} 复核中={bs.get('reviewing_count')} 已驳回={bs.get('rejected_count')}"
            )


@cli.command()
@click.argument("batch_id")
@click.option("--reason", required=True, help="回滚原因")
@click.option("--by", "rollback_by", default="系统管理员", help="回滚操作人")
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def rollback(batch_id: str, reason: str, rollback_by: str, json_output: bool):
    result = rollback_batch(batch_id, reason, rollback_by)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        click.echo(result.get("message"))
        if result["success"]:
            bs = result.get("batch_summary", {})
            click.echo(
                f"  回滚后统计: 已回滚={bs.get('rollbacked_count')} "
                f"异常待复核={bs.get('abnormal_count')}"
            )


@cli.command()
@click.option("--batch-id", default=None, help="指定批次ID")
@click.option("--status", default=None, help="按状态过滤")
@click.option("--abnormal-type", default=None, help="按异常类型过滤")
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def list_cmd(
    batch_id: Optional[str],
    status: Optional[str],
    abnormal_type: Optional[str],
    json_output: bool,
):
    result = list_records(batch_id, status, abnormal_type)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        click.echo(f"共 {result['total']} 条记录")
        bs_list = result.get("batch_summaries", [])
        if bs_list:
            click.echo(f"\n涉及批次 ({len(bs_list)}个):")
            for bs in bs_list:
                click.echo(
                    f"  {bs['batch_id']}: 总数={bs.get('total_records')} "
                    f"待处理={bs.get('pending_count')} 异常={bs.get('abnormal_count')} "
                    f"已通过={bs.get('approved_count')} 复核中={bs.get('reviewing_count')}"
                )
        click.echo("")
        for r in result["records"]:
            click.echo(
                f"  #{r['id']:>3} 行{r['original_row_number']:>2} "
                f"{r['sku_code']:<10} {r['product_name']:<8} | "
                f"分子/分母={r['numerator_value']}/{r['denominator_value']} "
                f"原='{r['original_result']}' 现='{r['result_value']}' "
                f"[{r.get('status_label', r['status'])} v{r['current_version']}]"
            )


@cli.command()
@click.option("--batch-id", default=None, help="指定批次ID")
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def abnormal(batch_id: Optional[str], json_output: bool):
    result = get_abnormal_records(batch_id)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        if not result:
            click.echo("没有异常记录")
            return
        click.echo(f"发现 {len(result)} 条异常记录:")
        for r in result:
            click.echo(
                f"\n  #{r['id']} 批次={r['batch_id']} 原始行号={r['original_row_number']}"
            )
            click.echo(f"    SKU/商品: {r['sku_code']} / {r['product_name']}")
            click.echo(
                f"    分子/分母/结果: {r['numerator_value']} / {r['denominator_value']} / "
                f"'{r['result_value'] or '(空)'}' (原始='{r['original_result'] or '(空)'}')"
            )
            click.echo(
                f"    异常: {r.get('abnormal_type_label', r['abnormal_type'])} - {r.get('abnormal_note', '')}"
            )
            if r.get("original_statement"):
                click.echo(f"    原始说法: {r['original_statement']}")
            if r.get("next_handler"):
                click.echo(f"    下一步找谁: {r['next_handler']}")


@cli.command()
@click.argument("output_path")
@click.option("--batch-id", default=None, help="指定批次ID")
@click.option("--status", default=None, help="按状态过滤")
@click.option(
    "--format",
    "fmt",
    type=click.Choice(["xlsx", "csv", "excel"]),
    default="xlsx",
    help="导出格式",
)
def export(output_path: str, batch_id: Optional[str], status: Optional[str], fmt: str):
    result = export_records(output_path, batch_id, status, fmt)
    if result["success"]:
        click.echo(
            f"✅ 导出成功: {result['records_exported']} 条记录 -> {result['output_path']}"
        )
    else:
        click.echo(f"❌ {result.get('message')}")


@cli.command()
@click.argument("batch_id")
@click.option("--output-path", default=None, help="报告输出路径（可选）")
@click.option("--json-output", is_flag=True, help="以JSON格式输出")
def report(batch_id: str, output_path: Optional[str], json_output: bool):
    result = generate_report(batch_id, output_path)
    if json_output:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        if not result["success"]:
            click.echo(result.get("message"))
            return
        click.echo(result["report_text"])
        if output_path:
            click.echo(f"\n报告已保存到: {output_path}")


@cli.command("init-rules")
def init_rules_cmd():
    init_boundary_rules()
    click.echo("✅ 边界规则初始化完成")


if __name__ == "__main__":
    cli()
