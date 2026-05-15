# 修改记录

## 🔧 问题修复

### 1. 补偿顺序控制修复

**问题**：原代码中 `/next` 接口返回全部 PENDING 状态的指令，无法保证按顺序执行；`executeInstruction` 也不校验前序依赖，存在乱序执行风险。

**修复**：
- 修改 `CompensationService.getNextInstructions()`：
  - 按 `executionOrder` 遍历所有指令
  - 只返回第一个真正可执行的指令（最小顺序、状态为 PENDING）
  - 同时返回所有阻塞原因（等待人工确认、失败、待执行等）
  - 返回格式：`{ next: Instruction, allPending: [...], hasNext: boolean }`
- 修改 `CompensationService.executeInstruction()`：
  - 执行前校验所有 `executionOrder` 更小的前序指令
  - 前序指令必须为 `SUCCESS` 或 `SKIPPED` 状态
  - 前序未完成时返回明确错误信息：`"前序指令未完成: INST-XXX (顺序: X, 状态: XXX)"`
- 修改 Controller 返回类型适配新格式

### 2. 可预测执行结果

**问题**：原代码使用 `new Random().nextInt(10) > 2` 随机决定执行结果，失败/重试/导出结果不可稳定复现，影响核心流程验收。

**修复**：
- 移除随机数逻辑，默认执行成功
- 在 `ExecuteInstructionRequest` DTO 中新增 `forceFail` 参数（Boolean，默认 false）
- 调用方可通过 `forceFail: true` 强制触发执行失败，用于测试重试逻辑
- 失败信息明确区分：
  - `"执行失败，等待重试"` - 未达最大重试次数，状态回到 PENDING
  - `"执行失败，已达最大重试次数"` - 达到 maxRetry，状态变为 FAILED

### 3. Java 版本兼容性

**问题**：原代码编译为 Java 11（class file version 55.0），Java 8 环境无法运行。

**修复**：
- 修改 `pom.xml` 中 `java.version` 从 `11` 改为 `1.8`

### 4. 运行脚本优化

**问题**：环境缺失 Maven 时无法运行，缺少一键启动方案。

**修复**：
- 新增 `start.sh` 启动脚本：
  - 自动检测 Java 环境（支持系统 java 和 JAVA_HOME）
  - 自动检查 target/classes，缺失时尝试用 Maven 编译
  - 自动下载依赖到 target/dependency 目录
  - 自动构建 classpath 并启动
  - 友好的错误提示和替代方案
- 新增 `test-full.sh` 完整测试脚本（见下文）

## ✅ 测试验证增强

新增 `test-full.sh` 完整流程测试脚本，覆盖所有验收要点：

1. **幂等性测试**
   - 重复创建相同 processId 的补偿流程
   - 重复提交相同 executionId 的执行请求
   - 验证不产生脏数据

2. **顺序控制测试**
   - 验证 `/next` 只返回顺序 1 的指令
   - 尝试跳步执行顺序 3 的指令，验证被拦截
   - 验证前序完成后才能执行后续指令

3. **失败原因验证**
   - 乱序执行返回明确的前序依赖错误
   - 状态校验返回明确的状态信息

4. **重试机制验证**
   - 连续 3 次强制失败执行指令 3（maxRetry=3）
   - 验证前 2 次失败后回到 PENDING 状态
   - 验证第 3 次失败后变为 FAILED 状态

5. **历史查询验证**
   - 查询所有流程历史记录
   - 验证状态、节点数等信息正确

6. **导出一致性验证**
   - 连续两次导出执行报告
   - 验证两次导出结果完全一致

## 📁 文件变更清单

### 修改的文件
1. `pom.xml` - Java 版本 11 → 1.8
2. `src/main/java/com/compensation/service/CompensationService.java` - 顺序控制、可预测执行
3. `src/main/java/com/compensation/controller/CompensationController.java` - /next 接口返回类型
4. `src/main/java/com/compensation/dto/ExecuteInstructionRequest.java` - 新增 forceFail 字段
5. `src/test/resources/test-request.json` - processId 改为 ORDER-TEST-001
6. `README.md` - 更新技术栈、核心规则、启动说明、测试说明

### 新增的文件
1. `start.sh` - 一键启动脚本
2. `test-full.sh` - 完整流程测试脚本
3. `CHANGES.md` - 本修改记录文档

## 🚀 使用说明

### 启动服务
```bash
./start.sh
```

### 运行测试
```bash
./test-full.sh
```

### 测试数据说明
测试数据包含 4 条补偿指令：
- 顺序 1：ROLLBACK，无需人工确认，maxRetry=3
- 顺序 2：NOTIFY，**需要人工确认**，maxRetry=2
- 顺序 3：ROLLBACK，无需人工确认，maxRetry=3
- 顺序 4：COMPENSATE，无需人工确认，maxRetry=2
