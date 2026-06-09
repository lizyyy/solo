import click
from datetime import datetime
import sys

sys.path.insert(0, '.')

from config import Config
from storage import DataStore
from core import DuplicateDetector, WeightUpdater


@click.group()
def cli():
    """随机游走资产敞口 - 评分权重表处理工具
    完整支持：边界值检测、重复复核、人工修正、重跑、报告导出
    """
    pass


@cli.command('init-demo')
@click.argument('demo_data_dir', default='./data')
def init_demo(demo_data_dir):
    """初始化演示数据（含边界值、重复答案、旧口径、顺利记录四种典型）
    """
    import os
    import pandas as pd

    os.makedirs(demo_data_dir, exist_ok=True)

    answers_df = pd.DataFrame([
        {
            "answer_id": "A001",
            "student_id": "S001",
            "student_name": "张三",
            "question_id": "Q1",
            "answer_content": "这是一份完整的答题内容，结构清晰、论证充分、符合评分标准所有要点。",
            "score": 85.0,
            "submitted_at": "2024-01-15 10:30:00",
            "notes": "顺利记录样例：答题正常、评分正常，无任何异常"
        },
        {
            "answer_id": "A002",
            "student_id": "S002",
            "student_name": "李四",
            "question_id": "Q1",
            "answer_content": "第一版初步作答，部分要点未展开论述完整。",
            "score": 78.0,
            "submitted_at": "2024-01-15 11:00:00",
            "notes": "重复答案样例：同一学生两版答案（第1版）"
        },
        {
            "answer_id": "A003",
            "student_id": "S002",
            "student_name": "李四",
            "question_id": "Q1",
            "answer_content": "第二版补充修改后完整作答，补充了缺失要点、调整了论述逻辑，比第一版更完整。",
            "score": 88.0,
            "submitted_at": "2024-01-15 14:30:00",
            "notes": "重复答案样例：同一学生两版答案（第2版重交版）"
        },
        {
            "answer_id": "A004",
            "student_id": "S003",
            "student_name": "王五",
            "question_id": "Q2",
            "answer_content": "旧评分标准下的作答，在当时标准下得分较高，但在新标准中权重需要调整。",
            "score": 92.0,
            "submitted_at": "2024-01-10 09:00:00",
            "notes": "旧口径样例：后续将由运营规划阿岚补看评分权重表后补录误差说明"
        },
        {
            "answer_id": "A005",
            "student_id": "S004",
            "student_name": "赵六",
            "question_id": "Q3",
            "answer_content": "满分",
            "score": 100.0,
            "submitted_at": "2024-01-16 15:20:00",
            "notes": "边界值样例：满分触发边界检查，答案内容过短也需告警（实际内容丰富度与得分不匹配）"
        },
        {
            "answer_id": "A006",
            "student_id": "S005",
            "student_name": "孙七",
            "question_id": "Q3",
            "answer_content": "基本答出了及格线附近的要点，部分论述稍显薄弱。",
            "score": 60.0,
            "submitted_at": "2024-01-16 16:45:00",
            "notes": "边界值样例：及格线附近（60分），建议复核评分公允性"
        },
    ])

    answers_path = os.path.join(demo_data_dir, "demo_answers.xlsx")
    answers_df.to_excel(answers_path, index=False)

    weights_df = pd.DataFrame([
        {
            "weight_id": "W001",
            "question_id": "Q2",
            "dimension": "逻辑完整性",
            "weight": 0.9,
            "standard_version": "V1.0",
            "effective_date": "2024-01-01",
            "remarks": "【运营规划阿岚备注】此题为早期命题，2024年1月起评分标准调整为新口径V2.0，V1.0旧标准下的得分需要按0.9系数折算并补录说明，避免新旧口径混算。2024-01-10及之前提交的Q2题均适用。"
        },
        {
            "weight_id": "W002",
            "question_id": "Q3",
            "dimension": "答案详实度",
            "weight": 0.85,
            "standard_version": "V1.5",
            "effective_date": "2024-01-15",
            "remarks": "【运营规划阿岚备注】Q3题发现存在答案过短但给分偏高的现象，补录此权重系数用于事后抽检和校准。仅对2024-01-15~01-20期间提交生效。"
        },
    ])

    weights_path = os.path.join(demo_data_dir, "demo_weights.xlsx")
    weights_df.to_excel(weights_path, index=False)

    click.echo("=" * 60)
    click.echo("演示数据已生成（小而真，覆盖四种典型 + 两种边界值）：")
    click.echo("=" * 60)
    click.echo(f"  - 学生答案（6条）: {answers_path}")
    click.echo("      ① 张三-Q1：顺利记录，无异常")
    click.echo("      ② 李四-Q1-v1：重复答案（第1版，78分）")
    click.echo("      ③ 李四-Q1-v2：重复答案（第2版，88分）")
    click.echo("      ④ 王五-Q2：旧口径（后续补录V1.0权重）")
    click.echo("      ⑤ 赵六-Q3：边界值（满分100分）")
    click.echo("      ⑥ 孙七-Q3：边界值（及格线60分）")
    click.echo(f"  - 评分权重表（2条）: {weights_path}")
    click.echo("      W001 Q2-V1.0系数0.9：运营规划阿岚备注完整")
    click.echo("      W002 Q3-V1.5系数0.85：答案详实度校准用")
    click.echo("=" * 60)
    click.echo("建议给新人讲流程的操作路径：")
    click.echo("  Step1: python3 cli.py import-answers ./data/demo_answers.xlsx")
    click.echo("            → 导入+自动检测边界值+重复答案挂起待复核")
    click.echo("  Step2: python3 cli.py status")
    click.echo("            → 看摘要（边界告警2条、重复待复核2条）")
    click.echo("  Step3: python3 cli.py detail <记录ID>")
    click.echo("            → 看某条的完整详情、历史、边界说明")
    click.echo("  Step4: python3 cli.py import-weights ./data/demo_weights.xlsx")
    click.echo("            → 运营规划阿岚补录权重表（带完整备注）")
    click.echo("  Step5: python3 cli.py apply-weights")
    click.echo("            → 自动生成误差说明，记录变更历史")
    click.echo("  Step6: python3 cli.py review <记录ID> --reviewer 业务运营小张")
    click.echo("            → 对重复答案进行复核（保留原始说法、改后值、原因、下一步找谁）")
    click.echo("  Step7: python3 cli.py correct <记录ID> --operator 运营规划阿岚")
    click.echo("            → 人工修正一次（形成一条修正记录）")
    click.echo("  Step8: python3 cli.py rerun --operator 运营规划阿岚")
    click.echo("            → 重跑权重应用一次，形成重跑痕迹")
    click.echo("  Step9: python3 cli.py export")
    click.echo("            → 导出完整报告Excel（摘要+明细+历史+误差）")
    click.echo("  Step10: python3 cli.py status")
    click.echo("            → 最终状态一致（同一份最新数据）")
    click.echo("  也可一键跑通：python3 cli.py run-demo")


