from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
import uuid
import hashlib
from datetime import datetime
import json

from backend.app.models.component import (
    Component, ComponentSchema, PropertyPanel, ComponentVersion,
    DependencyCheck, ExamplePreview, CompatibilityReport, ProcessingChain
)
from backend.app.schemas.component import (
    ComponentCreate, ComponentUpdate, ComponentSchemaCreate,
    PropertyPanelCreate, PropertyPanelUpdate, ComponentVersionCreate,
    DependencyCheckCreate, DependencyCheckUpdate, ExamplePreviewCreate,
    ExamplePreviewUpdate, CompatibilityReportCreate, CompatibilityReportManualUpdate,
    ProcessingChainCreate, ProcessingChainUpdate, ProcessingChainStep, ExportRequest
)


def generate_action_hash(component_id: int, version: str, action: str) -> str:
    data = f"{component_id}:{version}:{action}:{datetime.utcnow().timestamp()}"
    return hashlib.sha256(data.encode()).hexdigest()


def get_component(db: Session, component_id: int) -> Optional[Component]:
    return db.query(Component).filter(Component.id == component_id).first()


def get_components(db: Session, skip: int = 0, limit: int = 100) -> List[Component]:
    return db.query(Component).order_by(desc(Component.created_at)).offset(skip).limit(limit).all()


def create_component(db: Session, component: ComponentCreate) -> Component:
    db_component = Component(**component.model_dump())
    db.add(db_component)
    db.commit()
    db.refresh(db_component)
    return db_component


def update_component(db: Session, component_id: int, component: ComponentUpdate) -> Optional[Component]:
    db_component = get_component(db, component_id)
    if db_component:
        for key, value in component.model_dump(exclude_unset=True).items():
            setattr(db_component, key, value)
        db.commit()
        db.refresh(db_component)
    return db_component


def delete_component(db: Session, component_id: int) -> bool:
    db_component = get_component(db, component_id)
    if db_component:
        db.delete(db_component)
        db.commit()
        return True
    return False


def create_component_schema(db: Session, schema: ComponentSchemaCreate) -> ComponentSchema:
    db_schema = ComponentSchema(**schema.model_dump())
    db.add(db_schema)
    db.commit()
    db.refresh(db_schema)
    return db_schema


def get_component_schemas(db: Session, component_id: int) -> List[ComponentSchema]:
    return db.query(ComponentSchema).filter(ComponentSchema.component_id == component_id).order_by(desc(ComponentSchema.created_at)).all()


def create_property_panel(db: Session, panel: PropertyPanelCreate) -> PropertyPanel:
    db_panel = PropertyPanel(**panel.model_dump())
    db.add(db_panel)
    db.commit()
    db.refresh(db_panel)
    return db_panel


def update_property_panel(db: Session, panel_id: int, panel: PropertyPanelUpdate) -> Optional[PropertyPanel]:
    db_panel = db.query(PropertyPanel).filter(PropertyPanel.id == panel_id).first()
    if db_panel:
        db_panel.panel_config = panel.panel_config
        db_panel.version += 1
        db.commit()
        db.refresh(db_panel)
        trigger_recalculation(db, db_panel.component_id, db_panel.schema_version, db_panel.version)
    return db_panel


def get_property_panels(db: Session, component_id: int) -> List[PropertyPanel]:
    return db.query(PropertyPanel).filter(PropertyPanel.component_id == component_id).order_by(desc(PropertyPanel.version)).all()


def create_component_version(db: Session, version: ComponentVersionCreate) -> ComponentVersion:
    db_version = ComponentVersion(**version.model_dump())
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version


def get_component_versions(db: Session, component_id: int) -> List[ComponentVersion]:
    return db.query(ComponentVersion).filter(ComponentVersion.component_id == component_id).order_by(desc(ComponentVersion.created_at)).all()


