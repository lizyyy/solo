# SSO 属性映射 API

企业SSO接入字段映射校验与留痕系统。

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务将在 `http://localhost:8000` 启动，API文档地址: `http://localhost:8000/docs`

### 3. 初始化样例数据（新开一个终端）
```bash
python init_sample_data.py
```

---

## CURL 调用示例

### 1. 查询身份源列表
```bash
curl http://localhost:8000/api/identity-sources
```

### 2. 查询属性映射
```bash
# 将 {source_id} 替换为实际的身份源ID
curl http://localhost:8000/api/attribute-mappings/{source_id}
```

### 3. 验证正常用户（成功路径）
```bash
# 将 {user1_id} 替换为初始化输出的第一个用户ID
curl -X POST http://localhost:8000/api/test-users/{user1_id}/validate
```

### 4. 验证有问题的用户（被规则拦住的路径）
```bash
# 将 {user2_id} 替换为初始化输出的第二个用户ID
curl -X POST http://localhost:8000/api/test-users/{user2_id}/validate
```
**预期结果**: 返回 `status: "failed"`，提示缺少必填字段 `department`，同时保留完整的原始输入 `raw_input`。

### 5. 验证有角色冲突的用户
```bash
# 将 {user3_id} 替换为初始化输出的第三个用户ID
curl -X POST http://localhost:8000/api/test-users/{user3_id}/validate
```
**预期结果**: 角色标记为 `has_conflict: true`，冲突详情显示"角色名过长"。

### 6. 人工修正
```bash
# 将 {user2_id} 替换为实际用户ID
curl -X POST http://localhost:8000/api/corrections \
  -H "Content-Type: application/json" \
  -d '{
    "test_user_id": {user2_id},
    "field_name": "department",
    "new_value": "市场部",
    "corrected_by": "admin",
    "reason": "补充缺失的部门字段"
  }'
```

### 7. 生成映射报告
```bash
# 将 {source_id} 替换为身份源ID
curl -X POST http://localhost:8000/api/reports/{source_id}
```

### 8. 查询报告
```bash
# 将 {report_id} 替换为报告ID
curl http://localhost:8000/api/reports/{report_id}
```

---

## 核心数据模型
- **IdentitySource**: 身份源配置（AD/OIDC/SAML等）
- **AttributeMapping**: 属性映射规则（源字段→目标字段，必填校验）
- **TestUser**: 测试用户原始数据，留痕所有输入
- **RoleResult**: 角色解析结果，标记冲突
- **CorrectionRecord**: 人工修正记录（旧值→新值、操作人、原因）
- **MappingReport**: 整体映射统计报告

## 异常处理特性
1. 所有验证失败的请求都保留完整 `raw_input`
2. 角色冲突自动检测并标记
3. 人工修正完整留痕，可追溯变更历史
4. 统计报告聚合所有问题点