@cli.command('import-answers')
@click.argument('excel_path')
@click.option('--batch', default=None, help='导入批次号，默认自动生成')
def import_answers(excel_path, batch):
    """导入学生答案（自动：边界值检测 + 重复答案检测并挂起待复核）
    """
    batch = batch or f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    store = DataStore()
    answers = store.import_answers_from_excel(excel_path, batch)
    click.echo(f"[导入] 共导入 {len(answers)} 条答案，批次号：{batch}")

    all_answers = store.get_all_answers()
    all_answers = DuplicateDetector.mark_duplicates(all_answers)
    store._save_all()

    boundary_alerts = store.get_boundary_alerts()
    duplicates = store.get_duplicates_pending()

    click.echo(f"[边界值] 自动检测触发 {len(boundary_alerts)} 条边界值告警")
    for a in boundary_alerts:
        for bn in (a.boundary_notes or []):
            click.echo(f"  → {a.student_name}({a.question_id}) {a.score}分: {bn.get('description','')}")

    click.echo(f"[重复检测] 自动挂起 {len(duplicates)} 条重复提交，待业务运营复核（不提前归正常）")
    for a in duplicates:
        click.echo(f"  → {a.student_name}({a.question_id}) 第{a.version}版 {a.score}分: {a.submitted_at}")

    click.echo("导入流程完成，所有痕迹已保留在记录备注和修改历史中。")


