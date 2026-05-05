from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import func, and_, desc
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from models import db, Tenant, Contact, Contract, UsageSnapshot, FollowUp, AuditLog
from session_tracker import reset_query_count, get_query_count


class DataImportService:
    """数据导入服务"""

    @staticmethod
    def import_sample_data(tenant_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        导入样例数据（租户 + 联系人 + 合同 + 使用量快照）
        """
        if not tenant_data.get('name'):
            raise ValueError('租户名称不能为空')

        tenant = Tenant(name=tenant_data['name'])
        db.session.add(tenant)
        db.session.flush()

        contacts_map = {}
        for contact_data in tenant_data.get('contacts', []):
            contact = Contact(
                tenant_id=tenant.id,
                name=contact_data['name'],
                email=contact_data.get('email'),
                phone=contact_data.get('phone'),
                role=contact_data.get('role')
            )
            db.session.add(contact)
            contacts_map[contact_data.get('import_key', contact_data['name'])] = contact

        db.session.flush()

        contracts_map = {}
        for contract_data in tenant_data.get('contracts', []):
            contact_key = contract_data.get('contact_import_key')
            contact = contacts_map.get(contact_key) if contact_key else next(iter(contacts_map.values()), None)

            if not contact:
                raise ValueError(f'合同 {contract_data.get("contract_number")} 未找到对应的联系人')

            contract = Contract(
                tenant_id=tenant.id,
                contact_id=contact.id,
                contract_number=contract_data['contract_number'],
                start_date=datetime.strptime(contract_data['start_date'], '%Y-%m-%d').date(),
                end_date=datetime.strptime(contract_data['end_date'], '%Y-%m-%d').date(),
                value=contract_data['value'],
                status=contract_data.get('status', 'active')
            )
            db.session.add(contract)
            contracts_map[contract_data.get('import_key', contract_data['contract_number'])] = contract

        db.session.flush()

        for snapshot_data in tenant_data.get('usage_snapshots', []):
            contract_key = snapshot_data.get('contract_import_key')
            contract = contracts_map.get(contract_key) if contract_key else next(iter(contracts_map.values()), None)

            if not contract:
                raise ValueError(f'使用量快照未找到对应的合同')

            snapshot = UsageSnapshot(
                tenant_id=tenant.id,
                contract_id=contract.id,
                snapshot_date=datetime.strptime(snapshot_data['snapshot_date'], '%Y-%m-%d').date(),
                active_users=snapshot_data.get('active_users', 0),
                api_calls=snapshot_data.get('api_calls', 0),
                storage_usage=snapshot_data.get('storage_usage', 0),
                feature_usage=snapshot_data.get('feature_usage')
            )
            db.session.add(snapshot)

        db.session.commit()
        return {
            'tenant_id': tenant.id,
            'tenant_name': tenant.name,
            'contacts_imported': len(contacts_map),
            'contracts_imported': len(contracts_map)
        }


class RiskAssessmentService:
    """风险评估服务"""

    RISK_THRESHOLDS = {
        'expiring_days': 30,
        'usage_drop_percent': 0.3,
        'inactive_days': 14
    }

    @staticmethod
    def calculate_risk(contract: Contract, latest_usage: Optional[UsageSnapshot], 
                       previous_usage: Optional[UsageSnapshot]) -> Dict[str, Any]:
        """
        计算单个合同的续费风险
        """
        today = date.today()
        risks = []
        risk_score = 0
        risk_level = 'low'

        days_until_expiry = (contract.end_date - today).days
        if days_until_expiry <= 0:
            risks.append({'type': 'expired', 'message': f'合同已过期 {abs(days_until_expiry)} 天'})
            risk_score += 100
        elif days_until_expiry <= RiskAssessmentService.RISK_THRESHOLDS['expiring_days']:
            risks.append({'type': 'expiring_soon', 'message': f'合同将在 {days_until_expiry} 天后过期'})
            risk_score += 50

        if latest_usage:
            if latest_usage.active_users == 0:
                risks.append({'type': 'no_usage', 'message': '当前无活跃用户'})
                risk_score += 40

            if previous_usage and previous_usage.active_users > 0:
                usage_drop = 1 - (latest_usage.active_users / previous_usage.active_users)
                if usage_drop >= RiskAssessmentService.RISK_THRESHOLDS['usage_drop_percent']:
                    risks.append({
                        'type': 'usage_drop',
                        'message': f'活跃用户下降 {usage_drop*100:.1f}%',
                        'detail': f'从 {previous_usage.active_users} 降至 {latest_usage.active_users}'
                    })
                    risk_score += 30

        if risk_score >= 80:
            risk_level = 'critical'
        elif risk_score >= 50:
            risk_level = 'high'
        elif risk_score >= 20:
            risk_level = 'medium'

        return {
            'risk_score': risk_score,
            'risk_level': risk_level,
            'risks': risks,
            'days_until_expiry': days_until_expiry,
            'latest_usage': latest_usage.to_dict() if latest_usage else None
        }


class RiskQueryService:
    """风险查询服务"""

    @staticmethod
    def get_risk_list(tenant_id: int, risk_level: Optional[str] = None, 
                      page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """
        按租户查询风险列表 - 优化版，避免 N+1 问题
        
        优化策略：
        1. 使用 joinedload/selectinload 进行预加载
        2. 使用子查询获取最新使用量快照
        3. 批量查询所有关联数据
        """
        reset_query_count()

        today = date.today()

        latest_snapshot_subq = db.session.query(
            UsageSnapshot.contract_id,
            func.max(UsageSnapshot.snapshot_date).label('latest_date')
        ).filter(
            UsageSnapshot.tenant_id == tenant_id
        ).group_by(
            UsageSnapshot.contract_id
        ).subquery()

        query = db.session.query(Contract).options(
            selectinload(Contract.primary_contact),
            selectinload(Contract.usage_snapshots)
        ).filter(
            Contract.tenant_id == tenant_id,
            Contract.status == 'active'
        ).outerjoin(
            latest_snapshot_subq,
            Contract.id == latest_snapshot_subq.c.contract_id
        )

        if risk_level:
            if risk_level == 'expiring':
                query = query.filter(
                    Contract.end_date <= today + timedelta(days=30)
                )
            elif risk_level == 'expired':
                query = query.filter(Contract.end_date < today)

        total = query.count()

        contracts = query.order_by(
            Contract.end_date.asc()
        ).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        contract_ids = [c.id for c in contracts]

        latest_usage_map = {}
        if contract_ids:
            latest_usage_results = db.session.query(UsageSnapshot).filter(
                UsageSnapshot.contract_id.in_(contract_ids)
            ).order_by(
                UsageSnapshot.contract_id,
                UsageSnapshot.snapshot_date.desc()
            ).all()

            for usage in latest_usage_results:
                if usage.contract_id not in latest_usage_map:
                    latest_usage_map[usage.contract_id] = usage

        previous_usage_map = {}
        if contract_ids:
            for cid in contract_ids:
                if cid in latest_usage_map:
                    latest = latest_usage_map[cid]
                    previous = db.session.query(UsageSnapshot).filter(
                        UsageSnapshot.contract_id == cid,
                        UsageSnapshot.snapshot_date < latest.snapshot_date
                    ).order_by(
                        UsageSnapshot.snapshot_date.desc()
                    ).first()
                    if previous:
                        previous_usage_map[cid] = previous

        risk_list = []
        for contract in contracts:
            latest_usage = latest_usage_map.get(contract.id)
            previous_usage = previous_usage_map.get(contract.id)

            risk_info = RiskAssessmentService.calculate_risk(
                contract, latest_usage, previous_usage
            )

            if risk_level and risk_level not in ['expiring', 'expired']:
                if risk_info['risk_level'] != risk_level:
                    continue

            contact = contract.primary_contact
            risk_list.append({
                'contract': contract.to_dict(),
                'contact': contact.to_dict() if contact else None,
                'risk_info': risk_info
            })

        sql_count = get_query_count()

        return {
            'data': risk_list,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            },
            'sql_stats': {
                'query_count': sql_count,
                'explanation': f'''
                本查询使用以下优化策略避免 N+1 问题：
                1. 使用 selectinload 预加载 Contact 和 UsageSnapshot 关联（减少 2*N 次查询）
                2. 使用子查询获取每个合同的最新使用量快照日期（1 次查询）
                3. 批量获取所有合同的最新使用量快照（1 次查询，而非 N 次）
                4. 批量获取前一次使用量快照（最多 N 次，但可进一步优化）
                
                如果使用未优化的方式（如循环内访问 contract.primary_contact），
                查询次数将是：1（主查询） + N（联系人） + N（最新使用量） = 2N+1 次
                本次优化后查询次数约为：{sql_count} 次（取决于数据量）
                '''.strip()
            }
        }


class CustomerDetailService:
    """客户详情查询服务"""

    @staticmethod
    def get_customer_detail(tenant_id: int, contact_id: int) -> Dict[str, Any]:
        """
        获取客户详情（联系人 + 合同 + 使用量趋势 + 跟进记录）
        """
        reset_query_count()

        contact = db.session.query(Contact).options(
            selectinload(Contact.contracts).selectinload(Contract.usage_snapshots),
            selectinload(Contact.follow_ups)
        ).filter(
            Contact.id == contact_id,
            Contact.tenant_id == tenant_id
        ).first()

        if not contact:
            return None

        contracts = list(contact.contracts)
        contract_ids = [c.id for c in contracts]

        all_usage = []
        if contract_ids:
            all_usage = db.session.query(UsageSnapshot).filter(
                UsageSnapshot.contract_id.in_(contract_ids)
            ).order_by(
                UsageSnapshot.snapshot_date
            ).all()

        usage_trend = []
        if all_usage:
            usage_by_date = {}
            for usage in all_usage:
                date_str = usage.snapshot_date.isoformat()
                if date_str not in usage_by_date:
                    usage_by_date[date_str] = {
                        'date': date_str,
                        'total_active_users': 0,
                        'total_api_calls': 0,
                        'total_storage': 0.0
                    }
                usage_by_date[date_str]['total_active_users'] += usage.active_users
                usage_by_date[date_str]['total_api_calls'] += usage.api_calls
                usage_by_date[date_str]['total_storage'] += float(usage.storage_usage)
            usage_trend = sorted(usage_by_date.values(), key=lambda x: x['date'])

        follow_ups = list(contact.follow_ups.order_by(desc(FollowUp.follow_up_date)).limit(20))

        latest_contract = None
        if contracts:
            contracts_sorted = sorted(contracts, key=lambda c: c.end_date, reverse=True)
            latest_contract = contracts_sorted[0]

        latest_usage = None
        if latest_contract:
            latest_usage = db.session.query(UsageSnapshot).filter(
                UsageSnapshot.contract_id == latest_contract.id
            ).order_by(
                desc(UsageSnapshot.snapshot_date)
            ).first()

        risk_info = RiskAssessmentService.calculate_risk(
            latest_contract, latest_usage, None
        ) if latest_contract else None

        sql_count = get_query_count()

        return {
            'contact': contact.to_dict(),
            'contracts': [c.to_dict() for c in contracts],
            'latest_risk_info': risk_info,
            'usage_trend': usage_trend,
            'recent_follow_ups': [f.to_dict() for f in follow_ups],
            'sql_stats': {
                'query_count': sql_count
            }
        }


class FollowUpService:
    """跟进记录服务"""

    @staticmethod
    def create_follow_up(tenant_id: int, contact_id: int, data: Dict[str, Any],
                         operator: str, ip_address: Optional[str] = None) -> Dict[str, Any]:
        """
        创建跟进记录 - 使用事务确保原子性
        
        操作流程：
        1. 验证联系人是否存在
        2. 开始事务
        3. 创建跟进记录
        4. 写入审计日志
        5. 提交事务（两者同时成功）
        6. 任何异常则回滚
        """
        contact = db.session.query(Contact).filter(
            Contact.id == contact_id,
            Contact.tenant_id == tenant_id
        ).first()

        if not contact:
            raise ValueError('联系人不存在')

        try:
            follow_up = FollowUp(
                tenant_id=tenant_id,
                contact_id=contact_id,
                channel=data.get('channel', 'other'),
                content=data['content'],
                operator=operator,
                next_follow_up_at=datetime.strptime(
                    data['next_follow_up_at'], '%Y-%m-%d %H:%M:%S'
                ) if data.get('next_follow_up_at') else None,
                risk_level=data.get('risk_level')
            )

            if data.get('follow_up_date'):
                follow_up.follow_up_date = datetime.strptime(
                    data['follow_up_date'], '%Y-%m-%d %H:%M:%S'
                )

            db.session.add(follow_up)
            db.session.flush()

            audit_log = AuditLog(
                tenant_id=tenant_id,
                action='create',
                entity_type='FollowUp',
                entity_id=follow_up.id,
                new_value={
                    'channel': follow_up.channel,
                    'content': follow_up.content,
                    'operator': follow_up.operator,
                    'risk_level': follow_up.risk_level,
                    'next_follow_up_at': follow_up.next_follow_up_at.isoformat() if follow_up.next_follow_up_at else None
                },
                operator=operator,
                ip_address=ip_address
            )
            db.session.add(audit_log)

            db.session.commit()

            return {
                'follow_up': follow_up.to_dict(),
                'audit_log': audit_log.to_dict()
            }

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def create_follow_up_with_simulated_error(tenant_id: int, contact_id: int, 
                                                data: Dict[str, Any], operator: str,
                                                simulate_error: bool = False) -> Dict[str, Any]:
        """
        演示版本：用于测试事务回滚
        当 simulate_error=True 时，在写入审计日志前抛出异常，验证回滚
        """
        contact = db.session.query(Contact).filter(
            Contact.id == contact_id,
            Contact.tenant_id == tenant_id
        ).first()

        if not contact:
            raise ValueError('联系人不存在')

        try:
            follow_up = FollowUp(
                tenant_id=tenant_id,
                contact_id=contact_id,
                channel=data.get('channel', 'other'),
                content=data['content'],
                operator=operator,
                risk_level=data.get('risk_level')
            )
            db.session.add(follow_up)
            db.session.flush()

            if simulate_error:
                raise Exception('模拟错误：审计日志写入失败')

            audit_log = AuditLog(
                tenant_id=tenant_id,
                action='create',
                entity_type='FollowUp',
                entity_id=follow_up.id,
                new_value={'content': data['content']},
                operator=operator
            )
            db.session.add(audit_log)

            db.session.commit()

            return {
                'follow_up': follow_up.to_dict(),
                'audit_log': audit_log.to_dict()
            }

        except Exception as e:
            db.session.rollback()
            raise e
