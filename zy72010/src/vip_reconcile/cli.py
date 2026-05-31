import os
import sys
import json
from typing import List, Optional

import click

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from vip_reconcile.data_reader import (
    load_expected_vouchers,
    load_all_evidence,
    load_attachment_index,
    load_manual_notes
)
from vip_reconcile.reconciler import Reconciler
from vip_reconcile.exporter import FinanceExporter
from vip_reconcile.reporter import TerminalReporter
from vip_reconcile.models import ReconciliationRecord, MatchStatus


def _save_state(records: List[ReconciliationRecord], state_file: str) -> None:
    import pickle
    with open(state_file, 'wb') as f:
        pickle.dump(records, f)


def _load_state(state_file: str) -> List[ReconciliationRecord]:
    import pickle
    with open(state_file, 'rb') as f:
        return pickle.load(f)


@click.group()
@click.version_option(version="1.0.0", prog_name="vip-reconcile")
def cli():
    """机场贵宾券核销对账工具

    用于处理机场贵宾券核销对账，支持CSV/Excel数据导入、
    自动匹配对账、冲突检测、晚到附件处理、人工备注补录，
    最终导出财务明细报表。
    """
    pass


@cli.command()
@click.option('--vouchers', '-v', required=True, type=click.Path(exists=True),
              help='核销清单文件路径（CSV/Excel）')
@click.option('--evidence-dir', '-e', required=True, type=click.Path(exists=True),
              help='证据文件目录（包含收款流水、退款申请、审批邮件、银企回单等）')
@click.option('--attachments', '-a', type=click.Path(exists=True),
              help='附件索引文件路径（可选）')
@click.option('--output-dir', '-o', default='output', type=click.Path(),
              help='输出目录，默认: output')
@click.option('--operator', default='小孟', help='操作人姓名，默认: 小孟')
@click.option('--state-file', default='.reconcile_state.pkl',
              help='状态保存文件，用于后续补录备注')
def run(vouchers, evidence_dir, attachments, output_dir, operator, state_file):
    """运行完整对账流程

    示例:
      vip-reconcile run -v samples/voucher_list.csv -e samples/
    """
    click.echo(click.style("开始机场贵宾券核销对账...", fg='cyan', bold=True))

    click.echo(f"  读取核销清单: {vouchers}")
    records = load_expected_vouchers(vouchers)
    click.echo(f"  共加载 {len(records)} 条核销记录")

    click.echo(f"  读取证据文件目录: {evidence_dir}")
    evidence_map = load_all_evidence(evidence_dir)
    ev_count = sum(len(v) for v in evidence_map.values())
    click.echo(f"  共加载 {ev_count} 条证据记录，涉及 {len(evidence_map)} 个凭证")

    reconciler = Reconciler(operator=operator)
    reconciler.associate_evidence(records, evidence_map)

    if attachments and os.path.exists(attachments):
        click.echo(f"  读取附件索引: {attachments}")
        attachment_map = load_attachment_index(attachments)
        at_count = sum(len(v) for v in attachment_map.values())
        click.echo(f"  共加载 {at_count} 条附件索引记录")
        reconciler.associate_evidence(records, attachment_map)

    click.echo("  执行对账匹配...")
    records = reconciler.reconcile(records)

    reporter = TerminalReporter()
    reporter.print_summary(records)

    exporter = FinanceExporter(output_dir=output_dir)
    excel_path = exporter.export_to_finance_excel(records)
    csv_path = exporter.export_to_csv(records)

    _save_state(records, state_file)

    click.echo(click.style("\n对账完成！", fg='green', bold=True))
    click.echo(f"  财务明细 Excel: {click.format_filename(excel_path)}")
    click.echo(f"  财务明细 CSV:   {click.format_filename(csv_path)}")
    click.echo(f"  中间状态文件:   {state_file}")
    click.echo("\n下一步操作建议:")
    click.echo("  1. 查看导出的 Excel 文件，核对明细")
    click.echo("  2. 如需补录备注，使用: vip-reconcile add-note --voucher <编号> --note <内容>")
    click.echo("  3. 如需追加晚到附件，使用: vip-reconcile add-late-evidence --file <附件文件>")


@cli.command("add-note")
@click.option('--voucher', required=True, help='凭证编号')
@click.option('--note', required=True, help='备注内容')
@click.option('--operator', default='小孟', help='操作人姓名，默认: 小孟')
@click.option('--state-file', default='.reconcile_state.pkl',
              help='之前运行对账保存的状态文件')
@click.option('--output-dir', '-o', default='output', type=click.Path(),
              help='输出目录，默认: output')