@cli.command('import-weights')
@click.argument('excel_path')
def import_weights(excel_path):
    """导入评分权重表（运营规划阿岚补录动作，备注一起保留）
    """
    store = DataStore()
    weights = store.import_weights_from_excel(excel_path)
    click.echo(f"[补录权重表] 共导入 {len(weights)} 条权重配置")
    for w in weights:
        click.echo(f"  → {w.id} {w.question_id}-{w.standard_version} 系数{w.weight}: {w.remarks[:60]}...")


@cli.command('apply-weights')
@click.option('--all', is_flag=True, help='对所有历史答案应用（含已处理过的，默认仅NORMAL）')
@click.option('--operator', default='运营规划阿岚', help='操作人（用于修改历史）')
def apply_weights(all, operator):
    """应用评分权重表补录 → 自动生成误差说明并写入修改历史
    """
    store = DataStore()
    weights = store.get_all_weights()
    answers = store.get_all_answers()

    if not all:
        answers = [a for a in answers if a.status == "NORMAL" or a.status == "BOUNDARY_ALERT"]

    error_logs = WeightUpdater.apply_old_standard_update(
        answers, weights, rerun=False, operator=operator
    )
    store.add_error_logs(error_logs)
    store._save_all()
    click.echo(f"[补录误差说明] 共生成 {len(error_logs)} 条误差日志")
    for e in error_logs:
        click.echo(f"  → {e.id} {e.answer_id}: {e.description[:80]}...")


@cli.command('rerun')
@click.option('--operator', default='运营规划阿岚', help='操作人')
@click.option('--comment', default='', help='重跑说明（会保留在修改历史中）')
def rerun(operator, comment):
    """重跑：重新应用全部权重（模拟"补录后再重跑一次"流程）
    """
    store = DataStore()
    result = store.rerun_weight_application(operator=operator, comment=comment)
    click.echo(f"[重跑] 操作人：{operator}")
    click.echo(f"       涉及记录：{result['rerun_records']} 条")
    click.echo(f"       新增误差说明：{result['new_error_logs']} 条")
    if comment:
        click.echo(f"       重跑说明：{comment}")


@cli.command()
def status():
    """摘要概览：状态分布 + 边界告警 + 误差 + 重跑统计
    """
    store = DataStore()
    answers = store.get_all_answers()
    weights = store.get_all_weights()
    errors = store.get_all_error_logs()
    boundary = store.get_boundary_alerts()
    duplicates = store.get_duplicates_pending()

    click.echo("=" * 60)
    click.echo("【随机游走资产敞口】数据概览（摘要）")
    click.echo("=" * 60)
    click.echo(f"📝 学生答案总数  : {len(answers)}")
    click.echo(f"⚖️  权重规则数    : {len(weights)}")
    click.echo(f"🔔 误差说明总数  : {len(errors)}")
    click.echo("-" * 60)
    click.echo("📊 状态分布：")
    status_counts = {}
    for a in answers:
        status_counts[a.status] = status_counts.get(a.status, 0) + 1
    for st, cnt in sorted(status_counts.items(), key=lambda x: -x[1]):
        name = Config.STATUS_TYPES.get(st, st)
        color = Config.STATUS_COLORS.get(st, "#333")
        click.echo(f"   {name} ({st}): {cnt} 条")
    click.echo("-" * 60)
    click.echo(f"⚠️  边界值告警记录: {len(boundary)} 条")
    for a in boundary:
        bn_types = [Config.BOUNDARY_TYPES.get(b.get('boundary_type',''), b.get('boundary_type',''))
                    for b in (a.boundary_notes or [])]
        click.echo(f"   → {a.id} {a.student_name}({a.question_id}) {a.score}分 {','.join(bn_types)}")
    click.echo(f"⏳ 重复待复核记录: {len(duplicates)} 条（留给业务运营，未提前归正常）")
    for a in duplicates:
        click.echo(f"   → {a.id} {a.student_name}({a.question_id}) 第{a.version}版 {a.score}分")
    rerun_total = sum(1 for a in answers if a.rerun_count > 0)
    revision_total = sum(len(a.revision_history or []) for a in answers)
    click.echo(f"🔁 已重跑过的记录: {rerun_total} 条")
    click.echo(f"📜 修改历史记录数: {revision_total} 条")
    click.echo("=" * 60)


