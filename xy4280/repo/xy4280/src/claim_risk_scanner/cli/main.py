import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import print as rprint

project_root = Path(__file__).parent.parent.parent.parent.parent
src_dir = project_root / "src"
if src_dir.exists() and str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from claim_risk_scanner.data_parser import (
    InvoiceParser, ClaimParser, RiskSampleParser,
    InvoiceData, ClaimData, RiskSample
)
from claim_risk_scanner.features import FeatureExtractor, FeatureSet
from claim_risk_scanner.rules import RuleEngine, RiskLevel
from claim_risk_scanner.model import ModelTrainer, RiskModel, ModelConfig
from claim_risk_scanner.storage import (
    Repository, InvoiceRecord, ClaimRecord, RiskSampleRecord, ReviewRecord
)
from claim_risk_scanner.export import Exporter


console = Console()


def get_repo(db_path: Optional[Path] = None) -> Repository:
    if db_path:
        return Repository(Path(db_path))
    return Repository()


@click.group()
@click.version_option(version="0.1.0", prog_name="crs")
@click.option("--db", "-d", type=click.Path(), help="数据库路径")
@click.pass_context
def main(ctx, db):
    """票据篡改线索筛查器 - 保险理赔质检AI/ML工具"""
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = Path(db) if db else None


@main.command()
@click.argument("source", type=click.Path(exists=True))
@click.option("--type", "-t", "data_type", 
              type=click.Choice(["invoice", "claim", "risk_sample"]),
              required=True, help="数据类型")
@click.pass_context
def import_data(ctx, source, data_type):
    """导入数据 (发票JSON、理赔CSV、风险样本)"""
    source_path = Path(source)
    repo = get_repo(ctx.obj.get('db_path'))
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task(f"解析 {data_type} 数据...", total=None)
        
        try:
            if data_type == "invoice":
                parser = InvoiceParser()
                if source_path.is_file():
                    invoices = parser.parse_file(source_path)
                else:
                    invoices = parser.parse_directory(source_path)
                
                records = [
                    InvoiceRecord(
                        invoice_number=inv.invoice_number,
                        invoice_date=inv.invoice_date,
                        vendor_name=inv.vendor_name,
                        vendor_tax_id=inv.vendor_tax_id,
                        total_amount=inv.total_amount,
                        tax_amount=inv.tax_amount,
                        buyer_name=inv.buyer_name,
                        buyer_tax_id=inv.buyer_tax_id,
                        ocr_confidence=inv.ocr_confidence,
                        raw_json=inv.raw_json
                    )
                    for inv in invoices
                ]
                count = repo.add_invoices_batch(records)
                progress.update(task, description=f"已导入 {count} 张发票")
            
            elif data_type == "claim":
                parser = ClaimParser()
                claims = parser.parse_file(source_path)
                
                records = [
                    ClaimRecord(
                        claim_id=c.claim_id,
                        policy_number=c.policy_number,
                        claimant_name=c.claimant_name,
                        claim_date=c.claim_date,
                        claim_amount=c.claim_amount,
                        invoice_number=c.invoice_number,
                        diagnosis=c.diagnosis,
                        hospital_name=c.hospital_name,
                        raw_data=c.raw_data
                    )
                    for c in claims
                ]
                count = repo.add_claims_batch(records)
                progress.update(task, description=f"已导入 {count} 份理赔申请")
            
            elif data_type == "risk_sample":
                parser = RiskSampleParser()
                samples = parser.parse_file(source_path)
                
                records = [
                    RiskSampleRecord(
                        vendor_name=s.vendor_name,
                        vendor_tax_id=s.vendor_tax_id,
                        risk_level=s.risk_level,
                        risk_type=s.risk_type,
                        sample_count=s.sample_count,
                        last_occurrence=s.last_occurrence,
                        raw_data=s.raw_data
                    )
                    for s in samples
                ]
                count = repo.add_risk_samples_batch(records)
                progress.update(task, description=f"已导入 {count} 条风险样本")
            
            console.print(Panel.fit(
                f"[green]✓ 成功导入 {count} 条 {data_type} 数据[/green]",
                title="导入完成"
            ))
            
        except Exception as e:
            console.print(f"[red]✗ 导入失败: {e}[/red]")
            sys.exit(1)


