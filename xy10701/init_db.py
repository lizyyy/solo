from models import init_db, Spec, Review, Change, Approval, Timeline
import json

SAMPLE_OLD_SPEC = {
    "openapi": "3.0.0",
    "info": {
        "title": "用户管理 API",
        "version": "1.0.0"
    },
    "paths": {
        "/users": {
            "get": {
                "summary": "获取用户列表",
                "parameters": [
                    {
                        "name": "page",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "integer"}
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "integer"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "成功",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "data": {"type": "array"},
                                        "total": {"type": "integer"}
                                    },
                                    "required": ["data", "total"]
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "summary": "创建用户",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "email": {"type": "string"},
                                    "age": {"type": "integer"}
                                },
                                "required": ["name", "email"]
                            }
                        }
                    }
                },
                "responses": {
                    "201": {"description": "创建成功"}
                }
            }
        },
        "/users/{id}": {
            "get": {
                "summary": "获取用户详情",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"}
                    }
                ],
                "responses": {
                    "200": {"description": "成功"}
                }
            }
        }
    }
}

SAMPLE_NEW_SPEC_BLOCKED = {
    "openapi": "3.0.0",
    "info": {
        "title": "用户管理 API",
        "version": "2.0.0"
    },
    "paths": {
        "/users": {
            "get": {
                "summary": "获取用户列表",
                "parameters": [
                    {
                        "name": "limit",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "integer"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "成功",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "data": {"type": "array"},
                                        "total": {"type": "integer"}
                                    },
                                    "required": ["data", "total"]
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "summary": "创建用户",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "email": {"type": "string"},
                                    "age": {"type": "integer"}
                                },
                                "required": ["name", "email"]
                            }
                        }
                    }
                },
                "responses": {
                    "201": {"description": "创建成功"}
                }
            }
        }
    }
}

SAMPLE_NEW_SPEC_APPROVED = {
    "openapi": "3.0.0",
    "info": {
        "title": "用户管理 API",
        "version": "1.1.0"
    },
    "paths": {
        "/users": {
            "get": {
                "summary": "获取用户列表",
                "parameters": [
                    {
                        "name": "page",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "integer"}
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "integer"}
                    },
                    {
                        "name": "search",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "string"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "成功",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "data": {"type": "array"},
                                        "total": {"type": "integer"}
                                    },
                                    "required": ["data", "total"]
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

def create_sample_data():
    old_spec_id = Spec.create("1.0.0", SAMPLE_OLD_SPEC)
    
    new_spec_id_blocked = Spec.create("2.0.0", SAMPLE_NEW_SPEC_BLOCKED)
    review_id_blocked = Review.create(old_spec_id, new_spec_id_blocked, "BLOCKED")
    
    Change.create(
        review_id_blocked,
        "PARAMETER_REMOVED",
        "/users",
        "get",
        "page",
        "删除了必填查询参数 'page'",
        True,
        "high"
    )
    Change.create(
        review_id_blocked,
        "PATH_REMOVED",
        "/users/{id}",
        "get",
        None,
        "删除了路径 '/users/{id}' 及其 GET 操作",
        True,
        "high"
    )
    
    Timeline.create(
        review_id_blocked,
        "CREATED",
        "创建审查任务，对比 v1.0.0 与 v2.0.0",
        "system"
    )
    Timeline.create(
        review_id_blocked,
        "DETECTED",
        "检测到 2 个破坏性变更",
        "system",
        {"breaking_changes": 2, "total_changes": 2}
    )
    Timeline.create(
        review_id_blocked,
        "STATUS_CHANGE",
        "审查状态更新为 BLOCKED",
        "system"
    )
    
    Approval.create(
        review_id_blocked,
        "李四",
        False,
        "删除必填参数 'page' 会导致现有客户端调用失败。建议保留该参数或提供默认值。"
    )
    
    Timeline.create(
        review_id_blocked,
        "APPROVAL",
        "审批人李四驳回了变更",
        "李四",
        {"approved": False, "reason": "删除必填参数会导致客户端失败"}
    )
    
    new_spec_id_approved = Spec.create("1.1.0", SAMPLE_NEW_SPEC_APPROVED)
    review_id_approved = Review.create(old_spec_id, new_spec_id_approved, "APPROVED")
    
    Change.create(
        review_id_approved,
        "PARAMETER_ADDED",
        "/users",
        "get",
        "search",
        "新增可选查询参数 'search'",
        False,
        "low"
    )
    
    Timeline.create(
        review_id_approved,
        "CREATED",
        "创建审查任务，对比 v1.0.0 与 v1.1.0",
        "system"
    )
    Timeline.create(
        review_id_approved,
        "DETECTED",
        "检测到 1 个非破坏性变更",
        "system",
        {"breaking_changes": 0, "total_changes": 1}
    )
    Timeline.create(
        review_id_approved,
        "APPROVAL",
        "审批人张三通过了变更",
        "张三",
        {"approved": True, "reason": "新增可选参数，无兼容性风险"}
    )
    
    Approval.create(
        review_id_approved,
        "张三",
        True,
        "新增可选 search 参数，不影响现有接口，可安全上线。"
    )
    
    Review.update_status(review_id_approved, "APPROVED")
    
    print(f"示例数据创建完成:")
    print(f"  - 旧版规范 v1.0.0 (ID: {old_spec_id})")
    print(f"  - 审查 1: BLOCKED (破坏性变更示例, ID: {review_id_blocked})")
    print(f"  - 审查 2: APPROVED (非破坏性变更示例, ID: {review_id_approved})")

if __name__ == '__main__':
    print("初始化数据库...")
    init_db()
    print("数据库表创建完成！")
    print("\n创建示例数据...")
    create_sample_data()
    print("\n初始化完成！")
    print("\n运行 'python app.py' 启动服务。")
