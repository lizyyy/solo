#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import re
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Any, Set, Tuple

DATA_DIR = Path(__file__).parent / "data"
ACTION_ITEMS_FILE = DATA_DIR / "action_items.json"
PROCESSED_FILES_FILE = DATA_DIR / "processed_files.json"

VALID_STATUSES = ["待开始", "进行中", "已完成", "延期", "已取消"]


class ActionItem:
    def __init__(
        self,
        id: str,
        description: str,
        assignee: Optional[str] = None,
        due_date: Optional[str] = None,
        project: Optional[str] = None,
        status: str = "待开始",
        source_files: List[str] = None,
        history: List[Dict[str, Any]] = None,
        flags: List[str] = None,
        created_at: str = None,
        updated_at: str = None
    ):
        self.id = id
        self.description = description
        self.assignee = assignee
        self.due_date = due_date
        self.project = project
        self.status = status
        self.source_files = source_files or []
        self.history = history or []
        self.flags = flags or []
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "description": self.description,
            "assignee": self.assignee,
            "due_date": self.due_date,
            "project": self.project,
            "status": self.status,
            "source_files": self.source_files,
            "history": self.history,
            "flags": self.flags,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ActionItem':
        return cls(
            id=data["id"],
            description=data["description"],
            assignee=data.get("assignee"),
            due_date=data.get("due_date"),
            project=data.get("project"),
            status=data.get("status", "待开始"),
            source_files=data.get("source_files", []),
            history=data.get("history", []),
            flags=data.get("flags", []),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at")
        )

    def is_overdue(self, reference_date: date = None) -> bool:
        if not self.due_date:
            return False
        try:
            due_date = datetime.strptime(self.due_date, "%Y-%m-%d").date()
            ref_date = reference_date or date.today()
            return due_date < ref_date and self.status not in ["已完成", "已取消"]
        except ValueError:
            return False

    def validate(self) -> Tuple[bool, List[str]]:
        issues = []
        valid = True

        if not self.assignee:
            issues.append("负责人缺失")
            valid = False

        if not self.due_date:
            issues.append("截止日期缺失")
            valid = False
        elif not re.match(r'^\d{4}-\d{2}-\d{2}$', self.due_date):
            issues.append(f"截止日期格式不规范: {self.due_date}")
            valid = False

        if self.status not in VALID_STATUSES:
            issues.append(f"无效状态: {self.status}")
            valid = False

        return valid, issues


