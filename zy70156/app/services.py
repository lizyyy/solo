import hashlib
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import networkx as nx

from . import models, schemas
from .models import (
    TableMetadata, TableFieldVersion, LineageEdge, FieldChangeRequest,
    ImpactAnalysis, ImpactReport, Subscription, Alert, OperationHistory,
    MetricDefinition, FieldChangeType, ChangeStatus, AlertStatus
)


def generate_hash(data: Any) -> str:
    json_str = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(json_str.encode('utf-8')).hexdigest()[:64]


def generate_id() -> str:
    return str(uuid.uuid4()).replace('-', '')


def record_operation_history(
    db: Session,
    operation_type: str,
    entity_type: str,
    entity_id: int,
    entity_key: Optional[str] = None,
    old_state: Optional[Dict[str, Any]] = None,
    new_state: Optional[Dict[str, Any]] = None,
    operation_by: Optional[str] = None,
    batch_id: Optional[str] = None,
    comment: Optional[str] = None
) -> OperationHistory:
    history = OperationHistory(
        operation_type=operation_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_key=entity_key,
        old_state=old_state,
        new_state=new_state,
        operation_by=operation_by,
        batch_id=batch_id,
        comment=comment
    )
    db.add(history)
    db.flush()
    return history


def _serialize_value(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, 'value'):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list) or isinstance(value, dict):
        return json.loads(json.dumps(value, default=str))
    return value


def _serialize_model(obj: Any) -> Dict[str, Any]:
    result = {}
    for column in obj.__table__.columns:
        value = getattr(obj, column.name)
        result[column.name] = _serialize_value(value)
    return result


def compare_field_definitions(
    fields1: List[Dict[str, Any]],
    fields2: List[Dict[str, Any]]
) -> Dict[str, Any]:
    fields1_dict = {f['name']: f for f in fields1}
    fields2_dict = {f['name']: f for f in fields2}
    
    all_names = set(fields1_dict.keys()) | set(fields2_dict.keys())
    
    added = []
    removed = []
    modified = []
    unchanged = []
    
    for name in all_names:
        if name not in fields1_dict:
            added.append(fields2_dict[name])
        elif name not in fields2_dict:
            removed.append(fields1_dict[name])
        else:
            f1 = fields1_dict[name]
            f2 = fields2_dict[name]
            f1_sorted = json.dumps(f1, sort_keys=True, default=str)
            f2_sorted = json.dumps(f2, sort_keys=True, default=str)
            if f1_sorted != f2_sorted:
                modified.append({
                    'name': name,
                    'old': f1,
                    'new': f2
                })
            else:
                unchanged.append(f1)
    
    return {
        'added_fields': added,
        'removed_fields': removed,
        'modified_fields': modified,
        'unchanged_fields': unchanged
    }


def is_critical_field_change(
    change_type: FieldChangeType,
    old_value: Optional[Dict[str, Any]],
    new_value: Optional[Dict[str, Any]]
) -> bool:
    if change_type in [FieldChangeType.REMOVE, FieldChangeType.RENAME]:
        return True
    if change_type == FieldChangeType.MODIFY:
        if old_value and new_value:
            old_type = old_value.get('type', '').lower()
            new_type = new_value.get('type', '').lower()
            if old_type != new_type:
                type_mapping = {
                    'integer': ['bigint'],
                    'bigint': ['integer'],
                    'float': ['double'],
                    'double': ['float']
                }
                if old_type not in type_mapping or new_type not in type_mapping[old_type]:
                    return True
            old_nullable = old_value.get('nullable', True)
            new_nullable = new_value.get('nullable', True)
            if old_nullable and not new_nullable:
                return True
    return False


def calculate_risk_level(
    impacted_tables_count: int,
    impacted_jobs_count: int,
    impacted_metrics_count: int,
    is_critical: bool
) -> str:
    total_impact = impacted_tables_count + impacted_jobs_count + impacted_metrics_count
    
    if is_critical or total_impact > 20:
        return 'high'
    elif total_impact > 5:
        return 'medium'
    else:
        return 'low'