@cli.command()
@click.argument('answer_id')
def detail(answer_id):
    """查看单条记录详情（列表/摘要/复核详情/历史/边界/误差 同一份最新数据联动展示）
    """
    store = DataStore()
    a = store.get_answer_by_id(answer_id)
    if not a:
        click.echo(f"❌ 未找到记录：{answer_id}")
        return

    err_logs = store.get_error_logs_by_answer(a.id)
    same_group = store.get_answers_by_student_question(a.student_id, a.question_id)

    click.echo("=" * 60)
    click.echo(f"【详情视图】{a.id} | 状态: {Config.STATUS_TYPES.get(a.status, a.status)}")
    click.echo("=" * 60)
    click.echo(f"学生: {a.student_name} ({a.student_id})")
    click.echo(f"题目: {a.question_id}")
    click.echo(f"答案内容: {a.answer_content}")
    click.echo(f"原始得分: {a.original_score}  |  当前得分: {a.score}  |  调整后得分: {a.adjusted_score or '-'}")
    click.echo(f"提交时间: {a.submitted_at}")
    click.echo(f"版本号: v{a.version}")
    click.echo(f"导入批次: {a.import_batch}")
    click.echo(f"重跑次数: {a.rerun_count} 次，最近重跑: {a.last_rerun_at or '-'}")
    click.echo(f"复核人: {a.reviewed_by or '-'}，复核时间: {a.reviewed_at or '-'}")
    click.echo(f"完整备注: {a.notes or '-'}")

    if a.boundary_notes:
        click.echo("-" * 40)
        click.echo("🔶 边界值说明（保留第一次导入触发的原始说明）：")
        for idx, bn in enumerate(a.boundary_notes, 1):
            click.echo(f"  [{idx}] {Config.BOUNDARY_TYPES.get(bn.get('boundary_type',''), bn.get('boundary_type',''))}")
            click.echo(f"       说明: {bn.get('description','')}")
            click.echo(f"       阈值参考: {bn.get('threshold_ref','')} 触发时间: {bn.get('triggered_at','')}")

    if a.review_detail and (a.review_detail.get('original_claim') or a.review_detail.get('corrected_value')):
        click.echo("-" * 40)
        click.echo("🔷 复核详情（保留原始说法+改后值+原因+下一步找谁）：")
        rd = a.review_detail
        click.echo(f"  【原始说法】  : {rd.get('original_claim','(空)')}")
        click.echo(f"  【改后的值】  : {rd.get('corrected_value','(空)')}")
        click.echo(f"  【处理原因】  : {rd.get('handling_reason','(空)')}")
        click.echo(f"  【下一步动作】: {rd.get('next_step','(空)')}")
        click.echo(f"  【下一步找谁】: {rd.get('next_contact','(空)')}")
        click.echo(f"  复核意见: {rd.get('review_opinion','')}")
        click.echo(f"  复核得分: {rd.get('reviewed_score','(未改分)')}")

    if a.revision_history:
        click.echo("-" * 40)
        click.echo("📜 修改历史轨迹（人工修正+系统变更全部保留）：")
        for idx, rev in enumerate(a.revision_history, 1):
            click.echo(f"  [{idx}] {rev.get('operated_at','')}")
            click.echo(f"       操作人: {rev.get('operator','')}")
            click.echo(f"       字段: {rev.get('field_name','')}")
            click.echo(f"       原值: {rev.get('old_value','')}")
            click.echo(f"       新值: {rev.get('new_value','')}")
            click.echo(f"       原因: {rev.get('reason','')}")
            if rev.get('next_step') or rev.get('next_contact'):
                click.echo(f"       下一步: {rev.get('next_step','')} / 找: {rev.get('next_contact','')}")

    if same_group and len(same_group) > 1:
        click.echo("-" * 40)
        click.echo("🔗 同学生同题的其他版本（同一条重复组联动展示）：")
        for other in sorted(same_group, key=lambda x: x.version):
            tag = "←当前" if other.id == a.id else ""
            click.echo(f"  v{other.version} {other.id} {other.score}分 {other.submitted_at} {Config.STATUS_TYPES.get(other.status, other.status)} {tag}")

    if err_logs:
        click.echo("-" * 40)
        click.echo("🔴 关联的误差说明记录：")
        for e in err_logs:
            click.echo(f"  {e.id} [{e.error_type}] {e.source}")
            click.echo(f"    原{e.original_score}→调后{e.adjusted_score}（权重{e.weight_factor}，版本{e.weight_version}）")
            click.echo(f"    详细: {e.description}")

    click.echo("=" * 60)
    click.echo("👆 以上列表/详情/摘要/历史/误差全部来自同一份最新数据，保持一致。")