@main.command()
@click.option("--threshold", "-t", default=0.5, type=float, help="风险阈值 (默认 0.5)")
@click.option("--use-model/--no-model", default=True, help="是否使用ML模型预测")
@click.option("--model-path", "-m", type=click.Path(), help="模型路径")
@click.pass_context
def scan(ctx, threshold, use_model, model_path):
    """风险扫描 (规则 + 模型)"""
    repo = get_repo(ctx.obj.get('db_path'))
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        
        task = progress.add_task("加载数据...", total=None)
        invoices = repo.get_all_invoices()
        claims = repo.get_all_claims()
        risk_samples = repo.get_all_risk_samples()
        
        if not invoices:
            console.print("[yellow]⚠ 没有找到发票数据，请先导入数据[/yellow]")
            return
        
        progress.update(task, description=f"已加载 {len(invoices)} 张发票, {len(claims)} 份理赔")
        
        task = progress.add_task("转换数据...", total=None)
        invoice_data_list = [
            InvoiceData(
                invoice_number=inv.invoice_number,
                invoice_date=inv.invoice_date,
                vendor_name=inv.vendor_name,
                vendor_tax_id=inv.vendor_tax_id,
                total_amount=inv.total_amount,
                tax_amount=inv.tax_amount,
                items=[],
                raw_json=inv.raw_json,
                ocr_confidence=inv.ocr_confidence,
                buyer_name=inv.buyer_name,
                buyer_tax_id=inv.buyer_tax_id
            )
            for inv in invoices
        ]
        
        claim_data_list = [
            ClaimData(
                claim_id=c.claim_id,
                policy_number=c.policy_number,
                claimant_name=c.claimant_name,
                claim_date=c.claim_date,
                claim_amount=c.claim_amount,
                invoice_number=c.invoice_number,
                diagnosis=c.diagnosis,
                hospital_name=c.hospital_name,
                raw_data=c.raw_data
            )
            for c in claims
        ]
        
        risk_sample_data = [
            RiskSample(
                vendor_name=s.vendor_name,
                vendor_tax_id=s.vendor_tax_id,
                risk_level=s.risk_level,
                risk_type=s.risk_type,
                sample_count=s.sample_count,
                last_occurrence=s.last_occurrence,
                raw_data=s.raw_data
            )
            for s in risk_samples
        ]
        
        progress.update(task, description="数据转换完成")
        
        task = progress.add_task("特征提取...", total=None)
        extractor = FeatureExtractor(risk_samples=risk_sample_data)
        feature_sets = extractor.extract_batch(invoice_data_list, claim_data_list)
        progress.update(task, description=f"已提取 {len(feature_sets)} 组特征")
        
        task = progress.add_task("规则评估...", total=None)
        rule_engine = RuleEngine()
        rule_results_map = rule_engine.evaluate_batch(feature_sets)
        progress.update(task, description="规则评估完成")
        
        model_scores = {}
        if use_model:
            task = progress.add_task("模型预测...", total=None)
            try:
                if model_path and Path(model_path).exists():
                    model = RiskModel.load(Path(model_path))
                    trainer = ModelTrainer()
                    predictions = trainer.predict(model, feature_sets, threshold)
                    for pred in predictions:
                        model_scores[pred.invoice_number] = pred
                else:
                    pass
            except Exception as e:
                console.print(f"[yellow]⚠ 模型加载失败: {e}, 使用规则模式[/yellow]")
            progress.update(task, description="模型预测完成")
        
        task = progress.add_task("计算风险分数...", total=None)
        high_risk_count = 0
        medium_risk_count = 0
        low_risk_count = 0
        
        review_records = []
        
        for fs in feature_sets:
            inv_number = fs.invoice_data.invoice_number
            rule_results = rule_results_map.get(inv_number, [])
            risk_info = rule_engine.calculate_risk_score(rule_results, fs.to_feature_vector())
            
            model_pred = model_scores.get(inv_number)
            if model_pred:
                final_score = (risk_info['total_score'] * 0.4 + model_pred.risk_score * 0.6)
                final_level = model_pred.risk_level
            else:
                final_score = risk_info['total_score']
                max_level = risk_info['max_risk_level']
                if final_score >= 0.7:
                    final_level = 'high' if final_score < 0.9 else 'critical'
                elif final_score >= 0.4:
                    final_level = 'medium'
                else:
                    final_level = 'low'
            
            if final_level in ['critical', 'high']:
                high_risk_count += 1
            elif final_level == 'medium':
                medium_risk_count += 1
            else:
                low_risk_count += 1
            
            rule_matches_data = [
                {
                    'rule_id': r.rule_id,
                    'rule_name': r.rule_name,
                    'risk_level': r.risk_level.value if hasattr(r.risk_level, 'value') else str(r.risk_level),
                    'score': r.score,
                    'evidence': r.evidence
                }
                for r in rule_results
            ]
            
            review_record = ReviewRecord(
                invoice_number=inv_number,
                risk_score=final_score,
                risk_level=final_level,
                status='pending',
                features=fs.to_feature_vector(),
                rule_matches=rule_matches_data,
                top_features=[]
            )
            review_records.append(review_record)
        
        for rr in review_records:
            repo.add_review(rr)
        
        progress.update(task, description="风险分数计算完成")
    
    table = Table(title="风险扫描结果")
    table.add_column("风险等级", style="cyan")
    table.add_column("数量", justify="right", style="magenta")
    table.add_column("占比", justify="right", style="green")
    
    total = len(review_records)
    
    level_icons = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🟢'
    }
    
    level_names = {
        'critical': '极高风险',
        'high': '高风险',
        'medium': '中风险',
        'low': '低风险'
    }
    
    for level in ['critical', 'high', 'medium', 'low']:
        count = sum(1 for r in review_records if r.risk_level == level)
        if count > 0 or level in ['high', 'medium']:
            pct = (count / total * 100) if total > 0 else 0
            table.add_row(
                f"{level_icons[level]} {level_names[level]}",
                str(count),
                f"{pct:.1f}%"
            )
    
    console.print()
    console.print(table)
    
    high_risk_reviews = [r for r in review_records if r.risk_level in ['critical', 'high']]
    if high_risk_reviews:
        console.print()
        console.print(Panel.fit(
            f"[bold red]发现 {len(high_risk_reviews)} 张高风险票据，建议优先复核[/bold red]",
            title="⚠️ 高风险预警"
        ))
        
        detail_table = Table(title="高风险票据详情")
        detail_table.add_column("发票号", style="cyan")
        detail_table.add_column("风险分数", justify="right", style="magenta")
        detail_table.add_column("风险等级", style="red")
        detail_table.add_column("触发规则数", justify="right", style="green")
        
        for r in sorted(high_risk_reviews, key=lambda x: x.risk_score, reverse=True):
            icon = '🔴' if r.risk_level == 'critical' else '🟠'
            detail_table.add_row(
                r.invoice_number,
                f"{r.risk_score:.2%}",
                f"{icon} {r.risk_level}",
                str(len(r.rule_matches))
            )
        
        console.print(detail_table)


