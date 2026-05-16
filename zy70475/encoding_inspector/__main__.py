import click
from pathlib import Path
from datetime import datetime

from .encoder import EncodingDetector
from .demo_generator import DemoDataGenerator
from .candidate_manager import CandidateManager, FailureManager
from .report_generator import ReportGenerator
from .config import DATA_DIR


@click.group()
def cli():
    """文件编码巡检工具 - 批量检测和管理文件编码"""
    pass


@cli.command()
@click.option('--count', default=50, help='生成的演示数据记录数')
def generate_demo(count):
    """生成演示数据 - 过期审批催办列表（含脏数据）"""
    click.echo(f"正在生成演示数据...")

    generator = DemoDataGenerator()
    result = generator.generate_demo_files(count)

    click.echo(f"✅ 生成完成!")
    click.echo(f"   总文件数: {result['total_files']}")
    click.echo(f"   正常记录: {result['normal_count']}")
    click.echo(f"   异常记录: {result['dirty_count']}")
    click.echo(f"\n   文件列表:")
    for f in result['files']:
        note = f" ({f.get('note', '')})" if f.get('note') else ""
        click.echo(f"     - {f['name']} [{f['encoding']}] - {f['count']}条{note}")


@cli.command()
@click.argument('directory', type=click.Path(exists=True), default=str(DATA_DIR))
@click.option('--pattern', default='*.txt', help='文件匹配模式')
@click.option('--output', default='json', type=click.Choice(['json', 'markdown']), help='输出格式')
def scan(directory, pattern, output):
    """执行文件编码巡检"""
    click.echo(f"开始扫描目录: {directory}")
    click.echo(f"匹配模式: {pattern}\n")

    detector = EncodingDetector()
    results = detector.batch_detect(Path(directory), pattern)

    click.echo(f"扫描完成: 共检测 {len(results)} 个文件\n")

    valid_count = sum(1 for r in results if r.get('is_valid'))
    invalid_count = len(results) - valid_count

    click.echo(f"✅ 编码有效: {valid_count}")
    click.echo(f"❌ 编码异常: {invalid_count}\n")

    if results:
        reporter = ReportGenerator()
        report = reporter.generate_report(results, output_format=output)

        click.echo(f"📊 报告已生成: {report['output_path']}")
        click.echo(f"   报告ID: {report['report_id']}")

        if invalid_count > 0:
            candidate_mgr = CandidateManager()
            candidates = candidate_mgr.generate_candidates(results, "cleanup")
            click.echo(f"\n⚠️  发现 {candidates['total_count']} 个候选文件需要处理")
            click.echo(f"   候选清单ID: {candidates['candidate_id']}")
            click.echo(f"   风险分布: 高{candidates['risk_summary']['high']} "
                       f"中{candidates['risk_summary']['medium']} "
                       f"低{candidates['risk_summary']['low']}")


@cli.command()
def list_candidates():
    """列出所有候选清单"""
    candidate_mgr = CandidateManager()
    candidates = candidate_mgr.list_candidates()

    if not candidates:
        click.echo("暂无候选清单")
        return

    click.echo(f"候选清单列表 (共 {len(candidates)} 个):\n")

    for i, c in enumerate(candidates, 1):
        status = "已确认" if c.get('status') == 'confirmed' else "待确认"
        click.echo(f"{i}. [{status}] {c['candidate_id']}")
        click.echo(f"   生成时间: {c['generated_at']}")
        click.echo(f"   操作类型: {c['action_type']}")
        click.echo(f"   文件数量: {c['total_count']}\n")


@cli.command()
@click.argument('candidate_id')
@click.option('--note', prompt='请输入人工备注', help='对候选文件的备注说明')
@click.option('--index', type=int, help='指定文件索引，不指定则全部添加')
def add_note(candidate_id, note, index):
    """为候选文件添加人工备注"""
    candidate_mgr = CandidateManager()
    candidate_data = candidate_mgr.load_candidate_list(candidate_id)

    if not candidate_data:
        click.echo(f"❌ 候选清单不存在: {candidate_id}")
        return

    if index is not None:
        if 0 <= index < len(candidate_data['candidates']):
            file_path = candidate_data['candidates'][index]['file_path']
            candidate_mgr.add_manual_note(candidate_id, file_path, note)
            click.echo(f"✅ 已为第 {index + 1} 个文件添加备注")
        else:
            click.echo(f"❌ 索引超出范围")
    else:
        for c in candidate_data['candidates']:
            candidate_mgr.add_manual_note(candidate_id, c['file_path'], note)
        click.echo(f"✅ 已为所有候选文件添加备注")


