import click
import os
import json
import sys
from datetime import datetime

from .parser import PrometheusParser
from .estimator import CardinalityEstimator
from .threshold import ThresholdManager
from .reporter import Reporter
from .config import Config, OutputMode


@click.group()
@click.version_option(version="0.1.0")
def main():
    """Prometheus 基数估算 CLI 工具 - 分析高风险 label 组合"""
    pass


@main.command()
@click.option("--metrics", "-m", type=click.Path(exists=True), help="指标样本文件路径 (Prometheus 文本格式)")
@click.option("--labels", "-l", type=click.Path(exists=True), help="label 清单文件 (JSON/YAML)")
@click.option("--rules", "-r", type=click.Path(exists=True), help="估算规则配置 (JSON/YAML)")
@click.option("--service", "-s", help="服务名")
@click.option("--history", "-H", type=click.Path(exists=True), help="历史阈值文件 (JSON)")
@click.option("--report", "-R", type=click.Path(exists=True), help="历史基数报告 (用于对比)")
@click.option("--output-dir", "-o", default="./cardinality_output", help="输出目录 (默认: ./cardinality_output)")
@click.option("--output-mode", "-O", type=click.Choice(["overwrite", "append", "fail"]), default="overwrite",
              help="输出模式: overwrite(覆盖)|append(追加)|fail(已存在则失败)")
@click.option("--threshold", "-t", type=int, default=1000, help="基数告警阈值 (默认: 1000)")
@click.option("--top-n", "-n", type=int, default=20, help="显示风险最高的前 N 个组合 (默认: 20)")
@click.option("--include-empty/--exclude-empty", default=False, help="是否包含空 label 分析 (默认: 排除)")
@click.option("--detect-masked/--no-detect-masked", default=True, help="检测被掩盖的高基数 label (默认: 开启)")
@click.option("--format", "-f", "output_formats", multiple=True, 
              type=click.Choice(["terminal", "json", "markdown", "all"]), default=["all"],
              help="输出格式 (可多选, 默认: all)")
@click.option("--verbose", "-v", is_flag=True, help="详细输出")
@click.option("--quiet", "-q", is_flag=True, help="静默模式, 仅输出错误")
def estimate(
    metrics, labels, rules, service, history, report,
    output_dir, output_mode, threshold, top_n, include_empty,
    detect_masked, output_formats, verbose, quiet
):
    """估算 Prometheus 指标基数并识别高风险 label 组合"""
    
    config = Config(
        metrics_path=metrics,
        labels_path=labels,
        rules_path=rules,
        service_name=service,
        history_path=history,
        report_path=report,
        output_dir=output_dir,
        output_mode=OutputMode(output_mode),
        base_threshold=threshold,
        top_n=top_n,
        include_empty_labels=include_empty,
        detect_masked_high_cardinality=detect_masked,
        output_formats=output_formats,
        verbose=verbose,
        quiet=quiet
    )

    validator = InputValidator(config)
    try:
        validator.validate()
    except ValidationError as e:
        click.echo(f"输入校验失败: {e}", err=True)
        sys.exit(ExitCode.INPUT_ERROR)

    try:
        os.makedirs(output_dir, exist_ok=True)
        
        output_checker = OutputChecker(output_dir, OutputMode(output_mode))
        output_checker.check_and_prepare()
        
        parser = PrometheusParser(config)
        metric_samples = parser.parse()
        
        if not quiet:
            click.echo(f"✅ 解析完成, 共 {len(metric_samples)} 条指标样本")
        
        estimator = CardinalityEstimator(config)
        cardinality_results = estimator.estimate(metric_samples)
        
        if not quiet:
            click.echo(f"✅ 基数估算完成, 发现 {len(cardinality_results['label_combinations'])} 种 label 组合")
        
        threshold_mgr = ThresholdManager(config)
        risk_results = threshold_mgr.evaluate_risk(cardinality_results)
        
        if not quiet:
            high_risk = sum(1 for r in risk_results['combinations'] if r['risk_level'] != 'low')
            click.echo(f"✅ 风险评估完成, 发现 {high_risk} 个高风险组合")
        
        reporter = Reporter(config)
        reporter.generate_all(risk_results, output_formats)
        
        if not quiet:
            click.echo(f"\n📊 报告已生成到: {output_dir}")
        
        exit_code = ExitCode.SUCCESS
        if risk_results['summary']['critical_count'] > 0:
            exit_code = ExitCode.CRITICAL
        elif risk_results['summary']['warning_count'] > 0:
            exit_code = ExitCode.WARNING
        
        sys.exit(exit_code)
        
    except Exception as e:
        if verbose:
            import traceback
            traceback.print_exc()
        click.echo(f"执行失败: {e}", err=True)
        sys.exit(ExitCode.RUNTIME_ERROR)


class ExitCode:
    SUCCESS = 0
    WARNING = 1
    CRITICAL = 2
    INPUT_ERROR = 3
    RUNTIME_ERROR = 4
    OUTPUT_CONFLICT = 5


class ValidationError(Exception):
    pass


class InputValidator:
    def __init__(self, config):
        self.config = config
    
    def validate(self):
        if not self.config.metrics_path and not self.config.labels_path:
            raise ValidationError("必须提供 --metrics 或 --labels 参数")
        
        if self.config.metrics_path:
            self._validate_file(self.config.metrics_path, "指标样本文件")
        
        if self.config.labels_path:
            self._validate_file(self.config.labels_path, "label 清单文件")
        
        if self.config.rules_path:
            self._validate_file(self.config.rules_path, "估算规则文件")
        
        if self.config.history_path:
            self._validate_file(self.config.history_path, "历史阈值文件")
        
        if self.config.report_path:
            self._validate_file(self.config.report_path, "历史报告文件")
        
        if self.config.top_n <= 0:
            raise ValidationError("--top-n 必须大于 0")
        
        if self.config.base_threshold <= 0:
            raise ValidationError("--threshold 必须大于 0")
    
    def _validate_file(self, path, desc):
        if not os.path.exists(path):
            raise ValidationError(f"{desc}不存在: {path}")
        if not os.path.isfile(path):
            raise ValidationError(f"{desc}不是文件: {path}")
        if os.path.getsize(path) == 0:
            raise ValidationError(f"{desc}为空文件: {path}")


class OutputChecker:
    def __init__(self, output_dir, output_mode):
        self.output_dir = output_dir
        self.output_mode = output_mode
        self.existing_files = []
    
    def check_and_prepare(self):
        if not os.path.exists(self.output_dir):
            return
        
        for f in ["summary.json", "report.md", "details.json"]:
            path = os.path.join(self.output_dir, f)
            if os.path.exists(path):
                self.existing_files.append(f)
        
        if self.output_mode == OutputMode.FAIL and self.existing_files:
            click.echo(f"输出目录已存在文件: {', '.join(self.existing_files)}", err=True)
            click.echo("使用 --output-mode=overwrite 或 --output-mode=append 来允许写入", err=True)
            sys.exit(ExitCode.OUTPUT_CONFLICT)
        
        elif self.output_mode == OutputMode.OVERWRITE and self.existing_files:
            for f in self.existing_files:
                os.remove(os.path.join(self.output_dir, f))
        
        elif self.output_mode == OutputMode.APPEND and self.existing_files:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            for f in self.existing_files:
                name, ext = os.path.splitext(f)
                new_name = f"{name}_{timestamp}{ext}"
                os.rename(
                    os.path.join(self.output_dir, f),
                    os.path.join(self.output_dir, new_name)
                )


if __name__ == "__main__":
    main()
