#!/usr/bin/env python3
"""
表单配置导出字段引用影响扫描 CLI
扫描字段删除、改名、隐藏等操作对表单配置的影响
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime
import re
from typing import Dict, List, Set, Tuple, Any


class FormFieldImpactScanner:
    """表单字段引用影响扫描器"""

    def __init__(self, input_path: str, rules_file: str, output_dir: str, 
                 dry_run: bool = False, overwrite: bool = False):
        self.input_path = Path(input_path)
        self.rules_file = Path(rules_file)
        self.output_dir = Path(output_dir)
        self.dry_run = dry_run
        self.overwrite = overwrite
        
        self.rules = {}
        self.form_configs = []
        self.results = {
            'scan_time': datetime.now().isoformat(),
            'input_path': input_path,
            'rules_file': rules_file,
            'summary': {},
            'field_renames': [],
            'hidden_fields': [],
            'formula_references': [],
            'field_deletion_impacts': [],
            'files_scanned': 0
        }

    def load_rules(self):
        """加载规则文件"""
        if not self.rules_file.exists():
            raise FileNotFoundError(f"规则文件不存在: {self.rules_file}")
        
        with open(self.rules_file, 'r', encoding='utf-8') as f:
            self.rules = json.load(f)
        
        print(f"✅ 加载规则文件: {self.rules_file}")
        print(f"   - 待删字段: {len(self.rules.get('fields_to_delete', []))} 个")
        print(f"   - 字段改名: {len(self.rules.get('field_renames', {}))} 个")
        print(f"   - 隐藏字段: {len(self.rules.get('hidden_fields', []))} 个")

    def scan_input_files(self):
        """扫描输入目录下的所有表单配置文件"""
        if self.input_path.is_file():
            files = [self.input_path]
        else:
            files = list(self.input_path.rglob('*.json'))
        
        print(f"\n🔍 开始扫描文件...")
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.form_configs.append({
                        'path': str(file_path),
                        'config': config
                    })
                    self.results['files_scanned'] += 1
                    print(f"   ✓ {file_path.name}")
            except Exception as e:
                print(f"   ✗ 读取失败 {file_path.name}: {e}")
        
        print(f"   共扫描 {len(self.form_configs)} 个文件")

    def analyze_field_renames(self):
        """分析字段改名影响"""
        renames = self.rules.get('field_renames', {})
        if not renames:
            return
        
        print(f"\n🔄 分析字段改名影响...")
        
        for old_name, new_name in renames.items():
            impacts = []
            for form in self.form_configs:
                config_str = json.dumps(form['config'], ensure_ascii=False)
                if old_name in config_str:
                    locations = self._find_field_occurrences(form['config'], old_name)
                    impacts.append({
                        'file': form['path'],
                        'occurrences': locations
                    })
                    print(f"   发现引用: {old_name} → {new_name} 在 {Path(form['path']).name}")
            
            self.results['field_renames'].append({
                'old_name': old_name,
                'new_name': new_name,
                'impact_count': len(impacts),
                'impacts': impacts
            })

    def analyze_hidden_fields(self):
        """分析隐藏字段影响"""
        hidden_fields = self.rules.get('hidden_fields', [])
        if not hidden_fields:
            return
        
        print(f"\n👁️ 分析隐藏字段影响...")
        
        for field_name in hidden_fields:
            impacts = []
            for form in self.form_configs:
                locations = self._find_field_occurrences(form['config'], field_name)
                if locations:
                    impacts.append({
                        'file': form['path'],
                        'occurrences': locations
                    })
                    print(f"   发现引用: {field_name} 在 {Path(form['path']).name}")
            
            self.results['hidden_fields'].append({
                'field_name': field_name,
                'impact_count': len(impacts),
                'impacts': impacts
            })

    def analyze_formula_references(self):
        """分析公式引用"""
        print(f"\n📐 分析公式引用...")
        
        formula_pattern = re.compile(r'formula|expression|计算|公式', re.IGNORECASE)
        
        for form in self.form_configs:
            formulas = self._find_formulas(form['config'])
            if formulas:
                for formula in formulas:
                    referenced_fields = self._extract_fields_from_formula(formula['value'])
                    self.results['formula_references'].append({
                        'file': form['path'],
                        'field_path': formula['path'],
                        'formula': formula['value'],
                        'referenced_fields': referenced_fields
                    })
                    print(f"   发现公式: {Path(form['path']).name} - {formula['path']}")

    def analyze_field_deletion_impacts(self):
        """分析字段删除影响"""
        fields_to_delete = self.rules.get('fields_to_delete', [])
        if not fields_to_delete:
            return
        
        print(f"\n🗑️ 分析字段删除影响...")
        
        for field_name in fields_to_delete:
            impacts = []
            for form in self.form_configs:
                locations = self._find_field_occurrences(form['config'], field_name)
                if locations:
                    impacts.append({
                        'file': form['path'],
                        'occurrences': locations
                    })
                    print(f"   发现引用: {field_name} 在 {Path(form['path']).name}")
            
            self.results['field_deletion_impacts'].append({
                'field_name': field_name,
                'impact_count': len(impacts),
                'impacts': impacts
            })

    def _find_field_occurrences(self, config: Any, field_name: str, path: str = 'root') -> List[str]:
        """查找字段在配置中的所有出现位置"""
        occurrences = []
        
        if isinstance(config, dict):
            for key, value in config.items():
                current_path = f"{path}.{key}"
                if key == field_name or (isinstance(value, str) and field_name in value):
                    occurrences.append(current_path)
                occurrences.extend(self._find_field_occurrences(value, field_name, current_path))
        elif isinstance(config, list):
            for i, item in enumerate(config):
                current_path = f"{path}[{i}]"
                occurrences.extend(self._find_field_occurrences(item, field_name, current_path))
        elif isinstance(config, str) and field_name in config:
            occurrences.append(f"{path} (值包含)")
        
        return occurrences

    def _find_formulas(self, config: Any, path: str = 'root') -> List[Dict]:
        """查找所有公式"""
        formulas = []
        
        if isinstance(config, dict):
            for key, value in config.items():
                current_path = f"{path}.{key}"
                if isinstance(value, str) and ('formula' in key.lower() or 
                                               'expression' in key.lower() or
                                               '计算' in key or
                                               '公式' in key):
                    formulas.append({'path': current_path, 'value': value})
                formulas.extend(self._find_formulas(value, current_path))
        elif isinstance(config, list):
            for i, item in enumerate(config):
                formulas.extend(self._find_formulas(item, f"{path}[{i}]"))
        
        return formulas

    def _extract_fields_from_formula(self, formula: str) -> List[str]:
        """从公式中提取引用的字段名"""
        field_pattern = re.compile(r'[\{|\[]([a-zA-Z0-9_]+)[\}|\]]')
        return list(set(field_pattern.findall(formula)))

    def generate_output(self):
        """生成输出文件"""
        if self.dry_run:
            print(f"\n🔍 Dry-run 模式，不生成输出文件")
            self._print_summary()
            return
        
        if self.output_dir.exists() and not self.overwrite:
            print(f"\n⚠️  输出目录已存在且未指定 --overwrite，跳过文件生成")
            self._print_summary()
            return
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"\n📝 生成输出文件到: {self.output_dir}")
        
        files_generated = []
        
        summary_file = self.output_dir / 'scan_summary.json'
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(self._build_summary(), f, ensure_ascii=False, indent=2)
        files_generated.append(('scan_summary.json', '扫描汇总报告，包含统计数据和概要'))
        
        rename_file = self.output_dir / 'field_renames_impact.json'
        with open(rename_file, 'w', encoding='utf-8') as f:
            json.dump({'field_renames': self.results['field_renames']}, f, ensure_ascii=False, indent=2)
        files_generated.append(('field_renames_impact.json', '字段改名影响详情，列出所有受影响的表单和位置'))
        
        hidden_file = self.output_dir / 'hidden_fields_impact.json'
        with open(hidden_file, 'w', encoding='utf-8') as f:
            json.dump({'hidden_fields': self.results['hidden_fields']}, f, ensure_ascii=False, indent=2)
        files_generated.append(('hidden_fields_impact.json', '隐藏字段影响详情，列出所有引用了隐藏字段的表单'))
        
        formula_file = self.output_dir / 'formula_references.json'
        with open(formula_file, 'w', encoding='utf-8') as f:
            json.dump({'formula_references': self.results['formula_references']}, f, ensure_ascii=False, indent=2)
        files_generated.append(('formula_references.json', '公式引用分析，列出所有公式及其引用的字段'))
        
        deletion_file = self.output_dir / 'field_deletion_impacts.json'
        with open(deletion_file, 'w', encoding='utf-8') as f:
            json.dump({'field_deletion_impacts': self.results['field_deletion_impacts']}, f, ensure_ascii=False, indent=2)
        files_generated.append(('field_deletion_impacts.json', '字段删除影响详情，列出所有引用待删字段的表单'))
        
        full_report_file = self.output_dir / 'full_scan_report.json'
        with open(full_report_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        files_generated.append(('full_scan_report.json', '完整扫描报告，包含所有扫描结果的原始数据'))
        
        for filename, description in files_generated:
            print(f"   ✓ {filename} - {description}")
        
        self._print_summary()

    def _build_summary(self) -> Dict:
        """构建汇总信息"""
        total_rename_impacts = sum(r['impact_count'] for r in self.results['field_renames'])
        total_hidden_impacts = sum(h['impact_count'] for h in self.results['hidden_fields'])
        total_deletion_impacts = sum(d['impact_count'] for d in self.results['field_deletion_impacts'])
        
        return {
            'scan_info': {
                'scan_time': self.results['scan_time'],
                'input_path': self.results['input_path'],
                'rules_file': self.results['rules_file'],
                'files_scanned': self.results['files_scanned']
            },
            'impact_summary': {
                'field_renames_count': len(self.results['field_renames']),
                'field_renames_impacts': total_rename_impacts,
                'hidden_fields_count': len(self.results['hidden_fields']),
                'hidden_fields_impacts': total_hidden_impacts,
                'formula_references_count': len(self.results['formula_references']),
                'deletion_fields_count': len(self.results['field_deletion_impacts']),
                'deletion_impacts': total_deletion_impacts
            },
            'output_files': {
                'scan_summary.json': '扫描汇总报告，包含统计数据和概要',
                'field_renames_impact.json': '字段改名影响详情，列出所有受影响的表单和位置',
                'hidden_fields_impact.json': '隐藏字段影响详情，列出所有引用了隐藏字段的表单',
                'formula_references.json': '公式引用分析，列出所有公式及其引用的字段',
                'field_deletion_impacts.json': '字段删除影响详情，列出所有引用待删字段的表单',
                'full_scan_report.json': '完整扫描报告，包含所有扫描结果的原始数据'
            }
        }

    def _print_summary(self):
        """打印汇总信息"""
        print(f"\n{'='*60}")
        print(f"📊 表单配置导出字段引用影响扫描 - 汇总报告")
        print(f"{'='*60}")
        print(f"扫描时间: {self.results['scan_time']}")
        print(f"扫描文件: {self.results['files_scanned']} 个")
        print(f"")
        
        summary = self._build_summary()['impact_summary']
        print(f"字段改名: {summary['field_renames_count']} 个字段, 影响 {summary['field_renames_impacts']} 处")
        print(f"隐藏字段: {summary['hidden_fields_count']} 个字段, 影响 {summary['hidden_fields_impacts']} 处")
        print(f"公式引用: {summary['formula_references_count']} 个")
        print(f"字段删除: {summary['deletion_fields_count']} 个字段, 影响 {summary['deletion_impacts']} 处")
        print(f"{'='*60}")

    def run(self):
        """执行完整扫描流程"""
        print(f"\n{'='*60}")
        print(f"🚀 表单配置导出字段引用影响扫描 CLI")
        print(f"{'='*60}")
        
        self.load_rules()
        self.scan_input_files()
        self.analyze_field_renames()
        self.analyze_hidden_fields()
        self.analyze_formula_references()
        self.analyze_field_deletion_impacts()
        self.generate_output()


def main():
    parser = argparse.ArgumentParser(
        description='表单配置导出字段引用影响扫描 CLI - 扫描字段删除、改名、隐藏等操作对表单配置的影响',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python form_field_impact_scanner.py --input ./forms --rules rules.json --output ./results
  python form_field_impact_scanner.py --input ./forms --rules rules.json --output ./results --dry-run
  python form_field_impact_scanner.py --input ./forms --rules rules.json --output ./results --overwrite
        """
    )
    
    parser.add_argument('--input', '-i', required=True,
                        help='输入路径：表单配置文件或目录（.json格式）')
    parser.add_argument('--rules', '-r', required=True,
                        help='规则文件：定义待删字段、改名映射、隐藏字段（.json格式）')
    parser.add_argument('--output', '-o', required=True,
                        help='输出目录：存放扫描结果文件的目录')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='试运行模式：只分析不生成输出文件')
    parser.add_argument('--overwrite', '-w', action='store_true',
                        help='覆盖模式：输出目录存在时强制覆盖')
    
    args = parser.parse_args()
    
    try:
        scanner = FormFieldImpactScanner(
            input_path=args.input,
            rules_file=args.rules,
            output_dir=args.output,
            dry_run=args.dry_run,
            overwrite=args.overwrite
        )
        scanner.run()
        return 0
    except Exception as e:
        print(f"\n❌ 错误: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
