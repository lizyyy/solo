import json
import os
import yaml
from datetime import datetime
from typing import Dict, Any, List
from collections import Counter


class ReportExporter:
    def __init__(self, result: Dict[str, Any]):
        self.result = result
        
    def generate_json_report(self, output_path: str) -> str:
        report = {
            "metadata": {
                "version": "1.0.0",
                "generated_at": datetime.now().isoformat(),
                "tool_name": "APIcassette脱敏排查CLI"
            },
            "summary": {
                "input_file": self.result["input_file"],
                "output_file": self.result["output_file"],
                "total_sensitive_matches": self.result["total_matches"],
                "is_clean_after_sanitization": self.result["is_clean"],
                "remaining_leaks_count": self.result["remaining_leaks"],
                "location_breakdown": self.result["scan_report"]
            },
            "details": {
                "sensitive_matches": self._summarize_matches(self.result["matches"]),
                "remaining_leaks": self._summarize_matches(self.result["remaining_matches"]),
                "replacement_mapping": self.result["mapping"]
            }
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
            
        return output_path
        
    def _summarize_matches(self, matches: List[Dict]) -> Dict[str, Any]:
        if not matches:
            return {"count": 0, "by_rule": {}, "by_location": {}}
            
        by_rule = Counter(m["rule_name"] for m in matches)
        by_location = Counter(m["location"] for m in matches)
        
        return {
            "count": len(matches),
            "by_rule": dict(by_rule),
            "by_location": dict(by_location),
            "items": [
                {
                    "field_path": m["field_path"],
                    "rule_name": m["rule_name"],
                    "location": m["location"],
                    "masked_preview": m["masked_value"]
                }
                for m in matches
            ]
        }
        
    def generate_human_report(self, output_path: str) -> str:
        lines = []
        
        lines.append("=" * 70)
        lines.append("           APIcassette 脱敏排查报告")
        lines.append("=" * 70)
        lines.append("")
        
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"输入文件: {self.result['input_file']}")
        lines.append(f"输出文件: {self.result['output_file'] or '(未生成)'}")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【摘要概览】")
        lines.append("-" * 70)
        lines.append(f"发现敏感数据: {self.result['total_matches']} 处")
        lines.append(f"脱敏后是否干净: {'✓ 是' if self.result['is_clean'] else '✗ 否 (仍有 ' + str(self.result['remaining_leaks']) + ' 处泄漏)'}")
        lines.append("")
        
        lines.append("按位置分布:")
        for loc, count in self.result["scan_report"].items():
            bar = "█" * min(count, 30)
            lines.append(f"  {loc:20} {count:4} 处  {bar}")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【敏感数据详情】")
        lines.append("-" * 70)
        
        if self.result["matches"]:
            by_rule = Counter(m["rule_name"] for m in self.result["matches"])
            for rule, count in by_rule.most_common():
                lines.append(f"")
                lines.append(f"规则 [{rule}]: 发现 {count} 处")
                rule_matches = [m for m in self.result["matches"] if m["rule_name"] == rule]
                for i, m in enumerate(rule_matches[:10], 1):
                    lines.append(f"  {i}. 位置: {m['field_path']}")
                    lines.append(f"     区域: {m['location']}")
                    lines.append(f"     替换: {m['original_value'][:20]}... → {m['masked_value']}")
                if len(rule_matches) > 10:
                    lines.append(f"  ... 还有 {len(rule_matches) - 10} 处")
        else:
            lines.append("  (未发现敏感数据)")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【替换映射表】")
        lines.append("-" * 70)
        
        if self.result["mapping"]:
            for original, masked in list(self.result["mapping"].items())[:20]:
                lines.append(f"  {original[:30]:30} → {masked}")
            if len(self.result["mapping"]) > 20:
                lines.append(f"  ... 还有 {len(self.result['mapping']) - 20} 条映射")
        else:
            lines.append("  (无替换记录)")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【复检结果】")
        lines.append("-" * 70)
        
        if self.result["remaining_leaks"] == 0:
            lines.append("  ✓ 复检通过，未发现残留敏感数据")
        else:
            lines.append(f"  ✗ 复检失败，发现 {self.result['remaining_leaks']} 处残留泄漏:")
            for i, m in enumerate(self.result["remaining_matches"], 1):
                lines.append(f"  {i}. {m['field_path']} ({m['rule_name']})")
        lines.append("")
        
        lines.append("=" * 70)
        lines.append("报告结束")
        lines.append("=" * 70)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))
            
        return output_path
        
    def print_console_summary(self):
        print()
        print("=" * 60)
        print("        APIcassette 脱敏排查 CLI")
        print("=" * 60)
        print()
        
        print(f"📁 输入文件: {self.result['input_file']}")
        print()
        
        print(f"🔍 扫描结果: 发现 {self.result['total_matches']} 处敏感数据")
        for loc, count in self.result["scan_report"].items():
            if count > 0:
                print(f"   - {loc}: {count} 处")
        print()
        
        if self.result["output_file"]:
            print(f"💾 已输出脱敏文件: {self.result['output_file']}")
        
        if self.result["is_clean"]:
            print(f"✅ 复检通过: 脱敏后无残留敏感数据")
        else:
            print(f"❌ 复检警告: 仍有 {self.result['remaining_leaks']} 处残留")
        
        print()
        print("=" * 60)
        print()


class ReChecker:
    def __init__(self, rules_engine):
        self.rules_engine = rules_engine
        
    def deep_check(self, data: Any, depth: int = 3) -> List[Dict]:
        leaks = []
        
        def _check(obj: Any, path: str, current_depth: int):
            if current_depth > depth:
                return
                
            if isinstance(obj, str):
                matches = self.rules_engine.scan_value(obj, path, "deep_check")
                leaks.extend([m.__dict__ for m in matches])
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    _check(v, f"{path}.{k}" if path else k, current_depth + 1)
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    _check(item, f"{path}[{i}]", current_depth + 1)
        
        _check(data, "", 0)
        return leaks
        
    def check_file(self, file_path: str, depth: int = 10) -> Dict[str, Any]:
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if ext in ['.yaml', '.yml']:
            data = yaml.safe_load(content)
        elif ext == '.json':
            data = json.loads(content)
        else:
            data = content
            
        leaks = self.deep_check(data, depth=depth)
        
        return {
            "file": os.path.basename(file_path),
            "leak_count": len(leaks),
            "leaks": leaks,
            "is_clean": len(leaks) == 0
        }