def build_lineage_graph(db: Session) -> nx.DiGraph:
    G = nx.DiGraph()
    
    tables = db.query(TableMetadata).all()
    for table in tables:
        node_id = f"table_{table.id}"
        G.add_node(node_id, type='table', name=f"{table.database_name}.{table.schema_name}.{table.table_name}")
    
    edges = db.query(LineageEdge).filter(LineageEdge.is_active == True).all()
    for edge in edges:
        source_node = f"table_{edge.source_table_id}"
        target_node = f"table_{edge.target_table_id}"
        G.add_edge(source_node, target_node, 
                   source_field=edge.source_field_name,
                   target_field=edge.target_field_name,
                   job_id=edge.job_id,
                   job_name=edge.job_name,
                   transformation=edge.transformation_logic)
    
    return G


def get_downstream_tables(db: Session, table_id: int, field_name: Optional[str] = None) -> List[Dict[str, Any]]:
    G = build_lineage_graph(db)
    source_node = f"table_{table_id}"
    
    if source_node not in G:
        return []
    
    downstream_nodes = list(nx.descendants(G, source_node))
    
    result = []
    for node in downstream_nodes:
        if node.startswith('table_'):
            node_table_id = int(node.replace('table_', ''))
            table = db.query(TableMetadata).filter(TableMetadata.id == node_table_id).first()
            if table:
                paths = list(nx.all_simple_paths(G, source_node, node))
                edge_info = []
                for path in paths:
                    for i in range(len(path) - 1):
                        edge_data = G.get_edge_data(path[i], path[i+1])
                        if edge_data:
                            edge_info.append(edge_data)
                
                relevant_jobs = set()
                relevant_fields = set()
                for info in edge_info:
                    if info.get('job_id'):
                        relevant_jobs.add(f"{info.get('job_id')}:{info.get('job_name', '')}")
                    if info.get('target_field'):
                        relevant_fields.add(info.get('target_field'))
                
                result.append({
                    'table_id': table.id,
                    'database_name': table.database_name,
                    'schema_name': table.schema_name,
                    'table_name': table.table_name,
                    'path_length': min(len(p) - 1 for p in paths),
                    'relevant_jobs': list(relevant_jobs),
                    'relevant_fields': list(relevant_fields)
                })
    
    return sorted(result, key=lambda x: x['path_length'])


def analyze_metric_impact(db: Session, table_id: int, field_name: str) -> List[Dict[str, Any]]:
    table = db.query(TableMetadata).filter(TableMetadata.id == table_id).first()
    if not table:
        return []
    
    full_table_name = f"{table.database_name}.{table.schema_name}.{table.table_name}"
    
    metrics = db.query(MetricDefinition).filter(
        MetricDefinition.is_active == True,
        MetricDefinition.source_tables.contains([full_table_name])
    ).all()
    
    impacted_metrics = []
    for metric in metrics:
        fields = metric.source_fields or []
        for field in fields:
            if field.get('table_name') == full_table_name and field.get('field_name') == field_name:
                impacted_metrics.append({
                    'metric_id': metric.metric_id,
                    'metric_name': metric.metric_name,
                    'owner': metric.owner,
                    'calculation_logic': metric.calculation_logic
                })
                break
    
    return impacted_metrics


def analyze_change_impact(
    db: Session,
    change_request: FieldChangeRequest
) -> Dict[str, Any]:
    impacted_tables = get_downstream_tables(db, change_request.table_id, change_request.field_name)
    
    metrics = analyze_metric_impact(db, change_request.table_id, change_request.field_name)
    
    jobs = set()
    for table in impacted_tables:
        jobs.update(table.get('relevant_jobs', []))
    
    impacted_jobs = [{'job_id': job} for job in jobs]
    
    is_critical = is_critical_field_change(
        change_request.change_type,
        change_request.old_value,
        change_request.new_value
    )
    
    risk_level = calculate_risk_level(
        len(impacted_tables),
        len(impacted_jobs),
        len(metrics),
        is_critical
    )
    
    summary = (
        f"变更 {change_request.field_name} "
        f"将影响 {len(impacted_tables)} 个下游表, "
        f"{len(impacted_jobs)} 个任务, "
        f"{len(metrics)} 个指标。"
        f"风险等级: {risk_level.upper()}"
    )
    
    return {
        'impacted_tables': impacted_tables,
        'impacted_jobs': impacted_jobs,
        'impacted_metrics': metrics,
        'is_critical': is_critical,
        'risk_level': risk_level,
        'summary': summary,
        'details': {
            'change_type': change_request.change_type.value,
            'field_name': change_request.field_name,
            'old_value': change_request.old_value,
            'new_value': change_request.new_value
        }
    }