def load_data() -> Tuple[Dict[str, ActionItem], Set[str]]:
    DATA_DIR.mkdir(exist_ok=True)

    action_items = {}
    if ACTION_ITEMS_FILE.exists():
        with open(ACTION_ITEMS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            action_items = {k: ActionItem.from_dict(v) for k, v in data.items()}

    processed_files = set()
    if PROCESSED_FILES_FILE.exists():
        with open(PROCESSED_FILES_FILE, 'r', encoding='utf-8') as f:
            processed_files = set(json.load(f))

    return action_items, processed_files


def save_data(action_items: Dict[str, ActionItem], processed_files: Set[str]) -> None:
    DATA_DIR.mkdir(exist_ok=True)

    with open(ACTION_ITEMS_FILE, 'w', encoding='utf-8') as f:
        json.dump({k: v.to_dict() for k, v in action_items.items()}, f, ensure_ascii=False, indent=2)

    with open(PROCESSED_FILES_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(processed_files), f, ensure_ascii=False, indent=2)


def parse_meeting_note(file_path: Path) -> List[Dict[str, Any]]:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    
    action_items_section_found = False
    action_items_level = 0
    items = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        action_item_match = re.match(r'^(#{1,3})\s*行动项', line)
        if action_item_match:
            action_items_section_found = True
            action_items_level = len(action_item_match.group(1))
            i += 1
            continue
        
        if action_items_section_found:
            next_section_match = re.match(r'^(#{1,3})\s+', line)
            if next_section_match:
                current_level = len(next_section_match.group(1))
                if current_level <= action_items_level and '行动项' not in line:
                    action_items_section_found = False
                    i += 1
                    continue
            
            if re.match(r'^\d+\.', line):
                match = re.match(r'^(\d+\.\s*)?(.*)', line)
                if match:
                    description = match.group(2).strip()
                    if description and len(description) > 2:
                        item = {
                            "description": description,
                            "assignee": None,
                            "due_date": None,
                            "project": None,
                            "status": "待开始"
                        }

                        j = i + 1
                        while j < len(lines):
                            next_line = lines[j].strip()
                            if next_line.startswith('- '):
                                if '负责人:' in next_line:
                                    val = next_line.split('负责人:', 1)[1].strip()
                                    item["assignee"] = val if val else None
                                elif '截止日期:' in next_line:
                                    val = next_line.split('截止日期:', 1)[1].strip()
                                    item["due_date"] = val if val else None
                                elif '关联项目:' in next_line:
                                    val = next_line.split('关联项目:', 1)[1].strip()
                                    item["project"] = val if val else None
                                elif '当前状态:' in next_line:
                                    val = next_line.split('当前状态:', 1)[1].strip()
                                    item["status"] = val if val else "待开始"
                                j += 1
                            else:
                                break

                        items.append(item)
                        i = j - 1
        i += 1

    return items


def generate_item_id(description: str) -> str:
    normalized = re.sub(r'[^\w\u4e00-\u9fff]+', '', description.lower())
    return normalized[:50]


def find_duplicate(item: Dict[str, Any], existing_items: Dict[str, ActionItem]) -> Optional[str]:
    desc = item["description"]
    item_id = generate_item_id(desc)

    if item_id in existing_items:
        return item_id

    for existing_id, existing_item in existing_items.items():
        similarity = calculate_similarity(desc, existing_item.description)
        if similarity > 0.8:
            return existing_id

    return None


def calculate_similarity(s1: str, s2: str) -> float:
    s1_norm = re.sub(r'[^\w\u4e00-\u9fff]', '', s1.lower())
    s2_norm = re.sub(r'[^\w\u4e00-\u9fff]', '', s2.lower())

    if not s1_norm or not s2_norm:
        return 0.0

    if s1_norm == s2_norm:
        return 1.0

    if s1_norm in s2_norm or s2_norm in s1_norm:
        return 0.9

    set1 = set(s1_norm)
    set2 = set(s2_norm)
    intersection = len(set1 & set2)
    union = len(set1 | set2)

    return intersection / union if union > 0 else 0.0


def check_for_changes(new_item: Dict[str, Any], existing_item: ActionItem) -> List[str]:
    changes = []

    if new_item["assignee"] and new_item["assignee"] != existing_item.assignee:
        changes.append(f"负责人变化: {existing_item.assignee} -> {new_item['assignee']}")

    if new_item["due_date"] and new_item["due_date"] != existing_item.due_date:
        changes.append(f"截止日期变化: {existing_item.due_date} -> {new_item['due_date']}")

    if new_item["status"] and new_item["status"] != existing_item.status:
        changes.append(f"状态变化: {existing_item.status} -> {new_item['status']}")

    if new_item["project"] and new_item["project"] != existing_item.project:
        changes.append(f"项目变化: {existing_item.project} -> {new_item['project']}")

    return changes


def scan_directory(directory: str, interactive: bool = True) -> None:
    dir_path = Path(directory)
    if not dir_path.exists():
        print(f"错误: 目录不存在: {directory}")
        return

    action_items, processed_files = load_data()

    txt_files = sorted(dir_path.glob("*.txt"))
    if not txt_files:
        print("未找到 .txt 会议纪要文件")
        return

    print(f"开始扫描目录: {directory}")
    print(f"找到 {len(txt_files)} 个会议纪要文件\n")

    new_count = 0
    updated_count = 0
    skipped_count = 0
    blocked_count = 0

    for file_path in txt_files:
        file_key = str(file_path.resolve())

        if file_key in processed_files:
            print(f"跳过已处理文件: {file_path.name}")
            skipped_count += 1
            continue

        print(f"\n处理文件: {file_path.name}")
        parsed_items = parse_meeting_note(file_path)

        if not parsed_items:
            print(f"  - 未找到行动项")
            processed_files.add(file_key)
            continue

        print(f"  - 找到 {len(parsed_items)} 个行动项")

        for item in parsed_items:
            existing_id = find_duplicate(item, action_items)

            temp_item = ActionItem(
                id="temp",
                description=item["description"],
                assignee=item.get("assignee"),
                due_date=item.get("due_date"),
                project=item.get("project"),
                status=item.get("status", "待开始")
            )

            is_valid, issues = temp_item.validate()
            flags = []

            if not item.get("assignee"):
                flags.append("负责人缺失")
            if item.get("due_date") and not re.match(r'^\d{4}-\d{2}-\d{2}$', item.get("due_date", "")):
                flags.append("截止日期模糊")

            should_block = False
            if "负责人缺失" in flags and "截止日期模糊" in flags:
                should_block = True

            if should_block and interactive:
                print(f"\n⚠️  拦截记录 - 行动项: {item['description']}")
                print(f"   问题: {', '.join(issues)}")
                print(f"   此记录需要修正后才能继续处理")

                if should_block:
                    print("\n   选项:")
                    print("   1. 跳过此记录")
                    print("   2. 手动修正并继续")
                    print("   3. 标记为待处理，稍后修复")

                    choice = input("\n   请选择 (1-3): ").strip()

                    if choice == "1":
                        print(f"   → 已跳过此记录")
                        blocked_count += 1
                        continue
                    elif choice == "2":
                        print(f"\n   请输入修正信息 (直接回车保持原值):")
                        new_assignee = input(f"   负责人 [{item.get('assignee') or '空'}]: ").strip()
                        new_due_date = input(f"   截止日期 [{item.get('due_date') or '空'}]: ").strip()

                        if new_assignee:
                            item["assignee"] = new_assignee
                            if "负责人缺失" in flags:
                                flags.remove("负责人缺失")
                        if new_due_date:
                            item["due_date"] = new_due_date
                            if "截止日期模糊" in flags and re.match(r'^\d{4}-\d{2}-\d{2}$', new_due_date):
                                flags.remove("截止日期模糊")

                        print(f"   → 已修正记录")
                    elif choice == "3":
                        flags.append("待处理")
                        print(f"   → 已标记为待处理")
                    else:
                        print(f"   → 已跳过此记录")
                        blocked_count += 1
                        continue

            if existing_id:
                existing_item = action_items[existing_id]
                changes = check_for_changes(item, existing_item)

                if changes:
                    print(f"    ↻ 更新行动项: {item['description'][:50]}...")
                    print(f"      变化: {', '.join(changes)}")

                    existing_item.history.append({
                        "timestamp": datetime.now().isoformat(),
                        "source_file": file_path.name,
                        "changes": changes,
                        "old_assignee": existing_item.assignee,
                        "old_due_date": existing_item.due_date,
                        "old_status": existing_item.status
                    })

                    if item.get("assignee"):
                        existing_item.assignee = item["assignee"]
                    if item.get("due_date"):
                        existing_item.due_date = item["due_date"]
                    if item.get("project"):
                        existing_item.project = item["project"]
                    if item.get("status"):
                        existing_item.status = item["status"]

                    if file_path.name not in existing_item.source_files:
                        existing_item.source_files.append(file_path.name)

                    existing_item.flags = list(set(existing_item.flags + flags))

                    if "同一行动项多次变化" not in existing_item.flags:
                        existing_item.flags.append("同一行动项多次变化")

                    existing_item.updated_at = datetime.now().isoformat()
                    updated_count += 1
                else:
                    if file_path.name not in existing_item.source_files:
                        existing_item.source_files.append(file_path.name)
                    print(f"    ○ 跳过重复行动项: {item['description'][:50]}...")
            else:
                item_id = generate_item_id(item["description"])
                new_item = ActionItem(
                    id=item_id,
                    description=item["description"],
                    assignee=item.get("assignee"),
                    due_date=item.get("due_date"),
                    project=item.get("project"),
                    status=item.get("status", "待开始"),
                    source_files=[file_path.name],
                    flags=flags
                )
                action_items[item_id] = new_item
                print(f"    + 新增行动项: {item['description'][:50]}...")
                new_count += 1

        processed_files.add(file_key)

    save_data(action_items, processed_files)

    print(f"\n{'=' * 60}")
    print(f"扫描完成!")
    print(f"  - 新增行动项: {new_count}")
    print(f"  - 更新行动项: {updated_count}")
    print(f"  - 跳过重复/已处理: {skipped_count}")
    print(f"  - 拦截记录: {blocked_count}")
    print(f"{'=' * 60}")


def list_action_items(filter_status: str = None, show_overdue: bool = False) -> None:
    action_items, _ = load_data()

    if not action_items:
        print("暂无行动项数据")
        return

    filtered_items = list(action_items.values())

    if filter_status:
        filtered_items = [item for item in filtered_items if item.status == filter_status]

    if show_overdue:
        today = date.today()
        filtered_items = [item for item in filtered_items if item.is_overdue(today)]

    if not filtered_items:
        print("没有符合条件的行动项")
        return

    print(f"\n{'=' * 100}")
    print(f"{'行动项清单':^100}")
    print(f"{'=' * 100}")

    items_by_assignee = {}
    for item in filtered_items:
        assignee = item.assignee or "未指定"
        if assignee not in items_by_assignee:
            items_by_assignee[assignee] = []
        items_by_assignee[assignee].append(item)

    total_items = 0
    for assignee in sorted(items_by_assignee.keys()):
        items = items_by_assignee[assignee]
        print(f"\n{'─' * 100}")
        print(f"👤 负责人: {assignee}")
        print(f"{'─' * 100}")

        for item in sorted(items, key=lambda x: x.due_date or ""):
            status_icon = {
                "待开始": "⏳",
                "进行中": "🔄",
                "已完成": "✅",
                "延期": "⚠️",
                "已取消": "❌"
            }.get(item.status, "❓")

            overdue_icon = "🔥" if item.is_overdue() else ""
            flag_text = f" [{' | '.join(item.flags)}]" if item.flags else ""

            print(f"\n  {status_icon} {item.description}")
            print(f"     截止日期: {item.due_date or '未指定'} {overdue_icon}")
            print(f"     关联项目: {item.project or '未指定'}")
            print(f"     当前状态: {item.status}")
            print(f"     来源文件: {', '.join(item.source_files)}")
            if flag_text:
                print(f"     标记: {flag_text}")

        total_items += len(items)
        print(f"\n  {assignee} 共 {len(items)} 个行动项")

    print(f"\n{'=' * 100}")
    print(f"总计: {total_items} 个行动项")
    print(f"{'=' * 100}")


def update_status(item_id: str, new_status: str, new_assignee: str = None, new_due_date: str = None) -> None:
    action_items, _ = load_data()

    if item_id not in action_items:
        print(f"错误: 未找到行动项 ID: {item_id}")
        return

    item = action_items[item_id]

    old_assignee = item.assignee
    old_due_date = item.due_date
    old_status = item.status

    changes = []

    if new_status and new_status in VALID_STATUSES:
        item.status = new_status
        changes.append(f"状态变化: {old_status} -> {new_status}")

    if new_assignee:
        item.assignee = new_assignee
        changes.append(f"负责人变化: {old_assignee} -> {new_assignee}")

    if new_due_date:
        item.due_date = new_due_date
        changes.append(f"截止日期变化: {old_due_date} -> {new_due_date}")

    if changes:
        item.history.append({
            "timestamp": datetime.now().isoformat(),
            "source_file": "manual_update",
            "changes": changes,
            "old_assignee": old_assignee,
            "old_due_date": old_due_date,
            "old_status": old_status
        })
        item.updated_at = datetime.now().isoformat()

        save_data(action_items, set())
        print(f"✓ 已更新行动项: {item.description}")
        print(f"  变化: {', '.join(changes)}")
    else:
        print("没有进行任何更新")


def merge_duplicates() -> None:
    action_items, _ = load_data()

    if len(action_items) < 2:
        print("行动项数量不足，无需合并")
        return

    print("正在检测重复行动项...")

    merged_count = 0
    items_list = list(action_items.values())

    to_remove = set()

    for i in range(len(items_list)):
        if items_list[i].id in to_remove:
            continue

        for j in range(i + 1, len(items_list)):
            if items_list[j].id in to_remove:
                continue

            item1 = items_list[i]
            item2 = items_list[j]

            similarity = calculate_similarity(item1.description, item2.description)

            if similarity > 0.85:
                print(f"\n发现重复项:")
                print(f"  [1] {item1.description}")
                print(f"      - 负责人: {item1.assignee}")
                print(f"      - 截止日期: {item1.due_date}")
                print(f"      - 状态: {item1.status}")
                print(f"  [2] {item2.description}")
                print(f"      - 负责人: {item2.assignee}")
                print(f"      - 截止日期: {item2.due_date}")
                print(f"      - 状态: {item2.status}")
                print(f"  相似度: {similarity:.2f}")

                choice = input("\n  合并到 [1] 并删除 [2]? (y/n): ").strip().lower()

                if choice == 'y':
                    item1.source_files = list(set(item1.source_files + item2.source_files))
                    item1.history.extend(item2.history)
                    item1.flags = list(set(item1.flags + item2.flags))

                    if item2.assignee and not item1.assignee:
                        item1.assignee = item2.assignee
                    if item2.due_date and not item1.due_date:
                        item1.due_date = item2.due_date
                    if item2.project and not item1.project:
                        item1.project = item2.project

                    item1.history.append({
                        "timestamp": datetime.now().isoformat(),
                        "source_file": "merge",
                        "changes": [f"合并了行动项: {item2.description}"],
                        "merged_from_id": item2.id
                    })

                    item1.updated_at = datetime.now().isoformat()

                    to_remove.add(item2.id)
                    merged_count += 1
                    print(f"  ✓ 已合并")

    for item_id in to_remove:
        del action_items[item_id]

    if merged_count > 0:
        save_data(action_items, set())
        print(f"\n合并完成! 共合并了 {merged_count} 对重复行动项")
    else:
        print("没有发现需要合并的重复项")


def export_report(output_path: str = None) -> None:
    action_items, _ = load_data()

    if not action_items:
        print("暂无行动项数据可导出")
        return

    if output_path:
        output_file = Path(output_path)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = Path(__file__).parent / f"action_items_report_{timestamp}.md"

    today = date.today()
    items = list(action_items.values())

    total = len(items)
    completed = sum(1 for item in items if item.status == "已完成")
    in_progress = sum(1 for item in items if item.status == "进行中")
    pending = sum(1 for item in items if item.status == "待开始")
    overdue = sum(1 for item in items if item.is_overdue(today))
    missing_assignee = sum(1 for item in items if not item.assignee)
    flagged = sum(1 for item in items if item.flags)

    report = f"""# 行动项追踪报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 概览

| 指标 | 数量 |
|------|------|
| 总行动项 | {total} |
| 已完成 | {completed} |
| 进行中 | {in_progress} |
| 待开始 | {pending} |
| 逾期 | {overdue} |
| 缺负责人 | {missing_assignee} |
| 有标记 | {flagged} |

## 负责人分配

"""

    items_by_assignee = {}
    for item in items:
        assignee = item.assignee or "未指定"
        if assignee not in items_by_assignee:
            items_by_assignee[assignee] = []
        items_by_assignee[assignee].append(item)

    for assignee in sorted(items_by_assignee.keys()):
        assignee_items = items_by_assignee[assignee]
        report += f"\n### 👤 {assignee} ({len(assignee_items)} 项)\n\n"

        for item in sorted(assignee_items, key=lambda x: x.due_date or ""):
            status_emoji = {"已完成": "✅", "进行中": "🔄", "待开始": "⏳", "延期": "⚠️", "已取消": "❌"}.get(item.status, "❓")
            overdue = "🔥 逾期" if item.is_overdue(today) else ""
            flags = f" ⚑ {' | '.join(item.flags)}" if item.flags else ""

            report += f"- {status_emoji} **{item.description}**\n"
            report += f"  - 截止日期: {item.due_date or '未指定'} {overdue}\n"
            report += f"  - 关联项目: {item.project or '未指定'}\n"
            report += f"  - 状态: {item.status}{flags}\n"
            report += f"  - 来源: {', '.join(item.source_files)}\n"
            if item.history:
                report += f"  - 变更历史: {len(item.history)} 次\n"

    report += "\n## 按项目分组\n\n"

    items_by_project = {}
    for item in items:
        project = item.project or "未指定"
        if project not in items_by_project:
            items_by_project[project] = []
        items_by_project[project].append(item)

    for project in sorted(items_by_project.keys()):
        project_items = items_by_project[project]
        report += f"\n### 📁 {project} ({len(project_items)} 项)\n\n"

        for item in sorted(project_items, key=lambda x: x.due_date or ""):
            assignee = item.assignee or "未指定"
            status_emoji = {"已完成": "✅", "进行中": "🔄", "待开始": "⏳", "延期": "⚠️", "已取消": "❌"}.get(item.status, "❓")
            report += f"- {status_emoji} **{item.description}** - {assignee}\n"

    report += "\n## 风险提醒\n\n"

    risk_items = [item for item in items if item.is_overdue(today) or "负责人缺失" in item.flags or "截止日期模糊" in item.flags]

    if risk_items:
        for item in risk_items:
            assignee = item.assignee or "未指定"
            risks = []
            if item.is_overdue(today):
                risks.append("逾期")
            if "负责人缺失" in item.flags:
                risks.append("缺负责人")
            if "截止日期模糊" in item.flags:
                risks.append("截止日期模糊")

            report += f"- ⚠️ **{item.description}**\n"
            report += f"  - 负责人: {assignee}\n"
            report += f"  - 风险: {', '.join(risks)}\n"
    else:
        report += "暂无风险项\n"

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"✓ 报告已导出到: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="会议速记行动项 CLI - 管理会议纪要中的行动项",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python action_items_cli.py scan ./meeting_notes
  python action_items_cli.py list
  python action_items_cli.py list --overdue
  python action_items_cli.py update <item_id> --status 已完成
  python action_items_cli.py merge
  python action_items_cli.py export
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    scan_parser = subparsers.add_parser("scan", help="扫描目录中的会议纪要")
    scan_parser.add_argument("directory", help="包含会议纪要的目录路径")
    scan_parser.add_argument("--non-interactive", action="store_true", help="非交互模式（跳过拦截记录）")

    list_parser = subparsers.add_parser("list", help="列出所有行动项")
    list_parser.add_argument("--status", help="按状态过滤")
    list_parser.add_argument("--overdue", action="store_true", help="只显示逾期项")

    update_parser = subparsers.add_parser("update", help="更新行动项状态")
    update_parser.add_argument("item_id", help="行动项ID")
    update_parser.add_argument("--status", required=True, choices=VALID_STATUSES, help="新状态")
    update_parser.add_argument("--assignee", help="新负责人")
    update_parser.add_argument("--due-date", help="新截止日期 (YYYY-MM-DD)")

    subparsers.add_parser("merge", help="合并重复行动项")

    export_parser = subparsers.add_parser("export", help="导出追踪报告")
    export_parser.add_argument("--output", help="输出文件路径")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "scan":
        scan_directory(args.directory, interactive=not args.non_interactive)
    elif args.command == "list":
        list_action_items(filter_status=args.status, show_overdue=args.overdue)
    elif args.command == "update":
        update_status(args.item_id, args.status, args.assignee, args.due_date)
    elif args.command == "merge":
        merge_duplicates()
    elif args.command == "export":
        export_report(args.output)


if __name__ == "__main__":
    main()
