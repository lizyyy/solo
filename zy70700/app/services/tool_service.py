from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import (
    Tool,
    ToolStatus,
)
from app.schemas import (
    ToolCreate,
    ToolUpdate,
)


class ToolService:
    @staticmethod
    def create_tool(db: Session, tool: ToolCreate) -> Tool:
        db_tool = Tool(**tool.model_dump())
        db.add(db_tool)
        db.commit()
        db.refresh(db_tool)
        return db_tool

    @staticmethod
    def get_tool(db: Session, tool_id: int) -> Optional[Tool]:
        return db.query(Tool).filter(Tool.id == tool_id).first()

    @staticmethod
    def get_tool_by_name(db: Session, name: str) -> Optional[Tool]:
        return db.query(Tool).filter(Tool.name == name).first()

    @staticmethod
    def get_all_tools(
        db: Session,
        status: Optional[ToolStatus] = None,
        mcp_server: Optional[str] = None,
    ) -> List[Tool]:
        query = db.query(Tool)
        if status:
            query = query.filter(Tool.status == status)
        if mcp_server:
            query = query.filter(Tool.mcp_server == mcp_server)
        return query.order_by(Tool.created_at.desc()).all()

    @staticmethod
    def update_tool(
        db: Session, tool_id: int, tool_update: ToolUpdate
    ) -> Optional[Tool]:
        db_tool = ToolService.get_tool(db, tool_id)
        if not db_tool:
            return None
        update_data = tool_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_tool, key, value)
        db_tool.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_tool)
        return db_tool

    @staticmethod
    def deactivate_tool(db: Session, tool_id: int) -> Optional[Tool]:
        db_tool = ToolService.get_tool(db, tool_id)
        if not db_tool:
            return None
        db_tool.status = ToolStatus.INACTIVE
        db_tool.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_tool)
        return db_tool
