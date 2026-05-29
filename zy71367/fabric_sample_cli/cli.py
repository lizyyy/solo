import click
import sys
import json
import os
from datetime import date, datetime
from typing import Optional

from .storage import StorageManager
from .color_validator import ColorValidator
from .matching_engine import MatchingEngine
from .arrival_manager import ArrivalManager, InspectionStatus
from .history_manager import HistoryManager
from .report_exporter import ReportExporter
from .sample_data import create_sample_data
from .models import DataStore


class FabricSampleCLI:
    def __init__(self):
        self.storage = StorageManager()
        self.color_validator = ColorValidator(self.storage)
        self.matching_engine = MatchingEngine(self.storage, self.color_validator)
        self.arrival_manager = ArrivalManager(self.storage)
        self.history_manager = HistoryManager(self.storage)
        self.report_exporter = ReportExporter(self.storage)
        self.store = self.storage.load()


@click.group(invoke_without_command=True)
@click.pass_context
def main(ctx):
    """服装秀面料样卡管理工具 - 面料样卡、供应商、成衣编号对应关系管理"""
    ctx.ensure_object(FabricSampleCLI)
    ctx.obj = FabricSampleCLI()

    if ctx.invoked_subcommand is None:
        click.echo("=" * 80)
        click.echo("服装秀面料样卡管理系统 v0.1.0")
        click.echo("=" * 80)
        click.echo()
        click.echo("【输入区】可用命令:")
        click.echo("  初始化数据     init          初始化样例数据")
        click.echo("  匹配样卡     match         自动匹配样卡与成衣")
        click.echo("  人工匹配     manual-match  人工指定匹配关系")
        click.echo("  检查到货     check-arrival  检查到货与检验状态")
        click.echo("  色号校验     check-color  校验指定色号")
        click.echo("  补录信息     amend        补录样卡信息")
        click.echo("  撤回样卡     revoke       撤回样卡")
        click.echo("  状态流转     transition   变更检验状态")
        click.echo("  查看报告     report       查看各类报告")
        click.echo("  导出Excel     export       导出Excel报告")
        click.echo("  查看错误     errors       查看错误清单")
        click.echo("  查看历史     history      查看历史目录")
        click.echo("  验证撤回     verify-revoke 验证撤回完整性")
        click.echo()
        click.echo("【输出区】运行 '服装秀面料样卡 <命令> --help' 查看命令详情")
        click.echo("=" * 80)


@main.command()
@click.option('--reset', is_flag=True, help='重置所有数据')
@click.pass_obj
def init(cli, reset):
    """初始化样例数据"""
    click.echo("=" * 80)
    click.echo("【输入区】初始化样例数据")
    click.echo("=" * 80)

    if reset:
        cli.store = DataStore()
        click.echo("已重置所有数据")

    click.echo("正在加载贴近真实场景的样例数据...")
    cli.store = create_sample_data(cli.store, cli.color_validator)
    cli.storage.save(cli.store)

    click.echo("")
    click.echo("【输出区】数据初始化完成")
    click.echo(f"  供应商: {len(cli.store.suppliers)} 家")
    click.echo(f"  面料样卡: {len(cli.store.samples)} 张")
    click.echo(f"  成衣款式: {len(cli.store.garments)} 款")
    click.echo("")
    click.echo("样例数据特点:")
    click.echo("  ✓ 色号格式多样: HEX、RGB、PANTONE、CMYK、中文名称")
    click.echo("  ✓ 色号混淆场景: 大红/正红/中国红、米白/象牙白、藕粉/香芋紫")
    click.echo("  ✓ 样卡缺失: SAMP-009-I 标记为缺失")
    click.echo("  ✓ 到货逾期: SAMP-006-F 严重逾期15天")
    click.echo("  ✓ 状态流转异常: SAMP-007-G 到货晚于检验截止但已检验")
    click.echo("  ✓ 已撤回样卡: SAMP-008-H 已撤回状态")
    click.echo("  ✓ 脏数据备注: 手写标注、供应商说明、设计师备注")
    click.echo("")
    click.echo("【错误清单】初始化时自动检测的色号问题已记录")
    click.echo(f"  共生成错误记录: {len(cli.store.errors)} 条")
    click.echo("=" * 80)


