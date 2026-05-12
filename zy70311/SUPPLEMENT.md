# 离线许可证激活 CLI - 补充说明文档

## 1. 概述

本文档补充说明离线许可证激活 CLI 的主要边界情况、失败路径和重复执行路径，便于后续复查。

## 2. 主要边界情况

### 2.1 机器指纹不匹配

**触发条件**：
- 许可证已在机器A上激活，尝试在机器B上使用同一许可证
- 激活时提供的指纹与许可证中记录的指纹不一致

**系统行为**：
- 激活失败
- 错误信息明确提示指纹不匹配
- 告知售后需要在正确机器上激活或重新签发

**代码位置**：`license_cli/license.py:168-170`

```python
activated_fingerprint = license_data.get("activated_machine_fingerprint")
if activated_fingerprint and activated_fingerprint != machine_fingerprint:
    raise ValueError("机器指纹不匹配。此许可证已绑定到其他机器，请让客户在正确的机器上激活，或让售后重新签发新许可证。")
```

**复查方式**：
```bash
# 1. 在机器A上激活许可证
python3 -m license_cli activate --license LIC-XXX.json --fingerprint machine-A_fingerprint.json

# 2. 尝试在机器B上激活同一许可证（应该失败）
python3 -m license_cli activate --license LIC-XXX.json --fingerprint machine-B_fingerprint.json
```

### 2.2 许可证过期

**触发条件**：
- 当前时间超过许可证的 `valid_until` 时间
- 激活时发现已过期
- 查看状态时发现已过期

**系统行为**：
- 激活失败
- 状态检查显示 `expired`
- 提示需要联系售后办理续期

**代码位置**：`license_cli/license.py:162-166`（激活检查）和 `license_cli/license.py:243-248`（状态检查）

**复查方式**：
```bash
# 方法1：签发短期许可证等待过期
python3 -m license_cli issue --customer-id TEST --customer-name "测试" --features "测试" --max-machines 1 --validity-days 0

# 方法2：手动修改许可证文件的 valid_until 为过去时间（测试用）
```

### 2.3 续期不能缩短已生效权益

**触发条件**：
- 尝试使用负数或0天进行续期

**系统行为**：
- 续期失败
- 提示续期天数必须为正数

**代码位置**：`license_cli/license.py:280-281`

```python
if additional_days <= 0:
    raise ValueError("续期天数必须为正数。")
```

**复查方式**：
```bash
# 尝试用负数续期（应该失败）
python3 -m license_cli renew --license activated_license.json --additional-days -30

# 尝试用0天续期（应该失败）
python3 -m license_cli renew --license activated_license.json --additional-days 0
```

### 2.4 吊销后的许可证不能重新激活

**触发条件**：
- 许可证已被加入吊销列表
- 尝试激活已吊销的许可证
- 尝试续期已吊销的许可证

**系统行为**：
- 激活和续期均失败
- 明确提示许可证已被吊销
- 建议联系售后重新签发

**代码位置**：
- 激活检查：`license_cli/license.py:156-160`
- 续期检查：`license_cli/license.py:274-275`
- 吊销记录存储：`license_cli/license.py:340-349`

**复查方式**：
```bash
# 1. 吊销许可证
python3 -m license_cli revoke --license-id LIC-XXX --reason "测试吊销"

# 2. 尝试激活已吊销的许可证（应该失败）
python3 -m license_cli activate --license LIC-XXX.json --fingerprint machine_fingerprint.json

# 3. 尝试续期已吊销的许可证（应该失败）
python3 -m license_cli renew --license activated_license.json --additional-days 365
```

### 2.5 同一客户多台机器授权数量限制

**触发条件**：
- 客户已激活 `max_machines` 台不同的机器
- 尝试在新的机器上激活许可证

**系统行为**：
- 激活失败
- 提示已达到最大授权机器数量
- 建议升级授权或吊销不再使用的许可证

**代码位置**：`license_cli/license.py:138-142`（检查逻辑）和 `license_cli/license.py:172-177`（激活时检查）

**复查方式**：
```bash
# 1. 签发限制2台机器的许可证
python3 -m license_cli issue --customer-id CUST001 --customer-name "测试客户" --features "测试" --max-machines 2 --validity-days 365

# 2. 在2台不同机器上激活（应该成功）
python3 -m license_cli activate --license LIC-XXX.json --fingerprint machine-1_fingerprint.json
python3 -m license_cli activate --license LIC-XXX.json --fingerprint machine-2_fingerprint.json

# 3. 尝试在第3台机器上激活（应该失败）
python3 -m license_cli activate --license LIC-XXX.json --fingerprint machine-3_fingerprint.json
```

## 3. 一个完整的失败路径

### 3.1 场景：客户用错误的指纹文件激活

