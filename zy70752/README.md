# 漂移摘要敏感遮蔽责任团队后端API

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```

服务启动后访问: http://localhost:8000
API文档: http://localhost:8000/docs

## 造数脚本

创建测试数据文件 `sample_plan.json`:
```json
{
  "resource_changes": [
    {
      "address": "aws_instance.web_server",
      "actions": ["create"],
      "change": {
        "after": {
          "instance_type": "t2.micro",
          "ami": "ami-12345",
          "root_password": "secret123"
        }
      }
    },
    {
      "address": "kubernetes_deployment.app",
      "actions": ["update"],
      "change": {
        "after": {
          "replicas": 3,
          "image": "nginx:latest",
          "api_token": "tok_abc123"
        }
      }
    },
    {
      "address": "database_postgresql.main",
      "actions": ["delete"],
      "change": {
        "after": null
      }
    }
  ]
}
```

## CURL 主流程测试

### 1. 创建漂移检查任务
```bash
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "plan_file_name": "sample_plan.json",
    "plan_content": "{\"resource_changes\":[{\"address\":\"aws_instance.web_server\",\"actions\":[\"create\"],\"change\":{\"after\":{\"instance_type\":\"t2.micro\",\"ami\":\"ami-12345\",\"root_password\":\"secret123\"}}},{\"address\":\"kubernetes_deployment.app\",\"actions\":[\"update\"],\"change\":{\"after\":{\"replicas\":3,\"image\":\"nginx:latest\",\"api_token\":\"tok_abc123\"}}},{\"address\":\"database_postgresql.main\",\"actions\":[\"delete\"],\"change\":{\"after\":null}}]}",
    "created_by": "admin"
  }'
```

### 2. 查询所有任务
```bash
curl http://localhost:8000/api/tasks
```

### 3. 查询特定任务
```bash
curl http://localhost:8000/api/tasks/1
```

### 4. 按状态过滤查询
```bash
curl http://localhost:8000/api/tasks?status=analyzed
```

### 5. 按团队过滤查询
```bash
curl http://localhost:8000/api/tasks?team=cloud-infra
```

### 6. 更新任务状态
```bash
curl -X PUT http://localhost:8000/api/tasks/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "handler": "operator1",
    "conclusion": "已确认需要处理"
  }'
```

### 7. 人工修正资源信息
```bash
curl -X PUT http://localhost:8000/api/tasks/1/resources \
  -H "Content-Type: application/json" \
  -d '{
    "resource_address": "aws_instance.web_server",
    "change_action": "update",
    "sensitive_fields": ["root_password", "api_key"],
    "responsible_team": "cloud-infra",
    "summary": "Web服务器配置更新"
  }'
```

### 8. 关闭任务
```bash
curl -X POST http://localhost:8000/api/tasks/1/close \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "operator1",
    "conclusion": "漂移已修复，任务关闭"
  }'
```

### 9. 驳回任务
```bash
curl -X POST http://localhost:8000/api/tasks/1/reject \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "reviewer1",
    "conclusion": "误报，无需处理"
  }'
```

### 10. 导出报告
```bash
curl http://localhost:8000/api/tasks/1/export
```

### 11. 查询所有团队
```bash
curl http://localhost:8000/api/teams
```

## 异常路径测试

### 查询不存在的任务
```bash
curl http://localhost:8000/api/tasks/9999
```

### 更新不存在的任务
```bash
curl -X PUT http://localhost:8000/api/tasks/9999/status \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmed"}'
```

### 修正不存在的资源
```bash
curl -X PUT http://localhost:8000/api/tasks/1/resources \
  -H "Content-Type: application/json" \
  -d '{
    "resource_address": "nonexistent.resource"
  }'
```

## Pytest 测试

创建测试文件 `test_main.py`，运行:
```bash
pytest test_main.py -v
```

## 核心功能说明

### Plan 解析
- 支持JSON格式的Terraform plan文件
- 支持文本格式的plan文件（简单解析）
- 提取资源地址、变更动作、变更字段

### 动作分类
- create: 创建资源
- update: 更新资源
- delete: 删除资源
- read: 读取资源
- no-op: 无操作

### 敏感字段遮蔽
自动识别并标记以下敏感字段:
- password
- secret
- token
- key
- credential
- private
- cert

### 团队归属
根据资源类型自动分配责任团队:
- aws.* -> cloud-infra
- kubernetes.* -> k8s-team
- database.* -> dba-team
- network.* -> network-team
- security.* -> security-team
- application.* -> app-team
- 默认 -> default-team

### 报告导出
导出内容包括:
- 任务基本信息
- 资源详情列表
- 按动作统计
- 按团队统计

## 状态流转

```
pending -> processing -> analyzed -> confirmed -> resolved -> closed
                                      \
                                       -> rejected
```