@cli.command()
@click.argument('answer_id')
@click.option('--reviewer', required=True, help='复核人（业务运营姓名）')
@click.option('--keep/--discard', default=True, help='是否保留此版答案')
@click.option('--score', type=float, default=None, help='复核后调整得分（不调整则不填）')
@click.option('--opinion', default='', help='复核意见')
@click.option('--reason', default='', help='处理原因')
@click.option('--next-step', default='', help='下一步动作')
@click.option('--next-contact', default='', help='下一步找谁（对接人）')
@click.option('--corrected-value', default='', help='改后的值描述')
def review(answer_id, reviewer, keep, score, opinion, reason, next_step, next_contact, corrected_value):
    """业务运营复核：对重复答案复核（保留原始说法+改后值+原因+下一步找谁，不提前归正常）
    """
    store = DataStore()
    result = store.review_duplicate(
        answer_id=answer_id,
        reviewer=reviewer,
        keep=keep,
        reviewed_score=score,
        review_opinion=opinion,
        correction_reason=reason,
        next_step=next_step,
        next_contact=next_contact,
        corrected_value=corrected_value,
    )
    if result["success"]:
        click.echo(f"✅ {result['message']}")
        click.echo(f"   复核人: {reviewer}，保留: {'是' if keep else '否'}，调整得分: {score or '未改分'}")
        if "error_log_id" in result:
            click.echo(f"   同步生成误差说明: {result['error_log_id']}")
        click.echo(f"   💡 复核完成后状态是 REVIEWED（已复核），但原始说法+修改历史均保留，未被洗成干净数据。")
        click.echo(f"   💡 请再执行 `python3 cli.py detail {answer_id}` 查看复核详情五要素是否一致。")
    else:
        click.echo(f"❌ 复核失败：{result['message']}")


@cli.command()
@click.argument('answer_id')
@click.option('--operator', required=True, help='操作人（谁来修正）')
@click.option('--field', 'field_name', required=True, help='修正字段名：score / status / notes')
@click.option('--new-value', 'new_value', required=True, help='改后的值')
@click.option('--reason', required=True, help='修正原因')
@click.option('--next-step', default='', help='下一步动作')
@click.option('--next-contact', default='', help='下一步找谁')
def correct(answer_id, operator, field_name, new_value, reason, next_step, next_contact):
    """人工修正（一次人工修正流程样例）：改字段 + 保留原始值 + 原因 + 下一步找谁
    """
    store = DataStore()
    a = store.get_answer_by_id(answer_id)
    if not a:
        click.echo(f"❌ 未找到记录：{answer_id}")
        return
    old_value = getattr(a, field_name, None)
    if old_value is None:
        click.echo(f"❌ 字段 {field_name} 不存在或为空")
        return
    success = store.manual_correct_answer(
        answer_id=answer_id,
        operator=operator,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        next_step=next_step,
        next_contact=next_contact,
    )
    if success:
        click.echo(f"✅ 人工修正完成：")
        click.echo(f"   操作人: {operator}")
        click.echo(f"   字段: {field_name}")
        click.echo(f"   原值: {old_value} → 新值: {new_value}")
        click.echo(f"   原因: {reason}")
        if next_step or next_contact:
            click.echo(f"   下一步: {next_step} / 找谁: {next_contact}")
        click.echo(f"   💡 修改历史已追加记录，原值未丢失。执行 `python3 cli.py detail {answer_id}` 查看联动。")
    else:
        click.echo("❌ 修正失败")


