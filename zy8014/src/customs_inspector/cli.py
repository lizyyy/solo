#!/usr/bin/env python3
import argparse
import os
import sys
from collections import defaultdict
from typing import List, Dict

from .models import (
    InspectionResult, RiskLevel, ValidationError, ValidationErrorType
)
from .importer import Importer, ImportError
from .normalizer import Normalizer
from .rule_engine import RuleEngine
from .reconciler import Reconciler
from .exporter import Exporter


def main():
    parser = argparse.ArgumentParser(
        prog='customs-inspector',
        description='跨境报关资料预检与补证清单生成器',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  customs-inspector --manifest sample/manifest.csv --packing sample/packing_001.json --rules sample/rules.yaml --output out/
  customs-inspector -m manifest.csv -p packing1.json packing2.json -r rules.yaml -o ./out
        '''
    )
    
    parser.add_argument('-m', '--manifest', required=True,
                        help='舱单CSV文件路径')
    parser.add_argument('-p', '--packing', nargs='+', required=True,
                        help='装箱清单JSON文件路径（支持多个文件）')
    parser.add_argument('-r', '--rules', required=True,
                        help='申报规则YAML文件路径')
    parser.add_argument('-o', '--output', default='./out',
                        help='输出目录路径 (默认: ./out)')
    parser.add_argument('--tolerance', type=float, default=5.0,
                        help='重量体积差异容差百分比 (默认: 5.0)')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='显示详细输出')
    
    args = parser.parse_args()
    
    inspector = CustomsInspector(
        manifest_path=args.manifest,
        packing_paths=args.packing,
        rules_path=args.rules,
        output_dir=args.output,
        tolerance_percent=args.tolerance,
        verbose=args.verbose
    )
    
    try:
        result = inspector.run()
        inspector.print_summary(result)
        sys.exit(0)
    except ImportError as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"执行错误: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


class CustomsInspector:
    
    def __init__(self, manifest_path: str, packing_paths: List[str],
                 rules_path: str, output_dir: str,
                 tolerance_percent: float = 5.0,
                 verbose: bool = False):
        self.manifest_path = manifest_path
        self.packing_paths = packing_paths
        self.rules_path = rules_path
        self.output_dir = output_dir
        self.tolerance_percent = tolerance_percent
        self.verbose = verbose
    
    def run(self) -> InspectionResult:
        if self.verbose:
            print("=" * 60)
            print("跨境报关资料预检与补证清单生成器")
            print("=" * 60)
            print()
        
        if self.verbose:
            print("[1/6] 导入数据...")
        importer = Importer()
        manifest = importer.import_manifest(self.manifest_path)
        packing_lists = importer.import_multiple_packing_lists(self.packing_paths)
        rules = importer.import_rules(self.rules_path)
        
        if self.verbose:
            print(f"  - 舱单: {len(manifest.items)} 项")
            print(f"  - 装箱单: {len(packing_lists)} 份")
            print(f"  - 规则: {len(rules)} 条")
        
        if self.verbose:
            print("\n[2/6] 标准化字段...")
        normalizer = Normalizer()
        normalized_manifest = normalizer.normalize_manifest(manifest)
        normalized_packing_lists = [
            normalizer.normalize_packing_list(pl) for pl in packing_lists
        ]
        normalizer_errors = normalizer.get_errors()
        
        if self.verbose and normalizer_errors:
            print(f"  - 标准化过程发现 {len(normalizer_errors)} 个问题")
        
        if self.verbose:
            print("\n[3/6] 规则校验...")
        rule_engine = RuleEngine(rules)
        
        validation_errors: List[ValidationError] = []
        validation_errors.extend(normalizer_errors)
        
        for item in normalized_manifest.items:
            errors = rule_engine.validate_manifest_item(item)
            validation_errors.extend(errors)
        
        for pl in normalized_packing_lists:
            for item in pl.items:
                errors = rule_engine.validate_packing_item(item)
                validation_errors.extend(errors)
        
        if self.verbose:
            print(f"  - 规则校验发现 {len(validation_errors) - len(normalizer_errors)} 个问题")
        
        if self.verbose:
            print("\n[4/6] 集装箱核对与差异分析...")
        reconciler = Reconciler(tolerance_percent=self.tolerance_percent)
        container_reconciliations = reconciler.reconcile(
            normalized_manifest, normalized_packing_lists
        )
        reconciler_errors = reconciler.get_errors()
        validation_errors.extend(reconciler_errors)
        
        if self.verbose:
            print(f"  - 核对发现 {len(reconciler_errors)} 个问题")
        
        if self.verbose:
            print("\n[5/6] 生成补证任务...")
        correction_tasks = []
        unique_errors = self._deduplicate_errors(validation_errors)
        
        for i, error in enumerate(unique_errors, 1):
            task = rule_engine.generate_correction_task(error, i)
            correction_tasks.append(task)
        
        if self.verbose:
            print(f"  - 生成 {len(correction_tasks)} 个任务")
        
        if self.verbose:
            print("\n[6/6] 计算风险等级与导出报告...")
        
        risk_summary: Dict[RiskLevel, int] = defaultdict(int)
        for error in unique_errors:
            risk_summary[error.risk_level] += 1
        
        overall_risk = self._calculate_overall_risk(risk_summary)
        
        result = InspectionResult(
            manifest=normalized_manifest,
            packing_lists=normalized_packing_lists,
            rules=rules,
            validation_errors=unique_errors,
            correction_tasks=correction_tasks,
            container_reconciliations=container_reconciliations,
            overall_risk_level=overall_risk,
            risk_summary=dict(risk_summary)
        )
        
        os.makedirs(self.output_dir, exist_ok=True)
        exporter = Exporter(self.output_dir)
        exported_files = exporter.export_all(result)
        
        if self.verbose:
            print(f"  - 输出目录: {self.output_dir}")
            for key, path in exported_files.items():
                print(f"    - {path}")
        
        return result
    
    def _deduplicate_errors(self, errors: List[ValidationError]) -> List[ValidationError]:
        seen = set()
        unique = []
        
        for error in errors:
            key = (error.error_type, error.ticket_no, error.container_no, error.message[:50])
            if key not in seen:
                seen.add(key)
                unique.append(error)
        
        return unique
    
    def _calculate_overall_risk(self, risk_summary: Dict[RiskLevel, int]) -> RiskLevel:
        if risk_summary.get(RiskLevel.CRITICAL, 0) > 0:
            return RiskLevel.CRITICAL
        if risk_summary.get(RiskLevel.HIGH, 0) > 0:
            return RiskLevel.HIGH
        if risk_summary.get(RiskLevel.MEDIUM, 0) > 0:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW
    
    def print_summary(self, result: InspectionResult):
        print()
        print("=" * 60)
        print("检验完成摘要")
        print("=" * 60)
        print()
        
        risk_color = {
            RiskLevel.CRITICAL: '\033[91m',
            RiskLevel.HIGH: '\033[93m',
            RiskLevel.MEDIUM: '\033[96m',
            RiskLevel.LOW: '\033[92m',
        }
        reset_color = '\033[0m'
        
        color = risk_color.get(result.overall_risk_level, '')
        print(f"整体风险等级: {color}{result.overall_risk_level.value}{reset_color}")
        print()
        
        print("风险分布:")
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            count = result.risk_summary.get(level, 0)
            if count > 0:
                color = risk_color.get(level, '')
                print(f"  {color}{level.value}: {count} 个问题{reset_color}")
        print()
        
        print(f"舱单项数: {len(result.manifest.items) if result.manifest else 0}")
        print(f"装箱单数: {len(result.packing_lists)}")
        print(f"发现问题数: {len(result.validation_errors)}")
        print(f"生成任务数: {len(result.correction_tasks)}")
        print()
        print(f"输出目录: {self.output_dir}")
        print()


if __name__ == '__main__':
    main()
