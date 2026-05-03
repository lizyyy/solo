from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from config import SessionLocal, get_db, OperationStatus
from models.schemas import ImportResponse, TopologyCreate, ApprovalTicketCreate
from storage.repository import RepositoryFactory
from state_machine.state_machine import OperationStateMachine, StateEventType
from parsers.excel_parser import ExcelParser
from parsers.csv_parser import CSVParser
from parsers.json_parser import JSONParser
from parsers.yaml_parser import YAMLParser

router = APIRouter(
    prefix="/api/import",
    tags=["import"],
    responses={404: {"description": "Not found"}}
)


def get_parser_for_file(filename: str):
    lower_filename = filename.lower()
    if lower_filename.endswith(".xlsx") or lower_filename.endswith(".xls"):
        return ExcelParser()
    elif lower_filename.endswith(".csv"):
        return CSVParser()
    elif lower_filename.endswith(".json"):
        return JSONParser()
    elif lower_filename.endswith(".yaml") or lower_filename.endswith(".yml"):
        return YAMLParser()
    else:
        raise ValueError(f"不支持的文件格式: {filename}")


@router.post("/settings", response_model=ImportResponse)
async def import_settings(
    file: UploadFile = File(...),
    bay_id: str = Form(...),
    bay_name: str = Form(...),
    version: str = Form(...),
    operation_id: Optional[int] = Form(None),
    is_target: bool = Form(False),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    try:
        content = await file.read()
        parser = get_parser_for_file(file.filename or "")
        
        settings_data = parser.parse_settings(
            file_content=content,
            filename=file.filename or "",
            bay_id=bay_id,
            bay_name=bay_name,
            version=version
        )
        
        existing = repo.setting.get_by_version(bay_id, version)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"间隔 {bay_id} 的版本 {version} 已存在 (ID: {existing.id})"
            )
        
        version_data = settings_data.dict()
        values_data = version_data.pop("values", [])
        
        setting_version = repo.setting.create_with_values(
            version_data=version_data,
            values=values_data
        )
        
        if operation_id:
            operation = repo.operation.get_by_id(operation_id)
            if operation:
                if is_target:
                    repo.operation.update(operation_id, target_version_id=setting_version.id)
                else:
                    repo.operation.update(operation_id, current_version_id=setting_version.id)
                
                if operation.current_version_id and operation.target_version_id:
                    state_machine = OperationStateMachine(db)
                    try:
                        state_machine.trigger_event(operation, StateEventType.IMPORT)
                    except ValueError:
                        pass
        
        repo.audit.log_operation(
            operation="IMPORT",
            resource_type="setting_version",
            resource_id=setting_version.id,
            details={
                "version": setting_version.version,
                "bay_id": setting_version.bay_id,
                "filename": file.filename
            }
        )
        
        return ImportResponse(
            success=True,
            message=f"成功导入定值版本 {setting_version.version}",
            resource_type="setting_version",
            resource_id=setting_version.id,
            records_count=len(values_data)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/topology", response_model=ImportResponse)
async def import_topology(
    file: UploadFile = File(...),
    name: str = Form(...),
    operation_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    try:
        content = await file.read()
        parser = get_parser_for_file(file.filename or "")
        
        if isinstance(parser, (JSONParser, YAMLParser)):
            topology_data = parser.parse_topology(
                file_content=content,
                filename=file.filename or "",
                name=name
            )
        else:
            raise ValueError("拓扑文件仅支持 JSON 或 YAML 格式")
        
        topology_dict = topology_data.dict()
        nodes_data = topology_dict.pop("nodes", [])
        relations_data = topology_dict.pop("relations", [])
        
        topology = repo.topology.create_with_relations(
            topology_data=topology_dict,
            nodes=nodes_data,
            relations=relations_data
        )
        
        if operation_id:
            operation = repo.operation.get_by_id(operation_id)
            if operation:
                repo.operation.update(operation_id, topology_id=topology.id)
        
        repo.audit.log_operation(
            operation="IMPORT",
            resource_type="topology",
            resource_id=topology.id,
            details={
                "name": topology.name,
                "node_count": len(nodes_data),
                "relation_count": len(relations_data),
                "filename": file.filename
            }
        )
        
        return ImportResponse(
            success=True,
            message=f"成功导入拓扑: {topology.name}",
            resource_type="topology",
            resource_id=topology.id,
            records_count=len(nodes_data) + len(relations_data)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/plates", response_model=ImportResponse)
async def import_plates(
    file: UploadFile = File(...),
    name: str = Form(...),
    bay_id: str = Form(...),
    bay_name: str = Form(...),
    operation_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    try:
        content = await file.read()
        parser = get_parser_for_file(file.filename or "")
        
        plates_data = parser.parse_plates(
            file_content=content,
            filename=file.filename or "",
            bay_id=bay_id,
            bay_name=bay_name,
            name=name
        )
        
        plates_dict = plates_data.dict()
        plates_list = plates_dict.pop("plates", [])
        
        plate_status = repo.plate.create_with_plates(
            status_data=plates_dict,
            plates=plates_list
        )
        
        if operation_id:
            operation = repo.operation.get_by_id(operation_id)
            if operation:
                repo.operation.update(operation_id, plate_status_id=plate_status.id)
        
        repo.audit.log_operation(
            operation="IMPORT",
            resource_type="plate_status",
            resource_id=plate_status.id,
            details={
                "name": plate_status.name,
                "bay_id": plate_status.bay_id,
                "plate_count": len(plates_list),
                "filename": file.filename
            }
        )
        
        return ImportResponse(
            success=True,
            message=f"成功导入压板状态表: {plate_status.name}",
            resource_type="plate_status",
            resource_id=plate_status.id,
            records_count=len(plates_list)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/approval", response_model=ImportResponse)
async def import_approval(
    file: UploadFile = File(...),
    operation_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    try:
        content = await file.read()
        parser = get_parser_for_file(file.filename or "")
        
        if isinstance(parser, (JSONParser, YAMLParser)):
            ticket_data = parser.parse_approval_ticket(
                file_content=content,
                filename=file.filename or ""
            )
        else:
            raise ValueError("审批票文件仅支持 JSON 或 YAML 格式")
        
        existing = repo.approval.get_by_ticket_no(ticket_data.ticket_no)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"审批票号 {ticket_data.ticket_no} 已存在 (ID: {existing.id})"
            )
        
        ticket_dict = ticket_data.dict()
        signatures_list = ticket_dict.pop("signatures", [])
        ticket_dict.pop("operation_id", None)
        
        approval_ticket = repo.approval.create_with_signatures(
            ticket_data=ticket_dict,
            signatures=signatures_list
        )
        
        if operation_id:
            operation = repo.operation.get_by_id(operation_id)
            if operation:
                repo.operation.update(operation_id, approval_ticket_id=approval_ticket.id)
        
        repo.audit.log_operation(
            operation="IMPORT",
            resource_type="approval_ticket",
            resource_id=approval_ticket.id,
            details={
                "ticket_no": approval_ticket.ticket_no,
                "title": approval_ticket.title,
                "signature_count": len(signatures_list),
                "filename": file.filename
            }
        )
        
        return ImportResponse(
            success=True,
            message=f"成功导入审批票: {approval_ticket.ticket_no}",
            resource_type="approval_ticket",
            resource_id=approval_ticket.id,
            records_count=len(signatures_list)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
