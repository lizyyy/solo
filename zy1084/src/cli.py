#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CLI 界面模块
提供命令行交互界面
"""

import click
import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.markdown import Markdown
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

from .clause_classifier import ClauseClassifier
from .diff_detector import DiffDetector, ChangeType
from .risk_engine import RiskEngine, RiskLevel, RiskDictionary
from .storage import LocalStorage, AnalysisRecord
from .exporter import ReportExporter


class ContractDiffAnalyzer:
    """
    合同差异分析器主类
    整合所有模块，提供完整的分析功能
    """
    
    def __init__(self, base_dir: Optional[str] = None):
        """
        初始化分析器
        
        Args:
            base_dir: 基础工作目录
        """
        self.base_dir = base_dir or os.getcwd()
        
        # 初始化各模块
        self.classifier = ClauseClassifier()
        self.detector = DiffDetector()
        self.risk_engine = RiskEngine()
        self.storage = LocalStorage(self.base_dir)
        self.exporter = ReportExporter(self.storage.get_exports_dir())
        
        # 控制台输出
        if HAS_RICH:
            self.console = Console()
        else:
            self.console = None
    
    def _read_file(self, filepath: str) -> str:
        """
        读取文件内容
        
        Args:
            filepath: 文件路径
            
        Returns:
            文件内容字符串
        """
        path = Path(filepath)
        
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        if path.stat().st_size == 0:
            raise ValueError(f"文件为空: {filepath}")
        
        # 尝试多种编码读取
        encodings = ['utf-8', 'gbk', 'gb2312', 'utf-8-sig']
        
        for encoding in encodings:
            try:
                with open(path, 'r', encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        
        raise ValueError(f"无法读取文件，不支持的编码格式: {filepath}")
    
    def _validate_inputs(
        self,
        version_files: List[str],
        rules_file: Optional[str] = None
    ) -> Dict[str, str]:
        """
        验证输入文件
        
        Args:
            version_files: 版本文件路径列表
            rules_file: 规则文件路径（可选）
            
        Returns:
            验证后的文件内容字典
        """
        if len(version_files) < 2:
            raise ValueError("至少需要提供两个版本的合同文件进行对比")
        
        # 检查文件是否存在且非空
        contents = {}
        for filepath in version_files:
            content = self._read_file(filepath)
            # 检查是否全是空白字符
            if not content.strip():
                raise ValueError(f"文件内容为空或全是空白字符: {filepath}")
            contents[filepath] = content
        
        # 验证规则文件（如果提供）
        if rules_file:
            rules_path = Path(rules_file)
            if not rules_path.exists():
                raise FileNotFoundError(f"规则文件不存在: {rules_file}")
            
            try:
                with open(rules_path, 'r', encoding='utf-8') as f:
                    rules_data = json.load(f)
                
                # 验证规则格式
                if isinstance(rules_data, dict):
                    rules_data = [rules_data]
                
                for i, rule in enumerate(rules_data):
                    required_fields = ['id', 'name', 'category']
                    for field in required_fields:
                        if field not in rule:
                            raise ValueError(f"规则 {i+1} 缺少必填字段: {field}")
            except json.JSONDecodeError as e:
                raise ValueError(f"规则文件格式错误，不是有效的 JSON: {e}")
        
        return contents
    
    def analyze(
        self,
        version_files: List[str],
        project_name: Optional[str] = None,
        rules_file: Optional[str] = None,
        custom_keywords: Optional[Dict[str, List[str]]] = None,
        save_history: bool = True
    ) -> Dict[str, Any]:
        """
        执行完整的分析流程
        
        Args:
            version_files: 版本文件路径列表（按版本顺序排列）
            project_name: 项目名称（用于历史记录）
            rules_file: 自定义风险规则文件路径
            custom_keywords: 自定义分类关键词
            save_history: 是否保存到历史记录
            
        Returns:
            分析结果字典
        """
        # 验证输入
        contents = self._validate_inputs(version_files, rules_file)
        
        # 加载自定义规则
        if rules_file:
            self.risk_engine.load_rules_from_file(rules_file)
        
        # 更新分类关键词
        if custom_keywords:
            for category, keywords in custom_keywords.items():
                self.classifier.add_category_keywords(category, keywords)
        
        # 步骤1: 对每个版本进行条款分类
        version_clauses = {}
        version_names = []
        
        for i, filepath in enumerate(version_files):
            content = contents[filepath]
            clauses = self.classifier.classify(content)
            
            # 生成版本名称
            filename = Path(filepath).stem
            version_name = f"v{i+1}_{filename}"
            version_names.append(version_name)
            
            version_clauses[version_name] = clauses
        
        # 步骤2: 检测版本间的差异
        all_changes = []
        
        # 按顺序比较相邻版本
        for i in range(len(version_names) - 1):
            old_version = version_names[i]
            new_version = version_names[i + 1]
            
            old_clauses = version_clauses[old_version]
            new_clauses = version_clauses[new_version]
            
            changes = self.detector.detect_changes(old_clauses, new_clauses)
            all_changes.extend(changes)
        
        # 步骤3: 风险评估
        assessments = self.risk_engine.assess_changes(all_changes)
        
        # 步骤4: 生成摘要
        summary = self._generate_summary(all_changes, assessments)
        
        # 步骤5: 保存到历史记录
        record = None
        if save_history:
            if project_name is None:
                project_name = f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # 准备文件路径字典
            file_paths = {}
            for i, filepath in enumerate(version_files):
                file_paths[version_names[i]] = filepath
            
            record = self.storage.save_analysis(
                project_name=project_name,
                versions=version_names,
                changes=all_changes,
                assessments=assessments,
                file_paths=file_paths
            )
        
        # 构建结果
        result = {
            "project_name": project_name,
            "versions": version_names,
            "summary": summary,
            "changes": all_changes,
            "assessments": assessments,
            "version_clauses": version_clauses,
            "record": record
        }
        
        return result
    
    def _generate_summary(
        self,
        changes: List[Any],
        assessments: Dict[str, List[Any]]
    ) -> Dict[str, Any]:
        """
        生成分析摘要
        
        Args:
            changes: 变化列表
            assessments: 风险评估结果
            
        Returns:
            摘要字典
        """
        # 统计变化类型
        change_type_counts = {}
        category_counts = {}
        
        for change in changes:
            # 变化类型统计
            change_type = change.change_type.value
            if change_type not in change_type_counts:
                change_type_counts[change_type] = 0
            change_type_counts[change_type] += 1
            
            # 类别统计
            category = change.category
            if category not in category_counts:
                category_counts[category] = 0
            category_counts[category] += 1
        
        # 统计风险等级
        risk_level_counts = {
            "严重": 0,
            "高": 0,
            "中": 0,
            "低": 0
        }
        
        for change_id, assessment_list in assessments.items():
            for assessment in assessment_list:
                level = assessment.risk_level.value
                if level in risk_level_counts:
                    risk_level_counts[level] += 1
                else:
                    risk_level_counts[level] = 1
        
        return {
            "total_changes": len(changes),
            "total_assessments": sum(len(a) for a in assessments.values()),
            "change_types": change_type_counts,
            "categories": category_counts,
            "risk_levels": risk_level_counts,
            "generated_at": datetime.now().isoformat()
        }
    
    def export_report(
        self,
        analysis_result: Dict[str, Any],
        formats: List[str] = None,
        filename: Optional[str] = None
    ) -> Dict[str, str]:
        """
        导出分析报告
        
        Args:
            analysis_result: 分析结果
            formats: 导出格式列表（支持 'json', 'markdown', 'html'）
            filename: 输出文件名（不含扩展名）
            
        Returns:
            导出文件路径字典
        """
        if formats is None:
            formats = ['json', 'markdown', 'html']
        
        project_name = analysis_result.get("project_name", "report")
        versions = analysis_result.get("versions", [])
        changes = analysis_result.get("changes", [])
        assessments = analysis_result.get("assessments", {})
        summary = analysis_result.get("summary", {})
        
        if filename is None:
            filename = f"{project_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        exported_files = {}
        
        for fmt in formats:
            fmt_lower = fmt.lower()
            
            if fmt_lower == 'json':
                filepath = self.exporter.export_json(
                    project_name=project_name,
                    versions=versions,
                    changes=changes,
                    assessments=assessments,
                    summary=summary,
                    filename=filename
                )
                exported_files['json'] = filepath
            
            elif fmt_lower in ['markdown', 'md']:
                filepath = self.exporter.export_markdown(
                    project_name=project_name,
                    versions=versions,
                    changes=changes,
                    assessments=assessments,
                    summary=summary,
                    filename=filename
                )
                exported_files['markdown'] = filepath
            
            elif fmt_lower == 'html':
                filepath = self.exporter.export_html(
                    project_name=project_name,
                    versions=versions,
                    changes=changes,
                    assessments=assessments,
                    summary=summary,
                    filename=filename
                )
                exported_files['html'] = filepath
        
        return exported_files
    
    def get_history(self, limit: int = 10) -> List[AnalysisRecord]:
        """
        获取历史记录
        
        Args:
            limit: 返回记录数量限制
            
        Returns:
            分析记录列表
        """
        return self.storage.get_history(limit)
    
    def get_analysis_detail(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """
        获取历史分析的详细结果
        
        Args:
            analysis_id: 分析记录 ID
            
        Returns:
            分析结果字典
        """
        return self.storage.get_analysis(analysis_id)
    
    def delete_analysis(self, analysis_id: str) -> bool:
        """
        删除历史分析记录
        
        Args:
            analysis_id: 分析记录 ID
            
        Returns:
            是否成功删除
        """
        return self.storage.delete_analysis(analysis_id)


# 创建 CLI 命令组
@click.group()
@click.version_option(version='1.0.0')
@click.pass_context
def cli(ctx):
    """
    合同版本差异和风险归类小助手
    
    用于对比不同版本的合同文本，检测差异并评估风险。
    """
    # 初始化上下文
    ctx.ensure_object(dict)
    ctx.obj['analyzer'] = ContractDiffAnalyzer()


@cli.command()
@click.argument('version_files', nargs=-1, type=click.Path(exists=True))
@click.option('--project', '-p', 'project_name', help='项目名称（用于历史记录）')
@click.option('--rules', '-r', 'rules_file', type=click.Path(exists=True), help='自定义风险规则文件（JSON格式）')
@click.option('--format', '-f', 'formats', multiple=True, default=['json', 'markdown', 'html'], 
              type=click.Choice(['json', 'markdown', 'html', 'md']),
              help='导出格式（可多次指定）')
@click.option('--output', '-o', 'output_name', help='输出文件名（不含扩展名）')
@click.option('--no-history', is_flag=True, help='不保存到历史记录')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
@click.pass_context
def analyze(ctx, version_files, project_name, rules_file, formats, output_name, no_history, verbose):
    """
    分析合同版本差异并评估风险
    
    VERSION_FILES: 合同版本文件路径（按版本顺序排列，至少2个文件）
    
    示例:
      contract-diff analyze contract_v1.txt contract_v2.txt -p "我的项目"
      contract-diff analyze v1.md v2.md v3.md -r custom-rules.json -f markdown -f html
    """
    analyzer = ctx.obj['analyzer']
    
    if len(version_files) < 2:
        click.echo("错误: 至少需要提供两个版本的合同文件进行对比", err=True)
        ctx.exit(1)
    
    try:
        click.echo(f"开始分析 {len(version_files)} 个版本的合同...")
        click.echo(f"版本文件: {', '.join(version_files)}")
        
        # 执行分析
        result = analyzer.analyze(
            version_files=list(version_files),
            project_name=project_name,
            rules_file=rules_file,
            save_history=not no_history
        )
        
        # 显示摘要
        summary = result['summary']
        click.echo("\n" + "="*50)
        click.echo("分析完成！")
        click.echo("="*50)
        click.echo(f"\n📊 分析摘要:")
        click.echo(f"   - 总变化数: {summary['total_changes']}")
        click.echo(f"   - 风险评估数: {summary['total_assessments']}")
        
        # 风险等级统计
        risk_levels = summary.get('risk_levels', {})
        if any(risk_levels.values()):
            click.echo(f"\n⚠️  风险等级分布:")
            for level, count in risk_levels.items():
                if count > 0:
                    click.echo(f"   - {level}: {count} 项")
        
        # 变化类型统计
        change_types = summary.get('change_types', {})
        if change_types:
            click.echo(f"\n📝 变化类型分布:")
            for change_type, count in change_types.items():
                click.echo(f"   - {change_type}: {count} 处")
        
        # 导出报告
        click.echo(f"\n📤 正在导出报告...")
        exported_files = analyzer.export_report(
            analysis_result=result,
            formats=list(formats),
            filename=output_name
        )
        
        click.echo(f"\n✅ 报告已导出:")
        for fmt, filepath in exported_files.items():
            click.echo(f"   - {fmt.upper()}: {filepath}")
        
        # 显示历史记录信息
        if not no_history and result.get('record'):
            click.echo(f"\n💾 分析已保存到历史记录")
            click.echo(f"   - 记录ID: {result['record'].id}")
        
        click.echo("\n" + "="*50)
        
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        ctx.exit(1)


@cli.command('history')
@click.option('--limit', '-n', default=10, help='显示最近N条记录')
@click.option('--detail', '-d', 'analysis_id', help='查看指定记录的详细信息')
@click.option('--delete', '-D', 'delete_id', help='删除指定的历史记录')
@click.pass_context
def history(ctx, limit, analysis_id, delete_id):
    """
    管理历史分析记录
    
    示例:
      contract-diff history              # 显示最近10条记录
      contract-diff history -n 20        # 显示最近20条记录
      contract-diff history -d <id>      # 查看指定记录的详细信息
      contract-diff history -D <id>      # 删除指定记录
    """
    analyzer = ctx.obj['analyzer']
    
    # 删除记录
    if delete_id:
        if click.confirm(f"确定要删除记录 {delete_id} 吗？此操作不可撤销。"):
            if analyzer.delete_analysis(delete_id):
                click.echo(f"✅ 记录 {delete_id} 已删除")
            else:
                click.echo(f"❌ 记录 {delete_id} 不存在或删除失败")
        return
    
    # 查看详细信息
    if analysis_id:
        detail = analyzer.get_analysis_detail(analysis_id)
        if not detail:
            click.echo(f"❌ 记录 {analysis_id} 不存在")
            ctx.exit(1)
        
        click.echo(f"\n📋 分析记录详情: {analysis_id}")
        click.echo("="*50)
        
        summary = detail.get('summary', {})
        if summary:
            click.echo(f"\n📊 摘要:")
            click.echo(f"   - 总变化数: {summary.get('total_changes', 0)}")
            click.echo(f"   - 风险评估数: {summary.get('total_assessments', 0)}")
            
            risk_levels = summary.get('risk_levels', {})
            if any(risk_levels.values()):
                click.echo(f"\n⚠️  风险等级:")
                for level, count in risk_levels.items():
                    if count > 0:
                        click.echo(f"   - {level}: {count} 项")
        
        # 显示变化列表
        changes = detail.get('changes', [])
        if changes:
            click.echo(f"\n📝 变化列表 ({len(changes)} 项):")
            for i, change in enumerate(changes[:10]):  # 只显示前10项
                click.echo(f"\n   [{i+1}] {change.get('change_type', '未知')} - {change.get('category', '未分类')}")
                if change.get('evidence_new'):
                    click.echo(f"       新内容: {change['evidence_new'][:100]}...")
            
            if len(changes) > 10:
                click.echo(f"\n   ... 还有 {len(changes) - 10} 项变化")
        
        return
    
    # 显示历史记录列表
    records = analyzer.get_history(limit)
    
    if not records:
        click.echo("📭 暂无历史记录")
        return
    
    click.echo(f"\n📋 历史分析记录（最近 {len(records)} 条）:")
    click.echo("="*80)
    
    if HAS_RICH:
        # 使用 rich 显示表格
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("ID", style="dim")
        table.add_column("项目名称")
        table.add_column("创建时间")
        table.add_column("版本数")
        table.add_column("总变化")
        table.add_column("高风险")
        
        for record in records:
            summary = record.summary
            risk_levels = summary.get('risk_levels', {})
            high_risk = risk_levels.get('严重', 0) + risk_levels.get('高', 0)
            
            # 格式化时间
            try:
                created_time = datetime.fromisoformat(record.created_at)
                time_str = created_time.strftime('%Y-%m-%d %H:%M')
            except ValueError:
                time_str = record.created_at
            
            table.add_row(
                record.id,
                record.project_name,
                time_str,
                str(len(record.versions)),
                str(summary.get('total_changes', 0)),
                str(high_risk)
            )
        
        analyzer.console.print(table)
    else:
        # 简单文本输出
        click.echo(f"{'ID':<35} {'项目名称':<20} {'创建时间':<20} {'版本':<5} {'变化':<5} {'高风险':<5}")
        click.echo("-"*80)
        
        for record in records:
            summary = record.summary
            risk_levels = summary.get('risk_levels', {})
            high_risk = risk_levels.get('严重', 0) + risk_levels.get('高', 0)
            
            try:
                created_time = datetime.fromisoformat(record.created_at)
                time_str = created_time.strftime('%Y-%m-%d %H:%M')
            except ValueError:
                time_str = record.created_at
            
            click.echo(
                f"{record.id:<35} "
                f"{record.project_name[:18]:<20} "
                f"{time_str:<20} "
                f"{len(record.versions):<5} "
                f"{summary.get('total_changes', 0):<5} "
                f"{high_risk:<5}"
            )


@cli.command('export')
@click.argument('analysis_id')
@click.option('--format', '-f', 'formats', multiple=True, default=['json', 'markdown', 'html'],
              type=click.Choice(['json', 'markdown', 'html', 'md']),
              help='导出格式（可多次指定）')
@click.option('--output', '-o', 'output_name', help='输出文件名（不含扩展名）')
@click.pass_context
def export(ctx, analysis_id, formats, output_name):
    """
    从历史记录导出报告
    
    ANALYSIS_ID: 历史分析记录的 ID
    
    示例:
      contract-diff export <analysis_id>
      contract-diff export <analysis_id> -f markdown -f html
    """
    analyzer = ctx.obj['analyzer']
    
    # 获取历史分析数据
    detail = analyzer.get_analysis_detail(analysis_id)
    if not detail:
        click.echo(f"❌ 记录 {analysis_id} 不存在")
        ctx.exit(1)
    
    # 构建分析结果对象
    result = {
        "project_name": f"history_{analysis_id}",
        "versions": [],
        "summary": detail.get('summary', {}),
        "changes": detail.get('changes', []),
        "assessments": detail.get('assessments', {}),
        "version_clauses": {}
    }
    
    # 导出报告
    click.echo(f"📤 正在从历史记录 {analysis_id} 导出报告...")
    
    exported_files = analyzer.export_report(
        analysis_result=result,
        formats=list(formats),
        filename=output_name or f"history_{analysis_id}"
    )
    
    click.echo(f"\n✅ 报告已导出:")
    for fmt, filepath in exported_files.items():
        click.echo(f"   - {fmt.upper()}: {filepath}")


@cli.command('config')
@click.option('--show-rules', is_flag=True, help='显示当前风险规则')
@click.option('--show-keywords', is_flag=True, help='显示当前分类关键词')
@click.option('--load-rules', 'rules_file', type=click.Path(exists=True), help='加载自定义规则文件')
@click.pass_context
def config(ctx, show_rules, show_keywords, rules_file):
    """
    查看和管理配置
    
    示例:
      contract-diff config --show-rules
      contract-diff config --show-keywords
      contract-diff config --load-rules my-rules.json
    """
    analyzer = ctx.obj['analyzer']
    
    # 加载规则文件
    if rules_file:
        try:
            analyzer.risk_engine.load_rules_from_file(rules_file)
            click.echo(f"✅ 已从 {rules_file} 加载规则")
        except Exception as e:
            click.echo(f"❌ 加载规则失败: {e}", err=True)
            ctx.exit(1)
    
    # 显示规则
    if show_rules:
        rules = analyzer.risk_engine.rules
        click.echo(f"\n📋 当前风险规则 ({len(rules)} 条):")
        click.echo("="*60)
        
        for rule in rules:
            click.echo(f"\n🔹 [{rule.id}] {rule.name}")
            click.echo(f"   类别: {rule.category}")
            click.echo(f"   默认风险等级: {rule.risk_level.value}")
            if rule.triggers:
                click.echo(f"   触发词: {', '.join(rule.triggers[:5])}{'...' if len(rule.triggers) > 5 else ''}")
            if rule.suggested_questions:
                click.echo(f"   建议问题示例: {rule.suggested_questions[0] if rule.suggested_questions else ''}")
    
    # 显示关键词
    if show_keywords:
        categories = analyzer.classifier.get_categories()
        click.echo(f"\n📋 当前分类关键词 ({len(categories)} 个类别):")
        click.echo("="*60)
        
        for category in categories:
            keywords = analyzer.classifier.category_keywords.get(category, [])
            click.echo(f"\n🔹 {category}:")
            click.echo(f"   关键词: {', '.join(keywords[:10])}{'...' if len(keywords) > 10 else ''}")


if __name__ == '__main__':
    cli()
