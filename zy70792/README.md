# 发布制品哈希校验区域对比API

用于多地上传同一个发布制品后，进行哈希校验和区域对比的后端API。

## 技术栈

- FastAPI - Web框架
- SQLite - 数据库
- SQLAlchemy - ORM
- pytest - 测试框架

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问 http://localhost:8000/docs 可以查看Swagger文档。

## 造数脚本

创建测试数据目录结构：

```bash
# 创建制品目录
mkdir -p artifacts/{beijing,shanghai,guangzhou}

# 北京区域文件
echo "release content v1.0" > artifacts/beijing/app.exe
echo "config data" > artifacts/beijing/config.ini
echo "readme" > artifacts/beijing/readme.txt

# 上海区域文件（与北京一致）
echo "release content v1.0" > artifacts/shanghai/app.exe
echo "config data" > artifacts/shanghai/config.ini
echo "readme" > artifacts/shanghai/readme.txt

# 广州区域文件（有差异，制造冲突）
echo "release content v1.0 MODIFIED" > artifacts/guangzhou/app.exe
echo "config data" > artifacts/guangzhou/config.ini
# 缺少 readme.txt
echo "extra file" > artifacts/guangzhou/extra.txt
```

## API接口说明

### 主流程（正常路径）

#### 1. 创建校验任务

```bash
curl -X POST "http://localhost:8000/tasks/" \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "release_v1.0_check",
    "artifact_dir": "./artifacts",
    "regions": "beijing, shanghai, guangzhou"
  }'
```

#### 2. 查询任务列表

```bash
curl "http://localhost:8000/tasks/"
```

#### 3. 查询单个任务详情

```bash
curl "http://localhost:8000/tasks/1"
```

#### 4. 扫描文件（计算哈希）

```bash
curl -X POST "http://localhost:8000/tasks/1/scan"
```

#### 5. 区域对比

```bash
curl -X POST "http://localhost:8000/tasks/1/compare"
```

#### 6. 一键推进状态（自动执行扫描->对比）

```bash
curl -X POST "http://localhost:8000/tasks/1/advance"
```

#### 7. 导出报告

```bash
curl "http://localhost:8000/tasks/1/export"
```

### 冲突处理路径

#### 1. 人工修正冲突

```bash
curl -X POST "http://localhost:8000/tasks/1/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "zhangwei",
    "conclusion": "确认广州区域为热修复版本，已验证通过，允许发布",
    "original_input": "{\"hash_conflicts\": [...]}",
    "new_status": "resolved"
  }'
```

#### 2. 撤回任务

```bash
curl -X POST "http://localhost:8000/tasks/1/cancel"
```

#### 3. 关闭任务

```bash
curl -X POST "http://localhost:8000/tasks/1/close"
```

## 核心规则说明

### 目录扫描

- 遍历每个区域子目录下的所有文件
- 计算文件的相对路径、文件名、文件大小
- 使用SHA256算法计算文件哈希

### 哈希计算

- 分块读取大文件，避免内存溢出
- 使用SHA256算法保证校验强度

### 区域对比

1. **缺失文件检测**：对比各区域文件集合，标记某区域缺失的文件
2. **哈希冲突检测**：同一文件在不同区域哈希值不同
3. **大小冲突检测**：同一文件在不同区域大小不同

### 校验报告

```json
{
  "total_files": 4,
  "regions_checked": ["beijing", "shanghai", "guangzhou"],
  "missing_files": {
    "guangzhou": ["readme.txt"],
    "beijing": ["extra.txt"]
  },
  "hash_conflicts": [
    {
      "file_path": "app.exe",
      "regions": {
        "beijing": {"hash": "...", "size": 123},
        "shanghai": {"hash": "...", "size": 123},
        "guangzhou": {"hash": "DIFFERENT", "size": 456}
      }
    }
  ],
  "has_conflict": true
}
```

### 异常记录

每条异常处理记录保留：
- `original_input`：原始冲突数据
- `handler`：处理人
- `conclusion`：处理结论
- `created_at`：处理时间

## 状态流转

```
pending → scanning → scan_completed → comparing → comparison_completed
                                                         ↓
                                                      conflict → resolved
                                                         ↓
                                                    cancelled/closed
```

- **pending**：待处理
- **scanning**：扫描中
- **scan_completed**：扫描完成
- **comparing**：对比中
- **comparison_completed**：对比完成（无冲突）
- **conflict**：存在冲突
- **resolved**：冲突已解决
- **cancelled**：已取消
- **closed**：已关闭

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示详细输出
pytest -v

# 运行特定测试文件
pytest tests/test_hash_check.py

# 运行特定测试用例
pytest tests/test_hash_check.py::test_full_workflow
```

## 数据模型

### HashTask（校验任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| task_name | String | 任务名称 |
| artifact_dir | String | 制品目录 |
| regions | String | 区域列表（逗号分隔） |
| status | Enum | 状态 |
| report | Text | 校验报告（JSON） |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### ArtifactFile（制品文件）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| task_id | Integer | 任务ID |
| file_path | String | 文件相对路径 |
| file_name | String | 文件名 |
| file_size | Integer | 文件大小 |
| file_hash | String | 文件哈希（SHA256） |
| upload_region | String | 上传区域 |
| created_at | DateTime | 创建时间 |

### ExceptionRecord（异常记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| task_id | Integer | 任务ID |
| original_input | Text | 原始输入数据 |
| handler | String | 处理人 |
| conclusion | Text | 处理结论 |
| created_at | DateTime | 创建时间 |

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic模式
│   ├── services.py      # 业务逻辑
│   └── main.py          # API入口
├── tests/
│   ├── __init__.py
│   └── test_hash_check.py
├── pytest.ini
├── requirements.txt
└── README.md
```
