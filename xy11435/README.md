# 民宿保洁排班异常回执状态机 API

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 运行完整测试流程
打开新终端，执行：
```bash
chmod +x test_flow.sh
./test_flow.sh
```

### 4. 运行边界情况测试
```bash
chmod +x test_boundary.sh
./test_boundary.sh
```

### 5. 查看API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心功能

### 状态机流程
```
草稿(DRAFT) → 已提交(SUBMITTED) → 复核中(REVIEWING)
     ↓              ↓                  ↓
已撤回(WITHDRAWN) ←┘              部分失败(PARTIAL_FAILED)
     ↓                                  ↓
重新提交 → ...                    已冻结(FROZEN) → 已归档(ARCHIVED)
```

### 回执状态
- PENDING: 待处理
- CONFIRMED: 已确认
- DISPUTED: 存疑
- RESOLVED: 已解决
- OVERRULED: 人工改判
- CANCELLED: 已取消

### 数据来源类型
- order_calendar: 订单日历
- cleaning_group: 保洁群消息
- maintenance_note: 维修备注
- handover_paper: 门店交接纸
- sms_screenshot: 短信截图

## 核心API

### 批次管理
- `POST /api/batch/` - 创建批次
- `GET /api/batch/` - 批次列表
- `GET /api/batch/{id}` - 批次详情
- `POST /api/batch/{id}/import` - 导入回执
- `POST /api/batch/{id}/upload` - 上传附件
- `POST /api/batch/{id}/freeze` - 冻结结算
- `POST /api/batch/{id}/withdraw` - 撤回归档
- `POST /api/batch/{id}/resubmit` - 重新提交
- `POST /api/batch/{id}/archive` - 归档

### 回执管理
- `GET /api/receipt/` - 回执列表
- `GET /api/receipt/{id}` - 回执详情
- `POST /api/receipt/{id}/review` - 复核
- `POST /api/receipt/{id}/overrule` - 人工改判

### 历史回溯
- `GET /api/history/batch/{id}/logs` - 批次操作日志
- `GET /api/history/receipt/{id}/logs` - 回执操作日志
- `GET /api/history/logs/{id}/compare` - 状态对比
- `GET /api/history/batch/{id}/diffs` - 差异记录

### 导出报表
- `GET /api/export/batch/{id}/summary` - 导出汇总（店长视图）
- `GET /api/export/batch/{id}/details` - 导出明细
- `GET /api/export/batch/{id}/failed-list` - 失败清单

## 设计特点

1. **证据链完整**：每条回执保留 source_file、source_row_no、source_raw_data
2. **改判不覆盖**：人工改判记录操作人、时间、理由，原始数据保留
3. **前后差异可查**：每次状态变更记录 before_state 和 after_state
4. **冻结保护**：冻结后无法修改，确保结算数据准确
5. **边界处理**：
   - 重复提交检测
   - 撤回后可重新提交
   - 部分失败标记
   - 人工改判留痕
   - 导出前强制冻结

## 店长重点查看

在 `/api/export/batch/{id}/summary` 接口中包含：
- 冻结前后各状态数量对比
- 人工改判的数量和具体理由
- 每条改判涉及的房间号、操作人、时间
- 数据来源清晰可追溯
