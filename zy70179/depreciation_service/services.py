from typing import Tuple, List, Dict, Any, Optional
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid
from .models import (
    AssetCard, DepreciationRule, DepreciationRecord, RecalculationVersion,
    DifferenceDetail, AuditLog
)
from .storage import storage


class DepreciationService:
    @staticmethod
    def calculate_monthly_depreciation(
        original_value: Decimal,
        rule: DepreciationRule,
        accumulated_depreciation: Decimal = Decimal('0'),
        months_depreciated: int = 0
    ) -> Decimal:
        salvage_value = original_value * rule.salvage_value_rate
        depreciable_base = original_value - salvage_value
        
        if rule.method == '直线法':
            monthly_depreciation = depreciable_base / rule.useful_life_months
        elif rule.method == '双倍余额递减法':
            net_value = original_value - accumulated_depreciation
            straight_line_rate = Decimal('1') / rule.useful_life_months
            double_rate = straight_line_rate * Decimal('2')
            monthly_depreciation = net_value * double_rate
            
            remaining_months = rule.useful_life_months - months_depreciated
            if remaining_months <= 2:
                remaining_net_value = net_value - salvage_value
                monthly_depreciation = remaining_net_value / remaining_months
        elif rule.method == '年数总和法':
            remaining_useful_life = rule.useful_life_months - months_depreciated
            sum_of_years = rule.useful_life_months * (rule.useful_life_months + 1) / 2
            monthly_depreciation = depreciable_base * (remaining_useful_life / sum_of_years)
        else:
            monthly_depreciation = depreciable_base / rule.useful_life_months
        
        return monthly_depreciation.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    @staticmethod
    def get_month_range(start_month: str, end_month: str) -> List[str]:
        months = []
        current = datetime.strptime(start_month, '%Y-%m')
        end = datetime.strptime(end_month, '%Y-%m')
        
        while current <= end:
            months.append(current.strftime('%Y-%m'))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        return months
    
    @staticmethod
    def get_cost_center_for_period(asset: AssetCard, period: str) -> str:
        for history in asset.cost_center_history:
            effective_from = history['effective_from']
            effective_to = history.get('effective_to')
            
            if effective_from <= period:
                if effective_to is None or period <= effective_to:
                    return history['cost_center_code']
        
        return asset.cost_center_code