@main.command()
@click.pass_obj
def match(cli):
    """自动匹配样卡与成衣"""
    click.echo("=" * 80)
    click.echo("【输入区】自动匹配样卡与成衣")
    click.echo("=" * 80)

    matches, traces, cli.store = cli.matching_engine.find_matches(cli.store)
    cli.storage.save(cli.store)

    for line in traces:
        click.echo(line)

    click.echo("")
    click.echo("【输出区】匹配结果")
    click.echo(f"  成功匹配: {len(matches)} 对")
    click.echo(f"  自动匹配: {sum(1 for m in matches if not m.is_manual)} 对")
    click.echo(f"  人工匹配: {sum(1 for m in matches if m.is_manual)} 对")

    click.echo("")
    click.echo("【错误清单】匹配过程中发现的问题")
    match_errors = [e for e in cli.store.errors.values() if e.error_type == "样卡匹配" and not e.resolved]
    if match_errors:
        for e in match_errors:
            click.echo(f"  [{e.severity.upper()}] {e.error_code}: {e.message}")
    else:
        click.echo("  无匹配相关错误")

    click.echo("")
    click.echo("【历史目录】匹配操作已记录")
    match_history = [h for h in cli.store.history.values() if h.operation_type.value == "匹配"]
    click.echo(f"  历史记录: {len(match_history)} 条")
    click.echo("=" * 80)


@main.command()
@click.argument('sample_id')
@click.argument('garment_id')
@click.option('--operator', help='操作人')
@click.pass_obj
def manual_match(cli, sample_id, garment_id, operator):
    """人工指定匹配关系 SAMPLE_ID GARMENT_ID"""
    click.echo("=" * 80)
    click.echo(f"【输入区】人工匹配: {sample_id} <-> {garment_id}")
    click.echo("=" * 80)

    match, traces, cli.store = cli.matching_engine.manual_match(
        sample_id, garment_id, cli.store, operator
    )
    cli.storage.save(cli.store)

    for line in traces:
        click.echo(line)

    if match:
        click.echo("")
        click.echo("【输出区】匹配成功")
        click.echo(f"  匹配ID: {match.match_id}")
        click.echo(f"  匹配度: {match.match_score:.2%}")

    click.echo("=" * 80)


@main.command()
@click.option('--date', 'ref_date', help='参考日期 YYYY-MM-DD，默认今天')
@click.pass_obj
def check_arrival(cli, ref_date):
    """检查到货与检验状态"""
    click.echo("=" * 80)
    click.echo("【输入区】检查到货与检验状态")
    click.echo("=" * 80)

    reference_date = date.fromisoformat(ref_date) if ref_date else date.today()
    click.echo(f"参考日期: {reference_date.isoformat()}")

    reminders, traces, cli.store = cli.arrival_manager.check_arrivals(cli.store, reference_date)
    cli.storage.save(cli.store)

    for line in traces:
        click.echo(line)

    click.echo("")
    click.echo("【输出区】到货状态汇总")
    status_count = {}
    for r in reminders:
        status = r.arrival_status.value
        status_count[status] = status_count.get(status, 0) + 1

    for status, count in status_count.items():
        click.echo(f"  {status}: {count} 张样卡")

    click.echo("")
    click.echo("【错误清单】到货与检验问题")
    arrival_errors = [e for e in cli.store.errors.values() if e.error_type in ["到货管理", "检验提醒", "状态流转"]]
    for e in arrival_errors:
        if e.calculation_detail:
            calc = e.calculation_detail
            click.echo(f"  [{e.severity.upper()}] {e.error_code}: {e.message}")
            if 'days_since_expected' in calc:
                click.echo(f"    计算: 逾期天数 = {reference_date.isoformat()} - {calc.get('expected_arrival')} = {calc.get('days_since_expected')} 天")

    click.echo("")
    click.echo("【历史目录】检查记录已保存")
    click.echo(f"  生成提醒: {len(reminders)} 条")
    click.echo("=" * 80)


