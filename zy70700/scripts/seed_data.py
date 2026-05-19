#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import engine, Base
from app.models import (
    Tool,
    PermissionDeclaration,
    ActualCall,
    ApprovalBatch,
    ExceptionRecord,
    ToolStatus,
    ApprovalStatus,
    ExceptionStatus,
)


def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        tools = [
            Tool(
                name="file_reader",
                mcp_server="filesystem",
                description="读取文件内容的工具",
                version="1.0.0",
                status=ToolStatus.ACTIVE,
            ),
            Tool(
                name="file_writer",
                mcp_server="filesystem",
                description="写入文件内容的工具",
                version="1.0.0",
                status=ToolStatus.ACTIVE,
            ),
            Tool(
                name="browser_navigate",
                mcp_server="browser",
                description="浏览器导航工具",
                version="2.1.0",
                status=ToolStatus.ACTIVE,
            ),
            Tool(
                name="database_query",
                mcp_server="database",
                description="数据库查询工具",
                version="1.5.0",
                status=ToolStatus.ACTIVE,
            ),
        ]
        db.add_all(tools)
        db.commit()

        batch = ApprovalBatch(
            batch_number="MCP-PERM-2024-001",
            title="2024年第一季度MCP工具权限审批",
            description="第一季度所有MCP工具的权限声明审批批次",
            submitter="admin@example.com",
            status=ApprovalStatus.PENDING,
        )
        db.add(batch)
        db.commit()

        declarations = [
            PermissionDeclaration(
                tool_id=1,
                batch_id=1,
                declared_scopes=["read:local", "read:documents"],
                declared_resources=["/home/user", "/tmp"],
                declared_actions=["file_read", "content_extract"],
                declared_description="文件读取工具权限声明",
                declared_by="admin@example.com",
            ),
            PermissionDeclaration(
                tool_id=2,
                batch_id=1,
                declared_scopes=["write:local"],
                declared_resources=["/home/user/output"],
                declared_actions=["file_write", "append"],
                declared_description="文件写入工具权限声明",
                declared_by="admin@example.com",
            ),
            PermissionDeclaration(
                tool_id=3,
                batch_id=1,
                declared_scopes=["navigate:public"],
                declared_resources=["https://*.example.com"],
                declared_actions=["navigate", "screenshot"],
                declared_description="浏览器导航工具权限声明",
                declared_by="admin@example.com",
            ),
            PermissionDeclaration(
                tool_id=4,
                batch_id=1,
                declared_scopes=["query:readonly"],
                declared_resources=["production_db", "analytics_db"],
                declared_actions=["select", "count"],
                declared_description="数据库查询工具权限声明",
                declared_by="admin@example.com",
            ),
        ]
        db.add_all(declarations)
        db.commit()

        base_time = datetime.utcnow() - timedelta(days=7)
        calls = [
            ActualCall(
                tool_id=1,
                call_id="call_001",
                actual_scopes=["read:local", "read:documents"],
                actual_resources=["/home/user/docs"],
                actual_actions=["file_read"],
                caller="user1@example.com",
                call_time=base_time + timedelta(hours=1),
            ),
            ActualCall(
                tool_id=1,
                call_id="call_002",
                actual_scopes=["read:local", "read:documents"],
                actual_resources=["/tmp/cache"],
                actual_actions=["file_read", "content_extract"],
                caller="user2@example.com",
                call_time=base_time + timedelta(hours=2),
            ),
            ActualCall(
                tool_id=2,
                call_id="call_003",
                actual_scopes=["write:local"],
                actual_resources=["/home/user/output/report.txt"],
                actual_actions=["file_write"],
                caller="user1@example.com",
                call_time=base_time + timedelta(hours=3),
            ),
            ActualCall(
                tool_id=3,
                call_id="call_004",
                actual_scopes=["navigate:public", "navigate:external"],
                actual_resources=["https://api.example.com", "https://external.com"],
                actual_actions=["navigate", "screenshot"],
                caller="user3@example.com",
                call_time=base_time + timedelta(hours=4),
            ),
            ActualCall(
                tool_id=4,
                call_id="call_005",
                actual_scopes=["query:readonly", "query:write"],
                actual_resources=["production_db", "test_db"],
                actual_actions=["select", "insert"],
                caller="user4@example.com",
                call_time=base_time + timedelta(hours=5),
            ),
        ]
        db.add_all(calls)
        db.commit()

        exceptions = [
            ExceptionRecord(
                batch_id=1,
                tool_id=3,
                title="浏览器工具访问外部未声明域名",
                description="browser_navigate工具访问了声明范围以外的external.com域名",
                exception_type="scope_mismatch",
                original_input={
                    "call_id": "call_004",
                    "actual_scopes": ["navigate:public", "navigate:external"],
                    "actual_resources": ["https://external.com"],
                },
                status=ExceptionStatus.OPEN,
            ),
            ExceptionRecord(
                batch_id=1,
                tool_id=4,
                title="数据库工具执行了未声明的写操作",
                description="database_query工具声明为只读，但实际执行了insert操作",
                exception_type="action_mismatch",
                original_input={
                    "call_id": "call_005",
                    "actual_actions": ["select", "insert"],
                    "actual_resources": ["test_db"],
                },
                status=ExceptionStatus.REVIEWING,
                handler="reviewer@example.com",
                handling_time=datetime.utcnow(),
                handling_conclusion="正在复核该操作的必要性",
                handling_notes="需要确认test_db是否在允许列表中",
            ),
        ]
        db.add_all(exceptions)
        db.commit()

        print("造数完成!")
        print(f"- 工具: {len(tools)} 个")
        print(f"- 审批批次: 1 个")
        print(f"- 权限声明: {len(declarations)} 个")
        print(f"- 实际调用: {len(calls)} 个")
        print(f"- 异常记录: {len(exceptions)} 个")


if __name__ == "__main__":
    seed_database()
