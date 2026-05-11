# 法院卷宗移交检查规则说明

## 1. 卷宗目录一致性检查 (services/checker.py:139)

| 检查项 | 规则代码 | 严重程度 |
|--------|----------|----------|
| 目录缺失 | MISSING_CATALOG | warning |
| 页码计数不一致 | CATALOG_PAGE_MISMATCH | error |
| 目录页码间隙 | CATALOG_GAP | error |
| 目录页码重叠 | CATALOG_OVERLAP | error |
| 总页数不一致 | TOTAL_PAGE_MISMATCH | error |
| 页码超出范围 | PAGE_RANGE_EXCEED | error |

## 2. 移交批次完整性检查 (services/checker.py:110)

| 检查项 | 规则代码 | 严重程度 |
|--------|----------|----------|
| 无效页码总数 | INVALID_PAGE_COUNT | error |
| 无效卷宗数量 | INVALID_DOSSIER_COUNT | error |
| 源/目标阶段相同 | INVALID_STAGE_FLOW | error |

## 3. 签收核验 (services/checker.py:214)

| 检查项 | 规则代码 | 严重程度 |
|--------|----------|----------|
| 案件号不一致 | CASE_ID_MISMATCH | error |
| 实收页数不一致 | RECEIVED_PAGE_COUNT_MISMATCH | error |

## 4. 缺页检测 (services/checker.py:240)

| 检查项 | 规则代码 | 严重程度 |
|--------|----------|----------|
| 缺失页码无效 | INVALID_MISSING_PAGE | error |
| 存在缺页 | MISSING_PAGES | error |
| 存在多余页码 | EXTRA_PAGES | error |
| 多余页码无效 | INVALID_EXTRA_PAGE | warning |
| 页码冲突（同时缺失和多余） | CONFLICTING_PAGE_STATUS | error |

## 5. 退回处理 (services/checker.py:296)

| 检查项 | 规则代码 | 严重程度 |
|--------|----------|----------|
| 退回但无原因 | RETURN_WITHOUT_REASON | error |
| 因缺页退回 | RETURN_MISSING_PAGES | warning |
| 因目录不符退回 | RETURN_CATALOG_MISMATCH | warning |
| 非退回但有原因 | REASON_WITHOUT_RETURN | warning |

## 6. 阶段流转检查 (services/checker.py:337)

| 检查项 | 规则代码 | 严重程度 |
|--------|----------|----------|
| 不合法流转 | INVALID_STAGE_TRANSITION | error |
| 签收待处理 | RECEIPT_PENDING | info |
| 卷宗已退回 | RETURNED | warning |

### 合法流转路径
- filing → trial (立案→审判)
- trial → archive (审判→归档)
- filing → archive (立案→归档，简易程序)

## 7. 数据导入规则

导入时脏数据**不静默跳过**，而是：
1. 记录到 `import_problems` 表
2. 保留来源文件和行号
3. CLI 输出问题列表
4. 正常数据继续导入

## 8. 样例数据场景

初始化时包含以下测试场景：

### 批次 BATCH-2024002（应检测出问题）
- 移交总页数：30
- 实收页数：28（少2页）
- 缺失页码：10, 27-28
- 签收状态：returned（已退回）
- 退回原因：missing_pages（缺页）

**预期检查失败问题：**
- RECEIVED_PAGE_COUNT_MISMATCH (实收页数不一致: 30 vs 28)
- MISSING_PAGES (存在缺页: 10,27-28)
- RETURN_MISSING_PAGES (因缺页被退回)

### 其他批次（应通过检查）
- BATCH-2024001, 2024003, 2024004: 正常签收
