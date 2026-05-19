import json
from typing import Optional
from pathlib import Path

from .models import ShadowReport, VariableChain, SourceType


class Reporter:
    def __init__(self, report: ShadowReport):
        self.report = report
    
    def print_console(self, detailed: bool = False, show_overrides_only: bool = False) -> None:
        self._print_header()
        
        if self.report.parse_errors:
            self._print_errors()
        
        if show_overrides_only:
            self._print_overrides_only()
        elif detailed:
            self._print_detailed()
        else:
            self._print_summary()
        
        self._print_footer()
    
    def _print_header(self) -> None:
        print("=" * 80)
        print("环境变量覆盖链影子值定位排查报告")
        print("=" * 80)
        print(f"扫描路径: {self.report.scan_path}")
        print(f"解析文件数: {self.report.total_files}")
        print(f"发现变量数: {self.report.total_variables}")
        print(f"有覆盖变量: {self.report.variables_with_overrides}")
        print(f"缺失提示变量: {self.report.missing_variables}")
        print("-" * 80)
    
    def _print_footer(self) -> None:
        print("=" * 80)
    
    def _print_errors(self) -> None:
        print("\n[解析错误]")
        for error in self.report.parse_errors:
            print(f"  ✗ {error}")
        print()
    
    def _print_summary(self) -> None:
        for var_name, chain in sorted(self.report.variable_chains.items()):
            self._print_chain_summary(chain)
    
    def _print_overrides_only(self) -> None:
        for var_name, chain in sorted(self.report.variable_chains.items()):
            if chain.override_chain:
                self._print_chain_detail(chain)
    
    def _print_detailed(self) -> None:
        for var_name, chain in sorted(self.report.variable_chains.items()):
            self._print_chain_detail(chain)
    
    def _print_chain_summary(self, chain: VariableChain) -> None:
        if chain.is_missing:
            status = "✗ MISSING"
        elif chain.override_chain:
            status = "⚠ OVERRIDDEN"
        else:
            status = "✓ CLEAN"
        
        final_value = chain.final_value or "N/A"
        if len(final_value) > 40:
            final_value = final_value[:37] + "..."
        
        print(f"[{status}] {chain.name:<30} = {final_value}")
    
    def _print_chain_detail(self, chain: VariableChain) -> None:
        print(f"\n{'─' * 80}")
        
        if chain.is_missing:
            print(f"✗ 变量: {chain.name}")
            print(f"  状态: 缺失或全部注释")
            if chain.missing_hint:
                print(f"  提示: {chain.missing_hint}")
            if chain.definitions:
                print(f"  找到的定义（全部被注释）:")
                for d in chain.definitions:
                    print(f"    [{d.source_type.value}:{d.source_level.value}] {d.file_path}:{d.line_number}")
                    print(f"      {d.raw_line}")
            return
        
        print(f"变量: {chain.name}")
        print(f"最终值: {chain.final_value}")
        
        if chain.effective_source:
            src = chain.effective_source
            print(f"生效来源: [{src.source_type.value}:{src.source_level.value}] {src.file_path}:{src.line_number}")
        
        if chain.definitions:
            print(f"\n所有定义 ({len(chain.definitions)} 处):")
            for idx, d in enumerate(sorted(chain.definitions, key=lambda x: (x.source_level.value, x.file_path, x.line_number)), 1):
                status = "⊗" if d.is_commented else "⊕"
                print(f"  {idx}. {status} [{d.source_type.value}:{d.source_level.value}] {d.file_path}:{d.line_number}")
                print(f"       值: {d.value}")
                print(f"       行: {d.raw_line}")
        
        if chain.override_chain:
            print(f"\n覆盖链 ({len(chain.override_chain)} 次覆盖):")
            for idx, record in enumerate(chain.override_chain, 1):
                old_src = record.old_source
                new_src = record.new_source
                print(f"  {idx}. '{record.old_value}' → '{record.new_value}'")
                print(f"     来源: [{old_src.source_type.value}:{old_src.source_level.value}] {old_src.file_path}:{old_src.line_number}")
                print(f"       → [{new_src.source_type.value}:{new_src.source_level.value}] {new_src.file_path}:{new_src.line_number}")
    
    def export_json(self, output_path: str) -> None:
        data = self.report.to_dict()
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\nJSON 报告已导出到: {output_path}")
    
    def export_markdown(self, output_path: str) -> None:
        lines = []
        lines.append("# 环境变量覆盖链影子值定位排查报告")
        lines.append("")
        lines.append("## 概览")
        lines.append("")
        lines.append(f"- 扫描路径: `{self.report.scan_path}`")
        lines.append(f"- 解析文件数: {self.report.total_files}")
        lines.append(f"- 发现变量数: {self.report.total_variables}")
        lines.append(f"- 有覆盖变量: {self.report.variables_with_overrides}")
        lines.append(f"- 缺失提示变量: {self.report.missing_variables}")
        lines.append("")
        
        if self.report.parse_errors:
            lines.append("## 解析错误")
            lines.append("")
            for error in self.report.parse_errors:
                lines.append(f"- ❌ {error}")
            lines.append("")
        
        lines.append("## 变量详情")
        lines.append("")
        
        for var_name, chain in sorted(self.report.variable_chains.items()):
            status_icon = "❌" if chain.is_missing else ("⚠️" if chain.override_chain else "✅")
            lines.append(f"### {status_icon} {var_name}")
            lines.append("")
            
            if chain.is_missing:
                lines.append("- **状态**: 缺失或全部注释")
                if chain.missing_hint:
                    lines.append(f"- **提示**: {chain.missing_hint}")
            else:
                lines.append(f"- **最终值**: `{chain.final_value}`")
                if chain.effective_source:
                    src = chain.effective_source
                    lines.append(f"- **生效来源**: `{src.file_path}:{src.line_number}`")
            
            if chain.definitions:
                lines.append("")
                lines.append("#### 所有定义")
                lines.append("")
                lines.append("| # | 状态 | 来源 | 层级 | 位置 | 值 |")
                lines.append("|---|------|------|------|------|----|")
                for idx, d in enumerate(sorted(chain.definitions, key=lambda x: (x.source_level.value, x.file_path, x.line_number)), 1):
                    status = "⊗ 注释" if d.is_commented else "⊕ 激活"
                    display_value = d.value.replace('|', '\\|')
                    if len(display_value) > 30:
                        display_value = display_value[:27] + "..."
                    lines.append(f"| {idx} | {status} | {d.source_type.value} | {d.source_level.value} | `{Path(d.file_path).name}:{d.line_number}` | `{display_value}` |")
            
            if chain.override_chain:
                lines.append("")
                lines.append("#### 覆盖链")
                lines.append("")
                lines.append("| # | 旧值 | 新值 | 旧来源 | 新来源 |")
                lines.append("|---|------|------|--------|--------|")
                for idx, record in enumerate(chain.override_chain, 1):
                    old_src = record.old_source
                    new_src = record.new_source
                    old_val = record.old_value
                    new_val = record.new_value
                    if len(old_val) > 20:
                        old_val = old_val[:17] + "..."
                    if len(new_val) > 20:
                        new_val = new_val[:17] + "..."
                    lines.append(f"| {idx} | `{old_val}` | `{new_val}` | `{Path(old_src.file_path).name}:{old_src.line_number}` | `{Path(new_src.file_path).name}:{new_src.line_number}` |")
            
            lines.append("")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f"\nMarkdown 报告已导出到: {output_path}")