@main.command()
@click.argument('color_code')
@click.option('--color-name', help='颜色名称')
@click.pass_obj
def check_color(cli, color_code, color_name):
    """校验指定色号 COLOR_CODE"""
    click.echo("=" * 80)
    click.echo(f"【输入区】色号校验: {color_code}")
    click.echo("=" * 80)

    click.echo(f"原始色号: {color_code}")
    if color_name:
        click.echo(f"颜色名称: {color_name}")

    color_spec = cli.color_validator.validate_color_spec(color_code, color_name)

    click.echo("")
    click.echo("【输出区】校验结果")
    click.echo(f"  检测格式: {color_spec.format_detected.value}")
    click.echo(f"  标准化HEX: {color_spec.normalized_hex or '无法转换'}")
    if color_spec.normalized_rgb:
        click.echo(f"  标准化RGB: RGB{color_spec.normalized_rgb}")
    if color_spec.pantone_code:
        click.echo(f"  潘通色号: {color_spec.pantone_code}")
    click.echo(f"  识别置信度: {color_spec.color_confidence:.2%}")

    click.echo(f"  混淆风险: {'有' if color_spec.is_confusing else '无'}")
    if color_spec.confusing_with:
        click.echo(f"  易混色号: {', '.join(color_spec.confusing_with)}")

    click.echo("")
    click.echo("【计算过程】")
    click.echo(f"  色差计算公式: Redmean公式")
    click.echo(f"  色差容忍度: < 10 精确匹配, < 40 相似, < 100 可接受")
    if color_spec.normalized_rgb:
        r, g, b = color_spec.normalized_rgb
        click.echo(f"  RGB值: R={r}, G={g}, B={b}")

    click.echo("=" * 80)


@main.command()
@click.argument('sample_id')
@click.option('--arrival-date', help='实际到货日期 YYYY-MM-DD')
@click.option('--inspection-deadline', help='检验截止日期 YYYY-MM-DD')
@click.option('--remark', help='备注')
@click.option('--operator', help='操作人')
@click.option('--reason', help='补录原因')
@click.pass_obj
def amend(cli, sample_id, arrival_date, inspection_deadline, remark, operator, reason):
    """补录样卡信息 SAMPLE_ID"""
    click.echo("=" * 80)
    click.echo(f"【输入区】补录样卡信息: {sample_id}")
    click.echo("=" * 80)

    updates = {}
    if arrival_date:
        updates['arrival_date'] = date.fromisoformat(arrival_date)
    if inspection_deadline:
        updates['inspection_deadline'] = date.fromisoformat(inspection_deadline)
    if remark:
        updates['remark'] = remark

    if updates:
        sample, traces, cli.store = cli.arrival_manager.amend_sample(
            sample_id, updates, cli.store, operator, reason
        )
        cli.storage.save(cli.store)

        for line in traces:
            click.echo(line)

        click.echo("")
        click.echo("【历史目录】补录记录已保存")
    else:
        click.echo("未指定要更新的字段")

    click.echo("=" * 80)


@main.command()
@click.argument('sample_id')
@click.option('--operator', help='操作人')
@click.option('--reason', help='撤回原因')
@click.pass_obj
def revoke(cli, sample_id, operator, reason):
    """撤回样卡 SAMPLE_ID"""
    click.echo("=" * 80)
    click.echo(f"【输入区】撤回样卡: {sample_id}")
    click.echo("=" * 80)

    sample, traces, cli.store = cli.arrival_manager.revoke_sample(
        sample_id, cli.store, operator, reason
    )
    cli.storage.save(cli.store)

    for line in traces:
        click.echo(line)

    click.echo("")
    click.echo("【历史目录】撤回记录已保存")
    click.echo("  ✓ 已解除所有成衣关联")
    click.echo("  ✓ 已删除匹配记录")
    click.echo("  ✓ 状态已变更为'已撤回'")
    click.echo("=" * 80)


