from datetime import datetime
from typing import List, Tuple, Dict, Set, Optional
import uuid
from .models import (
    SystemState, MigrationPlan, MigrationItem, MigrationResult,
    MigrationStatus, CouponStatus, OldUser, UserMapping
)


class MigrationEngine:
    def __init__(self, state: SystemState, simulate: bool = True):
        self.state = state
        self.simulate = simulate
        self.now = datetime.now()

    def generate_plan(self) -> MigrationPlan:
        plan = MigrationPlan(
            plan_id=f'PL_{self.now.strftime("%Y%m%d")}_{uuid.uuid4().hex[:8]}',
            created_at=self.now,
        )

        for old_user_id, old_user in self.state.old_users.items():
            if old_user_id in self.state.user_mappings:
                item = self._create_migration_item(old_user)
                self._validate_item(item, plan.validation_errors)

                if item.status == MigrationStatus.NEEDS_REVIEW:
                    plan.needs_review_items.append(item)
                else:
                    plan.pending_items.append(item)
            else:
                plan.validation_errors.append(
                    f'旧用户 {old_user_id} 没有对应的新用户映射'
                )

        plan.total_users = len(plan.pending_items) + len(plan.needs_review_items)
        return plan

    def _create_migration_item(self, old_user: OldUser) -> MigrationItem:
        mapping = self.state.user_mappings[old_user.old_user_id]
        points_records = self.state.point_records.get(old_user.old_user_id, [])
        coupons = self.state.coupons.get(old_user.old_user_id, [])

        active_coupons = [
            c for c in coupons
            if c.status == CouponStatus.ACTIVE
        ]

        item = MigrationItem(
            old_user_id=old_user.old_user_id,
            new_user_id=mapping.new_user_id,
            phone=mapping.phone or old_user.phone,
            points_to_migrate=old_user.points_balance,
            points_records=points_records,
            coupons=active_coupons,
            status=MigrationStatus.PENDING,
        )
        return item

    def _validate_item(self, item: MigrationItem, errors: List[str]):
        item.warnings = []

        if item.phone:
            if item.phone in self.state.phone_bindings:
                bindings = self.state.phone_bindings[item.phone]
                if len(bindings) > 1:
                    user_ids = [b.old_user_id for b in bindings]
                    item.status = MigrationStatus.NEEDS_REVIEW
                    item.error_reason = f'手机号 {item.phone} 被多个用户占用: {user_ids}'
                    item.warnings.append(item.error_reason)
                    errors.append(item.error_reason)

        if not item.points_records and item.points_to_migrate > 0:
            item.warnings.append(
                f'积分余额 {item.points_to_migrate} 但没有积分流水记录'
            )
            if item.points_to_migrate > 1000:
                item.status = MigrationStatus.NEEDS_REVIEW
                item.error_reason = f'大额积分 {item.points_to_migrate} 缺少流水记录，需要人工确认'
                errors.append(item.error_reason)

        expired_count = 0
        for coupon in item.coupons:
            if coupon.expire_date and coupon.expire_date < self.now:
                expired_count += 1

        if expired_count > 0:
            item.warnings.append(
                f'有 {expired_count} 张优惠券已过期，将被跳过'
            )

        if item.old_user_id in self.state.migrated_users:
            item.status = MigrationStatus.SKIPPED
            item.error_reason = f'用户 {item.old_user_id} 已成功迁移过，不能重复加权益'

    def execute_plan(self, plan: MigrationPlan) -> MigrationResult:
        result = MigrationResult(
            plan_id=plan.plan_id,
            executed_at=datetime.now(),
            total_items=len(plan.pending_items),
            is_simulation=self.simulate,
        )

        for item in plan.pending_items:
            self._execute_item(item, result)

        return result

    def _execute_item(self, item: MigrationItem, result: MigrationResult):
        item.status = MigrationStatus.IN_PROGRESS

        try:
            if item.old_user_id in self.state.migrated_users:
                item.status = MigrationStatus.SKIPPED
                item.error_reason = f'用户已迁移过，跳过'
                result.skipped_count += 1
                result.skipped_items.append(item)
                return

            self._validate_coupons(item)
            self._migrate_points(item)
            self._migrate_coupons(item)

            item.status = MigrationStatus.SUCCESS
            item.migrated_at = datetime.now()

            if not self.simulate:
                self.state.migrated_users.add(item.old_user_id)

            result.success_count += 1
            result.success_items.append(item)

        except Exception as e:
            item.status = MigrationStatus.FAILED
            item.error_reason = str(e)
            result.failed_count += 1
            result.failed_items.append(item)

    def _validate_coupons(self, item: MigrationItem):
        valid_coupons = []
        for coupon in item.coupons:
            if coupon.expire_date and coupon.expire_date < self.now:
                continue
            if coupon.status != CouponStatus.ACTIVE:
                continue
            valid_coupons.append(coupon)
        item.coupons = valid_coupons

    def _migrate_points(self, item: MigrationItem):
        if item.points_to_migrate < 0:
            raise ValueError(f'积分余额不能为负数: {item.points_to_migrate}')

    def _migrate_coupons(self, item: MigrationItem):
        for coupon in item.coupons:
            if coupon.expire_date and coupon.expire_date < self.now:
                raise ValueError(f'优惠券 {coupon.coupon_id} 已过期')

    def retry_failed_items(self, result: MigrationResult, corrections: Dict[str, Dict] = None) -> MigrationResult:
        corrections = corrections or {}
        retry_result = MigrationResult(
            plan_id=f'{result.plan_id}_RETRY',
            executed_at=datetime.now(),
            total_items=len(result.failed_items),
            is_simulation=self.simulate,
        )

        for failed_item in result.failed_items:
            failed_item.retries += 1

            if failed_item.old_user_id in corrections:
                correction = corrections[failed_item.old_user_id]
                if 'phone' in correction:
                    failed_item.phone = correction['phone']
                if 'points_to_migrate' in correction:
                    failed_item.points_to_migrate = correction['points_to_migrate']
                if 'coupons' in correction:
                    failed_item.coupons = correction['coupons']
                failed_item.warnings.append(f'已应用修正: {list(correction.keys())}')

            self._execute_item(failed_item, retry_result)

        return retry_result

    def get_equity_comparison(self, item: MigrationItem) -> Dict:
        old_user = self.state.old_users.get(item.old_user_id)
        if not old_user:
            return {}

        all_old_coupons = self.state.coupons.get(item.old_user_id, [])
        old_active_coupons = [c for c in all_old_coupons if c.status == CouponStatus.ACTIVE]
        old_valid_coupons = [
            c for c in old_active_coupons
            if not c.expire_date or c.expire_date >= self.now
        ]

        migrated_coupons = len(item.coupons) if item.status == MigrationStatus.SUCCESS else 0

        return {
            'old_user_id': item.old_user_id,
            'new_user_id': item.new_user_id,
            'old_points': old_user.points_balance,
            'migrated_points': item.points_to_migrate if item.status == MigrationStatus.SUCCESS else 0,
            'old_coupons_total': len(all_old_coupons),
            'old_coupons_active': len(old_active_coupons),
            'old_coupons_valid': len(old_valid_coupons),
            'migrated_coupons': migrated_coupons,
            'coupons_skipped': len(old_valid_coupons) - migrated_coupons,
        }

    def get_needs_review_list(self, plan: MigrationPlan) -> List[Dict]:
        review_list = []
        for item in plan.needs_review_items:
            review_list.append({
                'old_user_id': item.old_user_id,
                'new_user_id': item.new_user_id,
                'phone': item.phone,
                'reason': item.error_reason or ' '.join(item.warnings),
                'points': item.points_to_migrate,
                'coupons_count': len(item.coupons),
            })
        return review_list
