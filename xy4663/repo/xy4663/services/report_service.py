from models import ConfigVersion, Plan, DiscountRule, CustomerUsage, BillingResult, RecalcTask, CacheKey, Dependency
from database import db_session
from datetime import datetime
import json


class ReportService:
    
    def generate_markdown_report(self, config_version_id):
        config_version = ConfigVersion.query.get(config_version_id)
        if not config_version:
            return "# 错误：配置版本不存在\n\n未找到指定的配置版本。"
        
        changes = json.loads(config_version.changes) if config_version.changes else {}
        
        affected_entities = self._analyze_changes(changes)
        affected_customers = self._get_affected_customers(affected_entities)
        invalidated_caches = self._get_invalidated_caches(affected_entities)
        recalc_tasks = self._get_related_recalc_tasks(config_version_id)
        billing_changes = self._get_billing_changes(config_version_id)
        
        report = self._build_markdown_report(
            config_version, changes, affected_entities, affected_customers,
            invalidated_caches, recalc_tasks, billing_changes
        )
        
        return report
    
    def generate_json_report(self, config_version_id):
        config_version = ConfigVersion.query.get(config_version_id)
        if not config_version:
            return {"error": "Config version not found"}
        
        changes = json.loads(config_version.changes) if config_version.changes else {}
        
        affected_entities = self._analyze_changes(changes)
        affected_customers = self._get_affected_customers(affected_entities)
        invalidated_caches = self._get_invalidated_caches(affected_entities)
        recalc_tasks = self._get_related_recalc_tasks(config_version_id)
        billing_changes = self._get_billing_changes(config_version_id)
        
        return {
            "config_version": config_version.to_dict(),
            "changes": changes,
            "impact_analysis": {
                "affected_entities": affected_entities,
                "affected_customers_count": len(affected_customers),
                "affected_customers": affected_customers,
                "invalidated_caches_count": len(invalidated_caches),
                "invalidated_caches": invalidated_caches
            },
            "recalc_tasks": [t.to_dict() for t in recalc_tasks],
            "billing_changes": billing_changes,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def _analyze_changes(self, changes):
        affected = {
            'plans': [],
            'discount_rules': [],
            'config_settings': []
        }
        
        if 'plans' in changes:
            for plan_change in changes['plans']:
                affected['plans'].append({
                    'id': plan_change.get('id'),
                    'action': plan_change.get('action', 'update'),
                    'fields': plan_change.get('fields', [])
                })
        
        if 'discount_rules' in changes:
            for discount_change in changes['discount_rules']:
                affected['discount_rules'].append({
                    'id': discount_change.get('id'),
                    'action': discount_change.get('action', 'update'),
                    'fields': discount_change.get('fields', [])
                })
        
        if 'config_settings' in changes:
            affected['config_settings'] = changes['config_settings']
        
        return affected
    
    def _get_affected_customers(self, affected_entities):
        affected = set()
        
        for plan_info in affected_entities.get('plans', []):
            plan_id = plan_info.get('id')
            if plan_id:
                usages = CustomerUsage.query.filter_by(plan_id=plan_id).all()
                for usage in usages:
                    affected.add(usage.customer_id)
        
        for discount_info in affected_entities.get('discount_rules', []):
            discount_id = discount_info.get('id')
            if discount_id:
                results = BillingResult.query.filter_by(discount_rule_id=discount_id).all()
                for result in results:
                    affected.add(result.customer_id)
        
        return list(affected)
    
    def _get_invalidated_caches(self, affected_entities):
        invalidated = []
        
        for plan_info in affected_entities.get('plans', []):
            plan_id = plan_info.get('id')
            if plan_id:
                cache_keys = CacheKey.query.filter_by(
                    key_type='plan',
                    entity_id=plan_id
                ).all()
                for key in cache_keys:
                    invalidated.append(key.to_dict())
        
        for discount_info in affected_entities.get('discount_rules', []):
            discount_id = discount_info.get('id')
            if discount_id:
                cache_keys = CacheKey.query.filter_by(
                    key_type='discount',
                    entity_id=discount_id
                ).all()
                for key in cache_keys:
                    invalidated.append(key.to_dict())
        
        return invalidated
    
    def _get_related_recalc_tasks(self, config_version_id):
        tasks = RecalcTask.query.filter_by(
            config_version_id=config_version_id
        ).order_by(RecalcTask.created_at.desc()).all()
        return tasks
    
    def _get_billing_changes(self, config_version_id):
        results = BillingResult.query.filter_by(
            config_version_id=config_version_id
        ).all()
        
        changes = []
        for result in results:
            changes.append({
                'customer_id': result.customer_id,
                'billing_month': result.billing_month,
                'final_cost': result.final_cost,
                'base_cost': result.base_cost,
                'discount_amount': result.discount_amount
            })
        
        return changes
    
    def _build_markdown_report(self, config_version, changes, affected_entities, 
                                 affected_customers, invalidated_caches, 
                                 recalc_tasks, billing_changes):
        report = []
        
        report.append(f"# 配置变更影响报告")
        report.append(f"")
        report.append(f"## 基本信息")
        report.append(f"")
        report.append(f"- **版本号**: {config_version.version}")
        report.append(f"- **发布者**: {config_version.author}")
        report.append(f"- **发布时间**: {config_version.created_at.isoformat() if config_version.created_at else 'N/A'}")
        report.append(f"- **描述**: {config_version.description or '无'}")
        report.append(f"")
        
        report.append(f"## 变更内容")
        report.append(f"")
        
        if 'plans' in changes:
            report.append(f"### 套餐配置变更")
            report.append(f"")
            for plan_change in changes['plans']:
                action = plan_change.get('action', 'update')
                plan_id = plan_change.get('id', 'N/A')
                fields = ', '.join(plan_change.get('fields', []))
                report.append(f"- **{action}**: 套餐 ID {plan_id}")
                if fields:
                    report.append(f"  - 变更字段: {fields}")
                old_val = plan_change.get('old_value')
                new_val = plan_change.get('new_value')
                if old_val or new_val:
                    report.append(f"  - 旧值: {old_val}")
                    report.append(f"  - 新值: {new_val}")
            report.append(f"")
        
        if 'discount_rules' in changes:
            report.append(f"### 折扣规则变更")
            report.append(f"")
            for discount_change in changes['discount_rules']:
                action = discount_change.get('action', 'update')
                discount_id = discount_change.get('id', 'N/A')
                fields = ', '.join(discount_change.get('fields', []))
                report.append(f"- **{action}**: 折扣规则 ID {discount_id}")
                if fields:
                    report.append(f"  - 变更字段: {fields}")
            report.append(f"")
        
        report.append(f"## 影响分析")
        report.append(f"")
        
        report.append(f"### 受影响的客户")
        report.append(f"")
        report.append(f"- **受影响客户总数**: {len(affected_customers)}")
        if affected_customers:
            report.append(f"- **客户 ID 列表**: {', '.join(map(str, affected_customers[:20]))}")
            if len(affected_customers) > 20:
                report.append(f"  - ... 等 {len(affected_customers) - 20} 个客户")
        report.append(f"")
        
        report.append(f"### 需要失效的缓存")
        report.append(f"")
        report.append(f"- **需失效缓存总数**: {len(invalidated_caches)}")
        if invalidated_caches:
            report.append(f"")
            report.append(f"| 缓存 Key | 类型 | 实体 ID | 状态 |")
            report.append(f"|-----------|------|---------|------|")
            for cache in invalidated_caches[:10]:
                status = "失效" if not cache.get('is_valid') else "有效"
                report.append(f"| {cache.get('key')} | {cache.get('key_type')} | {cache.get('entity_id')} | {status} |")
            if len(invalidated_caches) > 10:
                report.append(f"| ... | ... | ... | ... |")
        report.append(f"")
        
        report.append(f"## 重算任务")
        report.append(f"")
        if recalc_tasks:
            report.append(f"| 任务 ID | 类型 | 状态 | 进度 | 处理数/总数 |")
            report.append(f"|---------|------|------|------|-------------|")
            for task in recalc_tasks:
                status_display = {
                    'pending': '等待中',
                    'running': '运行中',
                    'completed': '已完成',
                    'failed': '失败'
                }.get(task.status, task.status)
                report.append(f"| {task.id} | {task.task_type} | {status_display} | {task.progress}% | {task.processed_items}/{task.total_items} |")
        else:
            report.append(f"*暂无相关重算任务*")
        report.append(f"")
        
        report.append(f"## 账单变更明细")
        report.append(f"")
        if billing_changes:
            total_change = sum(c.get('final_cost', 0) for c in billing_changes)
            report.append(f"- **涉及账单数**: {len(billing_changes)}")
            report.append(f"- **总费用变化**: {total_change:.2f}")
            report.append(f"")
            report.append(f"| 客户 ID | 账单月份 | 基础费用 | 折扣金额 | 最终费用 |")
            report.append(f"|---------|----------|----------|----------|----------|")
            for change in billing_changes[:15]:
                report.append(f"| {change.get('customer_id')} | {change.get('billing_month')} | {change.get('base_cost', 0):.2f} | {change.get('discount_amount', 0):.2f} | {change.get('final_cost', 0):.2f} |")
            if len(billing_changes) > 15:
                report.append(f"| ... | ... | ... | ... | ... |")
        else:
            report.append(f"*暂无账单变更记录*")
        report.append(f"")
        
        report.append(f"---")
        report.append(f"*报告生成时间: {datetime.utcnow().isoformat()}*")
        
        return '\n'.join(report)