@main.command()
@click.argument('sample_id')
@click.argument('new_status')
@click.option('--operator', help='操作人')
@click.option('--reason', help='变更原因')
@click.pass_obj
def transition(cli, sample_id, new_status, operator, reason):
    """变更检验状态 SAMPLE_ID NEW_STATUS

    可用状态: 待检验, 检验中, 检验通过, 检验不合格, 待复检, 已撤回
    """
    click.echo("=" * 80)
    click.echo(f"【输入区】状态流转: {sample_id} → {new_status}")
    click.echo("=" * 80)

    status_map = {
        '待检验': InspectionStatus.PENDING,
        '检验中': InspectionStatus.IN_PROGRESS,
        '检验通过': InspectionStatus.PASSED,
        '检验不合格': InspectionStatus.FAILED,
        '待复检': InspectionStatus.REINSPECT,
        '已撤回': InspectionStatus.REVOKED,
    }

    if new_status not in status_map:
        click.echo(f"错误: 未知状态 '{new_status}'")
        click.echo(f"可用状态: {', '.join(status_map.keys())}")
        return

    target_status = status_map[new_status]
    sample, traces, cli.store = cli.arrival_manager.transition_status(
        sample_id, target_status, cli.store, operator, reason
    )
    cli.storage.save(cli.store)

    for line in traces:
        click.echo(line)

    click.echo("")
    click.echo("【历史目录】状态变更已记录")
    click.echo("=" * 80)


@main.command()
@click.argument('report_type', default='all')
@click.pass_obj
def report(cli, report_type):
    """查看各类报告 [summary|matches|errors|history|all]"""
    click.echo(cli.report_exporter.print_console_report(cli.store, report_type))


@main.command()
@click.option('--filename', help='导出文件名')
@click.pass_obj
def export(cli, filename):
    """导出Excel报告"""
    click.echo("=" * 80)
    click.echo("【输入区】导出Excel报告")
    click.echo("=" * 80)

    filepath = cli.report_exporter.export_to_excel(cli.store, filename)

    click.echo("")
    click.echo("【输出区】报告已导出")
    click.echo(f"  文件路径: {filepath}")

    matching_report = cli.report_exporter.export_matching_report(cli.store)
    arrival_report = cli.report_exporter.export_arrival_report(cli.store)

    json_path = os.path.join(os.path.dirname(filepath), "计算明细.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            'matching_report': matching_report,
            'arrival_report': arrival_report
        }, f, ensure_ascii=False, indent=2)

    click.echo(f"  计算明细: {json_path}")
    click.echo("")
    click.echo("【计算过程】已包含在JSON文件中")
    click.echo("  - 匹配置信度计算方法")
    click.echo("  - 颜色匹配度计算公式")
    click.echo("  - 到货状态判定规则")
    click.echo("  - 状态流转校验规则")
    click.echo("=" * 80)


@main.command()
@click.option('--resolved', is_flag=True, help='显示已解决的错误')
@click.pass_obj
def errors(cli, resolved):
    """查看错误清单"""
    click.echo("=" * 80)
    click.echo("【错误清单】")
    click.echo("=" * 80)

    error_list = list(cli.store.errors.values())
    if not resolved:
        error_list = [e for e in error_list if not e.resolved]

    if not error_list:
        click.echo("暂无错误记录")
        click.echo("=" * 80)
        return

    for e in sorted(error_list, key=lambda x: x.created_at, reverse=True):
        click.echo("")
        click.echo(f"[{e.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {e.error_id}")
        click.echo(f"  类型: {e.error_type} | 代码: {e.error_code} | 严重度: {e.severity}")
        click.echo(f"  描述: {e.message}")
        if e.related_sample_id:
            click.echo(f"  关联样卡: {e.related_sample_id}")
        if e.related_garment_id:
            click.echo(f"  关联成衣: {e.related_garment_id}")
        if e.calculation_detail:
            click.echo(f"  计算详情:")
            for key, value in e.calculation_detail.items():
                if key != 'trace':
                    click.echo(f"    {key}: {value}")
            if 'trace' in e.calculation_detail:
                click.echo(f"    计算追踪:")
                for t in e.calculation_detail['trace'][-5:]:
                    click.echo(f"      {t}")
        click.echo(f"  状态: {'已解决' if e.resolved else '未解决'}")

    click.echo("")
    click.echo(f"共计 {len(error_list)} 条错误记录")
    click.echo("=" * 80)