@main.command()
@click.option("--output", "-o", type=click.Path(), default="./models", help="模型输出目录")
@click.option("--model-type", "-m", 
              type=click.Choice(["lightgbm", "randomforest", "logistic"]),
              default="randomforest", help="模型类型")
@click.option("--test-size", "-s", type=float, default=0.2, help="测试集比例")
@click.option("--cv-folds", "-k", type=int, default=5, help="交叉验证折数")
@click.pass_context
def train(ctx, output, model_type, test_size, cv_folds):
    """训练风险预测模型"""
    repo = get_repo(ctx.obj.get('db_path'))
    output_path = Path(output)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        
        task = progress.add_task("加载数据...", total=None)
        invoices = repo.get_all_invoices()
        claims = repo.get_all_claims()
        risk_samples = repo.get_all_risk_samples()
        
        if len(invoices) < 10:
            console.print("[yellow]⚠ 发票数据量不足，建议至少 10 张发票才能训练[/yellow]")
        
        invoice_data_list = [
            InvoiceData(
                invoice_number=inv.invoice_number,
                invoice_date=inv.invoice_date,
                vendor_name=inv.vendor_name,
                vendor_tax_id=inv.vendor_tax_id,
                total_amount=inv.total_amount,
                tax_amount=inv.tax_amount,
                items=[],
                raw_json=inv.raw_json
            )
            for inv in invoices
        ]
        
        claim_data_list = [
            ClaimData(
                claim_id=c.claim_id,
                policy_number=c.policy_number,
                claimant_name=c.claimant_name,
                claim_date=c.claim_date,
                claim_amount=c.claim_amount,
                invoice_number=c.invoice_number,
                diagnosis=c.diagnosis,
                hospital_name=c.hospital_name,
                raw_data=c.raw_data
            )
            for c in claims
        ]
        
        risk_sample_data = [
            RiskSample(
                vendor_name=s.vendor_name,
                vendor_tax_id=s.vendor_tax_id,
                risk_level=s.risk_level,
                risk_type=s.risk_type,
                sample_count=s.sample_count,
                last_occurrence=s.last_occurrence,
                raw_data=s.raw_data
            )
            for s in risk_samples
        ]
        
        progress.update(task, description=f"已加载 {len(invoices)} 张发票")
        
        task = progress.add_task("特征提取...", total=None)
        extractor = FeatureExtractor(risk_samples=risk_sample_data)
        feature_sets = extractor.extract_batch(invoice_data_list, claim_data_list)
        progress.update(task, description=f"已提取 {len(feature_sets)} 组特征")
        
        task = progress.add_task("训练模型...", total=None)
        config = ModelConfig(
            model_type=model_type,
            test_size=test_size,
            cv_folds=cv_folds
        )
        trainer = ModelTrainer(config)
        
        model_path = output_path / f"model_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = trainer.train(feature_sets, save_path=model_path)
        
        progress.update(task, description="模型训练完成")
    
    console.print()
    console.print(Panel.fit(
        f"[green]模型已保存至: {model_path}[/green]",
        title="训练完成"
    ))
    
    table = Table(title="模型评估结果")
    table.add_column("指标", style="cyan")
    table.add_column("数值", justify="right", style="magenta")
    
    table.add_row("准确率", f"{result.accuracy:.4f}")
    table.add_row("精确率", f"{result.precision:.4f}")
    table.add_row("召回率", f"{result.recall:.4f}")
    table.add_row("F1分数", f"{result.f1_score:.4f}")
    table.add_row("ROC AUC", f"{result.roc_auc:.4f}")
    
    if result.cv_scores:
        cv_mean = sum(result.cv_scores) / len(result.cv_scores)
        table.add_row("CV AUC(均值)", f"{cv_mean:.4f}")
    
    console.print(table)
    
    if result.feature_importance:
        console.print()
        feat_table = Table(title="Top 10 特征重要性")
        feat_table.add_column("特征", style="cyan")
        feat_table.add_column("重要性", justify="right", style="magenta")
        
        sorted_feats = sorted(result.feature_importance.items(), key=lambda x: x[1], reverse=True)[:10]
        for feat, imp in sorted_feats:
            feat_table.add_row(feat, f"{imp:.4f}")
        
        console.print(feat_table)