@cli.command()
@click.option('--output', default=None, help='导出路径，默认自动在 data/reports/ 下生成')
def export(output):
    """导出完整报告（Excel：摘要+答案明细+权重+误差+修改历史，与界面同一份数据）
    """
    store = DataStore()
    path = store.export_report(output)
    click.echo(f"📤 报告已导出: {path}")
    click.echo("   包含 Sheet: 摘要概览 / 答案明细 / 权重明细 / 误差说明明细 / 修改历史明细")
    click.echo("   💡 所有数据与 CLI status/detail、Web小看板保持一致，来自同一份最新状态。")


@cli.command('run-demo')
@click.option('--operator', default='运营规划阿岚', help='演示操作人')
def run_demo(operator):
    """🔥 一键跑通完整演示流程（边界值导入 → 补录权重 → 误差 → 复核 → 人工修正 → 重跑 → 导出）
    """
    import os
    click.echo("=" * 70)
    click.echo("【一键演示】随机游走资产敞口 · 完整业务流程")
    click.echo("=" * 70)
    store = DataStore()
    store.clear_all()
    click.echo("\n[0/8] 清空旧数据，重新开始")
    demo_answers = "./data/demo_answers.xlsx"
    demo_weights = "./data/demo_weights.xlsx"
    if not os.path.exists(demo_answers):
        click.echo("未找到演示数据，先执行 init-demo ...")
        os.system(f"python3 cli.py init-demo")

    click.echo("\n[1/8] 导入学生答案（触发：边界值自动检测 + 重复答案挂起待复核）")
    batch = f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    new_answers = store.import_answers_from_excel(demo_answers, batch)
    all_answers = store.get_all_answers()
    all_answers = DuplicateDetector.mark_duplicates(all_answers)
    store._save_all()
    click.echo(f"  → 导入 {len(new_answers)} 条，批次 {batch}")
    click.echo(f"  → 边界告警 {len(store.get_boundary_alerts())} 条，重复待复核 {len(store.get_duplicates_pending())} 条")

    click.echo("\n[2/8] 运营规划阿岚补录评分权重表（含完整备注，别洗成干净数据）")
    weights = store.import_weights_from_excel(demo_weights)
    click.echo(f"  → 导入 {len(weights)} 条权重规则")
    for w in weights:
        click.echo(f"    {w.question_id}-{w.standard_version} 系数{w.weight}，备注{len(w.remarks)}字")

    click.echo("\n[3/8] 应用权重补录 → 自动生成误差说明（误差说明跟着变化）")
    normals = [a for a in store.get_all_answers() if a.status == "NORMAL" or a.status == "BOUNDARY_ALERT"]
    errors = WeightUpdater.apply_old_standard_update(normals, weights, rerun=False, operator=operator)
    store.add_error_logs(errors)
    store._save_all()
    click.echo(f"  → 生成 {len(errors)} 条误差说明日志")

    pending = store.get_duplicates_pending()
    reviewed_count = 0
    if pending:
        click.echo("\n[4/8] 业务运营复核两版重复答案（不急着归正常，保留原始说法五要素）")
        for idx, dup in enumerate(pending, 1):
            keep = idx == 2
            result = store.review_duplicate(
                answer_id=dup.id,
                reviewer="业务运营小张",
                keep=keep,
                reviewed_score=90.0 if keep else None,
                review_opinion="比对两版内容，第二版补充了关键论述更完整" if keep else "作为历史参考存档",
                correction_reason="系统检测到同一学生重复提交两版，人工比对后选更完整版" if keep else "冗余版本归档",
                next_step="记录复核结论并同步给学生" if keep else "无需后续",
                next_contact="业务运营小张",
                corrected_value=f"{'确认保留' if keep else '标记不保留'}第{dup.version}版，复核得分{90.0 if keep else dup.score}",
            )
            if result["success"]:
                reviewed_count += 1
                click.echo(f"  → {dup.id} {dup.student_name}-v{dup.version}: {'保留' if keep else '弃用'} {result['message']}")
    else:
        click.echo("\n[4/8] 无可复核的重复答案，跳过。")

    click.echo("\n[5/8] 一次人工修正（运营规划阿岚发现边界值有瑕疵，修正备注）")
    boundary_answers = store.get_boundary_alerts()
    corrected = 0
    for ba in boundary_answers:
        if ba.score == 100.0:
            old_val = ba.notes or "(空)"
            ok = store.manual_correct_answer(
                answer_id=ba.id,
                operator=operator,
                field_name="notes",
                old_value=old_val,
                new_value=f"{old_val} 【{operator}人工修正】满分答案确认为真实高分，内容虽短但要点全部覆盖，给分合理，解除给分溢出嫌疑。",
                reason="人工复核确认满分合理，补充备注说明解除边界值疑虑",
                next_step="归档记录，如学生申诉可提供此备注作为依据",
                next_contact=operator,
            )
            if ok:
                corrected += 1
                click.echo(f"  → {ba.id} {ba.student_name} 100分：人工修正备注，满分确认合理")
    click.echo(f"  → 共修正 {corrected} 条")

    click.echo("\n[6/8] 一次重跑（运营规划阿岚补录后重跑一次权重应用）")
    rerun_result = store.rerun_weight_application(
        operator=operator, comment="补录权重表后统一重跑确保所有旧口径均已处理"
    )
    click.echo(f"  → 重跑完成：{rerun_result['rerun_records']} 条记录更新，新增 {rerun_result['new_error_logs']} 条误差说明")

    click.echo("\n[7/8] 导出完整报告")
    report_path = store.export_report()
    click.echo(f"  → 报告已生成：{report_path}")

    click.echo("\n[8/8] 最终状态校验（同一份最新数据，各视图一致）")
    store2 = DataStore()
    answers2 = store2.get_all_answers()
    errors2 = store2.get_all_error_logs()
    click.echo(f"  → 答案 {len(answers2)} 条，误差 {len(errors2)} 条，边界告警 {len(store2.get_boundary_alerts())} 条")
    for a in answers2:
        revisions = len(a.revision_history or [])
        boundaries = len(a.boundary_notes or [])
        review_ok = "✓" if (a.status == "DUPLICATE_PENDING" or (a.review_detail and a.review_detail.get('original_claim')) or a.status != "REVIEWED") else "✗"
        click.echo(f"    {a.id} {a.student_name:>4s} {a.question_id} {Config.STATUS_TYPES.get(a.status, a.status):<8s} 修改{revisions:>2d}次 边界{boundaries:>1d} 复核详情{review_ok}")

    click.echo("\n" + "=" * 70)
    click.echo("🎯 演示完成！三种结果差异清晰可见：")
    click.echo("   ① 张三-Q1：NORMAL 顺利记录（85分，无异常）")
    click.echo("   ② 李四-Q1：REVIEWED 两版答案已业务运营复核（保留v2弃用v1，原始说法仍在）")
    click.echo("   ③ 王五-Q2：RERUN_DONE 旧口径经两次权重应用，误差说明完整保留")
    click.echo("   附带边界值记录也已走完：赵六(100分)、孙七(60分)均保留第一次导入触发的原始说明")
    click.echo("📊 查看小看板：python3 app.py 后访问 http://127.0.0.1:5001")
    click.echo("📤 导出报告：data/reports/ 下最新 xlsx 文件")
    click.echo("=" * 70)


if __name__ == '__main__':
    cli()
