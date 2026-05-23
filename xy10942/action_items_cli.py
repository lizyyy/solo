#!/usr/bin/env python3
import argparse
import os
import re
import json
import csv
from datetime import datetime, date
from collections import defaultdict
from pathlib import Path
import sys


class Config:
    DEFAULT_OUTPUT_DIR = "./action_items_output"
    DEFAULT_STATUS_KEYWORDS = ["待办", "进行中", "完成", "阻塞", "延期"]
    DATE_FORMATS = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m-%d",
        "%m/%d",
        "%Y年%m月%d日",
        "%m月%d日"
    ]


class ActionItem:
    def __init__(self, content="", assignee="", due_date=None, status="待办", 
                 delay_reason="", line_number=0, raw_line="", is_valid=True, source_file=""):
        self.content = content
        self.assignee = assignee
        self.due_date = due_date
        self.status = status
        self.delay_reason = delay_reason
        self.line_number = line_number
        self.raw_line = raw_line
        self.is_valid = is_valid
        self.source_file = source_file
        self.is_delayed = False

    def update_delayed_status(self):
        if not self.due_date or self.status == "完成":
            self.is_delayed = False
        else:
            today = date.today()
            self.is_delayed = self.due_date < today

    def to_dict(self):
        return {
            "content": self.content,
            "assignee": self.assignee,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "status": self.status,
            "delay_reason": self.delay_reason,
            "line_number": self.line_number,
            "raw_line": self.raw_line,
            "is_valid": self.is_valid,
            "source_file": self.source_file,
            "is_delayed": self.is_delayed
        }


class MarkdownParser:
    def __init__(self, status_keywords=None):
        self.status_keywords = status_keywords or Config.DEFAULT_STATUS_KEYWORDS

    def parse_file(self, file_path):
        action_items = []
        source_file = os.path.basename(file_path)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for line_num, line in enumerate(lines, 1):
            action_item = self._parse_line(line, line_num, source_file)
            if action_item:
                action_items.append(action_item)

        return action_items

    def _parse_line(self, line, line_num, source_file):
        stripped_line = line.strip()
        
        if not self._is_task_line(stripped_line):
            return None

        action_item = ActionItem(
            line_number=line_num,
            raw_line=line.rstrip(),
            source_file=source_file,
            is_valid=False
        )

        content = stripped_line
        
        checkbox_match = re.match(r'^[-*]\s*\[([ xX])\]\s*', content)
        if checkbox_match:
            checkbox_status = checkbox_match.group(1)
            if checkbox_status in ['x', 'X']:
                action_item.status = "完成"
        
        delay_reason = self._extract_delay_reason(content)
        if delay_reason:
            action_item.delay_reason = delay_reason
            content = self._remove_delay_reason_from_content(content)

        assignee, content = self._extract_and_remove_assignee(content)
        action_item.assignee = assignee

        due_date = self._extract_date(content)
        if due_date:
            action_item.due_date = due_date
            content = self._remove_date_from_content(content)

        if action_item.status != "完成":
            status, content = self._extract_and_remove_status(content)
            action_item.status = status

        content = self._clean_content(content)
        action_item.content = content

        if content or assignee or due_date:
            action_item.is_valid = True

        action_item.update_delayed_status()

        return action_item

    def _is_task_line(self, line):
        task_patterns = [
            r'^[-*]\s*\[( |x|X)\]\s*',
            r'^[-*]\s+@[\w\u4e00-\u9fff]+',
            r'^[-*]\s+.*\s+(' + '|'.join(re.escape(s) for s in self.status_keywords) + r')$',
            r'^[-*]\s+.*\d{4}-\d{1,2}-\d{1,2}',
            r'^\d+\.\s*.*负责人[:：]',
            r'^\d+\.\s*.*@[\w\u4e00-\u9fff]+',
            r'^\d+\.\s*.*\d{4}-\d{1,2}-\d{1,2}',
            r'^待办[:：]\s*',
        ]
        return any(re.search(pattern, line) for pattern in task_patterns)

    def _extract_and_remove_assignee(self, content):
        assignee_patterns = [
            (r'@([\w\u4e00-\u9fff]+)', r'@[\w\u4e00-\u9fff]+'),
            (r'负责人[:：]\s*([\w\u4e00-\u9fff]+)', r'负责人[:：]\s*[\w\u4e00-\u9fff]+'),
            (r'指派给[:：]\s*([\w\u4e00-\u9fff]+)', r'指派给[:：]\s*[\w\u4e00-\u9fff]+'),
            (r'\(([\w\u4e00-\u9fff]+)\s*负责', r'\([\w\u4e00-\u9fff]+\s*负责[^)]*\)'),
        ]
        
        for match_pattern, remove_pattern in assignee_patterns:
            match = re.search(match_pattern, content)
            if match:
                assignee = match.group(1)
                content = re.sub(remove_pattern, '', content).strip()
                return assignee, content
        return "", content

    def _extract_date(self, content):
        for date_format in Config.DATE_FORMATS:
            date_pattern = self._get_date_pattern(date_format)
            match = re.search(date_pattern, content)
            if match:
                try:
                    date_str = match.group(0)
                    parsed_date = datetime.strptime(date_str, date_format).date()
                    if date_format in ["%m-%d", "%m/%d", "%m月%d日"]:
                        parsed_date = parsed_date.replace(year=date.today().year)
                    return parsed_date
                except ValueError:
                    continue
        return None

    def _get_date_pattern(self, date_format):
        patterns = {
            "%Y-%m-%d": r'\d{4}-\d{1,2}-\d{1,2}',
            "%Y/%m/%d": r'\d{4}/\d{1,2}/\d{1,2}',
            "%m-%d": r'\d{1,2}-\d{1,2}',
            "%m/%d": r'\d{1,2}/\d{1,2}',
            "%Y年%m月%d日": r'\d{4}年\d{1,2}月\d{1,2}日',
            "%m月%d日": r'\d{1,2}月\d{1,2}日'
        }
        return patterns.get(date_format, r'\d{4}-\d{1,2}-\d{1,2}')

    def _remove_date_from_content(self, content):
        for date_format in Config.DATE_FORMATS:
            date_pattern = self._get_date_pattern(date_format)
            content = re.sub(date_pattern, '', content)
        return content.strip()

    def _extract_and_remove_status(self, content):
        status_patterns = [
            (r'\s+(' + '|'.join(re.escape(s) for s in self.status_keywords) + r')$', '待办'),
            (r'^(' + '|'.join(re.escape(s) for s in self.status_keywords) + r')[:：\s]+', '待办'),
            (r'\s+(' + '|'.join(re.escape(s) for s in self.status_keywords) + r')\s+', '待办'),
        ]
        
        for pattern, default_status in status_patterns:
            match = re.search(pattern, content)
            if match:
                status = match.group(1)
                content = re.sub(pattern, ' ', content).strip()
                return status, content
        
        return "待办", content

    def _extract_delay_reason(self, content):
        delay_patterns = [
            r'延期原因[:：]\s*([^。！？\n]+)',
            r'阻塞原因[:：]\s*([^。！？\n]+)',
            r'为什么延期[:：]\s*([^。！？\n]+)'
        ]
        
        for pattern in delay_patterns:
            match = re.search(pattern, content)
            if match:
                return match.group(1).strip()
        return ""

    def _remove_delay_reason_from_content(self, content):
        delay_patterns = [
            r'延期原因[:：]\s*[^。！？\n]+',
            r'阻塞原因[:：]\s*[^。！？\n]+',
            r'为什么延期[:：]\s*[^。！？\n]+'
        ]
        
        for pattern in delay_patterns:
            content = re.sub(pattern, '', content)
        return content.strip()

    def _clean_content(self, content):
        content = re.sub(r'^[-*]\s*\[( |x|X)\]\s*', '', content)
        content = re.sub(r'^[-*]\s+', '', content)
        content = re.sub(r'^\d+\.\s*', '', content)
        content = re.sub(r'^待办[:：]\s*', '', content)
        content = re.sub(r'^[:：]\s*', '', content)
        content = re.sub(r'\s+', ' ', content)
        return content.strip()