@main.command()
@click.argument("invoice_number")
@click.option("--status", "-s", 
              type=click.Choice(["reviewing", "confirmed", "dismissed", "escalated"]),
              required=True, help="复核状态")
@click.option("--notes", "-n", help="复核备注")
@click.option("--reviewer", "-r", help="复核人ID")
@click.pass_context
def review(ctx, invoice_number, status, notes, reviewer):
    """更新票据复核状态"""
    repo = get_repo(ctx.obj.get('db_path'))
    
    review_record = repo.get_review(invoice_number)
    
    if not review_record:
        console.print(f"[red]✗ 未找到发票号 {invoice_number} 的复核记录[/red]")
        sys.exit(1)
    
    success = repo.update_review_status(
        invoice_number,
        status,
        reviewer_notes=notes,
        reviewer_id=reviewer
    )
    
    if success:
        status_display = {
            'reviewing': '🔍 复核中',
            'confirmed': '✅ 已确认',
            'dismissed': '❌ 已驳回',
            'escalated': '⚠️ 已升级'
        }.get(status, status)
        
        console.print(Panel.fit(
            f"[green]✓ 已将发票 {invoice_number} 状态更新为 {status_display}[/green]\n"
            + (f"备注: {notes}" if notes else "")
            + (f"\n复核人: {reviewer}" if reviewer else ""),
            title="复核完成"
        ))
    else:
        console.print(f"[red]✗ 更新失败[/red]")


@main.command("list")
@click.option("--risk-level", "-l", 
              type=click.Choice(["critical", "high", "medium", "low"]),
              help="按风险等级筛选")
@click.option("--status", "-s", 
              type=click.Choice(["pending", "reviewing", "confirmed", "dismissed", "escalated"]),
              help="按复核状态筛选")