@cli.command()
@click.argument('candidate_id')
@click.option('--select', '-s', multiple=True, type=int, help='选择要确认的文件索引 (从0开始)')
@click.option('--yes', '-y', is_flag=True, help='跳过确认，直接执行')
def confirm(candidate_id, select, yes):
    """确认候选清单并执行操作"""
    candidate_mgr = CandidateManager()

    candidate_data = candidate_mgr.load_candidate_list(candidate_id)
    if not candidate_data:
        click.echo(f"❌ 候选清单不存在: {candidate_id}")
        return

    click.echo(f"候选清单: {candidate_id}")
    click.echo(f"操作类型: {candidate_data['action_type']}")
    click.echo(f"待处理文件: {len(candidate_data['candidates'])} 个\n")

    selected_indices = list(select) if select else None

    for i, c in enumerate(candidate_data['candidates']):
        status = " [选中]" if selected_indices is None or i in selected_indices else " [跳过]"
        click.echo(f"  [{i}] [{c['risk_level'].upper()}] {c['file_name']}{status}")
        click.echo(f"      原因: {c['reason']}")
        if c.get('manual_note'):
            click.echo(f"      备注: {c['manual_note']}")

    click.echo()

    if not yes:
        if not click.confirm('是否确认执行上述操作？', default=False):
            click.echo("操作已取消")
            return

    click.echo("正在执行操作...")
    result = candidate_mgr.execute_action(candidate_id, selected_indices)

    if result['success']:
        click.echo(f"\n✅ 操作完成!")
    else:
        click.echo(f"\n⚠️  操作部分完成，存在失败项")

    click.echo(f"   成功处理: {len(result['processed'])} 个")
    click.echo(f"   处理失败: {len(result['failed'])} 个")
    click.echo(f"   已跳过: {len(result['skipped'])} 个")

    if result['failed']:
        click.echo(f"\n❌ 失败项:")
        for f in result['failed']:
            click.echo(f"   - {f['file_name']}: {f['error']}")
            click.echo(f"     失败ID: {f['failure_id']}")


@cli.command()
@click.option('--unhandled', is_flag=True, help='只显示未处理的失败项')
def list_failures(unhandled):
    """列出处理失败项"""
    failure_mgr = FailureManager()
    failures = failure_mgr.get_failures(unhandled_only=unhandled)

    if not failures:
        click.echo("暂无失败记录")
        return

    click.echo(f"失败记录列表 (共 {len(failures)} 个):\n")

    for f in failures:
        status = "已处理" if f.get('handled') else "待处理"
        click.echo(f"[{status}] {f['failure_id']}")
        click.echo(f"   操作: {f['operation']}")
        click.echo(f"   时间: {f['failed_at']}")
        click.echo(f"   错误: {f['error']}")
        if f.get('handler_note'):
            click.echo(f"   处理备注: {f['handler_note']}")
        click.echo()


@cli.command()
@click.argument('failure_id')
@click.option('--note', prompt='请输入处理备注', help='处理说明备注')
def mark_handled(failure_id, note):
    """标记失败项为已处理"""
    failure_mgr = FailureManager()
    if failure_mgr.mark_handled(failure_id, note):
        click.echo(f"✅ 失败项 {failure_id} 已标记为已处理")
    else:
        click.echo(f"❌ 失败项不存在")


@cli.command()
@click.option('--limit', default=10, help='显示最近N条历史记录')
def version_history(limit):
    """查看版本冻结历史"""
    reporter = ReportGenerator()
    history = reporter.get_version_history(limit)

    if not history:
        click.echo("暂无版本历史")
        return

    click.echo(f"版本冻结历史 (最近 {len(history)} 条):\n")

    for h in history:
        click.echo(f"📌 {h['report_id']}")
        click.echo(f"   冻结时间: {h['frozen_at']}")
        click.echo(f"   备注: {h.get('freeze_note', '无')}")
        click.echo()


@click.group()
def report():
    """巡检报告管理"""
    pass