def create_table_metadata(
    db: Session,
    table_data: schemas.TableMetadataCreate,
    created_by: Optional[str] = None
) -> TableMetadata:
    existing = db.query(TableMetadata).filter(
        TableMetadata.database_name == table_data.database_name,
        TableMetadata.schema_name == table_data.schema_name,
        TableMetadata.table_name == table_data.table_name
    ).first()
    
    if existing:
        raise ValueError(f"表 {table_data.database_name}.{table_data.schema_name}.{table_data.table_name} 已存在")
    
    table = TableMetadata(
        database_name=table_data.database_name,
        schema_name=table_data.schema_name,
        table_name=table_data.table_name,
        description=table_data.description,
        current_version=1
    )
    db.add(table)
    db.flush()
    
    fields_dict = [f.model_dump() for f in table_data.fields]
    hash_value = generate_hash(fields_dict)
    
    initial_version = TableFieldVersion(
        table_id=table.id,
        version=1,
        fields=fields_dict,
        change_log={'type': 'initial', 'description': '初始版本'},
        change_reason='表创建时的初始版本',
        created_by=created_by,
        hash_value=hash_value,
        is_active=True
    )
    db.add(initial_version)
    db.flush()
    
    record_operation_history(
        db=db,
        operation_type='CREATE',
        entity_type='TableMetadata',
        entity_id=table.id,
        entity_key=f"{table_data.database_name}.{table_data.schema_name}.{table_data.table_name}",
        new_state=_serialize_model(table),
        operation_by=created_by,
        comment='创建表元数据和初始版本'
    )
    
    db.commit()
    db.refresh(table)
    return table


def create_field_change_request(
    db: Session,
    request_data: schemas.FieldChangeRequestCreate
) -> FieldChangeRequest:
    table = db.query(TableMetadata).filter(
        TableMetadata.id == request_data.table_id
    ).first()
    
    if not table:
        raise ValueError(f"表ID {request_data.table_id} 不存在")
    
    current_version = db.query(TableFieldVersion).filter(
        TableFieldVersion.table_id == request_data.table_id,
        TableFieldVersion.is_active == True
    ).first()
    
    if not current_version:
        raise ValueError(f"表 {table.database_name}.{table.schema_name}.{table.table_name} 没有激活的版本")
    
    fields_dict = {f['name']: f for f in current_version.fields}
    
    if request_data.change_type == FieldChangeType.REMOVE:
        if request_data.field_name not in fields_dict:
            raise ValueError(f"字段 {request_data.field_name} 不存在")
        old_value = fields_dict[request_data.field_name]
        new_value = None
    elif request_data.change_type == FieldChangeType.ADD:
        if request_data.field_name in fields_dict:
            raise ValueError(f"字段 {request_data.field_name} 已存在")
        old_value = None
        new_value = request_data.new_value or {}
        new_value['name'] = request_data.field_name
    elif request_data.change_type == FieldChangeType.MODIFY:
        if request_data.field_name not in fields_dict:
            raise ValueError(f"字段 {request_data.field_name} 不存在")
        old_value = fields_dict[request_data.field_name]
        new_value = request_data.new_value or {}
        new_value['name'] = request_data.field_name
    elif request_data.change_type == FieldChangeType.RENAME:
        if request_data.field_name not in fields_dict:
            raise ValueError(f"字段 {request_data.field_name} 不存在")
        if not request_data.new_value or 'new_name' not in request_data.new_value:
            raise ValueError("重命名操作需要提供 new_name")
        old_value = fields_dict[request_data.field_name]
        new_value = request_data.new_value
    else:
        raise ValueError(f"未知的变更类型: {request_data.change_type}")
    
    change_request = FieldChangeRequest(
        request_id=generate_id(),
        table_id=request_data.table_id,
        change_type=request_data.change_type,
        field_name=request_data.field_name,
        old_value=old_value,
        new_value=new_value,
        reason=request_data.reason,
        created_by=request_data.created_by,
        status=ChangeStatus.DRAFT
    )
    db.add(change_request)
    db.flush()
    
    record_operation_history(
        db=db,
        operation_type='CREATE',
        entity_type='FieldChangeRequest',
        entity_id=change_request.id,
        entity_key=change_request.request_id,
        new_state=_serialize_model(change_request),
        operation_by=request_data.created_by,
        comment=f'创建字段变更请求: {request_data.change_type.value} {request_data.field_name}'
    )
    
    db.commit()
    db.refresh(change_request)
    return change_request