def add_note(voucher, note, operator, state_file, output_dir):
    """临时补录备注，补录后重新判断并展示差异

    示例:
      vip-reconcile add-note --voucher VIP202605001 --note "客户同意补差价"
    """
    if not os.path.exists(state_file):
        click.echo(click.style(f"错误: 状态文件 {state_file} 不存在，请先运行对账", fg='red'))
        return

    click.echo(f"加载对账状态: {state_file}")
    records = _load_state(state_file)

    reconciler = Reconciler(operator=operator)
    result = reconciler.apply_manual_note(records, voucher, note, operator)

    reporter = TerminalReporter()
    reporter.print_manual_note_result(result)

    if result:
        exporter = FinanceExporter(output_dir=output_dir)
        excel_path = exporter.export_to_finance_excel(records)
        _save_state(records, state_file)
        click.echo(f"已更新财务明细 Excel: {click.format_filename(excel_path)}")


@cli.command("add-late-evidence")
@click.option('--file', 'evidence_file', required=True, type=click.Path(exists=True),
              help='晚到的证据文件路径（CSV/Excel）')
@click.option('--operator', default='小孟', help='操作人姓名，默认: 小孟')
@click.option('--state-file', default='.reconcile_state.pkl',
              help='之前运行对账保存的状态文件')
@click.option('--output-dir', '-o', default='output', type=click.Path(),
              help='输出目录，默认: output')
def add_late_evidence(evidence_file, operator, state_file, output_dir):
    """追加晚到附件，不直接覆盖原判断，保留变化记录

    示例:
      vip-reconcile add-late-evidence --file samples/late_attachment.csv
    """
    if not os.path.exists(state_file):
        click.echo(click.style(f"错误: 状态文件 {state_file} 不存在，请先运行对账", fg='red'))
        return

    click.echo(f"加载对账状态: {state_file}")
    records = _load_state(state_file)

    click.echo(f"读取晚到证据文件: {evidence_file}")

    from vip_reconcile.data_reader import (
        load_payment_receipts,
        load_refund_requests,
        load_approval_emails,
        load_bank_receipts,
        load_manual_notes,
        load_attachment_index
    )

    fname = os.path.basename(evidence_file).lower()
    late_evidence = {}

    if 'payment' in fname or '收款' in fname:
        ev_list = load_payment_receipts(evidence_file)
    elif 'refund' in fname or '退款' in fname:
        ev_list = load_refund_requests(evidence_file)
    elif 'approval' in fname or '审批' in fname:
        ev_list = load_approval_emails(evidence_file)
    elif 'bank' in fname or '回单' in fname:
        ev_list = load_bank_receipts(evidence_file)
    elif 'note' in fname or '备注' in fname:
        ev_list = load_manual_notes(evidence_file)
    elif 'attachment' in fname or '附件' in fname:
        late_evidence = load_attachment_index(evidence_file)
        ev_list = []
    else:
        click.echo(click.style(f"警告: 无法识别文件类型，尝试按附件索引处理", fg='yellow'))
        try:
            late_evidence = load_attachment_index(evidence_file)
            ev_list = []
        except Exception as e:
            click.echo(click.style(f"错误: 无法解析文件: {e}", fg='red'))
            return

    if ev_list:
        for ev in ev_list:
            if ev.voucher_no:
                if ev.voucher_no not in late_evidence:
                    late_evidence[ev.voucher_no] = []
                late_evidence[ev.voucher_no].append(ev)

    ev_count = sum(len(v) for v in late_evidence.values())
    click.echo(f"  共加载 {ev_count} 条晚到证据记录，涉及 {len(late_evidence)} 个凭证")

    reconciler = Reconciler(operator=operator)
    changes = reconciler.apply_late_evidence(records, late_evidence)

    reporter = TerminalReporter()
    reporter.print_late_evidence_changes(changes)

    exporter = FinanceExporter(output_dir=output_dir)
    excel_path = exporter.export_to_finance_excel(records)
    _save_state(records, state_file)
    click.echo(f"已更新财务明细 Excel: {click.format_filename(excel_path)}")


@cli.command("show-history")
@click.option('--voucher', help='指定凭证编号查看历史，不指定则显示全部')
@click.option('--state-file', default='.reconcile_state.pkl',
              help='之前运行对账保存的状态文件')