@click.option("--min-score", "-m", type=float, help="最低风险分数")
@click.option("--limit", "-n", type=int, default=50, help="显示数量限制")
@click.pass_context
def list_reviews(ctx, risk_level, status, min_score, limit):
    """列出复核记录"""
    repo = get_repo(ctx.obj.get('db_path'))
    
    if risk_level:
        reviews = repo.get_reviews_by_risk_level(risk_level)
    elif status:
        reviews = repo.get_reviews_by_status(status)
    elif min_score is not None:
        reviews = repo.get_high_risk_reviews(min_score)
    else:
        stats = repo.get_statistics()
        reviews = repo.get_high_risk_reviews(0.0)
    
    if limit:
        reviews = reviews[:limit]
    
    if not reviews:
        console.print("[yellow]⚠ 没有找到复核记录[/yellow]")
        return
    
    table = Table(title="复核记录列表")
    table.add_column("#", style="dim")
    table.add_column("发票号", style="cyan")
    table.add_column("风险分数", justify="right", style="magenta")
    table.add_column("风险等级", style="red")
    table.add_column("复核状态", style="green")
    table.add_column("触发规则", justify="right")
    
    level_icons = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🟢'
    }
    
    status_icons = {
        'pending': '⏳',
        'reviewing': '🔍',
        'confirmed': '✅',
        'dismissed': '❌',
        'escalated': '⚠️'
    }
    
    for idx, r in enumerate(reviews, 1):
        table.add_row(
            str(idx),
            r.invoice_number,
            f"{r.risk_score:.2%}",
            f"{level_icons.get(r.risk_level, '')} {r.risk_level}",
            f"{status_icons.get(r.status, '')} {r.status}",
            str(len(r.rule_matches))
        )
    
    console.print(table)


@main.command()
@click.option("--output", "-o", type=click.Path(), required=True, help="输出目录")
@click.option("--name", "-n", default="risk_report", help="报告基础名称")
@click.option("--include-raw/--no-raw", default=False, help="是否包含原始数据")
@click.pass_context
def export(ctx, output, name, include_raw):
    """导出报告 (Markdown/CSV/JSON)"""
    repo = get_repo(ctx.obj.get('db_path'))
    output_path = Path(output)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        
        task = progress.add_task("加载数据...", total=None)
        reviews = repo.get_high_risk_reviews(0.0)
        invoices = repo.get_all_invoices()
        claims = repo.get_all_claims()
        stats = repo.get_statistics()
        progress.update(task, description=f"已加载 {len(reviews)} 条复核记录")
        
        task = progress.add_task("生成报告...", total=None)
        exporter = Exporter()
        
        results = exporter.export_all(
            output_dir=output_path,
            base_name=name,
            reviews=reviews,
            invoices=invoices,
            claims=claims,
            statistics=stats,
            include_raw_data=include_raw
        )
        
        progress.update(task, description="报告生成完成")
    
    console.print()
    console.print(Panel.fit(
        "\n".join([f"[green]✓ {fmt}: {path}[/green]" for fmt, path in results.items()]),
        title="导出完成"
    ))


@main.command()
@click.pass_context
def stats(ctx):
    """显示统计信息"""
    repo = get_repo(ctx.obj.get('db_path'))
    
    stats = repo.get_statistics()
    
    table = Table(title="系统统计")
    table.add_column("类别", style="cyan")
    table.add_column("数量", justify="right", style="magenta")
    
    table.add_row("发票总数", str(stats.get('invoices', 0)))
    table.add_row("理赔申请总数", str(stats.get('claims', 0)))
    table.add_row("风险样本数", str(stats.get('risk_samples', 0)))
    table.add_row("高风险票据(≥70%)", str(stats.get('high_risk_count', 0)))
    
    console.print(table)
    
    risk_dist = stats.get('risk_distribution', {})
    if risk_dist and sum(risk_dist.values()) > 0:
        console.print()
        risk_table = Table(title="风险等级分布")
        risk_table.add_column("等级", style="cyan")
        risk_table.add_column("数量", justify="right", style="magenta")
        risk_table.add_column("占比", justify="right", style="green")
        
        level_display = {
            'critical': '🔴 极高风险',
            'high': '🟠 高风险',
            'medium': '🟡 中风险',
            'low': '🟢 低风险'
        }
        
        total = sum(risk_dist.values())
        for level, count in risk_dist.items():
            if count > 0:
                risk_table.add_row(
                    level_display.get(level, level),
                    str(count),
                    f"{count/total*100:.1f}%"
                )
        
        console.print(risk_table)
    
    status_dist = stats.get('status_distribution', {})
    if status_dist and sum(status_dist.values()) > 0:
        console.print()
        status_table = Table(title="复核状态分布")
        status_table.add_column("状态", style="cyan")
        status_table.add_column("数量", justify="right", style="magenta")
        status_table.add_column("占比", justify="right", style="green")
        
        status_display = {
            'pending': '⏳ 待复核',
            'reviewing': '🔍 复核中',
            'confirmed': '✅ 已确认',
            'dismissed': '❌ 已驳回',
            'escalated': '⚠️ 已升级'
        }
        
        total = sum(status_dist.values())
        for status, count in status_dist.items():
            if count > 0:
                status_table.add_row(
                    status_display.get(status, status),
                    str(count),
                    f"{count/total*100:.1f}%"
                )
        
        console.print(status_table)