def create_dependency_check(db: Session, check: DependencyCheckCreate) -> DependencyCheck:
    existing = db.query(DependencyCheck).filter(
        DependencyCheck.component_id == check.component_id,
        DependencyCheck.version == check.version,
        DependencyCheck.property_panel_version == check.property_panel_version
    ).first()
    
    if existing and existing.status in ["running", "completed"]:
        return existing
    
    check_id = f"dep-{uuid.uuid4().hex[:8]}"
    db_check = DependencyCheck(
        **check.model_dump(),
        check_id=check_id,
        status="running",
        started_at=datetime.utcnow()
    )
    db.add(db_check)
    db.commit()
    db.refresh(db_check)
    
    simulate_dependency_check(db, db_check)
    return db_check


def simulate_dependency_check(db: Session, check: DependencyCheck):
    try:
        check.dependencies = {"libraries": ["vue", "axios", "lodash"], "versions": {"vue": "3.3.0"}}
        check.warnings = ["Minor version mismatch in lodash"]
        check.status = "completed"
        check.completed_at = datetime.utcnow()
    except Exception as e:
        check.errors = [str(e)]
        check.status = "failed"
        check.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(check)


def get_dependency_checks(db: Session, component_id: int) -> List[DependencyCheck]:
    return db.query(DependencyCheck).filter(DependencyCheck.component_id == component_id).order_by(desc(DependencyCheck.started_at)).all()


def create_example_preview(db: Session, preview: ExamplePreviewCreate) -> ExamplePreview:
    existing = db.query(ExamplePreview).filter(
        ExamplePreview.component_id == preview.component_id,
        ExamplePreview.version == preview.version,
        ExamplePreview.property_panel_version == preview.property_panel_version
    ).first()
    
    if existing and existing.status in ["running", "completed"]:
        return existing
    
    preview_id = f"prev-{uuid.uuid4().hex[:8]}"
    db_preview = ExamplePreview(
        **preview.model_dump(),
        preview_id=preview_id,
        status="running",
        started_at=datetime.utcnow()
    )
    db.add(db_preview)
    db.commit()
    db.refresh(db_preview)
    
    simulate_example_preview(db, db_preview)
    return db_preview


def simulate_example_preview(db: Session, preview: ExamplePreview):
    try:
        preview.preview_data = {
            "rendered": True,
            "screenshot": "base64_encoded_image",
            "metrics": {"load_time": 120, "memory_usage": 45}
        }
        preview.status = "completed"
        preview.completed_at = datetime.utcnow()
    except Exception as e:
        preview.errors = [str(e)]
        preview.status = "failed"
        preview.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(preview)


def get_example_previews(db: Session, component_id: int) -> List[ExamplePreview]:
    return db.query(ExamplePreview).filter(ExamplePreview.component_id == component_id).order_by(desc(ExamplePreview.started_at)).all()


def create_compatibility_report(db: Session, report: CompatibilityReportCreate) -> CompatibilityReport:
    existing = db.query(CompatibilityReport).filter(
        CompatibilityReport.component_id == report.component_id,
        CompatibilityReport.version == report.version,
        CompatibilityReport.property_panel_version == report.property_panel_version
    ).first()
    
    if existing:
        return existing
    
    db_report = CompatibilityReport(**report.model_dump(), status="generating")
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    generate_compatibility_report(db, db_report)
    return db_report


def generate_compatibility_report(db: Session, report: CompatibilityReport):
    dep_check = db.query(DependencyCheck).filter(
        DependencyCheck.component_id == report.component_id,
        DependencyCheck.version == report.version,
        DependencyCheck.property_panel_version == report.property_panel_version
    ).first()
    
    example_prev = db.query(ExamplePreview).filter(
        ExamplePreview.component_id == report.component_id,
        ExamplePreview.version == report.version,
        ExamplePreview.property_panel_version == report.property_panel_version
    ).first()
    
    if dep_check:
        report.dependency_check_id = dep_check.id
    if example_prev:
        report.example_preview_id = example_prev.id
    
    report.report_content = {
        "overall_score": 85,
        "dependency_check": {"passed": dep_check.status == "completed" if dep_check else False},
        "example_preview": {"passed": example_prev.status == "completed" if example_prev else False},
        "issues": []
    }
    report.status = "completed"
    db.commit()
    db.refresh(report)