def submit_for_approval(
    db: Session,
    change_request_id: int,
    comment: Optional[str] = None
) -> FieldChangeRequest:
    change_request = db.query(FieldChangeRequest).filter(
        FieldChangeRequest.id == change_request_id
    ).first()
    
    if not change_request:
        raise ValueError(f"变更请求 {change_request_id} 不存在")
    
    if change_request.status != ChangeStatus.DRAFT:
        raise ValueError(f"只有 DRAFT 状态的请求才能提交审核，当前状态: {change_request.status}")
    
    change_request.status = ChangeStatus.PENDING_REVIEW
    
    impact_result = analyze_change_impact(db, change_request)
    
    analysis = ImpactAnalysis(
        change_request_id=change_request.id,
        analysis_id=generate_id(),
        analysis_type='field_change',
        impacted_tables=impact_result['impacted_tables'],
        impacted_jobs=impact_result['impacted_jobs'],
        impacted_metrics=impact_result['impacted_metrics'],
        risk_level=impact_result['risk_level'],
        summary=impact_result['summary'],
        details=impact_result['details']
    )
    db.add(analysis)
    db.flush()
    
    report = ImpactReport(
        analysis_id=analysis.id,
        report_id=generate_id(),
        report_type='impact_summary',
        content=impact_result
    )
    db.add(report)
    db.flush()
    
    record_operation_history(
        db=db,
        operation_type='SUBMIT',
        entity_type='FieldChangeRequest',
        entity_id=change_request.id,
        entity_key=change_request.request_id,
        old_state={'status': 'draft'},
        new_state={'status': 'pending_review', 'analysis_id': analysis.analysis_id},
        comment=comment or '提交字段变更审核'
    )
    
    db.commit()
    db.refresh(change_request)
    return change_request


def approve_change(
    db: Session,
    change_request_id: int,
    approved_by: str,
    comment: Optional[str] = None
) -> FieldChangeRequest:
    change_request = db.query(FieldChangeRequest).filter(
        FieldChangeRequest.id == change_request_id
    ).first()
    
    if not change_request:
        raise ValueError(f"变更请求 {change_request_id} 不存在")
    
    if change_request.status != ChangeStatus.PENDING_REVIEW:
        raise ValueError(f"只有 PENDING_REVIEW 状态的请求才能被批准，当前状态: {change_request.status}")
    
    change_request.status = ChangeStatus.APPROVED
    change_request.approved_by = approved_by
    change_request.approved_at = datetime.utcnow()
    
    subscriptions = db.query(Subscription).filter(
        Subscription.table_id == change_request.table_id,
        Subscription.is_active == True
    ).all()
    
    for sub in subscriptions:
        alert = Alert(
            alert_id=generate_id(),
            change_request_id=change_request.id,
            subscriber_id=sub.subscriber_id,
            alert_type='change_approved',
            title=f'字段变更已批准: {change_request.field_name}',
            message=f"变更请求 {change_request.request_id} 已由 {approved_by} 批准。"
                    f"变更类型: {change_request.change_type.value}, "
                    f"原因: {change_request.reason or '未提供'}",
            status=AlertStatus.PENDING
        )
        db.add(alert)
    
    record_operation_history(
        db=db,
        operation_type='APPROVE',
        entity_type='FieldChangeRequest',
        entity_id=change_request.id,
        entity_key=change_request.request_id,
        old_state={'status': 'pending_review'},
        new_state={'status': 'approved', 'approved_by': approved_by},
        operation_by=approved_by,
        comment=comment or '批准字段变更请求'
    )
    
    db.commit()
    db.refresh(change_request)
    return change_request


