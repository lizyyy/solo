#!/usr/bin/env python3
"""
数据权限矩阵CLI - 主入口
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from models.data_models import User, Role, Department, TemporaryAuthorization
from utils.helpers import (
    load_json_file, parse_user, parse_role, parse_department, 
    parse_temporary_auth, format_date_for_report
)
from engine.permission_engine import PermissionEngine


class PermissionCLI:
    """权限矩阵CLI命令处理类"""
    
    def __init__(self, data_dir: str = "sample_data"):
        self.data_dir = data_dir
        self.users: Dict[str, User] = {}
        self.roles: Dict[str, Role] = {}
        self.departments: Dict[str, Department] = {}
        self.temp_auths: List[TemporaryAuthorization] = []
        self.engine: Optional[PermissionEngine] = None
    
    def load_data(self) -> None:
        """加载所有配置数据"""
        base_path = Path(self.data_dir)
        
        users_data = load_json_file(str(base_path / "users.json"))
        self.users = {u['user_id']: parse_user(u) for u in users_data}
        
        roles_data = load_json_file(str(base_path / "roles.json"))
        self.roles = {r['role_id']: parse_role(r) for r in roles_data}
        
        depts_data = load_json_file(str(base_path / "departments.json"))
        self.departments = {d['dept_id']: parse_department(d) for d in depts_data}
        
        auths_data = load_json_file(str(base_path / "temporary_authorizations.json"))
        self.temp_auths = [parse_temporary_auth(a) for a in auths_data]
        
        self.engine = PermissionEngine(
            self.users, self.roles, self.departments, self.temp_auths
        )
    
    def cmd_explain(self, user_id: str, object_type: str, field: Optional[str] = None) -> None:
        """解释权限来源"""
        if not self.engine:
            print("错误: 数据未加载")
            return
        
        if user_id not in self.users:
            print(f"错误: 未找到用户 {user_id}")
            return
        
        user = self.users[user_id]
        print(f"\n{'='*60}")
        print(f"权限解释报告 - 用户: {user.full_name} ({user.user_id})")
        print(f"{'='*60}")
        print(f"用户信息:")
        print(f"  用户名: {user.username}")
        print(f"  邮箱: {user.email}")
        print(f"  部门: {self.departments.get(user.department_id, {}).dept_name if user.department_id in self.departments else '未知'}")
        print(f"  角色: {', '.join([self.roles[r].role_name for r in user.role_ids if r in self.roles])}")
        print(f"  状态: {'在职' if user.is_active else '已离职'}")
        print(f"  类型: {'正式员工' if user.is_employee else '外包人员'}")
        print()
        
        summary = self.engine.calculate_user_permissions(user_id, object_type)
        if not summary:
            print(f"未找到用户对 {object_type} 的权限配置")
            return
        
        print(f"数据对象: {object_type}")
        print(f"风险等级: {summary.risk_level.upper()}")
        if summary.risk_reasons:
            print(f"风险原因: {', '.join(summary.risk_reasons)}")
        print()
        
        if object_type in summary.effective_permissions:
            perms = summary.effective_permissions[object_type]
            print(f"字段权限:")
            for field_name, ep in perms.items():
                if field and field != field_name:
                    continue
                print(f"\n  字段: {field_name}")
                print(f"    读权限: {'✓ 允许' if ep.can_read else '✗ 禁止'}")
                print(f"    写权限: {'✓ 允许' if ep.can_write else '✗ 禁止'}")
                print(f"    权限冲突: {'是' if ep.has_conflict else '否'}")
                print(f"    有效权限类型: {ep.effective_permission_type.value}")
                print(f"    权限来源:")
                for src in ep.sources:
                    source_desc = f"      - {src['source_type']}: {src['source_name']}"
                    if src['source_type'] == 'temporary':
                        if 'auth_end' in src and src['auth_end']:
                            source_desc += f" (有效期至: {format_date_for_report(src['auth_end'])})"
                    print(source_desc)
                if ep.highest_priority_source:
                    hp = ep.highest_priority_source
                    print(f"    最高优先级来源: {hp['source_name']}")
        
        if object_type in summary.effective_data_scopes:
            scope = summary.effective_data_scopes[object_type]
            print(f"\n数据范围:")
            print(f"  范围类型: {scope.scope_type.value}")
            if scope.department_ids:
                dept_names = [self.departments.get(d, {}).dept_name if d in self.departments else d for d in scope.department_ids]
                print(f"  部门范围: {', '.join(dept_names)}")
            if scope.user_ids:
                print(f"  用户范围: {', '.join(scope.user_ids)}")
            if scope.custom_filter:
                print(f"  自定义过滤器: {scope.custom_filter}")
            print(f"  范围来源:")
            for src in scope.sources:
                print(f"      - {src['source_type']}: {src['source_name']}")
        
        print(f"\n{'='*60}\n")
    
    def cmd_check(self, user_id: str, object_type: str, field: str, operation: str = "read") -> None:
        """检查特定权限"""
        if not self.engine:
            print("错误: 数据未加载")
            return
        
        can_access, explanation = self.engine.check_field_permission(
            user_id, object_type, field, operation
        )
        
        user = self.users.get(user_id)
        user_name = user.full_name if user else user_id
        
        print(f"\n权限检查结果:")
        print(f"  用户: {user_name} ({user_id})")
        print(f"  数据对象: {object_type}")
        print(f"  字段: {field}")
        print(f"  操作: {operation}")
        print(f"  结果: {'✓ 有权限' if can_access else '✗ 无权限'}")
        
        if explanation:
            print(f"\n详细信息:")
            print(f"  有效权限类型: {explanation['effective_permission_type']}")
            print(f"  是否存在冲突: {'是' if explanation['has_conflict'] else '否'}")
            
            if explanation['highest_priority_source']:
                hp = explanation['highest_priority_source']
                print(f"  决定权限的来源: {hp['source_name']} ({hp['source_type']})")
            
            print(f"\n所有权限来源:")
            for src in explanation['sources']:
                perm = src['permission']
                status = "禁止" if perm.permission_type.value == 'deny' else "允许"
                source_desc = f"  - {src['source_name']}: {status}"
                if src['source_type'] == 'temporary' and 'auth_end' in src and src['auth_end']:
                    source_desc += f" (有效期至: {format_date_for_report(src['auth_end'])})"
                print(source_desc)
        
        print()
    
    def cmd_diff(self, user1_id: str, user2_id: str, object_type: str) -> None:
        """比较两个用户的权限差异"""
        if not self.engine:
            print("错误: 数据未加载")
            return
        
        summary1 = self.engine.calculate_user_permissions(user1_id, object_type)
        summary2 = self.engine.calculate_user_permissions(user2_id, object_type)
        
        if not summary1 or not summary2:
            print("错误: 无法获取用户权限信息")
            return
        
        user1 = self.users.get(user1_id)
        user2 = self.users.get(user2_id)
        
        print(f"\n{'='*60}")
        print(f"权限差异比较")
        print(f"{'='*60}")
        print(f"用户1: {user1.full_name if user1 else user1_id}")
        print(f"用户2: {user2.full_name if user2 else user2_id}")
        print(f"数据对象: {object_type}")
        print()
        
        perms1 = summary1.effective_permissions.get(object_type, {})
        perms2 = summary2.effective_permissions.get(object_type, {})
        
        all_fields = set(perms1.keys()) | set(perms2.keys())
        
        print("字段权限差异:")
        print(f"{'字段':<20} {'用户1':<15} {'用户2':<15} {'差异'}")
        print("-" * 60)
        
        for field in sorted(all_fields):
            ep1 = perms1.get(field)
            ep2 = perms2.get(field)
            
            p1_read = ep1.can_read if ep1 else False
            p1_write = ep1.can_write if ep1 else False
            p2_read = ep2.can_read if ep2 else False
            p2_write = ep2.can_write if ep2 else False
            
            perm1_str = f"R:{'Y' if p1_read else 'N'} W:{'Y' if p1_write else 'N'}"
            perm2_str = f"R:{'Y' if p2_read else 'N'} W:{'Y' if p2_write else 'N'}"
            
            has_diff = (p1_read != p2_read) or (p1_write != p2_write)
            diff_str = "是" if has_diff else "否"
            
            print(f"{field:<20} {perm1_str:<15} {perm2_str:<15} {diff_str}")
        
        print()
        
        scope1 = summary1.effective_data_scopes.get(object_type)
        scope2 = summary2.effective_data_scopes.get(object_type)
        
        print("数据范围差异:")
        print(f"  用户1范围: {scope1.scope_type.value if scope1 else '无'}")
        print(f"  用户2范围: {scope2.scope_type.value if scope2 else '无'}")
        
        if scope1 and scope2:
            depts1 = set(scope1.department_ids)
            depts2 = set(scope2.department_ids)
            if depts1 != depts2:
                print(f"\n  部门范围差异:")
                only_1 = depts1 - depts2
                only_2 = depts2 - depts1
                if only_1:
                    print(f"    仅用户1可访问: {', '.join(only_1)}")
                if only_2:
                    print(f"    仅用户2可访问: {', '.join(only_2)}")
        
        print(f"\n{'='*60}\n")
    
    def cmd_expire(self, check_time_str: Optional[str] = None) -> None:
        """检查过期的临时授权"""
        if not self.engine:
            print("错误: 数据未加载")
            return
        
        check_time = datetime.fromisoformat(check_time_str) if check_time_str else datetime.now()
        expired = self.engine.get_expired_authorizations(check_time)
        
        print(f"\n{'='*60}")
        print(f"过期临时授权检查")
        print(f"{'='*60}")
        print(f"检查时间: {format_date_for_report(check_time)}")
        print()
        
        if not expired:
            print("✓ 无过期的临时授权\n")
            return
        
        print(f"发现 {len(expired)} 个过期临时授权:")
        print()
        print(f"{'授权ID':<10} {'用户':<15} {'数据对象':<15} {'过期时间':<20}")
        print("-" * 60)
        
        for auth in expired:
            print(f"{auth['auth_id']:<10} {auth['user_name']:<15} {auth['object_type']:<15} {format_date_for_report(auth['end_time']):<20}")
            print(f"  原因: {auth['reason']}")
            print(f"  授权人: {auth['granted_by']}")
            print()
        
        print("建议动作:")
        print("  1. 清理过期的临时授权记录")
        print("  2. 确认是否需要续期或重新授权")
        print("  3. 检查是否存在权限泄漏风险")
        print(f"\n{'='*60}\n")
    
    def cmd_report(self) -> None:
        """生成内控报告"""
        if not self.engine:
            print("错误: 数据未加载")
            return
        
        object_types = self.engine.get_all_object_types()
        all_summaries = []
        
        for user_id, user in self.users.items():
            user_obj_types = set()
            for obj_type in object_types:
                summary = self.engine.calculate_user_permissions(user_id, obj_type)
                if summary and (summary.risk_level != "low" or summary.effective_permissions):
                    user_obj_types.add(obj_type)
            if user_obj_types:
                all_summaries.append((user_id, user, user_obj_types))
        
        print(f"\n{'='*80}")
        print(f"数据权限内控分析报告")
        print(f"{'='*80}")
        print(f"报告生成时间: {format_date_for_report(datetime.now())}")
        print(f"总用户数: {len(self.users)}")
        print(f"总角色数: {len(self.roles)}")
        print(f"临时授权数: {len(self.temp_auths)}")
        print()
        
        high_risk_users = []
        expired_auths = self.engine.get_expired_authorizations()
        conflict_users = []
        inactive_with_perms = []
        duplicate_auths = []
        
        for user_id, user, obj_types in all_summaries:
            has_high_risk = False
            has_conflict = False
            
            for obj_type in obj_types:
                summary = self.engine.calculate_user_permissions(user_id, obj_type)
                if summary:
                    if summary.risk_level == "high":
                        has_high_risk = True
                    if summary.risk_level == "medium":
                        for reason in summary.risk_reasons:
                            if "冲突" in reason:
                                has_conflict = True
            
            if has_high_risk:
                high_risk_users.append((user, obj_types))
            if has_conflict:
                conflict_users.append((user, obj_types))
            if not user.is_active:
                inactive_with_perms.append((user, obj_types))
        
        auth_dict = {}
        for auth in self.temp_auths:
            key = (auth.user_id, auth.object_type)
            if key in auth_dict:
                auth_dict[key].append(auth)
            else:
                auth_dict[key] = [auth]
        
        for key, auths in auth_dict.items():
            if len(auths) > 1:
                user = self.users.get(key[0])
                duplicate_auths.append({
                    "user": user,
                    "object_type": key[1],
                    "count": len(auths),
                    "auths": auths
                })
        
        print(f"\n{'='*80}")
        print(f"一、高风险用户列表")
        print(f"{'='*80}")
        
        if high_risk_users:
            print(f"{'用户ID':<10} {'姓名':<15} {'风险原因':<40} {'建议动作'}")
            print("-" * 80)
            for user, obj_types in high_risk_users:
                reasons = []
                for obj_type in obj_types:
                    summary = self.engine.calculate_user_permissions(user.user_id, obj_type)
                    if summary:
                        reasons.extend(summary.risk_reasons)
                unique_reasons = list(dict.fromkeys(reasons))
                reason_str = "; ".join(unique_reasons)
                
                actions = []
                if not user.is_active:
                    actions.append("立即清理离职用户权限")
                if "冲突" in reason_str:
                    actions.append("解决权限冲突配置")
                
                print(f"{user.user_id:<10} {user.full_name:<15} {reason_str:<40} {'; '.join(actions)}")
        else:
            print("✓ 无高风险用户")
        
        print(f"\n{'='*80}")
        print(f"二、过期临时授权")
        print(f"{'='*80}")
        
        if expired_auths:
            print(f"{'授权ID':<10} {'用户':<15} {'数据对象':<15} {'过期时间':<20} {'建议动作'}")
            print("-" * 80)
            for auth in expired_auths:
                print(f"{auth['auth_id']:<10} {auth['user_name']:<15} {auth['object_type']:<15} {format_date_for_report(auth['end_time']):<20} 清理过期授权")
        else:
            print("✓ 无过期临时授权")
        
        print(f"\n{'='*80}")
        print(f"三、权限冲突用户")
        print(f"{'='*80}")
        
        if conflict_users:
            print(f"{'用户ID':<10} {'姓名':<15} {'涉及对象':<20} {'建议动作'}")
            print("-" * 80)
            for user, obj_types in conflict_users:
                print(f"{user.user_id:<10} {user.full_name:<15} {', '.join(obj_types):<20} 复核权限配置，明确优先级")
        else:
            print("✓ 无权限冲突用户")
        
        print(f"\n{'='*80}")
        print(f"四、重复导入的临时授权")
        print(f"{'='*80}")
        
        if duplicate_auths:
            print(f"{'用户':<15} {'数据对象':<15} {'重复数量':<10} {'建议动作'}")
            print("-" * 80)
            for dup in duplicate_auths:
                user_name = dup['user'].full_name if dup['user'] else 'Unknown'
                print(f"{user_name:<15} {dup['object_type']:<15} {dup['count']:<10} 去重并保留最新授权")
        else:
            print("✓ 无重复导入的临时授权")
        
        print(f"\n{'='*80}")
        print(f"五、内控复核建议")
        print(f"{'='*80}")
        
        suggestions = []
        if high_risk_users:
            suggestions.append(f"1. 立即处理 {len(high_risk_users)} 个高风险用户的权限问题")
        if expired_auths:
            suggestions.append(f"2. 清理 {len(expired_auths)} 个过期临时授权")
        if conflict_users:
            suggestions.append(f"3. 复核 {len(conflict_users)} 个存在权限冲突的用户配置")
        if duplicate_auths:
            suggestions.append(f"4. 去重 {len(duplicate_auths)} 组重复的临时授权")
        
        if suggestions:
            for s in suggestions:
                print(s)
        else:
            print("✓ 所有权限配置检查通过，无需要立即处理的问题")
        
        print(f"\n{'='*80}")
        print(f"报告结束")
        print(f"{'='*80}\n")
    
    def run(self) -> None:
        """运行CLI"""
        parser = argparse.ArgumentParser(
            description='数据权限矩阵CLI - 计算和分析用户有效权限',
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog='''
示例用法:
  python main.py explain --user U002 --object customer
  python main.py check --user U002 --object customer --field phone --operation read
  python main.py diff --user1 U001 --user2 U002 --object customer
  python main.py expire
  python main.py report
            '''
        )
        
        parser.add_argument(
            '--data-dir', 
            default='sample_data',
            help='数据目录路径 (默认: sample_data)'
        )
        
        subparsers = parser.add_subparsers(dest='command', help='可用命令')
        
        explain_parser = subparsers.add_parser('explain', help='解释用户权限来源')
        explain_parser.add_argument('--user', required=True, help='用户ID')
        explain_parser.add_argument('--object', required=True, help='数据对象类型')
        explain_parser.add_argument('--field', help='特定字段名(可选)')
        
        check_parser = subparsers.add_parser('check', help='检查特定权限')
        check_parser.add_argument('--user', required=True, help='用户ID')
        check_parser.add_argument('--object', required=True, help='数据对象类型')
        check_parser.add_argument('--field', required=True, help='字段名')
        check_parser.add_argument('--operation', default='read', choices=['read', 'write'], help='操作类型 (默认: read)')
        
        diff_parser = subparsers.add_parser('diff', help='比较两个用户的权限差异')
        diff_parser.add_argument('--user1', required=True, help='用户1 ID')
        diff_parser.add_argument('--user2', required=True, help='用户2 ID')
        diff_parser.add_argument('--object', required=True, help='数据对象类型')
        
        expire_parser = subparsers.add_parser('expire', help='检查过期临时授权')
        expire_parser.add_argument('--time', help='指定检查时间 (ISO格式，如: 2026-05-20T00:00:00)')
        
        subparsers.add_parser('report', help='生成内控报告')
        
        args = parser.parse_args()
        
        self.data_dir = args.data_dir
        self.load_data()
        
        if args.command == 'explain':
            self.cmd_explain(args.user, args.object, args.field)
        elif args.command == 'check':
            self.cmd_check(args.user, args.object, args.field, args.operation)
        elif args.command == 'diff':
            self.cmd_diff(args.user1, args.user2, args.object)
        elif args.command == 'expire':
            self.cmd_expire(args.time)
        elif args.command == 'report':
            self.cmd_report()
        else:
            parser.print_help()


if __name__ == '__main__':
    cli = PermissionCLI()
    cli.run()
