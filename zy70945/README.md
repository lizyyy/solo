# 物业装修审批系统

## 功能概述

解决物业客服装修验收、违规扣款和押金退还审批链混乱的问题。

## 核心能力

1. **数据导入** - 支持 CSV 装修申请、JSON 巡检记录、JSON 扣款规则
2. **分类审批** - 自动分为正常项、待确认项、失败项
3. **失败记录** - 保留原始字段和建议处理方式
4. **去重机制** - 同一批材料再次提交不会重复生效
5. **规则引擎** - 覆盖违规复查、押金冻结、重复退款检测
6. **退款追踪** - 从历史中追到完整来源

## 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 运行演示脚本
npm run test

# 3. 启动 API 服务
npm start
# 或开发模式
npm run dev
```

## API 服务

服务地址: `http://localhost:3000`

### 装修申请
- `POST /api/decoration/upload` - 上传 CSV 文件
- `POST /api/decoration/process` - 直接提交 JSON 数据
- `GET /api/decoration` - 获取申请列表
- `GET /api/decoration/:id` - 获取申请详情

### 巡检记录
- `POST /api/inspection/upload` - 上传巡检 JSON
- `POST /api/inspection` - 直接提交巡检数据

### 扣款规则
- `POST /api/rules/upload` - 上传规则 JSON
- `GET /api/rules` - 获取所有规则
- `POST /api/rules` - 添加规则

### 审批
- `POST /api/approval/process` - 批量审批分类
- `POST /api/approval/deduction` - 执行扣款

### 退款（重点功能）
- `POST /api/refund/create` - 创建退款审批
- `POST /api/refund/confirm/:id` - 确认退款
- `GET /api/refund/:id/trace` - **退款追踪（完整时间线）**
- `GET /api/refund` - 所有退款历史

### 其他
- `GET /api/stats` - 统计信息
- `GET /api/batch/:fingerprint` - 批次去重检查
- `GET /api/health` - 健康检查

## 示例数据

位于 `data/` 目录：

- `decoration_applications.csv` - 8 条装修申请（包含正常、违规、待验收等场景）
- `inspection_records.json` - 6 条巡检记录
- `deduction_rules.json` - 6 条扣款规则

## 业务规则

默认内置规则：

| 规则 | 类型 | 优先级 | 处罚 |
|------|------|--------|------|
| 承重墙违规 | violation_recheck | 1 | 5000元 + 冻结押金 |
| 外立面改动 | violation_recheck | 1 | 3000元 + 冻结押金 |
| 消防设施遮挡 | violation_recheck | 1 | 8000元 + 冻结押金 |
| 水电未报备 | violation_recheck | 2 | 2000元 + 冻结押金 |
| 押金余额不足 | deposit_check | 1 | 拒绝退款 |
| 装修未验收 | deposit_check | 1 | 拒绝退款 + 冻结押金 |

## 退款审批追踪

`GET /api/refund/:id/trace` 返回完整时间线，包含：

- 装修申请提交
- 违规记录
- 押金冻结/解冻
- 巡检记录
- 审批记录
- 退款执行
