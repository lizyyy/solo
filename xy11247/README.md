# 公益书库后端管理系统

## 项目概述

专门解决公益书库志愿者捐书入库时数据混乱问题的后端系统。核心功能包括：
- ISBN格式校验和标准化
- 品相标签智能识别和标准化
- 年级标签智能识别和标准化
- 重复导入自动检测和去重
- 批量导入支持部分成功，失败重试不影响已成功记录
- 每条记录处理结果全程可追溯
- 人工复核和强制导入功能

## 技术栈

- Python 3.8+
- Flask 2.3.3
- Flask-SQLAlchemy 3.1.1
- SQLite（本地数据库）
- isbnlib（ISBN校验库）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 健康检查

```bash
curl http://localhost:5000/api/health
```

## 核心流程

### 一、批量导入书籍

使用 sample_data.json 中的样例数据测试导入功能。

**请求示例：**

```bash
curl -X POST http://localhost:5000/api/import/batch \
  -H "Content-Type: application/json" \
  -d @sample_data.json
```

**sample_data.json 格式说明：**

```json
{
  "records": [
    {
      "isbn": "9787107186142",
      "title": "义务教育课程标准实验教科书 语文 五年级上册",
      "author": "人民教育出版社",
      "publisher": "人民教育出版社",
      "condition": "九成新",
      "grade": "五年级",
      "quantity": 1
    }
  ],
  "created_by": "志愿者张三"
}
```

**响应示例：**

```json
{
  "success": true,
  "message": "批量导入完成：成功5条，失败3条，重复2条",
  "data": {
    "batch_no": "BATCH20240115123456",
    "total": 10,
    "success": [
      {"row": 1, "title": "书名", "message": "处理原因详情"}
    ],
    "failed": [
      {"row": 2, "title": "书名", "message": "失败原因"}
    ],
    "duplicate": [
      {"row": 3, "title": "书名", "message": "重复原因"}
    ]
  }
}
```

### 二、查看导入批次

```bash
curl http://localhost:5000/api/import/batches
```

### 三、查看导入记录

```bash
# 查看所有记录
curl http://localhost:5000/api/import/records

# 按批次筛选
curl "http://localhost:5000/api/import/records?batch_id=1"

# 按状态筛选（SUCCESS/FAILED/DUPLICATE/PENDING/REVIEWED）
curl "http://localhost:5000/api/import/records?status=FAILED"
```

### 四、复核异常记录

对于失败或重复的记录，可以进行人工复核：

```bash
curl -X POST http://localhost:5000/api/review/record/1 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "force_import",
    "reviewer": "管理员李四",
    "remark": "确认书籍正确，强制导入"
  }'
```

**action 选项：**
- `approve` - 通过复核（仅变更状态）
- `reject` - 驳回（标记为失败）
- `force_import` - 强制导入（实际创建库存记录）

### 五、导出最终清单

```bash
curl http://localhost:5000/api/inventory
```

返回的数据可直接复制到Excel或其他表格工具中使用。

### 六、查看统计数据

```bash
curl http://localhost:5000/api/stats
```

## 数据标准化规则

### ISBN处理规则
1. 自动去除非数字和X字符
2. 支持10位和13位ISBN
3. 校验ISBN校验位，标记有效性
4. 空ISBN也允许导入（标记为ISBN为空）

### 品相标准化规则
自动识别以下品相描述并标准化为：
- 全新、全新未拆、未拆封 → **全新**
- 九成新、9成新、几乎全新 → **九成新**
- 八成新、8成新、良好 → **八成新**
- 七成新、7成新、一般 → **七成新**
- 六成新、6成新、较差、破旧 → **六成新及以下**
- 无法识别或为空 → **未标注**

### 年级标签标准化规则
自动识别以下年级描述并标准化为：
- 学前、幼儿园、学龄前 → **学前**
- 一年级到六年级 → **对应年级**
- 初一到初三 → **对应初中年级**
- 高一到高三 → **对应高中年级**
- 成人、大学、通用 → **成人**
- 无法识别或为空 → **未标注**

### 重复检测规则
1. 有ISBN的记录：ISBN相同即为重复
2. 无ISBN的记录：书名完全相同即为重复
3. 仅检测状态为成功、重复、已复核的记录

## 样例数据说明

`sample_data.json` 包含10条测试数据，覆盖各种场景：

### 正常场景（5条）
1. 完全正常的记录（有效ISBN、标准品相、标准年级）
2. 品相非标准描述（能识别）
3. 年级非标准描述（能识别）
4. 无ISBN但书名完整
5. 同ISBN不同品相（应分别入库）

### 异常场景（3条）
6. 书名为空（必败）
7. ISBN格式错误（长度不对）
8. 品相和年级都无法识别（仍可入库但标记未标注）

### 重复场景（2条）
9. 与第1条ISBN完全相同
10. 与第4条书名完全相同（无ISBN）

## API文档

访问 `http://localhost:5000/api/docs` 查看完整的API文档。

## 数据库结构

- `book` - 书籍主表
- `book_inventory` - 库存表（按书籍+品相+年级分SKU）
- `import_batch` - 导入批次表
- `import_record` - 单条导入记录表（含原始数据、处理结果、原因）
- `review_log` - 复核操作日志表

## 注意事项

1. 批量导入具有原子性，单条记录失败不影响其他记录
2. 重复导入不会创建重复库存，只会记录为重复状态
3. 强制导入功能慎用，建议仅在人工确认后使用
4. 所有操作都有完整记录可追溯