def show_history(voucher, state_file):
    """查看判断历史记录

    示例:
      vip-reconcile show-history
      vip-reconcile show-history --voucher VIP202605001
    """
    if not os.path.exists(state_file):
        click.echo(click.style(f"错误: 状态文件 {state_file} 不存在，请先运行对账", fg='red'))
        return

    records = _load_state(state_file)

    if voucher:
        records = [r for r in records if r.voucher_no == voucher]
        if not records:
            click.echo(click.style(f"未找到凭证编号: {voucher}", fg='yellow'))
            return

    click.echo(click.style("\n判断历史记录", bold=True))
    click.echo("-" * 80)

    for r in records:
        click.echo(f"\n{click.style(r.voucher_no, bold=True)} - {r.passenger_name} - {r.flight_no}")
        click.echo(f"  当前状态: {click.style(r.current_status.value, fg='cyan')}")
        for i, j in enumerate(r.judgment_history):
            color_before = _get_status_color(j.status_before)
            color_after = _get_status_color(j.status_after)
            click.echo(f"  [{i+1}] {j.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            click.echo(f"      {click.style(j.status_before.value, fg=color_before)} → "
                       f"{click.style(j.status_after.value, fg=color_after)}")
            click.echo(f"      原因: {j.reason}")
            click.echo(f"      操作人: {j.operator}")
            if j.evidence_refs:
                click.echo(f"      证据: {', '.join(j.evidence_refs)}")

    if records and records[0].manual_notes:
        click.echo(f"\n{click.style('人工备注:', bold=True)}")
        for note in records[0].manual_notes:
            click.echo(f"  {note}")

    if records and records[0].suggestions:
        click.echo(f"\n{click.style('处理建议:', bold=True)}")
        for s in records[0].suggestions:
            click.echo(f"  {s}")


def _get_status_color(status: MatchStatus) -> str:
    mapping = {
        MatchStatus.CONFIRMED: 'green',
        MatchStatus.PENDING_MATERIALS: 'yellow',
        MatchStatus.MANUAL_REVIEW: 'blue',
        MatchStatus.CONFLICT: 'red',
        MatchStatus.UNMATCHED: 'yellow'
    }
    return mapping.get(status, 'white')


@cli.command("demo")
@click.option('--output-dir', '-o', default='output', type=click.Path(),
              help='输出目录，默认: output')
def demo(output_dir):
    """使用内置样例数据演示完整流程（先对账，再补录备注）

    示例:
      vip-reconcile demo
    """
    base_dir = os.path.join(os.path.dirname(__file__), '..', '..')
    samples_dir = os.path.abspath(os.path.join(base_dir, 'samples'))

    click.echo(click.style("=" * 60, fg='cyan'))
    click.echo(click.style("  机场贵宾券核销对账 - 完整流程演示", fg='cyan', bold=True))
    click.echo(click.style("=" * 60, fg='cyan'))

    click.echo("\n" + click.style("【第一步】运行初始对账", bold=True))
    vouchers = os.path.join(samples_dir, 'voucher_list.csv')
    attachments = os.path.join(samples_dir, 'attachment_index.csv')

    from subprocess import run, PIPE
    result = run([
        sys.executable, '-m', 'vip_reconcile.cli', 'run',
        '-v', vouchers,
        '-e', samples_dir,
        '-a', attachments,
        '-o', output_dir,
        '--operator', '小孟'
    ], cwd=os.path.join(base_dir, 'src'))

    if result.returncode != 0:
        click.echo(click.style("第一步执行失败", fg='red'))
        return

    click.echo("\n" + click.style("【第二步】模拟运营主管小孟临时补录备注", bold=True))
    click.echo(click.style("  场景: 小孟接到VIP202605002客户电话，确认20元优惠券有效", fg='yellow'))

    result = run([
        sys.executable, '-m', 'vip_reconcile.cli', 'add-note',
        '--voucher', 'VIP202605002',
        '--note', '客户来电确认20元优惠券有效，此差异为正常折扣，可确认入账',
        '--operator', '小孟',
        '-o', output_dir
    ], cwd=os.path.join(base_dir, 'src'))

    if result.returncode != 0:
        click.echo(click.style("第二步执行失败", fg='red'))
        return

    click.echo("\n" + click.style("【第三步】查看VIP202605002的完整判断历史", bold=True))
    result = run([
        sys.executable, '-m', 'vip_reconcile.cli', 'show-history',
        '--voucher', 'VIP202605002'
    ], cwd=os.path.join(base_dir, 'src'))

    click.echo("\n" + click.style("=" * 60, fg='cyan'))
    click.echo(click.style("  演示完成！请查看 output/ 目录下的 Excel 文件", fg='cyan', bold=True))
    click.echo(click.style("=" * 60, fg='cyan'))


if __name__ == '__main__':
    cli()