def apply_change(
    db: Session,
    change_request_id: int,
    applied_by: Optional[str] = None
) -> Tuple[FieldChangeRequest, TableFieldVersion]:
    change_request = db.query(FieldChangeRequest).filter(
        FieldChangeRequest.id == change_request_id
    ).first()
    
    if not change_request:
        raise ValueError(f"变更请求 {change_request_id} 不存在")
    
    if change_request.status != ChangeStatus.APPROVED:
        raise ValueError(f"只有 APPROVED 状态的请求才能应用，当前状态: {change_request.status}")
    
    table = db.query(TableMetadata).filter(
        TableMetadata.id == change_request.table_id
    ).first()
    
    current_version = db.query(TableFieldVersion).filter(
        TableFieldVersion.table_id == change_request.table_id,
        TableFieldVersion.is_active == True
    ).first()
    
    new_fields = [f.copy() for f in current_version.fields]
    
    if change_request.change_type == FieldChangeType.ADD:
        new_fields.append(change_request.new_value)
    elif change_request.change_type == FieldChangeType.REMOVE:
        new_fields = [f for f in new_fields if f['name'] != change_request.field_name]
    elif change_request.change_type == FieldChangeType.MODIFY:
        for i, f in enumerate(new_fields):
            if f['name'] == change_request.field_name:
                new_fields[i] = change_request.new_value
                break
    elif change_request.change_type == FieldChangeType.RENAME:
        for f in new_fields:
            if f['name'] == change_request.field_name:
                f['name'] = change_request.new_value.get('new_name', f['name'])
                break
    
    current_version.is_active = False
    
    new_version_number = table.current_version + 1
    new_hash = generate_hash(new_fields)
    
    new_version = TableFieldVersion(
        table_id=table.id,
        version=new_version_number,
        fields=new_fields,
        change_log={
            'change_request_id': change_request.request_id,
            'change_type': change_request.change_type.value,
            'field_name': change_request.field_name
        },
        change_reason=change_request.reason,
        created_by=applied_by,
        hash_value=new_hash,
        is_active=True
    )
    db.add(new_version)
    db.flush()
    
    change_request.target_version_id = new_version.id
    change_request.status = ChangeStatus.APPLIED
    change_request.applied_at = datetime.utcnow()
    
    table.current_version = new_version_number
    
    record_operation_history(
        db=db,
        operation_type='APPLY',
        entity_type='FieldChangeRequest',
        entity_id=change_request.id,
        entity_key=change_request.request_id,
        old_state={'status': 'approved', 'current_version': table.current_version - 1},
        new_state={'status': 'applied', 'new_version': new_version_number},
        operation_by=applied_by,
        comment=f'应用字段变更，版本从 {table.current_version - 1} 升级到 {new_version_number}'
    )
    
    db.commit()
    db.refresh(change_request)
    db.refresh(new_version)
    return change_request, new_version