class ActionItemReporter:
    def __init__(self, output_dir, append_mode=False):
        self.output_dir = Path(output_dir)
        self.append_mode = append_mode
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_reports(self, action_items):
        self._print_terminal_summary(action_items)
        self._generate_json_report(action_items)
        self._generate_csv_report(action_items)
        self._generate_markdown_report(action_items)

    def _print_terminal_summary(self, action_items):
        print("\n" + "="*60)
        print("会议纪要行动项摘要")
        print("="*60)
        
        valid_items = [item for item in action_items if item.is_valid]
        invalid_items = [item for item in action_items if not item.is_valid]
        
        print(f"\n总计: {len(valid_items)} 个有效行动项")
        print(f"异常: {len(invalid_items)} 个异常行")
        
        assignee_groups = defaultdict(list)
        for item in valid_items:
            assignee_groups[item.assignee or "未分配"].append(item)
        
        print("\n按负责人统计:")
        for assignee, items in sorted(assignee_groups.items()):
            delayed = sum(1 for item in items if item.is_delayed)
            print(f"  {assignee}: {len(items)} 项 (延期: {delayed})")
        
        status_groups = defaultdict(list)
        for item in valid_items:
            status_groups[item.status].append(item)
        
        print("\n按状态统计:")
        for status, items in sorted(status_groups.items()):
            print(f"  {status}: {len(items)} 项")
        
        print("\n" + "="*60)

    def _generate_json_report(self, action_items):
        file_path = self.output_dir / "action_items.json"
        
        data = [item.to_dict() for item in action_items]
        
        if self.append_mode and file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            data = existing_data + data
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"JSON报告已生成: {file_path}")

    def _generate_csv_report(self, action_items):
        file_path = self.output_dir / "action_items.csv"
        
        fieldnames = ["content", "assignee", "due_date", "status", "delay_reason", 
                     "line_number", "raw_line", "is_valid", "source_file", "is_delayed"]
        
        mode = 'a' if self.append_mode and file_path.exists() else 'w'
        
        with open(file_path, mode, encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if mode == 'w':
                writer.writeheader()
            for item in action_items:
                writer.writerow(item.to_dict())
        
        print(f"CSV报告已生成: {file_path}")

    def _generate_markdown_report(self, action_items):
        file_path = self.output_dir / "action_items_report.md"
        
        valid_items = [item for item in action_items if item.is_valid]
        invalid_items = [item for item in action_items if not item.is_valid]
        
        assignee_groups = defaultdict(list)
        for item in valid_items:
            assignee_groups[item.assignee or "未分配"].append(item)
        
        status_groups = defaultdict(list)
        for item in valid_items:
            status_groups[item.status].append(item)
        
        content = f"# 会议纪要行动项报告\n\n"
        content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        
        content += "## 概览\n\n"
        content += f"- 总计行动项: {len(valid_items)}\n"
        content += f"- 异常行数: {len(invalid_items)}\n"
        content += f"- 延期项数: {sum(1 for item in valid_items if item.is_delayed)}\n\n"
        
        content += "## 按负责人分类\n\n"
        for assignee, items in sorted(assignee_groups.items()):
            content += f"### {assignee} ({len(items)}项)\n\n"
            content += "| 状态 | 内容 | 截止日期 | 延期原因 |\n"
            content += "|------|------|----------|----------|\n"
            for item in sorted(items, key=lambda x: x.due_date or date.max):
                due_date_str = item.due_date.strftime('%Y-%m-%d') if item.due_date else "未设置"
                delay_str = f"⚠️ {item.delay_reason}" if item.is_delayed and item.delay_reason else ("⚠️ 延期" if item.is_delayed else "")
                content += f"| {item.status} | {item.content} | {due_date_str} | {delay_str} |\n"
            content += "\n"
        
        content += "## 按状态分类\n\n"
        for status, items in sorted(status_groups.items()):
            content += f"### {status} ({len(items)}项)\n\n"
            for item in items:
                assignee_str = f" - @{item.assignee}" if item.assignee else ""
                due_date_str = item.due_date.strftime('%Y-%m-%d') if item.due_date else ""
                content += f"- [ ] {item.content}{assignee_str} {due_date_str}\n"
            content += "\n"
        
        if invalid_items:
            content += "## 异常行（保留原始位置）\n\n"
            for item in invalid_items:
                content += f"- **{item.source_file}:{item.line_number}**: {item.raw_line}\n"
            content += "\n"
        
        if self.append_mode and file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_content = f.read()
            content = existing_content + "\n\n---\n\n" + content
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Markdown报告已生成: {file_path}")


def validate_input(args):
    errors = []
    
    if args.input:
        input_path = Path(args.input)
        if not input_path.exists():
            errors.append(f"输入文件不存在: {args.input}")
        elif not input_path.is_file():
            errors.append(f"输入不是文件: {args.input}")
        elif input_path.suffix.lower() != '.md':
            errors.append(f"输入文件不是Markdown格式: {args.input}")
    
    if args.output:
        output_path = Path(args.output)
        if output_path.exists() and not output_path.is_dir():
            errors.append(f"输出路径不是目录: {args.output}")
    
    return errors


def main():
    parser = argparse.ArgumentParser(
        description="会议纪要行动项CLI - 从Markdown会议纪要中提取和管理待办事项",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s -i meeting_notes.md
  %(prog)s -i meeting_notes.md -o ./output
  %(prog)s -i meeting_notes.md -a
  %(prog)s -i meeting_notes.md -s 待办 进行中 完成
        """
    )
    
    parser.add_argument("-i", "--input", required=True, help="输入Markdown会议纪要文件路径")
    parser.add_argument("-o", "--output", default=Config.DEFAULT_OUTPUT_DIR, help="输出目录 (默认: ./action_items_output)")
    parser.add_argument("-a", "--append", action="store_true", help="追加模式，不覆盖已有报告")
    parser.add_argument("-s", "--status", nargs="+", default=Config.DEFAULT_STATUS_KEYWORDS, 
                       help=f"自定义状态关键词列表 (默认: {', '.join(Config.DEFAULT_STATUS_KEYWORDS)})")
    parser.add_argument("-v", "--verbose", action="store_true", help="显示详细信息")
    
    args = parser.parse_args()
    
    errors = validate_input(args)
    if errors:
        print("错误:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    
    print(f"正在处理文件: {args.input}")
    print(f"输出目录: {args.output}")
    if args.append:
        print("模式: 追加到已有报告")
    else:
        print("模式: 覆盖已有报告")
    
    parser = MarkdownParser(status_keywords=args.status)
    action_items = parser.parse_file(args.input)
    
    reporter = ActionItemReporter(args.output, append_mode=args.append)
    reporter.generate_reports(action_items)
    
    print("\n处理完成!")


if __name__ == "__main__":
    main()