**失败路径步骤**：

1. **正确流程开始**
   ```
   客户A需要激活许可证
   ↓
   售后签发许可证 LIC-A001（绑定客户A，max_machines=2）
   ↓
   客户A应该在生产服务器 machine-A1 上生成指纹
   ```

2. **错误发生**
   ```
   客户A不小心用测试服务器 machine-Test 生成了指纹
   ↓
   客户A将 machine-Test_fingerprint.json 发送给售后
   ↓
   售后不知情，让客户用这个指纹激活
   ```

3. **激活失败**
   ```
   客户A在生产服务器 machine-A1 上运行激活命令
   ↓
   使用的是 machine-Test 的指纹文件
   ↓
   系统检查：
     - 许可证签名验证通过 ✓
     - 许可证未被吊销 ✓
     - 许可证未过期 ✓
     - 机器指纹与实际机器不匹配 ✗
   ↓
   激活失败，错误信息：
   "机器指纹不匹配。此许可证已绑定到其他机器，请让客户在正确的机器上激活，或让售后重新签发新许可证。"
   ```

4. **问题排查和解决**
   ```
   客户看到错误信息，知道问题出在指纹
   ↓
   方案1：在测试服务器 machine-Test 上激活（如果这是预期的）
   方案2：重新在生产服务器 machine-A1 上生成指纹，售后重新签发许可证
   ↓
   选择方案2，问题解决
   ```

### 3.2 错误信息设计原则

所有错误信息都遵循以下格式，让售后知道下一步该做什么：

```
错误原因 + 明确的行动指引
```

**示例**：
- ✅ "机器指纹不匹配。请让客户在正确的机器上激活，或让售后重新签发新许可证。"
- ❌ "指纹错误"

**所有错误信息位置**：
- 签名验证失败：`license_cli/license.py:154`
- 许可证已吊销：`license_cli/license.py:157, 160`
- 许可证已过期：`license_cli/license.py:166`
- 指纹不匹配：`license_cli/license.py:170`
- 机器数量限制：`license_cli/license.py:177`
- 续期天数无效：`license_cli/license.py:281`

## 4. 一次重复执行路径

### 4.1 场景：许可证续期后重复执行续期命令

**正常流程**：

```
第1次续期（正常）：
┌─────────────────────────────────────────────────────────┐
│ 许可证状态: valid                                        │
│ 有效期至: 2026-05-12 (今天)                              │
│ 续期天数: 365天                                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 检查签名: ✓ 通过                                          │
│ 检查吊销: ✓ 未吊销                                        │
│ 计算新有效期: 2026-05-12 + 365天 = 2027-05-12            │
│ 记录续期历史:                                            │
│   - renewed_at: 2026-05-12                               │
│   - previous_valid_until: 2026-05-12                     │
│   - additional_days: 365                                 │
│ 版本号: version 1 → version 2                            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 结果: 成功                                               │
│ 新许可证文件: LIC-A001_renewed.json                      │
└─────────────────────────────────────────────────────────┘
```

**第2次续期（重复执行同一命令）**：

```
第2次续期（重复执行）：
┌─────────────────────────────────────────────────────────┐
│ 注意：使用的是原始许可证文件 LIC-A001.json，              │
│      不是续期后的 LIC-A001_renewed.json                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 许可证状态: valid                                        │
│ 有效期至: 2026-05-12 (还是原始有效期，因为用的是旧文件)    │
│ 续期天数: 365天                                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 检查签名: ✓ 通过                                          │
│ 检查吊销: ✓ 未吊销                                        │
│ 计算新有效期: 2026-05-12 + 365天 = 2027-05-12            │
│ 记录续期历史:                                            │
│   - renewed_at: 2026-05-12                               │
│   - previous_valid_until: 2026-05-12                     │
│   - additional_days: 365                                 │
│   (这是第2条续期记录)                                     │
│ 版本号: version 1 → version 2 (还是从1到2)                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 结果: 成功（但实际上重复续期了）                          │
│ 新许可证文件: LIC-A001_renewed.json (覆盖上一个)          │
└─────────────────────────────────────────────────────────┘
```

**第3次续期（使用续期后的文件）**：

```
第3次续期（正确使用新文件）：
┌─────────────────────────────────────────────────────────┐
│ 使用的文件: LIC-A001_renewed.json                        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 许可证状态: valid                                        │
│ 有效期至: 2027-05-12 (续期后的有效期)                     │
│ 续期天数: 365天                                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 检查签名: ✓ 通过                                          │
│ 检查吊销: ✓ 未吊销                                        │
│ 计算新有效期: 2027-05-12 + 365天 = 2028-05-12            │
│ 记录续期历史:                                            │
│   - 第1条: 2026-05-12, +365天                            │
│   - 第2条: 2026-05-12, +365天 (如果第2次用了旧文件)       │
│   - 第3条: 2026-05-12, +365天 (本次)                     │
│ 版本号: version 2 → version 3                            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 结果: 成功                                               │
│ 新许可证文件: LIC-A001_renewed_renewed.json              │
└─────────────────────────────────────────────────────────┘
```