class RecalculationService:
    @staticmethod
    def _generate_id(prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:8]}"
    
    @staticmethod
    def _get_idempotency_key(
        asset_code: str,
        new_rule_code: Optional[str],
        new_cost_center: Optional[str],
        effective_period: str,
        operator: str
    ) -> str:
        key_parts = [
            asset_code,
            new_rule_code or 'same',
            new_cost_center or 'same',
            effective_period,
            operator
        ]
        return '_'.join(key_parts)
    
    @staticmethod
    def initialize_asset(
        asset_code: str,
        asset_name: str,
        original_value: Decimal,
        rule_code: str,
        cost_center_code: str,
        purchase_date: str,
        start_depreciation_month: str
    ) -> Dict[str, Any]:
        idempotency_key = f"init_asset_{asset_code}"
        existing = storage.check_idempotency(idempotency_key)
        if existing:
            return {
                'success': False,
                'message': f'资产卡片 {asset_code} 已初始化，无需重复操作',
                'data': existing['result']['data'],
                'is_idempotent': True
            }
        
        existing_asset = storage.load_asset(asset_code)
        if existing_asset:
            result = {
                'success': False,
                'message': f'资产卡片 {asset_code} 已存在',
                'data': existing_asset.to_dict()
            }
            storage.save_idempotency(idempotency_key, result)
            return result
        
        rule = storage.load_depreciation_rule(rule_code)
        if not rule:
            return {
                'success': False,
                'message': f'折旧规则 {rule_code} 不存在',
                'data': None
            }
        
        cost_center = storage.load_cost_center(cost_center_code)
        if not cost_center:
            return {
                'success': False,
                'message': f'成本中心 {cost_center_code} 不存在',
                'data': None
            }
        
        asset = AssetCard(
            asset_code=asset_code,
            asset_name=asset_name,
            original_value=original_value,
            depreciation_rule_code=rule_code,
            cost_center_code=cost_center_code,
            purchase_date=datetime.strptime(purchase_date, '%Y-%m-%d'),
            start_depreciation_month=start_depreciation_month
        )
        
        storage.save_asset(asset)
        
        log = AuditLog(
            log_id=RecalculationService._generate_id('audit'),
            asset_code=asset_code,
            action='ASSET_INITIALIZE',
            after_data=asset.to_dict(),
            operator='system',
            business_description=f'初始化资产卡片：{asset_name}（{asset_code}）'
        )
        storage.save_audit_log(log)
        
        result = {
            'success': True,
            'message': f'资产卡片 {asset_name}（{asset_code}）初始化成功',
            'data': asset.to_dict()
        }
        storage.save_idempotency(idempotency_key, result)
        return result
    
    @staticmethod
    def create_depreciation_records(
        asset_code: str,
        start_period: str,
        end_period: str
    ) -> Dict[str, Any]:
        idempotency_key = f"create_depreciation_{asset_code}_{start_period}_{end_period}"
        existing = storage.check_idempotency(idempotency_key)
        if existing:
            return {
                'success': True,
                'message': f'该期间折旧记录已生成，无需重复操作（资产：{asset_code}，期间：{start_period} 至 {end_period}）',
                'data': existing['result']['data'],
                'is_idempotent': True
            }
        
        asset = storage.load_asset(asset_code)
        if not asset:
            return {
                'success': False,
                'message': f'资产卡片 {asset_code} 不存在',
                'data': None
            }
        
        rule = storage.load_depreciation_rule(asset.depreciation_rule_code)
        if not rule:
            return {
                'success': False,
                'message': f'折旧规则 {asset.depreciation_rule_code} 不存在',
                'data': None
            }
        
        periods = DepreciationService.get_month_range(start_period, end_period)
        records = []
        accumulated_depreciation = asset.accumulated_depreciation
        months_depreciated = 0
        
        for period in periods:
            monthly_depreciation = DepreciationService.calculate_monthly_depreciation(
                asset.original_value,
                rule,
                accumulated_depreciation,
                months_depreciated
            )
            
            accumulated_depreciation += monthly_depreciation
            net_value = asset.original_value - accumulated_depreciation
            cost_center_code = DepreciationService.get_cost_center_for_period(asset, period)
            
            record = DepreciationRecord(
                asset_code=asset_code,
                period=period,
                depreciation_amount=monthly_depreciation,
                accumulated_depreciation=accumulated_depreciation,
                net_value=net_value,
                cost_center_code=cost_center_code,
                depreciation_rule_code=rule.code,
                is_original=True
            )
            
            storage.save_depreciation_record(record)
            records.append(record.to_dict())
            months_depreciated += 1
        
        asset.accumulated_depreciation = accumulated_depreciation
        asset.net_value = net_value
        asset.depreciation_history = records
        storage.save_asset(asset)
        
        log = AuditLog(
            log_id=RecalculationService._generate_id('audit'),
            asset_code=asset_code,
            action='DEPRECIATION_GENERATE',
            after_data={'periods': periods, 'records_count': len(records)},
            operator='system',
            business_description=f'生成折旧记录：资产 {asset.asset_name}（{asset_code}），期间 {start_period} 至 {end_period}，共 {len(records)} 条记录'
        )
        storage.save_audit_log(log)
        
        result = {
            'success': True,
            'message': f'折旧记录生成成功：共 {len(records)} 条记录，期间 {start_period} 至 {end_period}',
            'data': {
                'asset_code': asset_code,
                'asset_name': asset.asset_name,
                'periods': periods,
                'records_count': len(records),
                'total_depreciation': str(accumulated_depreciation - asset.original_value + asset.original_value - (asset.original_value - accumulated_depreciation))
            }
        }
        storage.save_idempotency(key=idempotency_key, result=result)
        return result
    
    @staticmethod
    def recalculate_depreciation(
        asset_code: str,
        effective_period: str,
        new_rule_code: Optional[str] = None,
        new_cost_center: Optional[str] = None,
        operator: str = 'system',
        reason: str = ''
    ) -> Dict[str, Any]:
        idempotency_key = RecalculationService._get_idempotency_key(
            asset_code, new_rule_code, new_cost_center, effective_period, operator
        )
        existing = storage.check_idempotency(idempotency_key)
        if existing:
            return {
                'success': True,
                'message': f'相同参数的重算已执行过，版本号：{existing["result"]["data"]["version_id"]}',
                'data': existing['result']['data'],
                'is_idempotent': True
            }
        
        asset = storage.load_asset(asset_code)
        if not asset:
            return {
                'success': False,
                'message': f'资产卡片 {asset_code} 不存在',
                'data': None
            }
        
        old_rule_code = asset.depreciation_rule_code
        old_cost_center = asset.cost_center_code
        
        if new_rule_code and new_rule_code == old_rule_code:
            new_rule_code = None
        if new_cost_center and new_cost_center == old_cost_center:
            new_cost_center = None
        
        if not new_rule_code and not new_cost_center:
            return {
                'success': False,
                'message': '未检测到任何变更（折旧规则和成本中心均未变化），无需重算',
                'data': None
            }
        
        if new_rule_code:
            new_rule = storage.load_depreciation_rule(new_rule_code)
            if not new_rule:
                return {
                    'success': False,
                    'message': f'新折旧规则 {new_rule_code} 不存在',
                    'data': None
                }
        else:
            new_rule = storage.load_depreciation_rule(old_rule_code)
        
        if new_cost_center:
            new_cc = storage.load_cost_center(new_cost_center)
            if not new_cc:
                return {
                    'success': False,
                    'message': f'新成本中心 {new_cost_center} 不存在',
                    'data': None
                }
        
        old_rule = storage.load_depreciation_rule(old_rule_code)
        
        change_type = 'both' if new_rule_code and new_cost_center else \
                     'category_change' if new_rule_code else 'cost_center_change'
        
        version = RecalculationVersion(
            version_id=RecalculationService._generate_id('ver'),
            asset_code=asset_code,
            change_type=change_type,
            old_depreciation_rule_code=old_rule_code,
            new_depreciation_rule_code=new_rule_code or old_rule_code,
            old_cost_center_code=old_cost_center,
            new_cost_center_code=new_cost_center or old_cost_center,
            effective_period=effective_period,
            status='processing',
            created_by=operator
        )
        storage.save_version(version)
        
        before_asset = asset.to_dict()
        
        if new_cost_center:
            for history in asset.cost_center_history:
                if history.get('is_current'):
                    history['effective_to'] = effective_period
                    history['is_current'] = False
            
            asset.cost_center_history.append({
                'cost_center_code': new_cost_center,
                'effective_from': effective_period,
                'effective_to': None,
                'is_current': True
            })
            asset.cost_center_code = new_cost_center
        
        if new_rule_code:
            asset.depreciation_rule_code = new_rule_code
        
        storage.save_asset(asset)
        
        try:
            original_records = storage.load_depreciation_records(asset_code)
            if not original_records:
                version.status = 'failed'
                storage.save_version(version)
                return {
                    'success': False,
                    'message': '未找到原始折旧记录，无法进行重算',
                    'data': {'version_id': version.version_id}
                }
            
            periods_to_recalculate = [r.period for r in original_records if r.period >= effective_period]
            if not periods_to_recalculate:
                version.status = 'failed'
                storage.save_version(version)
                return {
                    'success': False,
                    'message': f'生效日期 {effective_period} 之后没有折旧记录需要重算',
                    'data': {'version_id': version.version_id}
                }
            
            periods_before = [r.period for r in original_records if r.period < effective_period]
            accumulated_before = original_records[-1].accumulated_depreciation if periods_before else Decimal('0')
            months_before = len(periods_before)
            
            new_records = []
            differences = []
            current_accumulated = accumulated_before
            
            for period in periods_to_recalculate:
                original_record = next(r for r in original_records if r.period == period)
                
                monthly_depreciation = DepreciationService.calculate_monthly_depreciation(
                    asset.original_value,
                    new_rule,
                    current_accumulated,
                    months_before
                )
                
                current_accumulated += monthly_depreciation
                net_value = asset.original_value - current_accumulated
                cost_center_for_period = new_cost_center if new_cost_center else original_record.cost_center_code
                
                new_record = DepreciationRecord(
                    asset_code=asset_code,
                    period=period,
                    depreciation_amount=monthly_depreciation,
                    accumulated_depreciation=current_accumulated,
                    net_value=net_value,
                    cost_center_code=cost_center_for_period,
                    depreciation_rule_code=new_rule.code,
                    version_id=version.version_id,
                    is_original=False
                )
                
                storage.save_depreciation_record(new_record)
                new_records.append(new_record.to_dict())
                
                diff_amount = monthly_depreciation - original_record.depreciation_amount
                
                explanations = []
                if new_rule_code and old_rule:
                    if old_rule.useful_life_months != new_rule.useful_life_months:
                        explanations.append(
                            f'折旧年限变更：{old_rule.useful_life_months}个月 → {new_rule.useful_life_months}个月'
                        )
                    if old_rule.method != new_rule.method:
                        explanations.append(
                            f'折旧方法变更：{old_rule.method} → {new_rule.method}'
                        )
                    if old_rule.salvage_value_rate != new_rule.salvage_value_rate:
                        explanations.append(
                            f'残值率变更：{old_rule.salvage_value_rate*100}% → {new_rule.salvage_value_rate*100}%'
                        )
                
                if new_cost_center and original_record.cost_center_code != new_cost_center:
                    explanations.append(
                        f'成本中心变更：{original_record.cost_center_code} → {new_cost_center}'
                    )
                
                if not explanations:
                    explanations.append('其他调整')
                
                difference = DifferenceDetail(
                    difference_id=RecalculationService._generate_id('diff'),
                    version_id=version.version_id,
                    asset_code=asset_code,
                    period=period,
                    original_depreciation=original_record.depreciation_amount,
                    new_depreciation=monthly_depreciation,
                    difference_amount=diff_amount,
                    original_cost_center=original_record.cost_center_code,
                    new_cost_center=cost_center_for_period,
                    explanation='；'.join(explanations)
                )
                storage.save_difference(difference)
                differences.append(difference.to_dict())
                
                months_before += 1
            
            asset.accumulated_depreciation = current_accumulated
            asset.net_value = net_value
            storage.save_asset(asset)
            
            version.status = 'completed'
            version.completed_at = datetime.now()
            storage.save_version(version)
            
            after_asset = asset.to_dict()
            
            change_description = []
            if new_rule_code:
                change_description.append(f'折旧规则：{old_rule_code} → {new_rule_code}')
            if new_cost_center:
                change_description.append(f'成本中心：{old_cost_center} → {new_cost_center}')
            
            log = AuditLog(
                log_id=RecalculationService._generate_id('audit'),
                asset_code=asset_code,
                action='DEPRECIATION_RECALCULATE',
                version_id=version.version_id,
                before_data=before_asset,
                after_data=after_asset,
                operator=operator,
                business_description=(
                    f'折旧重算完成：资产 {asset.asset_name}（{asset_code}），版本号 {version.version_id}。'
                    f'变更内容：{"；".join(change_description)}。'
                    f'重算期间：{periods_to_recalculate[0]} 至 {periods_to_recalculate[-1]}，共 {len(differences)} 个期间。'
                    f'{reason}'
                ).strip()
            )
            storage.save_audit_log(log)
            
            total_diff = sum(Decimal(d['difference_amount']) for d in differences)
            
            result = {
                'success': True,
                'message': f'折旧重算成功：版本号 {version.version_id}，重算 {len(differences)} 个期间，总差异 {total_diff} 元',
                'data': {
                    'version_id': version.version_id,
                    'asset_code': asset_code,
                    'asset_name': asset.asset_name,
                    'change_type': change_type,
                    'effective_period': effective_period,
                    'recalculated_periods': periods_to_recalculate,
                    'differences_count': len(differences),
                    'total_difference': str(total_diff),
                    'old_rule': old_rule_code,
                    'new_rule': new_rule_code or old_rule_code,
                    'old_cost_center': old_cost_center,
                    'new_cost_center': new_cost_center or old_cost_center
                }
            }
            storage.save_idempotency(idempotency_key, result)
            return result
            
        except Exception as e:
            version.status = 'failed'
            storage.save_version(version)
            
            log = AuditLog(
                log_id=RecalculationService._generate_id('audit'),
                asset_code=asset_code,
                action='DEPRECIATION_RECALCULATE_FAILED',
                version_id=version.version_id,
                operator=operator,
                business_description=f'折旧重算失败：资产 {asset.asset_name}（{asset_code}），错误信息：{str(e)}'
            )
            storage.save_audit_log(log)
            
            return {
                'success': False,
                'message': f'折旧重算失败：{str(e)}',
                'data': {'version_id': version.version_id}
            }
    
    @staticmethod
    def get_version_details(version_id: str) -> Dict[str, Any]:
        version = storage.load_version(version_id)
        if not version:
            return {
                'success': False,
                'message': f'版本 {version_id} 不存在',
                'data': None
            }
        
        differences = storage.load_differences(version_id)
        audit_logs = storage.load_audit_logs(version_id=version_id)
        asset = storage.load_asset(version.asset_code)
        
        return {
            'success': True,
            'message': f'获取版本详情成功',
            'data': {
                'version': version.to_dict(),
                'asset': asset.to_dict() if asset else None,
                'differences': [d.to_dict() for d in differences],
                'audit_logs': [log.to_dict() for log in audit_logs],
                'summary': {
                    'total_periods': len(differences),
                    'total_difference': str(sum(d.difference_amount for d in differences)),
                    'has_rule_change': version.old_depreciation_rule_code != version.new_depreciation_rule_code,
                    'has_cost_center_change': version.old_cost_center_code != version.new_cost_center_code
                }
            }
        }
    
    @staticmethod
    def get_audit_trail(asset_code: str) -> Dict[str, Any]:
        asset = storage.load_asset(asset_code)
        if not asset:
            return {
                'success': False,
                'message': f'资产卡片 {asset_code} 不存在',
                'data': None
            }
        
        logs = storage.load_audit_logs(asset_code=asset_code)
        versions = storage.list_versions(asset_code=asset_code)
        
        return {
            'success': True,
            'message': f'获取资产审计轨迹成功',
            'data': {
                'asset': asset.to_dict(),
                'audit_logs': [log.to_dict() for log in logs],
                'versions': [v.to_dict() for v in versions],
                'summary': {
                    'total_operations': len(logs),
                    'total_recalculations': len(versions),
                    'successful_recalculations': len([v for v in versions if v.status == 'completed'])
                }
            }
        }
    
    @staticmethod
    def setup_demo_data() -> Dict[str, Any]:
        idempotency_key = 'setup_demo_data'
        existing = storage.check_idempotency(idempotency_key)
        if existing:
            return {
                'success': True,
                'message': '演示数据已设置，无需重复操作',
                'data': existing['result']['data'],
                'is_idempotent': True
            }
        
        from .models import CostCenter, DepreciationRule
        
        cc1 = CostCenter(
            code='CC001',
            name='生产一部',
            effective_from=datetime(2023, 1, 1)
        )
        cc2 = CostCenter(
            code='CC002',
            name='生产二部',
            effective_from=datetime(2023, 1, 1)
        )
        storage.save_cost_center(cc1)
        storage.save_cost_center(cc2)
        
        rule1 = DepreciationRule(
            code='RULE001',
            name='电子设备-3年',
            method='直线法',
            useful_life_months=36,
            salvage_value_rate=Decimal('0.05')
        )
        rule2 = DepreciationRule(
            code='RULE002',
            name='机器设备-5年',
            method='直线法',
            useful_life_months=60,
            salvage_value_rate=Decimal('0.05')
        )
        storage.save_depreciation_rule(rule1)
        storage.save_depreciation_rule(rule2)
        
        result = {
            'success': True,
            'message': '演示数据设置成功',
            'data': {
                'cost_centers': [cc1.to_dict(), cc2.to_dict()],
                'depreciation_rules': [rule1.to_dict(), rule2.to_dict()]
            }
        }
        storage.save_idempotency(idempotency_key, result)
        return result