def manual_update_compatibility_report(
    db: Session, report_id: int, update: CompatibilityReportManualUpdate, user: str
) -> Optional[CompatibilityReport]:
    db_report = db.query(CompatibilityReport).filter(CompatibilityReport.id == report_id).first()
    if db_report:
        db_report.manual_override = update.manual_override
        db_report.override_notes = update.override_notes
        db_report.override_by = user
        if update.report_content:
            db_report.report_content = update.report_content
        if update.status:
            db_report.status = update.status
        db.commit()
        db.refresh(db_report)
    return db_report


def get_compatibility_reports(db: Session, component_id: int) -> List[CompatibilityReport]:
    return db.query(CompatibilityReport).filter(CompatibilityReport.component_id == component_id).order_by(desc(CompatibilityReport.created_at)).all()


def create_processing_chain(db: Session, chain_data: ProcessingChainCreate) -> ProcessingChain:
    existing = db.query(ProcessingChain).filter(
        ProcessingChain.component_id == chain_data.component_id,
        ProcessingChain.version == chain_data.version
    ).first()
    
    if existing:
        return existing
    
    steps = [
        ProcessingChainStep(name="schema_validation", status="pending"),
        ProcessingChainStep(name="property_panel_processing", status="pending"),
        ProcessingChainStep(name="dependency_check", status="pending"),
        ProcessingChainStep(name="example_preview", status="pending"),
        ProcessingChainStep(name="compatibility_report", status="pending")
    ]
    
    db_chain = ProcessingChain(
        **chain_data.model_dump(),
        status="idle",
        steps=[step.model_dump() for step in steps],
        current_step_index=0
    )
    db.add(db_chain)
    db.commit()
    db.refresh(db_chain)
    return db_chain


def replay_processing_chain(db: Session, chain_id: str, action_hash: Optional[str] = None) -> Optional[ProcessingChain]:
    db_chain = db.query(ProcessingChain).filter(ProcessingChain.chain_id == chain_id).first()
    if not db_chain:
        return None
    
    if action_hash and db_chain.last_action_hash == action_hash:
        return db_chain
    
    new_hash = generate_action_hash(db_chain.component_id, db_chain.version, "replay")
    db_chain.status = "running"
    db_chain.current_step_index = 0
    db_chain.last_action_hash = new_hash
    
    steps = []
    for step in ["schema_validation", "property_panel_processing", "dependency_check", "example_preview", "compatibility_report"]:
        steps.append(ProcessingChainStep(name=step, status="pending").model_dump())
    db_chain.steps = steps
    db.commit()
    db.refresh(db_chain)
    
    simulate_chain_execution(db, db_chain)
    return db_chain


def simulate_chain_execution(db: Session, chain: ProcessingChain):
    from datetime import timedelta
    
    steps = chain.steps if chain.steps else []
    for i, step in enumerate(steps):
        chain.current_step_index = i
        chain.current_step = step["name"]
        step["status"] = "running"
        step["started_at"] = datetime.utcnow()
        chain.steps = steps
        db.commit()
        
        step["status"] = "completed"
        step["completed_at"] = datetime.utcnow()
        step["result"] = {"success": True}
    
    chain.status = "completed"
    chain.current_step = None
    chain.current_step_index = len(steps)
    db.commit()
    db.refresh(chain)


def get_processing_chains(db: Session, component_id: int) -> List[ProcessingChain]:
    return db.query(ProcessingChain).filter(ProcessingChain.component_id == component_id).order_by(desc(ProcessingChain.created_at)).all()


