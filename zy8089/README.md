# BLE OTA Package Pre-Checker

CLI 工具，用于在灰度发布前预检 BLE 设备 OTA 包的完整性和兼容性。

## 功能特性

- ✅ 解析 firmware_manifest.json、device_caps.yaml、rollout.csv
- ✅ 版本升级路径校验（检测目标设备固件版本高于包版本等问题）
- ✅ 分片哈希校验、顺序检查、重复检测
- ✅ 设备能力匹配校验
- ✅ 断点续传清单验证
- ✅ 生成 ota_report.md 报告
- ✅ 生成 retry_plan.json 重试计划
- ✅ 生成可打开的 timeline.html 时间线

## 安装

```bash
npm install
npm run build
```

## 用法

```bash
npm run demo
```

或者直接运行：

```bash
node dist/cli.js \
  --manifest firmware_manifest.json \
  --chunks chunks/ \
  --caps device_caps.yaml \
  --rollout rollout.csv
```

## 参数说明

| 参数 | 别名 | 说明 |
|------|------|------|
| --manifest | -m | firmware_manifest.json 文件路径 |
| --chunks | -c | 分片文件目录路径 |
| --caps | -p | device_caps.yaml 文件路径 |
| --rollout | -r | rollout.csv 文件路径 |

## 输入文件格式

### firmware_manifest.json

```json
{
  "version": "2.1.0",
  "targetDeviceType": "ble_sensor_v2",
  "minSupportedVersion": "1.5.0",
  "maxSupportedVersion": "2.0.9",
  "releaseDate": "2024-01-15",
  "chunks": [
    {
      "index": 0,
      "hash": "sha256-hash",
      "size": 1024,
      "filename": "chunk_0.bin"
    }
  ],
  "totalSize": 2560,
  "metadata": {
    "buildId": "build-xxx",
    "commitHash": "abc123",
    "signingKey": "key-id"
  }
}
```

### device_caps.yaml

```yaml
capabilities:
  - deviceType: ble_sensor_v2
    model: BLE-SENSOR-2000
    maxChunkSize: 2048
    supportedHashAlgorithms:
      - SHA-256
    minBatteryLevel: 20
    supportsResume: true
    maxRolloutRate: 100
```

### rollout.csv

```csv
device_id,device_type,current_version,target_version,priority,region
sensor-001,ble_sensor_v2,2.0.0,2.1.0,high,us-west
```

## 输出文件

### ota_report.md

详细的 Markdown 格式报告，包含所有校验结果。

### retry_plan.json

包含失败设备的重试计划，按优先级排序。

### timeline.html

可视化的发布时间线页面，可直接在浏览器中打开。

## 检测的问题

- ✅ **重复分片**: 检测具有相同哈希值的分片
- ✅ **版本过高**: 检测目标设备固件版本高于包版本的情况
- ✅ **版本过低**: 检测设备版本低于最低支持版本
- ✅ **设备类型不匹配**: 检测设备类型与目标类型不兼容
- ✅ **分片哈希不匹配**: 验证分片文件的完整性
- ✅ **分片缺失**: 检测缺失的分片文件
- ✅ **分片顺序错误**: 验证分片索引顺序
- ✅ **设备能力不足**: 检测设备能力不满足要求

## 示例数据

示例数据位于 `sample/` 目录，运行 `npm run demo` 即可测试。

## 技术栈

- Node.js 18+
- TypeScript
- YAML 解析
- CSV 解析
- SHA-256 哈希校验
