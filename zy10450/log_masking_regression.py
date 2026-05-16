#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any


@dataclass
class MaskingRule:
    name: str
    pattern: str
    replacement: str
    priority: int = 0
    enabled: bool = True


@dataclass
class MatchResult:
    line_number: int
    original: str
    masked: str
    file_path: str
    differences: List[Tuple[str, str]] = field(default_factory=list)
    risk_words_found: List[str] = field(default_factory=list)
    has_error: bool = False
    error_message: str = ""


@dataclass
class FileResult:
    file_path: str
    total_lines: int = 0
    masked_lines: int = 0
    failed_lines: int = 0
    risk_lines: int = 0
    results: List[MatchResult] = field(default_factory=list)
    failed_samples: List[MatchResult] = field(default_factory=list)
    risk_samples: List[MatchResult] = field(default_factory=list)


@dataclass
class RegressionReport:
    summary: Dict[str, Any] = field(default_factory=dict)
    files: List[FileResult] = field(default_factory=list)
    failed_samples: List[MatchResult] = field(default_factory=list)
    risk_samples: List[MatchResult] = field(default_factory=list)


class LogMaskingRegression:
    def __init__(self, args):
        self.log_dir = Path(args.log_dir).resolve()
        self.rules_file = Path(args.rules_file).resolve()
        self.preserve_file = Path(args.preserve_file).resolve() if args.preserve_file else None
        self.risk_words_file = Path(args.risk_words_file).resolve() if args.risk_words_file else None
        self.output_dir = Path(args.output_dir).resolve()
        self.file_pattern = args.file_pattern or "*.log"
        self.verbose = args.verbose
        
        self.rules: List[MaskingRule] = []
        self.preserve_patterns: List[str] = []
        self.risk_words: Set[str] = set()
        
        self._validate_inputs()
        self._load_configurations()

    def _validate_inputs(self):
        errors = []
        
        if not self.log_dir.exists():
            errors.append(f"日志目录不存在: {self.log_dir}")
        elif not self.log_dir.is_dir():
            errors.append(f"路径不是目录: {self.log_dir}")
        
        if not self.rules_file.exists():
            errors.append(f"规则文件不存在: {self.rules_file}")
        elif not self.rules_file.is_file():
            errors.append(f"路径不是文件: {self.rules_file}")
        
        if self.preserve_file and not self.preserve_file.exists():
            errors.append(f"保留字段文件不存在: {self.preserve_file}")
        
        if self.risk_words_file and not self.risk_words_file.exists():
            errors.append(f"风险词表文件不存在: {self.risk_words_file}")
        
        if errors:
            print("输入校验失败:", file=sys.stderr)
            for err in errors:
                print(f"  ❌ {err}", file=sys.stderr)
            sys.exit(1)

    def _load_configurations(self):
        with open(self.rules_file, 'r', encoding='utf-8') as f:
            rules_data = json.load(f)
        
        self.rules = []
        for rule_data in rules_data.get("rules", []):
            if rule_data.get("enabled", True):
                self.rules.append(MaskingRule(
                    name=rule_data["name"],
                    pattern=rule_data["pattern"],
                    replacement=rule_data.get("replacement", "***"),
                    priority=rule_data.get("priority", 0),
                    enabled=True
                ))
        
        self.rules.sort(key=lambda x: -x.priority)
        
        if self.preserve_file:
            with open(self.preserve_file, 'r', encoding='utf-8') as f:
                self.preserve_patterns = [line.strip() for line in f if line.strip()]
        
        if self.risk_words_file:
            with open(self.risk_words_file, 'r', encoding='utf-8') as f:
                self.risk_words = set(line.strip().lower() for line in f if line.strip())
        
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _scan_log_files(self) -> List[Path]:
        return sorted(self.log_dir.rglob(self.file_pattern))

    def _apply_masking(self, line: str) -> Tuple[str, List[Tuple[str, str]]]:
        differences = []
        result = line
        
        for rule in self.rules:
            try:
                pattern = re.compile(rule.pattern)
                matches = pattern.findall(result)
                for match in matches:
                    original = match if isinstance(match, str) else match[0]
                    differences.append((original, rule.replacement))
                result = pattern.sub(rule.replacement, result)
            except re.error as e:
                print(f"警告: 规则 '{rule.name}' 的正则表达式无效: {e}", file=sys.stderr)
                continue
        
        return result, differences

    def _check_risk_words(self, masked_line: str) -> List[str]:
        found = []
        masked_lower = masked_line.lower()
        for word in self.risk_words:
            if word in masked_lower:
                found.append(word)
        return found

    def _process_file(self, file_path: Path) -> FileResult:
        file_result = FileResult(file_path=str(file_path))
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
        except Exception as e:
            file_result.failed_lines = 1
            error_result = MatchResult(
                line_number=0,
                original="",
                masked="",
                file_path=str(file_path),
                has_error=True,
                error_message=f"无法读取文件: {str(e)}"
            )
            file_result.results.append(error_result)
            return file_result
        
        file_result.total_lines = len(lines)
        
        for line_num, original_line in enumerate(lines, 1):
            original_line = original_line.rstrip('\n')
            
            try:
                masked_line, differences = self._apply_masking(original_line)
                risk_words_found = self._check_risk_words(masked_line)
                
                result = MatchResult(
                    line_number=line_num,
                    original=original_line,
                    masked=masked_line,
                    file_path=str(file_path),
                    differences=differences,
                    risk_words_found=risk_words_found
                )
                
                if differences:
                    file_result.masked_lines += 1
                
                if risk_words_found:
                    file_result.risk_lines += 1
                    file_result.risk_samples.append(result)
                
                file_result.results.append(result)
                
            except Exception as e:
                file_result.failed_lines += 1
                error_result = MatchResult(
                    line_number=line_num,
                    original=original_line,
                    masked="",
                    file_path=str(file_path),
                    has_error=True,
                    error_message=str(e)
                )
                file_result.results.append(error_result)
                file_result.failed_samples.append(error_result)
        
        return file_result

    def run(self) -> RegressionReport:
        log_files = self._scan_log_files()
        
        if not log_files:
            print(f"警告: 在 {self.log_dir} 中未找到匹配 '{self.file_pattern}' 的文件", file=sys.stderr)
        
        report = RegressionReport()
        
        for file_path in log_files:
            file_result = self._process_file(file_path)
            report.files.append(file_result)
            report.failed_samples.extend([r for r in file_result.results if r.has_error])
            report.risk_samples.extend([r for r in file_result.results if r.risk_words_found])
        
        total_lines = sum(f.total_lines for f in report.files)
        total_masked = sum(f.masked_lines for f in report.files)
        total_failed = sum(f.failed_lines for f in report.files)
        total_risk = sum(f.risk_lines for f in report.files)
        total_files = len(report.files)
        
        report.summary = {
            "scan_time": datetime.now().isoformat(),
            "log_directory": str(self.log_dir),
            "rules_file": str(self.rules_file),
            "total_files": total_files,
            "total_lines": total_lines,
            "masked_lines": total_masked,
            "failed_lines": total_failed,
            "risk_lines": total_risk,
            "rules_applied": len(self.rules)
        }
        
        return report

    def export_json(self, report: RegressionReport) -> Path:
        output_file = self.output_dir / "regression_results.json"
        
        json_data = {
            "summary": report.summary,
            "files": [],
            "failed_samples": [],
            "risk_samples": []
        }
        
        for file_result in report.files:
            file_dict = {
                "file_path": file_result.file_path,
                "total_lines": file_result.total_lines,
                "masked_lines": file_result.masked_lines,
                "failed_lines": file_result.failed_lines,
                "risk_lines": file_result.risk_lines
            }
            json_data["files"].append(file_dict)
        
        for sample in report.failed_samples:
            json_data["failed_samples"].append(asdict(sample))
        
        for sample in report.risk_samples:
            json_data["risk_samples"].append(asdict(sample))
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        return output_file

    def export_markdown(self, report: RegressionReport) -> Path:
        output_file = self.output_dir / "regression_report.md"
        
        summary = report.summary
        success_rate = ((summary["total_lines"] - summary["failed_lines"]) / summary["total_lines"] * 100) if summary["total_lines"] > 0 else 100
        
        md_content = f"""# 日志脱敏回归测试报告

## 📊 执行摘要

| 指标 | 数值 |
|------|------|
| 扫描时间 | {summary["scan_time"]} |
| 日志目录 | `{summary["log_directory"]}` |
| 规则文件 | `{summary["rules_file"]}` |
| 扫描文件数 | {summary["total_files"]} |
| 总行数 | {summary["total_lines"]} |
| 脱敏行数 | {summary["masked_lines"]} |
| 失败行数 | {summary["failed_lines"]} |
| 风险行数 | {summary["risk_lines"]} |
| 应用规则数 | {summary["rules_applied"]} |
| 成功率 | {success_rate:.1f}% |

## 📁 文件扫描结果

"""
        
        for file_result in report.files:
            md_content += f"""### 📄 {Path(file_result.file_path).name}

- **路径**: `{file_result.file_path}`
- **总行数**: {file_result.total_lines}
- **脱敏行数**: {file_result.masked_lines}
- **失败行数**: {file_result.failed_lines}
- **风险行数**: {file_result.risk_lines}

"""
        
        if report.failed_samples:
            md_content += "## ❌ 失败样本详情\n\n"
            for i, sample in enumerate(report.failed_samples[:20], 1):
                md_content += f"""### 失败样本 #{i}

- **文件**: `{sample.file_path}`
- **行号**: {sample.line_number}
- **错误信息**: {sample.error_message}
- **原始内容**:
```
{sample.original[:200]}{'...' if len(sample.original) > 200 else ''}
```

"""
            if len(report.failed_samples) > 20:
                md_content += f"\n> 还有 {len(report.failed_samples) - 20} 个失败样本未显示，详见 JSON 结果\n\n"
        
        if report.risk_samples:
            md_content += "## ⚠️ 风险词检测结果\n\n"
            for i, sample in enumerate(report.risk_samples[:20], 1):
                md_content += f"""### 风险样本 #{i}

- **文件**: `{sample.file_path}`
- **行号**: {sample.line_number}
- **检测到的风险词**: {', '.join(sample.risk_words_found)}
- **脱敏后内容**:
```
{sample.masked[:200]}{'...' if len(sample.masked) > 200 else ''}
```

"""
            if len(report.risk_samples) > 20:
                md_content += f"\n> 还有 {len(report.risk_samples) - 20} 个风险样本未显示，详见 JSON 结果\n\n"
        
        md_content += """## 🛠️ 使用说明

本报告由日志脱敏回归测试工具自动生成。
- **JSON 结果**: 包含完整的逐行检测数据，用于自动化分析
- **失败样本**: 所有处理失败的行及其文件位置
- **风险样本**: 脱敏后仍包含风险词的行，可能需要调整脱敏规则

"""
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return output_file

    def print_summary(self, report: RegressionReport):
        summary = report.summary
        
        print("\n" + "=" * 60)
        print("📊 日志脱敏回归测试 - 执行摘要")
        print("=" * 60)
        print(f"扫描时间: {summary['scan_time']}")
        print(f"日志目录: {summary['log_directory']}")
        print(f"规则文件: {summary['rules_file']}")
        print(f"扫描文件: {summary['total_files']} 个")
        print(f"总行数: {summary['total_lines']} 行")
        print(f"脱敏行数: {summary['masked_lines']} 行")
        print(f"失败行数: {summary['failed_lines']} 行")
        print(f"风险行数: {summary['risk_lines']} 行")
        print(f"应用规则: {summary['rules_applied']} 条")
        
        success_rate = ((summary["total_lines"] - summary["failed_lines"]) / summary["total_lines"] * 100) if summary["total_lines"] > 0 else 100
        print(f"成功率: {success_rate:.1f}%")
        print("=" * 60)
        
        if report.failed_samples:
            print(f"\n❌ 发现 {len(report.failed_samples)} 个失败样本:")
            for sample in report.failed_samples[:5]:
                print(f"  - {Path(sample.file_path).name}:{sample.line_number} - {sample.error_message}")
            if len(report.failed_samples) > 5:
                print(f"  ... 还有 {len(report.failed_samples) - 5} 个")
        
        if report.risk_samples:
            print(f"\n⚠️  发现 {len(report.risk_samples)} 个风险样本:")
            for sample in report.risk_samples[:5]:
                print(f"  - {Path(sample.file_path).name}:{sample.line_number} - 风险词: {', '.join(sample.risk_words_found)}")
            if len(report.risk_samples) > 5:
                print(f"  ... 还有 {len(report.risk_samples) - 5} 个")
        
        print(f"\n📁 输出目录: {self.output_dir}")
        print(f"   - JSON 结果: regression_results.json")
        print(f"   - Markdown 报告: regression_report.md")
        print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="日志脱敏回归测试 CLI - 批量验证脱敏规则在历史日志上的表现",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  %(prog)s --log-dir ./logs --rules-file rules.json --output-dir ./results
  %(prog)s --log-dir ./logs --rules-file rules.json --preserve-file preserve.txt --risk-words risk.txt
  %(prog)s --log-dir ./logs --rules-file rules.json --file-pattern "*.log*" --verbose
        """
    )
    
    parser.add_argument(
        "--log-dir", "-d",
        required=True,
        help="待扫描的日志目录路径（递归扫描）"
    )
    
    parser.add_argument(
        "--rules-file", "-r",
        required=True,
        help="脱敏规则配置文件路径（JSON格式）"
    )
    
    parser.add_argument(
        "--preserve-file", "-p",
        help="保留字段配置文件路径（每行一个正则表达式）"
    )
    
    parser.add_argument(
        "--risk-words-file", "-w",
        help="风险词表文件路径（每行一个词，脱敏后出现这些词将被标记）"
    )
    
    parser.add_argument(
        "--output-dir", "-o",
        default="./masking_results",
        help="输出目录路径（默认: ./masking_results）"
    )
    
    parser.add_argument(
        "--file-pattern", "-f",
        help="日志文件匹配模式（默认: *.log）"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细处理信息"
    )
    
    args = parser.parse_args()
    
    tool = LogMaskingRegression(args)
    report = tool.run()
    
    json_path = tool.export_json(report)
    md_path = tool.export_markdown(report)
    
    tool.print_summary(report)
    
    if report.summary["failed_lines"] > 0 or report.summary["risk_lines"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