def rollback_change(
    db: Session,
    change_request_id: int,
    rollback_reason: str,
    rolled_back_by: str
) -> Tuple[FieldChangeRequest, TableFieldVersion]:
    change_request = db.query(FieldChangeRequest).filter(
        FieldChangeRequest.id == change_request_id
    ).first()
    
    if not change_request:
        raise ValueError(f"变更请求 {change_request_id} 不存在")
    
    if change_request.status != ChangeStatus.APPLIED:
        raise ValueError(f"只有 APPLIED 状态的请求才能回滚，当前状态: {change_request.status}")
    
    table = db.query(TableMetadata).filter(
        TableMetadata.id == change_request.table_id
    ).first()
    
    current_version = db.query(TableFieldVersion).filter(
        TableFieldVersion.table_id == change_request.table_id,
        TableFieldVersion.is_active == True
    ).first()
    
    if current_version.id != change_request.target_version_id:
        raise ValueError("当前激活版本不是该变更创建的版本，无法回滚")
    
    previous_version = db.query(TableFieldVersion).filter(
        TableFieldVersion.table_id == change_request.table_id,
        TableFieldVersion.version == current_version.version - 1
    ).first()
    
    if not previous_version:
        raise ValueError("没有找到前一个版本，无法回滚")
    
    current_version.is_active = False
    previous_version.is_active = True
    
    change_request.status = ChangeStatus.ROLLED_BACK
    change_request.rollback_reason = rollback_reason
    change_request.rollback_by = rolled_back_by
    change_request.rollback_at = datetime.utcnow()
    
    table.current_version = previous_version.version
    
    record_operation_history(
        db=db,
        operation_type='ROLLBACK',
        entity_type='FieldChangeRequest',
        entity_id=change_request.id,
        entity_key=change_request.request_id,
        old_state={'status': 'applied', 'current_version': current_version.version},
        new_state={'status': 'rolled_back', 'restored_version': previous_version.version},
        operation_by=rolled_back_by,
        comment=f"回滚字段变更: {rollback_reason}"
    )
    
    db.commit()
    db.refresh(change_request)
    db.refresh(previous_version)
    return change_request, previous_version


def create_subscription(
    db: Session,
    subscription_data: schemas.SubscriptionCreate
) -> Subscription:
    table = db.query(TableMetadata).filter(
        TableMetadata.id == subscription_data.table_id
    ).first()
    
    if not table:
        raise ValueError(f"表ID {subscription_data.table_id} 不存在")
    
    existing = db.query(Subscription).filter(
        Subscription.table_id == subscription_data.table_id,
        Subscription.subscriber_id == subscription_data.subscriber_id
    ).first()
    
    if existing:
        existing.is_active = True
        existing.subscriber_name = subscription_data.subscriber_name
        existing.subscriber_email = subscription_data.subscriber_email
        existing.notification_channel = subscription_data.notification_channel
        db.commit()
        db.refresh(existing)
        return existing
    
    subscription = Subscription(
        table_id=subscription_data.table_id,
        subscriber_id=subscription_data.subscriber_id,
        subscriber_name=subscription_data.subscriber_name,
        subscriber_email=subscription_data.subscriber_email,
        notification_channel=subscription_data.notification_channel
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def create_lineage_edge(
    db: Session,
    edge_data: schemas.LineageEdgeCreate
) -> LineageEdge:
    source_table = db.query(TableMetadata).filter(
        TableMetadata.id == edge_data.source_table_id
    ).first()
    
    target_table = db.query(TableMetadata).filter(
        TableMetadata.id == edge_data.target_table_id
    ).first()
    
    if not source_table or not target_table:
        raise ValueError("源表或目标表不存在")
    
    edge = LineageEdge(
        source_table_id=edge_data.source_table_id,
        source_field_name=edge_data.source_field_name,
        target_table_id=edge_data.target_table_id,
        target_field_name=edge_data.target_field_name,
        transformation_logic=edge_data.transformation_logic,
        job_id=edge_data.job_id,
        job_name=edge_data.job_name
    )
    db.add(edge)
    db.commit()
    db.refresh(edge)
    return edge


def compare_versions(
    db: Session,
    table_id: int,
    version1: int,
    version2: int
) -> schemas.VersionCompareResponse:
    v1 = db.query(TableFieldVersion).filter(
        TableFieldVersion.table_id == table_id,
        TableFieldVersion.version == version1
    ).first()
    
    v2 = db.query(TableFieldVersion).filter(
        TableFieldVersion.table_id == table_id,
        TableFieldVersion.version == version2
    ).first()
    
    if not v1 or not v2:
        raise ValueError("指定的版本不存在")
    
    diff = compare_field_definitions(v1.fields, v2.fields)
    
    return schemas.VersionCompareResponse(
        table_id=table_id,
        version1=version1,
        version2=version2,
        added_fields=diff['added_fields'],
        removed_fields=diff['removed_fields'],
        modified_fields=diff['modified_fields'],
        unchanged_fields=diff['unchanged_fields']
    )
