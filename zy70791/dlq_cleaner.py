#!/usr/bin/env python3
import argparse
import json
import sys
import re
import os
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Tuple, Optional


class DLQMessage:
    def __init__(self, raw_line: str, line_num: int):
        self.raw_line = raw_line
        self.line_num = line_num
        self.parsed: Optional[Dict] = None
        self.error: Optional[str] = None
        self.error_category: Optional[str] = None
        self.fixable: bool = False
        self.fixed_content: Optional[Dict] = None
        self.fix_note: Optional[str] = None
        
        self._parse()
    
    def _parse(self):
        try:
            self.parsed = json.loads(self.raw_line.strip())
        except json.JSONDecodeError as e:
            self.error = f"JSON解析失败: {str(e)}"
            self.error_category = "INVALID_JSON"
        except Exception as e:
            self.error = f"未知解析错误: {str(e)}"
            self.error_category = "PARSE_ERROR"


class FixRule:
    def __init__(self, name: str, category: str, pattern: str, fix_func):
        self.name = name
        self.category = category
        self.pattern = re.compile(pattern)
        self.fix_func = fix_func
    
    def match(self, message: DLQMessage) -> bool:
        if not message.error:
            return False
        return bool(self.pattern.search(message.error))


class DLQCleaner:
    def __init__(self):
        self.messages: List[DLQMessage] = []
        self.clusters: Dict[str, List[DLQMessage]] = defaultdict(list)
        self.fix_rules: List[FixRule] = []
        self._init_fix_rules()
    
    def _init_fix_rules(self):
        self.fix_rules = [
            FixRule(
                "修复缺少闭合括号",
                "INVALID_JSON",
                r"Expecting value|Unterminated string",
                self._fix_missing_brackets
            ),
        ]
    
    def _fix_missing_brackets(self, msg: DLQMessage) -> Tuple[bool, Optional[Dict], str]:
        line = msg.raw_line.strip()
        candidates = [line]
        
        if not line.endswith('}'):
            candidates.append(line + '}')
        if line.count('{') > line.count('}'):
            candidates.append(line + '}' * (line.count('{') - line.count('}')))
        
        for candidate in candidates:
            try:
                fixed = json.loads(candidate)
                return True, fixed, "已补充缺失的闭合括号"
            except:
                continue
        return False, None, "无法修复括号不匹配"
    
    def _fix_type_error(self, msg: DLQMessage) -> Tuple[bool, Optional[Dict], str]:
        if not msg.parsed:
            return False, None, "消息未解析"
        
        fixed = dict(msg.parsed)
        fixes = []
        
        if 'timestamp' in fixed and isinstance(fixed['timestamp'], str):
            try:
                ts = int(fixed['timestamp'])
                fixed['timestamp'] = ts
                fixes.append("timestamp转换为整数")
            except:
                pass
        
        return (True, fixed, ", ".join(fixes)) if fixes else (False, None, "无需要修复的类型错误")
    
    def load_file(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.rstrip('\n')
                if line.strip():
                    msg = DLQMessage(line, line_num)
                    self.messages.append(msg)
                    if msg.error_category:
                        self.clusters[msg.error_category].append(msg)
                    else:
                        self.clusters["VALID"].append(msg)
    
    def analyze_errors(self):
        for msg in self.messages:
            if msg.parsed:
                error_content = self._extract_error(msg.parsed)
                if error_content:
                    error_str = str(error_content)
                    if 'timeout' in error_str.lower():
                        msg.error_category = "TIMEOUT_ERROR"
                        msg.fixable = True
                        msg.fixed_content = msg.parsed
                        msg.fix_note = "超时错误可重试"
                        continue
                    elif 'rate limit' in error_str.lower():
                        msg.error_category = "RATE_LIMIT"
                        msg.fixable = True
                        msg.fixed_content = msg.parsed
                        msg.fix_note = "限流错误可稍后重试"
                        continue
            
            if msg.error:
                for rule in self.fix_rules:
                    if rule.match(msg):
                        success, fixed, note = rule.fix_func(msg)
                        if success:
                            msg.fixable = True
                            msg.fixed_content = fixed
                            msg.fix_note = note
                        break
            
            if not msg.fixable and msg.parsed and not msg.error:
                success, fixed, note = self._fix_type_error(msg)
                if success:
                    msg.fixable = True
                    msg.fixed_content = fixed
                    msg.fix_note = note
        
        self._rebuild_clusters()
    
    def _extract_error(self, parsed: dict) -> any:
        if 'error' in parsed:
            return parsed['error']
        if 'data' in parsed and isinstance(parsed['data'], dict) and 'error' in parsed['data']:
            return parsed['data']['error']
        return None
    
    def _rebuild_clusters(self):
        self.clusters = defaultdict(list)
        for msg in self.messages:
            if msg.error_category:
                self.clusters[msg.error_category].append(msg)
            else:
                self.clusters["VALID"].append(msg)
    
    def generate_report(self) -> Dict:
        total = len(self.messages)
        valid = len(self.clusters.get("VALID", []))
        invalid = total - valid
        fixable = sum(1 for m in self.messages if m.fixable)
        unfixable = invalid - fixable
        
        cluster_stats = {}
        for cat, msgs in self.clusters.items():
            cluster_stats[cat] = {
                "count": len(msgs),
                "fixable": sum(1 for m in msgs if m.fixable),
                "samples": [m.line_num for m in msgs[:3]]
            }
        
        return {
            "summary": {
                "total": total,
                "valid": valid,
                "invalid": invalid,
                "fixable": fixable,
                "unfixable": unfixable
            },
            "clusters": cluster_stats,
            "generated_at": datetime.now().isoformat()
        }
    
    def export_replay_list(self, filepath: str):
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            for msg in self.messages:
                if msg.fixable and msg.fixed_content:
                    f.write(json.dumps(msg.fixed_content, ensure_ascii=False) + '\n')
                elif not msg.error and msg.parsed and not msg.fixable:
                    f.write(json.dumps(msg.parsed, ensure_ascii=False) + '\n')
    
    def export_bad_messages(self, filepath: str):
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            for msg in self.messages:
                if msg.error and not msg.fixable:
                    f.write(f"--- Line {msg.line_num} ---\n")
                    f.write(f"Error: {msg.error}\n")
                    f.write(f"Category: {msg.error_category}\n")
                    f.write(f"Raw: {msg.raw_line}\n\n")
    
    def export_machine_report(self, filepath: str):
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        report = self.generate_report()
        report["messages"] = [
            {
                "line_num": m.line_num,
                "error": m.error,
                "error_category": m.error_category,
                "fixable": m.fixable,
                "fix_note": m.fix_note
            }
            for m in self.messages
        ]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    
    def print_human_report(self):
        report = self.generate_report()
        s = report["summary"]
        
        print("=" * 60)
        print("    死信消息清洗报告")
        print("=" * 60)
        print(f"生成时间: {report['generated_at']}")
        print()
        
        print("📊 汇总统计")
        print("-" * 40)
        print(f"  总消息数:     {s['total']:5d}")
        if s['total'] > 0:
            print(f"  有效消息:     {s['valid']:5d}  ({s['valid']/s['total']*100:5.1f}%)")
            print(f"  无效消息:     {s['invalid']:5d}  ({s['invalid']/s['total']*100:5.1f}%)")
        else:
            print("  有效消息:         0")
            print("  无效消息:         0")
        print(f"  ✓ 可修复:    {s['fixable']:5d}")
        print(f"  ✗ 需丢弃:    {s['unfixable']:5d}")
        print()
        
        print("🏷️  错误聚类分析")
        print("-" * 40)
        for cat, stats in report["clusters"].items():
            label = "✓ " if cat == "VALID" else ("🔧 " if stats["fixable"] > 0 else "✗ ")
            print(f"  {label}{cat:20s} {stats['count']:5d} 条")
            if stats["fixable"] > 0 and cat != "VALID":
                print(f"      可修复: {stats['fixable']} 条, 示例行号: {stats['samples']}")
        print()
        
        print("📋 可重放清单预览 (前5条)")
        print("-" * 40)
        count = 0
        for msg in self.messages:
            if count >= 5:
                break
            if (msg.fixable and msg.fixed_content) or (not msg.error and msg.parsed):
                content = msg.fixed_content if msg.fixable else msg.parsed
                preview = json.dumps(content, ensure_ascii=False)[:60]
                status = "已修复" if msg.fixable else "原本有效"
                print(f"  [{msg.line_num:4d}] {status} | {preview}...")
                count += 1
        if count == 0:
            print("  无可重放消息")
        print()


def main():
    parser = argparse.ArgumentParser(description="死信消息清洗重放清单排查工具")
    parser.add_argument("input", help="输入的JSONL死信文件路径")
    parser.add_argument("--replay", help="输出可重放清单文件路径")
    parser.add_argument("--bad", help="输出坏消息留存文件路径")
    parser.add_argument("--report", help="输出机器可读报告(JSON)")
    parser.add_argument("--quiet", action="store_true", help="静默模式,不打印人类可读报告")
    
    args = parser.parse_args()
    
    cleaner = DLQCleaner()
    
    try:
        cleaner.load_file(args.input)
    except FileNotFoundError:
        print(f"错误: 文件不存在 - {args.input}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"错误: 读取文件失败 - {str(e)}", file=sys.stderr)
        sys.exit(1)
    
    cleaner.analyze_errors()
    
    if not args.quiet:
        cleaner.print_human_report()
    
    if args.replay:
        cleaner.export_replay_list(args.replay)
        if not args.quiet:
            print(f"✅ 可重放清单已导出: {args.replay}")
    
    if args.bad:
        cleaner.export_bad_messages(args.bad)
        if not args.quiet:
            print(f"✅ 坏消息已留存: {args.bad}")
    
    if args.report:
        cleaner.export_machine_report(args.report)
        if not args.quiet:
            print(f"✅ 机器报告已导出: {args.report}")


if __name__ == "__main__":
    main()
