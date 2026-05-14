from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.app.core.database import get_db
from backend.app.schemas.component import (
    Component, ComponentCreate, ComponentUpdate,
    ComponentSchema, ComponentSchemaCreate,
    PropertyPanel, PropertyPanelCreate, PropertyPanelUpdate,
    ComponentVersion, ComponentVersionCreate,
    DependencyCheck, DependencyCheckCreate,
    ExamplePreview, ExamplePreviewCreate,
    CompatibilityReport, CompatibilityReportCreate, CompatibilityReportManualUpdate,
    ProcessingChain, ProcessingChainCreate,
    ChainTraceResponse, ExportRequest
)
from backend.app.services import component_service

router = APIRouter(prefix="/components", tags=["components"])


@router.get("/", response_model=List[Component])
def read_components(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    return component_service.get_components(db, skip=skip, limit=limit)


@router.get("/{component_id}", response_model=Component)
def read_component(component_id: int, db: Session = Depends(get_db)):
    db_component = component_service.get_component(db, component_id)
    if db_component is None:
        raise HTTPException(status_code=404, detail="Component not found")
    return db_component


@router.post("/", response_model=Component, status_code=201)
def create_component(component: ComponentCreate, db: Session = Depends(get_db)):
    return component_service.create_component(db, component)


@router.put("/{component_id}", response_model=Component)
def update_component(
    component_id: int,
    component: ComponentUpdate,
    db: Session = Depends(get_db)
):
    db_component = component_service.update_component(db, component_id, component)
    if db_component is None:
        raise HTTPException(status_code=404, detail="Component not found")
    return db_component


@router.delete("/{component_id}", status_code=204)
def delete_component(component_id: int, db: Session = Depends(get_db)):
    success = component_service.delete_component(db, component_id)
    if not success:
        raise HTTPException(status_code=404, detail="Component not found")
    return None


@router.get("/{component_id}/schemas", response_model=List[ComponentSchema])
def read_component_schemas(component_id: int, db: Session = Depends(get_db)):
    return component_service.get_component_schemas(db, component_id)


@router.post("/{component_id}/schemas", response_model=ComponentSchema, status_code=201)
def create_component_schema(
    component_id: int,
    schema: ComponentSchemaCreate,
    db: Session = Depends(get_db)
):
    schema.component_id = component_id
    return component_service.create_component_schema(db, schema)


@router.get("/{component_id}/property-panels", response_model=List[PropertyPanel])
def read_property_panels(component_id: int, db: Session = Depends(get_db)):
    return component_service.get_property_panels(db, component_id)


@router.post("/{component_id}/property-panels", response_model=PropertyPanel, status_code=201)
def create_property_panel(
    component_id: int,
    panel: PropertyPanelCreate,
    db: Session = Depends(get_db)
):
    panel.component_id = component_id
    return component_service.create_property_panel(db, panel)


@router.put("/property-panels/{panel_id}", response_model=PropertyPanel)
def update_property_panel(
    panel_id: int,
    panel: PropertyPanelUpdate,
    db: Session = Depends(get_db)
):
    db_panel = component_service.update_property_panel(db, panel_id, panel)
    if db_panel is None:
        raise HTTPException(status_code=404, detail="Property panel not found")
    return db_panel


@router.get("/{component_id}/versions", response_model=List[ComponentVersion])
def read_component_versions(component_id: int, db: Session = Depends(get_db)):
    return component_service.get_component_versions(db, component_id)


@router.post("/{component_id}/versions", response_model=ComponentVersion, status_code=201)
def create_component_version(
    component_id: int,
    version: ComponentVersionCreate,
    db: Session = Depends(get_db)
):
    version.component_id = component_id
    return component_service.create_component_version(db, version)


@router.get("/{component_id}/dependency-checks", response_model=List[DependencyCheck])
def read_dependency_checks(component_id: int, db: Session = Depends(get_db)):
    return component_service.get_dependency_checks(db, component_id)


@router.post("/{component_id}/dependency-checks", response_model=DependencyCheck, status_code=201)
def create_dependency_check(
    component_id: int,
    check: DependencyCheckCreate,
    db: Session = Depends(get_db)
):
    check.component_id = component_id
    return component_service.create_dependency_check(db, check)


@router.get("/{component_id}/example-previews", response_model=List[ExamplePreview])
def read_example_previews(component_id: int, db: Session = Depends(get_db)):
    return component_service.get_example_previews(db, component_id)


@router.post("/{component_id}/example-previews", response_model=ExamplePreview, status_code=201)
def create_example_preview(
    component_id: int,
    preview: ExamplePreviewCreate,
    db: Session = Depends(get_db)
):
    preview.component_id = component_id
    return component_service.create_example_preview(db, preview)


@router.get("/{component_id}/compatibility-reports", response_model=List[CompatibilityReport])
def read_compatibility_reports(component_id: int, db: Session = Depends(get_db)):
    return component_service.get_compatibility_reports(db, component_id)


@router.post("/{component_id}/compatibility-reports", response_model=CompatibilityReport, status_code=201)
def create_compatibility_report(
    component_id: int,
    report: CompatibilityReportCreate,
    db: Session = Depends(get_db)
):
    report.component_id = component_id
    return component_service.create_compatibility_report(db, report)


@router.put("/compatibility-reports/{report_id}/manual", response_model=CompatibilityReport)
def manual_update_compatibility_report(
    report_id: int,
    update: CompatibilityReportManualUpdate,
    db: Session = Depends(get_db)
):
    db_report = component_service.manual_update_compatibility_report(
        db, report_id, update, user="admin"
    )
    if db_report is None:
        raise HTTPException(status_code=404, detail="Compatibility report not found")
    return db_report


@router.get("/{component_id}/processing-chains", response_model=List[ProcessingChain])
def read_processing_chains(component_id: int, db: Session = Depends(get_db)):
    return component_service.get_processing_chains(db, component_id)


@router.post("/{component_id}/processing-chains", response_model=ProcessingChain, status_code=201)
def create_processing_chain(
    component_id: int,
    chain: ProcessingChainCreate,
    db: Session = Depends(get_db)
):
    chain.component_id = component_id
    return component_service.create_processing_chain(db, chain)


@router.post("/processing-chains/{chain_id}/replay", response_model=ProcessingChain)
def replay_processing_chain(
    chain_id: str,
    action_hash: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_chain = component_service.replay_processing_chain(db, chain_id, action_hash)
    if db_chain is None:
        raise HTTPException(status_code=404, detail="Processing chain not found")
    return db_chain


@router.get("/processing-chains/{chain_id}/trace", response_model=ChainTraceResponse)
def get_chain_trace(chain_id: str, db: Session = Depends(get_db)):
    trace_data = component_service.get_chain_trace(db, chain_id)
    if trace_data is None:
        raise HTTPException(status_code=404, detail="Processing chain not found")
    return trace_data


@router.post("/export")
def export_components(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    return component_service.export_components_data(db, export_request)
