#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
review命令 - 人工复核问题并添加备注
"""

from pathlib import Path
from datetime import datetime
from typing import Optional, List

from core.storage import DataStore
from core.models import Issue, IssueSeverity


def review_command(work_dir: Path, issue_id: str, remark: str,
                   confirmed_by: Optional[str] = None,
                   unconfirm: bool = False):
    store = DataStore(work_dir)
    
    issue = store.get_issue(issue_id)
    
    if not issue:
        raise ValueError(f"未找到问题ID: {issue_id}")
    
    if unconfirm:
        issue.confirmed = False
        issue.confirm_remark = None
        issue.confirmed_at = None
        issue.confirmed_by = None
        
        print(f"已取消确认问题: {issue_id}")
        print(f"  问题类型: {issue.issue_type.value}")
        print(f"  原始描述: {issue.message}")
        print()
    else:
        issue.confirmed = True
        issue.confirm_remark = remark
        issue.confirmed_at = datetime.now()
        issue.confirmed_by = confirmed_by or "操作员"
        
        print(f"已确认问题: {issue_id}")
        print(f"  问题类型: {issue.issue_type.value}")
        print(f"  严重程度: {issue.severity.value}")
        print(f"  原始描述: {issue.message}")
        print(f"  确认备注: {remark}")
        print(f"  确认人员: {issue.confirmed_by}")
        print(f"  确认时间: {issue.confirmed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print()
    
    store.save_issue(issue)
    
    print("提示:")
    print(f"  - 运行 'smt-workshop check' 可查看所有问题状态")
    print(f"  - 运行 'smt-workshop export --all' 导出包含确认备注的报告")


def list_unconfirmed_command(work_dir: Path, verbose: bool = False):
    store = DataStore(work_dir)
    
    issues = store.get_unconfirmed_issues()
    
    if not issues:
        print("没有未确认的问题。")
        return
    
    print(f"共有 {len(issues)} 个未确认的问题:")
    print("=" * 70)
    print()
    
    for i, issue in enumerate(issues, 1):
        print(f"[{i}] {issue.issue_type.value} ({issue.severity.value})")
        print(f"    问题ID: {issue.issue_id}")
        print(f"    描述: {issue.message}")
        
        if issue.board_number:
            print(f"    板号: {issue.board_number}")
        if issue.reference:
            print(f"    位号: {issue.reference}")
        
        if verbose:
            print(f"    详细信息: {issue.details}")
        
        print()
    
    print("=" * 70)
    print(f"\n提示: 使用 'smt-workshop review <问题ID> -r \"备注内容\"' 来确认问题")
