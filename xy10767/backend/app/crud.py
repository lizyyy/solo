from sqlalchemy.orm import Session
from datetime import datetime
from . import models, schemas


def get_dataset(db: Session, dataset_id: int):
    return db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()


def get_datasets(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Dataset).offset(skip).limit(limit).all()


def create_dataset(db: Session, dataset: schemas.DatasetCreate):
    db_dataset = models.Dataset(**dataset.model_dump())
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    return db_dataset


def create_upstream_task(db: Session, task: schemas.UpstreamTaskCreate):
    db_task = models.UpstreamTask(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_upstream_tasks(db: Session, dataset_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.UpstreamTask)
    if dataset_id:
        query = query.filter(models.UpstreamTask.dataset_id == dataset_id)
    return query.offset(skip).limit(limit).all()


def create_downstream_report(db: Session, report: schemas.DownstreamReportCreate):
    db_report = models.DownstreamReport(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_downstream_reports(db: Session, dataset_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.DownstreamReport)
    if dataset_id:
        query = query.filter(models.DownstreamReport.dataset_id == dataset_id)
    return query.offset(skip).limit(limit).all()


def create_field_mapping(db: Session, mapping: schemas.FieldMappingCreate):
    db_mapping = models.FieldMapping(**mapping.model_dump())
    db.add(db_mapping)
    db.commit()
    db.refresh(db_mapping)
    return db_mapping


def get_field_mappings(db: Session, dataset_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.FieldMapping)
    if dataset_id:
        query = query.filter(models.FieldMapping.dataset_id == dataset_id)
    return query.offset(skip).limit(limit).all()


def manual_correct_field_mapping(
    db: Session, 
    mapping_id: int, 
    correction: schemas.FieldMappingManualCorrection
):
    db_mapping = db.query(models.FieldMapping).filter(models.FieldMapping.id == mapping_id).first()
    if db_mapping:
        if correction.mapping_rule:
            db_mapping.mapping_rule = correction.mapping_rule
        if correction.transformation_logic:
            db_mapping.transformation_logic = correction.transformation_logic
        db_mapping.is_manual_correction = True
        db_mapping.corrected_by = correction.corrected_by
        db_mapping.corrected_at = datetime.utcnow()
        db_mapping.correction_reason = correction.correction_reason
        db_mapping.status = "corrected"
        db.commit()
        db.refresh(db_mapping)
    return db_mapping


def create_change_impact(db: Session, impact: schemas.ChangeImpactCreate):
    db_impact = models.ChangeImpact(**impact.model_dump())
    db.add(db_impact)
    db.commit()
    db.refresh(db_impact)
    return db_impact


def get_change_impacts(db: Session, dataset_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ChangeImpact)
    if dataset_id:
        query = query.filter(models.ChangeImpact.dataset_id == dataset_id)
    return query.offset(skip).limit(limit).all()


def create_lineage_graph(db: Session, graph: schemas.LineageGraphCreate):
    db_graph = models.LineageGraph(**graph.model_dump())
    db.add(db_graph)
    db.commit()
    db.refresh(db_graph)
    return db_graph


def get_lineage_graph(db: Session, dataset_id: int):
    return db.query(models.LineageGraph).filter(models.LineageGraph.dataset_id == dataset_id).first()


def get_failed_items(db: Session, skip: int = 0, limit: int = 100):
    failed_tasks = db.query(models.UpstreamTask).filter(models.UpstreamTask.is_failed == True).all()
    failed_impacts = db.query(models.ChangeImpact).filter(models.ChangeImpact.is_failed == True).all()
    invalid_mappings = db.query(models.FieldMapping).filter(models.FieldMapping.status == "invalid").all()
    
    result = []
    for task in failed_tasks:
        dataset = db.query(models.Dataset).filter(models.Dataset.id == task.dataset_id).first()
        result.append(schemas.FailedItemDetail(
            id=task.id,
            type="upstream_task",
            name=task.name,
            status=task.status,
            handler=task.handler,
            handled_at=task.handled_at,
            handle_reason=task.handle_reason,
            created_at=task.created_at,
            dataset_name=dataset.name if dataset else None
        ))
    
    for impact in failed_impacts:
        dataset = db.query(models.Dataset).filter(models.Dataset.id == impact.dataset_id).first()
        result.append(schemas.FailedItemDetail(
            id=impact.id,
            type="change_impact",
            name=impact.change_type,
            status=impact.status,
            handler=impact.handler,
            handled_at=impact.handled_at,
            handle_reason=impact.handle_reason,
            created_at=impact.created_at,
            dataset_name=dataset.name if dataset else None
        ))
    
    for mapping in invalid_mappings:
        dataset = db.query(models.Dataset).filter(models.Dataset.id == mapping.dataset_id).first()
        result.append(schemas.FailedItemDetail(
            id=mapping.id,
            type="field_mapping",
            name=f"{mapping.source_field} -> {mapping.target_field}",
            status=mapping.status,
            handler=mapping.corrected_by,
            handled_at=mapping.corrected_at,
            handle_reason=mapping.error_message,
            created_at=mapping.created_at,
            dataset_name=dataset.name if dataset else None
        ))
    
    return result[skip:skip+limit]


def recalculate_lineage_graph(db: Session, dataset_id: int):
    dataset = get_dataset(db, dataset_id)
    if not dataset:
        return None
    
    tasks = get_upstream_tasks(db, dataset_id)
    reports = get_downstream_reports(db, dataset_id)
    mappings = get_field_mappings(db, dataset_id)
    
    nodes = []
    edges = []
    
    nodes.append({
        "id": f"dataset_{dataset_id}",
        "label": dataset.name,
        "type": "dataset",
        "data": {"owner": dataset.owner, "status": dataset.status}
    })
    
    for task in tasks:
        node_id = f"task_{task.id}"
        nodes.append({
            "id": node_id,
            "label": task.name,
            "type": "upstream_task",
            "data": {"status": task.status, "source_system": task.source_system}
        })
        edges.append({
            "source": node_id,
            "target": f"dataset_{dataset_id}",
            "label": "produces"
        })
    
    for report in reports:
        node_id = f"report_{report.id}"
        nodes.append({
            "id": node_id,
            "label": report.name,
            "type": "downstream_report",
            "data": {"status": report.status, "type": report.report_type}
        })
        edges.append({
            "source": f"dataset_{dataset_id}",
            "target": node_id,
            "label": "feeds"
        })
    
    for mapping in mappings:
        node_id = f"mapping_{mapping.id}"
        nodes.append({
            "id": node_id,
            "label": f"{mapping.source_field}->{mapping.target_field}",
            "type": "field_mapping",
            "data": {"status": mapping.status, "is_manual": mapping.is_manual_correction}
        })
        edges.append({
            "source": f"dataset_{dataset_id}",
            "target": node_id,
            "label": "contains"
        })
    
    graph_data = {"nodes": nodes, "edges": edges}
    
    existing_graph = get_lineage_graph(db, dataset_id)
    if existing_graph:
        existing_graph.nodes = nodes
        existing_graph.edges = edges
        existing_graph.graph_data = graph_data
        existing_graph.calculated_at = datetime.utcnow()
        existing_graph.version += 1
        db.commit()
        db.refresh(existing_graph)
        return existing_graph
    else:
        return create_lineage_graph(db, schemas.LineageGraphCreate(
            dataset_id=dataset_id,
            nodes=nodes,
            edges=edges,
            graph_data=graph_data
        ))


def handle_upstream_task_change(db: Session, task_id: int, handler: str, reason: str, is_failed: bool = True):
    task = db.query(models.UpstreamTask).filter(models.UpstreamTask.id == task_id).first()
    if task:
        task.handler = handler
        task.handled_at = datetime.utcnow()
        task.handle_reason = reason
        task.is_failed = is_failed
        task.status = "failed" if is_failed else "resolved"
        db.commit()
        db.refresh(task)
        
        recalculate_lineage_graph(db, task.dataset_id)
    return task


def create_demo_data(db: Session):
    dataset = create_dataset(db, schemas.DatasetCreate(
        name="用户行为数据集",
        description="包含用户点击、浏览、购买等行为数据",
        owner="数据平台团队"
    ))
    
    create_upstream_task(db, schemas.UpstreamTaskCreate(
        dataset_id=dataset.id,
        name="点击流采集任务",
        task_type="ETL",
        source_system="APP前端埋点",
        schedule="每小时"
    ))
    
    task2 = create_upstream_task(db, schemas.UpstreamTaskCreate(
        dataset_id=dataset.id,
        name="用户行为清洗任务",
        task_type="数据清洗",
        source_system="数据湖",
        schedule="每天"
    ))
    
    handle_upstream_task_change(db, task2.id, "张三", "字段格式不匹配", True)
    
    create_downstream_report(db, schemas.DownstreamReportCreate(
        dataset_id=dataset.id,
        name="用户活跃日报",
        report_type="日报",
        target_audience="运营团队",
        refresh_frequency="每天"
    ))
    
    create_downstream_report(db, schemas.DownstreamReportCreate(
        dataset_id=dataset.id,
        name="转化漏斗分析",
        report_type="分析报告",
        target_audience="产品团队",
        refresh_frequency="每周"
    ))
    
    mapping1 = create_field_mapping(db, schemas.FieldMappingCreate(
        dataset_id=dataset.id,
        source_field="user_id",
        target_field="uid",
        mapping_rule="直接映射",
        transformation_logic="无"
    ))
    
    mapping2 = create_field_mapping(db, schemas.FieldMappingCreate(
        dataset_id=dataset.id,
        source_field="event_time",
        target_field="timestamp",
        mapping_rule="格式转换",
        transformation_logic="字符串转时间戳"
    ))
    mapping2.status = "invalid"
    mapping2.error_message = "时间格式转换失败：无法解析 '2024/13/01'"
    db.commit()
    
    impact = create_change_impact(db, schemas.ChangeImpactCreate(
        dataset_id=dataset.id,
        change_type="字段类型变更",
        change_description="user_id 从字符串改为整数",
        impacted_fields=["user_id", "uid"],
        impacted_reports=["用户活跃日报"],
        severity="high"
    ))
    
    impact.handler = "李四"
    impact.handled_at = datetime.utcnow()
    impact.handle_reason = "影响范围评估不完整"
    impact.is_failed = True
    impact.status = "failed"
    db.commit()
    
    recalculate_lineage_graph(db, dataset.id)
    
    return dataset
