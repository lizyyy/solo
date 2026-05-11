from typing import List, Dict, Any
from tabulate import tabulate
from datetime import datetime
from .models import (
    MigrationPlan, MigrationResult, MigrationStatus,
    MigrationItem
)
from .engine import MigrationEngine


class ReportGenerator:
    def __init__(self, engine: MigrationEngine):
        self.engine = engine

    def generate_plan_report(self, plan: MigrationPlan) -> str:
        lines = []
        lines.append('=' * 80)
        lines.append(f'迁移计划报告')
        lines.append('=' * 80)
        lines.append(f'计划ID: {plan.plan_id}')
        lines.append(f'生成时间: {plan.created_at.strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append('')

        lines.append(f'【统计概览】')
        lines.append(f'  总用户数: {plan.total_users}')
        lines.append(f'  待迁移: {len(plan.pending_items)}')
        lines.append(f'  需人工确认: {len(plan.needs_review_items)}')
        lines.append(f'  校验错误: {len(plan.validation_errors)}')
        lines.append('')

        if plan.validation_errors:
            lines.append(f'【校验错误】')
            for err in plan.validation_errors:
                lines.append(f'  - {err}')
            lines.append('')

        if plan.needs_review_items:
            lines.append(f'【需人工确认名单】')
            review_table = []
            for item in plan.needs_review_items:
                review_table.append([
                    item.old_user_id,
                    item.new_user_id,
                    item.phone or '-',
                    item.points_to_migrate,
                    len(item.coupons),
                    item.error_reason or '待确认',
                ])
            lines.append(tabulate(
                review_table,
                headers=['旧用户ID', '新用户ID', '手机号', '积分', '优惠券数', '原因'],
                tablefmt='simple'
            ))
            lines.append('')

        if plan.pending_items:
            lines.append(f'【待迁移用户预览（前10条）】')
            preview_table = []
            for item in plan.pending_items[:10]:
                preview_table.append([
                    item.old_user_id,
                    item.new_user_id,
                    item.phone or '-',
                    item.points_to_migrate,
                    len(item.coupons),
                    '; '.join(item.warnings) if item.warnings else '-',
                ])
            lines.append(tabulate(
                preview_table,
                headers=['旧用户ID', '新用户ID', '手机号', '积分', '优惠券数', '警告'],
                tablefmt='simple'
            ))
            if len(plan.pending_items) > 10:
                lines.append(f'... 还有 {len(plan.pending_items) - 10} 条')
            lines.append('')

        return '\n'.join(lines)

    def generate_result_report(self, result: MigrationResult, plan: MigrationPlan = None) -> str:
        lines = []
        lines.append('=' * 80)
        lines.append(f'迁移执行报告')
        lines.append('=' * 80)
        lines.append(f'计划ID: {result.plan_id}')
        lines.append(f'执行时间: {result.executed_at.strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'执行模式: {"模拟执行" if result.is_simulation else "正式执行"}')
        lines.append('')

        lines.append(f'【执行统计】')
        lines.append(f'  总处理数: {result.total_items}')
        lines.append(f'  成功: {result.success_count}')
        lines.append(f'  失败: {result.failed_count}')
        lines.append(f'  跳过: {result.skipped_count}')
        if result.total_items > 0:
            success_rate = (result.success_count / result.total_items) * 100
            lines.append(f'  成功率: {success_rate:.1f}%')
        lines.append('')

        if result.success_items:
            lines.append(f'【迁移前后权益对比（成功项）】')
            comparison_table = []
            for item in result.success_items:
                comp = self.engine.get_equity_comparison(item)
                comparison_table.append([
                    comp.get('old_user_id', '-'),
                    comp.get('new_user_id', '-'),
                    comp.get('old_points', 0),
                    comp.get('migrated_points', 0),
                    comp.get('old_coupons_valid', 0),
                    comp.get('migrated_coupons', 0),
                    comp.get('coupons_skipped', 0),
                ])
            lines.append(tabulate(
                comparison_table,
                headers=['旧用户ID', '新用户ID', '旧积分', '迁移积分', '旧有效券', '迁移券', '跳过券'],
                tablefmt='simple'
            ))

            total_old_points = sum(c.get('old_points', 0) for c in [self.engine.get_equity_comparison(i) for i in result.success_items])
            total_migrated_points = sum(c.get('migrated_points', 0) for c in [self.engine.get_equity_comparison(i) for i in result.success_items])
            lines.append(f'\n  积分迁移总量: {total_migrated_points} / {total_old_points}')
            lines.append('')

        if result.failed_items:
            lines.append(f'【失败项清单及原因】')
            failed_table = []
            for item in result.failed_items:
                failed_table.append([
                    item.old_user_id,
                    item.new_user_id,
                    item.phone or '-',
                    item.error_reason or '未知错误',
                    item.retries,
                ])
            lines.append(tabulate(
                failed_table,
                headers=['旧用户ID', '新用户ID', '手机号', '失败原因', '重试次数'],
                tablefmt='simple'
            ))
            lines.append('')

        if result.skipped_items:
            lines.append(f'【跳过项清单】')
            skipped_table = []
            for item in result.skipped_items:
                skipped_table.append([
                    item.old_user_id,
                    item.new_user_id,
                    item.phone or '-',
                    item.error_reason or '已迁移',
                ])
            lines.append(tabulate(
                skipped_table,
                headers=['旧用户ID', '新用户ID', '手机号', '跳过原因'],
                tablefmt='simple'
            ))
            lines.append('')

        if plan and plan.needs_review_items:
            lines.append(f'【待人工确认名单（未执行）】')
            review_table = []
            for item in plan.needs_review_items:
                review_table.append([
                    item.old_user_id,
                    item.new_user_id,
                    item.phone or '-',
                    item.points_to_migrate,
                    len(item.coupons),
                    item.error_reason or '待确认',
                ])
            lines.append(tabulate(
                review_table,
                headers=['旧用户ID', '新用户ID', '手机号', '积分', '优惠券数', '原因'],
                tablefmt='simple'
            ))
            lines.append('')

        lines.append(f'【建议】')
        if result.failed_count > 0:
            lines.append('  - 请查看失败项清单，修正数据后使用 retry 命令重试')
        if plan and plan.needs_review_items:
            lines.append(f'  - 有 {len(plan.needs_review_items)} 条记录需要人工确认后再处理')
        if result.success_count == result.total_items:
            lines.append('  - 全部迁移成功！')
        lines.append('')

        return '\n'.join(lines)

    def generate_equity_summary(self, result: MigrationResult) -> Dict[str, Any]:
        all_items = result.success_items + result.failed_items + result.skipped_items
        comparisons = [self.engine.get_equity_comparison(i) for i in all_items]

        total_old_points = sum(c.get('old_points', 0) for c in comparisons)
        total_migrated_points = sum(c.get('migrated_points', 0) for c in comparisons)
        total_old_valid_coupons = sum(c.get('old_coupons_valid', 0) for c in comparisons)
        total_migrated_coupons = sum(c.get('migrated_coupons', 0) for c in comparisons)

        return {
            'total_users': len(all_items),
            'success_users': result.success_count,
            'failed_users': result.failed_count,
            'skipped_users': result.skipped_count,
            'old_points_total': total_old_points,
            'migrated_points_total': total_migrated_points,
            'points_diff': total_old_points - total_migrated_points,
            'old_valid_coupons_total': total_old_valid_coupons,
            'migrated_coupons_total': total_migrated_coupons,
            'coupons_skipped_total': sum(c.get('coupons_skipped', 0) for c in comparisons),
        }