### 4.2 重复执行的影响

| 操作 | 第1次执行 | 第2次重复执行（用旧文件） | 第3次执行（用新文件） |
|------|----------|------------------------|---------------------|
| 签发许可证 | 生成新的LIC-XXX | 生成另一个新的LIC-YYY | 生成第三个LIC-ZZZ |
| 激活许可证 | 绑定机器指纹 | 指纹已绑定，报错 | 指纹已绑定，报错 |
| 续期许可证 | 延长有效期 | 可能重复延长（取决于用哪个文件） | 在之前基础上延长 |
| 吊销许可证 | 加入吊销列表 | 已吊销，报错 | 已吊销，报错 |
| 查看状态 | 显示当前状态 | 显示当前状态（相同） | 显示当前状态（相同） |
| 导出审计 | 生成报告 | 生成更新的报告 | 生成更新的报告 |

### 4.3 复查清单

复查时请确认以下几点：

1. **签发操作**：
   - [ ] 每次执行都生成新的许可证ID
   - [ ] 私钥保持不变，公钥可以分发给客户
   - [ ] issued_licenses.json 中有完整记录

2. **激活操作**：
   - [ ] 同一许可证在同一机器上可以重复激活（幂等）
   - [ ] 同一许可证在不同机器上激活失败
   - [ ] activated_machine_fingerprint 正确记录

3. **续期操作**：
   - [ ] renewal_history 正确记录每次续期
   - [ ] version 号递增
   - [ ] 使用旧文件续期不会导致有效期缩短（只会增加或不变）

4. **吊销操作**：
   - [ ] revoked_licenses.json 中有记录
   - [ ] 原许可证状态更新为 revoked
   - [ ] 后续激活/续期操作均失败

5. **审计日志**：
   - [ ] 所有操作都有记录
   - [ ] 时间戳正确
   - [ ] 操作详情完整

## 5. 文件结构说明

```
zy70311/
├── requirements.txt              # 依赖列表
├── test_demo.py                  # 完整测试脚本（运行这个看效果）
├── license_cli/
│   ├── __init__.py               # 包初始化
│   ├── __main__.py               # 入口模块
│   ├── cli.py                    # CLI命令解析和执行
│   ├── crypto.py                 # 加密签名模块
│   ├── fingerprint.py            # 机器指纹生成模块
│   └── license.py                # 许可证管理核心逻辑
├── keys/                         # 密钥目录（运行后生成）
│   ├── private_key.pem           # 私钥（售后保管，保密）
│   └── public_key.pem            # 公钥（可以分发给客户）
├── licenses/                     # 许可证目录（运行后生成）
│   ├── issued_licenses.json      # 所有已签发许可证记录
│   ├── revoked_licenses.json     # 已吊销许可证记录
│   ├── audit_log.json            # 审计日志
│   ├── LIC-XXXXXXXX.json         # 原始许可证文件
│   ├── LIC-XXXXXXXX_activated.json  # 激活后的许可证
│   ├── LIC-XXXXXXXX_renewed.json    # 续期后的许可证
│   └── final_audit_report.json   # 最终审计报告
└── fingerprints/                 # 指纹目录（运行后生成）
    ├── machine-A1_fingerprint.json
    ├── machine-A2_fingerprint.json
    └── machine-B1_fingerprint.json
```

## 6. 快速开始

```bash
# 1. 安装依赖
pip3 install -r requirements.txt

# 2. 运行完整测试演示
python3 test_demo.py

# 3. 查看生成的文件
ls -la licenses/
ls -la fingerprints/

# 4. 查看审计报告
cat licenses/final_audit_report.json | python3 -m json.tool
```

## 7. 单命令测试

```bash
# 查看帮助
python3 -m license_cli --help

# 生成机器指纹
python3 -m license_cli generate-fingerprint --machine-id test-machine

# 签发许可证
python3 -m license_cli issue \
  --customer-id TEST001 \
  --customer-name "测试公司" \
  --features "功能1,功能2" \
  --max-machines 1 \
  --validity-days 365

# 激活许可证（需要先签发和生成指纹）
# python3 -m license_cli activate --license licenses/LIC-XXXX.json --fingerprint fingerprints/test-machine_fingerprint.json

# 查看许可证列表
python3 -m license_cli list

# 导出审计报告
python3 -m license_cli export-audit
```