cli.add_command(report)


@report.command(name='list')
@click.option('--limit', default=10, help='显示最近N条报告')
def list_reports(limit):
    """列出所有巡检报告"""
    reporter = ReportGenerator()
    reports = reporter.list_reports()[:limit]

    if not reports:
        click.echo("暂无巡检报告")
        return

    click.echo(f"巡检报告列表 (共 {len(reports)} 个):\n")

    for i, r in enumerate(reports, 1):
        summary = r.get('summary', {})
        click.echo(f"{i}. 📊 {r['report_id']}")
        click.echo(f"   生成时间: {r['generated_at']}")
        click.echo(f"   总文件数: {summary.get('total_files', 0)}")
        click.echo(f"   编码异常: {summary.get('invalid_encoding', 0)} 个")
        click.echo()


@report.command(name='show')
@click.argument('report_id')
def show_report(report_id):
    """查看指定报告详情"""
    reporter = ReportGenerator()
    report = reporter.get_report(report_id)

    if not report:
        click.echo(f"❌ 报告不存在: {report_id}")
        return

    summary = report.get('summary', {})
    results = report.get('results', [])

    click.echo(f"📊 报告详情: {report_id}")
    click.echo(f"   生成时间: {report.get('generated_at', '未知')}\n")

    click.echo("【执行摘要】")
    click.echo(f"   总文件数: {summary.get('total_files', 0)}")
    click.echo(f"   编码有效: {summary.get('valid_encoding', 0)}")
    click.echo(f"   编码异常: {summary.get('invalid_encoding', 0)}")
    click.echo(f"   含BOM标记: {summary.get('has_bom', 0)}")
    click.echo()

    click.echo("【编码分布】")
    encoding_dist = summary.get('encoding_distribution', {})
    if encoding_dist:
        for enc, count in encoding_dist.items():
            click.echo(f"   - {enc or '未知'}: {count} 个")
    else:
        click.echo("   无编码分布数据")
    click.echo()

    click.echo("【文件检测结果】")
    for i, r in enumerate(results, 1):
        status = "✅" if r.get('is_valid') else "❌"
        click.echo(f"   {status} {r.get('file_name')}")
        click.echo(f"      编码: {r.get('encoding', '未知')}")
        click.echo(f"      置信度: {r.get('confidence', 0):.2f}")
        if r.get('error'):
            click.echo(f"      错误: {r['error']}")
    click.echo()


@report.command(name='full')
@click.argument('report_id')
def full_report(report_id):
    """查看完整报告（含版本冻结信息）"""
    reporter = ReportGenerator()
    full = reporter.get_full_report(report_id)

    if not full:
        click.echo(f"❌ 报告不存在: {report_id}")
        return

    show_report.callback(report_id)

    version = full.get('version')
    if version:
        click.echo("【版本冻结信息】")
        click.echo(f"   冻结时间: {version.get('frozen_at', '未知')}")
        click.echo(f"   冻结备注: {version.get('freeze_note', '无')}")
        click.echo(f"   校验和: {version.get('checksum', '无')}")
        click.echo()


@cli.command()
@click.argument('report_id')
def export(report_id):
    """导出报告供下载"""
    reporter = ReportGenerator()
    result = reporter.export_for_download(report_id)

    if not result['formats']:
        click.echo(f"❌ 报告 {report_id} 不存在")
        return

    click.echo(f"报告导出信息:\n")
    for fmt in result['formats']:
        click.echo(f"  📄 {fmt['format'].upper()}")
        click.echo(f"     路径: {fmt['path']}")
        click.echo(f"     大小: {fmt['size']} bytes\n")


@cli.command()
def info():
    """显示工具信息"""
    from . import __version__
    click.echo(f"文件编码巡检工具 v{__version__}")
    click.echo()
    click.echo("功能特性:")
    click.echo("  ✅ 批量文件编码检测")
    click.echo("  ✅ 过期审批催办列表演示数据")
    click.echo("  ✅ 候选清单生成与人工确认")
    click.echo("  ✅ 异常样本单独留存")
    click.echo("  ✅ 失败项单独保存")
    click.echo("  ✅ JSON/Markdown多格式输出")
    click.echo("  ✅ 版本冻结通知追踪")


if __name__ == '__main__':
    cli()