def get_chain_trace(db: Session, chain_id: str) -> Optional[Dict[str, Any]]:
    chain = db.query(ProcessingChain).filter(ProcessingChain.chain_id == chain_id).first()
    if not chain:
        return None
    
    component = get_component(db, chain.component_id)
    schema = db.query(ComponentSchema).filter(
        ComponentSchema.component_id == chain.component_id,
        ComponentSchema.version == chain.version
    ).first()
    property_panel = db.query(PropertyPanel).filter(
        PropertyPanel.component_id == chain.component_id,
        PropertyPanel.schema_version == chain.version,
        PropertyPanel.version == chain.property_panel_version
    ).first()
    dependency_check = db.query(DependencyCheck).filter(
        DependencyCheck.component_id == chain.component_id,
        DependencyCheck.version == chain.version,
        DependencyCheck.property_panel_version == chain.property_panel_version
    ).first()
    example_preview = db.query(ExamplePreview).filter(
        ExamplePreview.component_id == chain.component_id,
        ExamplePreview.version == chain.version,
        ExamplePreview.property_panel_version == chain.property_panel_version
    ).first()
    compatibility_report = db.query(CompatibilityReport).filter(
        CompatibilityReport.component_id == chain.component_id,
        CompatibilityReport.version == chain.version,
        CompatibilityReport.property_panel_version == chain.property_panel_version
    ).first()
    
    return {
        "chain": chain,
        "component": component,
        "schema": schema,
        "property_panel": property_panel,
        "dependency_check": dependency_check,
        "example_preview": example_preview,
        "compatibility_report": compatibility_report
    }


def trigger_recalculation(db: Session, component_id: int, version: str, property_panel_version: int):
    chain = db.query(ProcessingChain).filter(
        ProcessingChain.component_id == component_id,
        ProcessingChain.version == version
    ).first()
    
    if chain:
        chain.property_panel_version = property_panel_version
        db.commit()
        replay_processing_chain(db, chain.chain_id)


def export_components_data(db: Session, export_request: ExportRequest) -> Dict[str, Any]:
    query = db.query(Component)
    if export_request.component_ids:
        query = query.filter(Component.id.in_(export_request.component_ids))
    
    components = query.all()
    export_data = {"exported_at": datetime.utcnow().isoformat(), "components": []}
    
    for comp in components:
        version_filter = {"version": export_request.version} if export_request.version else {}
        
        schemas = db.query(ComponentSchema).filter(ComponentSchema.component_id == comp.id, **version_filter).all()
        panels = db.query(PropertyPanel).filter(PropertyPanel.component_id == comp.id, **version_filter).all()
        versions = db.query(ComponentVersion).filter(ComponentVersion.component_id == comp.id, **version_filter).all()
        dep_checks = db.query(DependencyCheck).filter(DependencyCheck.component_id == comp.id, **version_filter).all()
        previews = db.query(ExamplePreview).filter(ExamplePreview.component_id == comp.id, **version_filter).all()
        reports = db.query(CompatibilityReport).filter(CompatibilityReport.component_id == comp.id, **version_filter).all()
        chains = db.query(ProcessingChain).filter(ProcessingChain.component_id == comp.id, **version_filter).all()
        
        export_data["components"].append({
            "component": {
                "id": comp.id, "name": comp.name, "description": comp.description,
                "type": comp.type, "current_version": comp.current_version,
                "created_at": comp.created_at.isoformat()
            },
            "schemas": [{"id": s.id, "version": s.version, "schema_content": s.schema_content, "created_at": s.created_at.isoformat()} for s in schemas],
            "property_panels": [{"id": p.id, "version": p.version, "panel_config": p.panel_config} for p in panels],
            "versions": [{"id": v.id, "version": v.version, "status": v.status} for v in versions],
            "dependency_checks": [{"id": d.id, "status": d.status, "check_id": d.check_id} for d in dep_checks],
            "example_previews": [{"id": e.id, "status": e.status, "preview_id": e.preview_id} for e in previews],
            "compatibility_reports": [{"id": r.id, "status": r.status, "manual_override": r.manual_override} for r in reports],
            "processing_chains": [{"id": c.id, "chain_id": c.chain_id, "status": c.status} for c in chains]
        })
    
    return export_data