@main.command()
@click.option("--output", "-o", type=click.Path(), default="./examples", help="示例数据输出目录")
@click.option("--invoice-count", "-i", type=int, default=20, help="发票数量")
@click.option("--claim-count", "-c", type=int, default=15, help="理赔单数")
@click.option("--risk-count", "-r", type=int, default=10, help="风险样本数")
@click.pass_context
def examples(ctx, output, invoice_count, claim_count, risk_count):
    """生成示例数据"""
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    try:
        from claim_risk_scanner.examples import SampleGenerator
    except ImportError:
        console.print("[yellow]⚠ 示例数据生成模块未安装，使用简单生成[/yellow]")
        
        import json
        import random
        from datetime import datetime, timedelta
        
        vendors = [
            ("北京康泰医药有限公司", "91110106MA007Y7K8T"),
            ("上海康复医疗器械有限公司", "91310115MA1G8H7Y9K"),
            ("广州市天河区人民医院", "12440106455385573P"),
            ("深圳市龙华区中心医院", "12440309455751708G"),
            ("杭州百草堂大药房有限公司", "91330106MA2H1L7Y6K"),
            ("南京健康医疗科技有限公司", "91320100MA1N2H7K8Y"),
            ("成都华西药业有限公司", "91510100MA61TH7L9K"),
            ("武汉仁心医院管理有限公司", "91420100MA4K2H7Y8L"),
            ("西安康健医疗设备有限公司", "91610100MA6U3H7K9M"),
            ("重庆医科大学附属第一医院", "12500000450402155F"),
        ]
        
        risk_vendors = [
            ("北京诚信医药经营部", "91110105MA008X9Y1T", "high", "虚假发票"),
            ("上海汇通商贸有限公司", "91310114MA1G7H8Z2K", "high", "重复报销"),
            ("广州市天河区康源药房", "91440106MA59H7Y3K", "medium", "金额异常"),
            ("深圳市福田区盛达医疗器械", "91440300MA5D8H7K4L", "medium", "商户异常"),
            ("杭州益康保健品商行", "91330103MA28H7Y5K", "high", "历史违规"),
        ]
        
        items_list = [
            [{"item_name": "阿莫西林胶囊", "quantity": 3, "unit_price": 25.5, "amount": 76.5}],
            [{"item_name": "布洛芬缓释胶囊", "quantity": 2, "unit_price": 18.0, "amount": 36.0}],
            [{"item_name": "感冒灵颗粒", "quantity": 5, "unit_price": 15.0, "amount": 75.0}],
            [{"item_name": "头孢克肟分散片", "quantity": 2, "unit_price": 45.0, "amount": 90.0}],
            [{"item_name": "奥美拉唑肠溶胶囊", "quantity": 3, "unit_price": 35.0, "amount": 105.0}],
            [{"item_name": "血常规检查", "quantity": 1, "unit_price": 80.0, "amount": 80.0}],
            [{"item_name": "胸部CT扫描", "quantity": 1, "unit_price": 350.0, "amount": 350.0}],
            [{"item_name": "心电图检查", "quantity": 1, "unit_price": 60.0, "amount": 60.0}],
            [{"item_name": "彩色超声检查", "quantity": 1, "unit_price": 200.0, "amount": 200.0}],
            [{"item_name": "核磁共振检查", "quantity": 1, "unit_price": 800.0, "amount": 800.0}],
        ]
        
        invoices = []
        for i in range(invoice_count):
            if i < invoice_count * 0.15:
                vendor_name, vendor_tax_id, risk_level, risk_type = random.choice(risk_vendors)
                is_risky = True
            else:
                vendor_name, vendor_tax_id = random.choice(vendors)
                is_risky = False
            
            invoice_date = (datetime.now() - timedelta(days=random.randint(1, 365))).strftime("%Y-%m-%d")
            
            if is_risky:
                total_amount = random.choice([1000, 2000, 5000, 10000])
                tax_amount = total_amount * 0.06
                ocr_confidence = random.randint(60, 85)
            else:
                items = random.choice(items_list)
                total_amount = sum(item['amount'] for item in items)
                tax_amount = total_amount * 0.06
                ocr_confidence = random.randint(85, 99)
            
            invoice = {
                "invoice_number": f"INV{202400000 + i:08d}",
                "invoice_date": invoice_date,
                "vendor_name": vendor_name,
                "vendor_tax_id": vendor_tax_id,
                "total_amount": total_amount,
                "tax_amount": round(tax_amount, 2),
                "items": [{"item_name": "检查/药品", "quantity": 1, "unit_price": total_amount, "amount": total_amount}],
                "ocr_confidence": ocr_confidence,
                "buyer_name": "张三",
                "buyer_tax_id": ""
            }
            
            if is_risky and random.random() < 0.3:
                dup_idx = random.randint(0, i-1) if i > 0 else 0
                if invoices:
                    invoice['invoice_number'] = invoices[dup_idx]['invoice_number']
                    invoice['total_amount'] = invoices[dup_idx]['total_amount'] * (1 + random.uniform(0.1, 0.5))
            
            invoices.append(invoice)
        
        invoice_path = output_path / "invoices.json"
        with open(invoice_path, 'w', encoding='utf-8') as f:
            json.dump(invoices, f, ensure_ascii=False, indent=2)
        
        claims = []
        for i in range(claim_count):
            invoice_idx = random.randint(0, len(invoices) - 1)
            invoice = invoices[invoice_idx]
            
            claim = {
                "claim_id": f"CLM{2024000 + i:07d}",
                "policy_number": f"POL{random.randint(100000, 999999)}",
                "claimant_name": f"{'张三李四王五赵六孙七周八'[random.randint(0,7)]}{'明杰芳敏强勇'[random.randint(0,5)]}",
                "claim_date": (datetime.now() - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
                "claim_amount": invoice['total_amount'],
                "invoice_number": invoice['invoice_number'],
                "diagnosis": random.choice(["感冒发烧", "急性肠胃炎", "高血压检查", "糖尿病复诊", "体检"]),
                "hospital_name": random.choice(["广州市天河区人民医院", "深圳市龙华区中心医院", "社区卫生服务中心"])
            }
            claims.append(claim)
        
        claim_path = output_path / "claims.csv"
        with open(claim_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=claims[0].keys())
            writer.writeheader()
            writer.writerows(claims)
        
        risk_samples = []
        for vendor_name, vendor_tax_id, risk_level, risk_type in risk_vendors:
            risk_samples.append({
                "vendor_name": vendor_name,
                "vendor_tax_id": vendor_tax_id,
                "risk_level": risk_level,
                "risk_type": risk_type,
                "sample_count": random.randint(2, 10),
                "last_occurrence": (datetime.now() - timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d")
            })
        
        risk_path = output_path / "risk_samples.csv"
        with open(risk_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=risk_samples[0].keys())
            writer.writeheader()
            writer.writerows(risk_samples)
        
        console.print(Panel.fit(
            f"[green]✓ 示例数据已生成至: {output_path}[/green]\n"
            f"  - 发票: {invoice_path} ({len(invoices)} 张)\n"
            f"  - 理赔: {claim_path} ({len(claims)} 份)\n"
            f"  - 风险样本: {risk_path} ({len(risk_samples)} 条)",
            title="示例数据生成完成"
        ))
        return
    
    generator = SampleGenerator()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("生成示例数据...", total=None)
        
        generator.generate(
            output_dir=output_path,
            invoice_count=invoice_count,
            claim_count=claim_count,
            risk_sample_count=risk_count
        )
        
        progress.update(task, description="示例数据生成完成")
    
    console.print(Panel.fit(
        f"[green]✓ 示例数据已生成至: {output_path}[/green]",
        title="完成"
    ))


import csv


if __name__ == "__main__":
    main()
