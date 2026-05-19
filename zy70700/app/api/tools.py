from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ToolStatus
from app.schemas import (
    Tool,
    ToolCreate,
    ToolUpdate,
    PermissionDeclaration,
)
from app.services import ToolService, PermissionService

router = APIRouter(prefix="/tools", tags=["tools"])


@router.post("/", response_model=Tool)
def create_tool(tool: ToolCreate, db: Session = Depends(get_db)):
    return ToolService.create_tool(db, tool)


@router.get("/", response_model=List[Tool])
def get_tools(
    status: Optional[ToolStatus] = None,
    mcp_server: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return ToolService.get_all_tools(db, status, mcp_server)


@router.get("/{tool_id}", response_model=Tool)
def get_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = ToolService.get_tool(db, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.put("/{tool_id}", response_model=Tool)
def update_tool(tool_id: int, tool_update: ToolUpdate, db: Session = Depends(get_db)):
    tool = ToolService.update_tool(db, tool_id, tool_update)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.delete("/{tool_id}", response_model=Tool)
def deactivate_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = ToolService.deactivate_tool(db, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.get("/{tool_id}/declarations", response_model=List[PermissionDeclaration])
def get_tool_declarations(tool_id: int, db: Session = Depends(get_db)):
    tool = ToolService.get_tool(db, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return PermissionService.get_declarations_by_tool(db, tool_id)
