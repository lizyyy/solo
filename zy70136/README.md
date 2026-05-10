"""
使用说明
========

项目结构
--------
app/                    # 核心应用
  ├── __init__.py
  ├── config.py         # 配置
  ├── database.py       # 数据库连接
  ├── main.py           # FastAPI 应用入口
  ├── models.py         # SQLAlchemy 数据模型
  ├── schemas.py        # Pydantic 数据模式
  └── services/         # 业务服务层
      ├── __init__.py
      ├── idempotency_service.py   # 幂等性服务
      ├── sign_service.py          # 签名申请服务
      ├── qualification_service.py # 资质审核服务
      ├── channel_service.py       # 渠道提交/回执服务
      ├── retry_service.py         # 重试队列服务
      └── report_service.py        # 审核报告服务

tests/                  # 单元测试
  ├── conftest.py
  └── test_services.py  # 35个测试用例

examples/
  └── sample_data.py    # 样例数据脚本（4个场景）

运行方式
--------

1. 安装依赖
   pip install fastapi sqlalchemy pydantic pydantic-settings uvicorn pytest

2. 运行样例数据演示
   python3 examples/sample_data.py

3. 运行单元测试
   python3 -m pytest tests/ -v

4. 启动 API 服务
   uvicorn app.main:app --reload --port 8000

   然后访问: http://localhost:8000/docs

核心流程
--------

签名审核完整流程：

1. 签名申请 (POST /api/v1/signs)
   → 状态: DRAFT

2. 提交资质审核 (POST /api/v1/signs/{id}/submit-qualification)
   → 状态: PENDING_QUALIFICATION

3. 上传资质附件 (POST /api/v1/qualifications)
   → 资质状态: PENDING

4. 审批资质 (POST /api/v1/qualifications/{id}/approve 或 reject)
   → 全部通过: QUALIFICATION_APPROVED
   → 任一被拒: QUALIFICATION_REJECTED

5. 提交渠道 (POST /api/v1/channels/submit)
   → 状态: SUBMITTING_TO_CHANNEL → CHANNEL_SUBMITTED

6. 接收回执 (POST /api/v1/channels/receipts)
   → 回执状态: PENDING

7. 解析回执 (POST /api/v1/channels/receipts/{id}/parse)
   → 审核通过: AUDIT_APPROVED
   → 审核拒绝: AUDIT_REJECTED
   → 解析失败: 进入重试队列

8. 生成审核报告 (GET /api/v1/reports/{application_id})

幂等性保障
----------

- 所有写操作都需要传入 request_id
- 重复 request_id 会返回已存在的记录
- 文件通过 file_hash 去重
- 状态转换有严格的状态机校验

追溯方法
--------

1. 按 request_id 追溯: GET /api/v1/trace/{request_id}
2. 查看申请历史: GET /api/v1/signs/{application_id}/history
3. 查看审核报告: GET /api/v1/reports/{application_id}

重试机制
--------

- 回执解析失败自动进入重试队列
- 支持指数退避策略
- 达到最大重试次数后标记为最终失败
- 可手动取消重试

关键代码位置
------------

- 幂等性检查: app/services/idempotency_service.py:48 (check_idempotency)
- 状态机校验: app/services/idempotency_service.py:65 (can_transition_status)
- 文件去重: app/services/qualification_service.py:55 (existing_same_hash)
- 回执解析: app/services/channel_service.py:173 (_parse_receipt_payload)
- 重试逻辑: app/services/retry_service.py:74 (execute_retry)

测试覆盖
--------

- TestIdempotencyService (9个测试): 幂等性基础功能
- TestSignService (5个测试): 签名申请和状态转换
- TestQualificationService (5个测试): 资质上传和审批
- TestChannelService (6个测试): 渠道提交和回执处理
- TestRetryService (3个测试): 重试队列
- TestReportService (4个测试): 审核报告和追溯
- TestIdempotencyGuarantee (3个测试): 幂等性保障验证
"""