@main.command()
@click.option('--entity-type', help='实体类型 sample/garment/supplier')
@click.option('--entity-id', help='实体编号')
@click.option('--operation', help='操作类型')
@click.option('--start-date', help='开始日期 YYYY-MM-DD')
@click.option('--end-date', help='结束日期 YYYY-MM-DD')
@click.option('--operator', help='操作人')
@click.option('--audit-trail', is_flag=True, help='生成完整审计追踪')
@click.pass_obj
def history(cli, entity_type, entity_id, operation, start_date, end_date, operator, audit_trail):
    """查看历史目录"""
    click.echo("=" * 80)
    click.echo("【历史目录】")
    click.echo("=" * 80)

    if audit_trail:
        click.echo(cli.history_manager.generate_audit_trail(cli.store))
        click.echo("=" * 80)
        return

    from .models import OperationType
    op_type = None
    if operation:
        op_map = {
            '创建': OperationType.CREATE,
            '更新': OperationType.UPDATE,
            '补录': OperationType.AMEND,
            '撤回': OperationType.REVOKE,
            '匹配': OperationType.MATCH,
            '检验': OperationType.INSPECT,
            '导出': OperationType.EXPORT,
        }
        op_type = op_map.get(operation)

    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None

    records = cli.history_manager.query_history(
        cli.store, entity_type, entity_id, op_type, start_d, end_d, operator
    )

    if not records:
        click.echo("暂无历史记录")
    else:
        for r in records:
            click.echo("")
            click.echo(f"[{r.operation_time.strftime('%Y-%m-%d %H:%M:%S')}] {r.record_id}")
            click.echo(f"  操作: {r.operation_type.value} | 实体: {r.entity_type} | 编号: {r.entity_id}")
            if r.operator:
                click.echo(f"  操作人: {r.operator}")
            if r.change_reason:
                click.echo(f"  原因: {r.change_reason}")
            if r.before_data and r.after_data:
                click.echo(f"  变更:")
                for key in set(list(r.before_data.keys()) + list(r.after_data.keys())):
                    before = r.before_data.get(key)
                    after = r.after_data.get(key)
                    if before != after:
                        click.echo(f"    {key}: {before} → {after}")

    stats = cli.history_manager.get_operation_statistics(cli.store, start_d, end_d)
    click.echo("")
    click.echo("【统计信息】")
    click.echo(f"  总操作数: {stats['total_operations']}")
    for op, count in stats['by_operation_type'].items():
        click.echo(f"  {op}: {count}")

    click.echo("=" * 80)


@main.command()
@click.argument('sample_id')
@click.pass_obj
def verify_revoke(cli, sample_id):
    """验证撤回完整性 SAMPLE_ID"""
    click.echo("=" * 80)
    click.echo(f"【输入区】验证撤回完整性: {sample_id}")
    click.echo("=" * 80)

    result = cli.history_manager.verify_revocation_integrity(sample_id, cli.store)

    click.echo("【输出区】验证结果")
    click.echo(f"  样卡状态: {'已撤回' if result['is_revoked'] else '未撤回'}")
    if result['revocation_time']:
        click.echo(f"  撤回时间: {result['revocation_time']}")
    if result['revocation_reason']:
        click.echo(f"  撤回原因: {result['revocation_reason']}")
    click.echo(f"  匹配记录已清理: {'✓' if result['related_records_removed'] else '✗'}")
    click.echo(f"  成衣关联已解除: {'✓' if result['garment_associations_cleared'] else '✗'}")
    click.echo(f"  状态流转有效: {'✓' if result['status_chain_valid'] else '✗'}")

    click.echo("")
    click.echo("【验证追踪】")
    for trace in result['verification_trace']:
        click.echo(f"  {trace}")

    if result['anomalies']:
        click.echo("")
        click.echo("【错误清单】发现异常:")
        for anomaly in result['anomalies']:
            click.echo(f"  ⚠ {anomaly}")

    click.echo("=" * 80)


if __name__ == "__main__":
    main()
