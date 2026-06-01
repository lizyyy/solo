# 播客广告口播响度审查系统

用于批量审查播客广告口播音频响度，串连文件、曲目、批注和异常原因，方便交接和追溯。

## 功能特点

- ✅ **批量处理**：坏文件不拖垮整批，正常文件先出结果
- 📝 **完整链路**：记录原始来源、处理时间、审查原因
- 📊 **多格式导出**：CSV / JSON / Excel，带完整审查信息
- 📜 **旧口径支持**：从舞台通道表导入历史数据，保留上下文
- ⚠️ **异常标注**：需人工确认的记录清晰标记

## 目录结构

```
.
├── data/
│   ├── audio/          # 样例音频文件放这里
│   ├── tracklists/     # 曲目表（CSV/Excel）
│   └── notes/          # 群聊补充批注
├── src/                # 源代码
├── output/             # 导出的报告
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行完整演示

```bash
node src/demo.js
```

演示包含以下场景：

| 类型 | 说明 | 状态 |
|------|------|------|
| 顺利通过 | 品牌开场口播，响度正常 | ✅ 通过 |
| 需人工确认 | 产品介绍口播，音量过高但有群聊批注说明 | ⚠️ 需人工确认 |
| 旧口径 | 舞台通道表历史数据，2024年10月批次 | 📜 旧口径 |
| 坏文件 | 空文件、损坏文件，不影响其他文件处理 | ❌ 失败 |

### 3. 扫描实际音频

```bash
# 扫描音频目录，自动关联曲目表和批注
node src/cli.js scan --tracklist data/tracklists/sample_tracklist.csv --notes data/notes/sample_notes.json --export
```

## 样例音频存放位置

所有音频文件放在 `data/audio/` 目录下，支持格式：
- `.mp3`
- `.wav`
- `.m4a`
- `.aac`
- `.flac`

### 提供的样例文件

| 文件名 | 说明 | 预期结果 |
|--------|------|----------|
| `ad_opening_normal.mp3` | 正常响度的开场口播 | 通过 |
| `ad_product_loud.mp3` | 音量偏高的产品口播 | 需人工确认 |
| `corrupted_file.mp3` | 损坏文件（模拟） | 失败 |
| `empty_file.wav` | 空文件（模拟） | 失败 |

## 曲目表格式

放在 `data/tracklists/`，支持 CSV 和 Excel。

字段说明：
- `trackId` / `序号` - 曲目编号
- `title` / `曲目` / `名称` - 曲目标题
- `artist` / `歌手` / `表演者` - 录制人
- `fileName` / `文件名` - 对应的音频文件名
- `notes` / `批注` / `备注` - 初始批注
- `status` / `状态` - 初始状态

## 批注格式

放在 `data/notes/`，支持 JSON 和 CSV：

```json
[
  {
    "trackId": "A002",
    "note": "群里王老师说这个版本是专门给老年听众录的",
    "author": "演出统筹阿蓝",
    "createdAt": "2024-12-15T10:30:00Z",
    "source": "微信群聊"
  }
]
```

## 报告导出

运行扫描后，报告自动导出到 `output/` 目录：

### 导出的报告包含

- **审查状态**：通过 / 需人工确认 / 旧口径 / 失败
- **审查原因**：详细说明判定依据
- **批注**：带来源信息的批注记录
- **数据来源**：曲目表 / 舞台通道表 / 文件验证
- **处理时间**：每条记录的处理时间戳
- **响度数据**：LUFS 值、峰值 dB

### 导出格式

| 格式 | 文件名 | 用途 |
|------|--------|------|
| CSV | `播客广告口播响度审查_时间.csv` | Excel打开、数据处理 |
| JSON | `播客广告口播响度审查_时间.json` | 程序读取、二次开发 |
| Excel | `播客广告口播响度审查_时间.xlsx` | 直接查看、交接 |

## 交给演出统筹阿蓝的交接清单

1. ✅ `output/` 目录下的三份报告
2. ✅ 每条记录都有明确的审查原因
3. ✅ 旧口径记录标注了来源和当时标准
4. ✅ 批注保留了原始添加人和群聊来源
5. ✅ 处理时间完整记录，便于追溯

## 配置说明

默认响度标准可在 `src/config.js` 修改：

```javascript
loudness: {
  targetLUFS: -16,      // 目标响度
  toleranceLUFS: 2,     // 容差范围
  minLUFS: -20,         // 最低阈值
  maxLUFS: -12,         // 最高阈值
  maxPeak: -1           // 峰值限制 (dB)
}
```

## 脏数据处理能力

- 空文件 → 标记失败，不影响其他文件
- 损坏文件 → 标记失败，记录错误原因
- 格式不支持 → 提前过滤
- 曲目表与音频不匹配 → 音频单独处理，保留文件名关联

## 使用示例

```javascript
const ReviewService = require('./src/reviewService');

const service = new ReviewService();

// 1. 加载曲目表
await service.loadTracklist('data/tracklists/sample_tracklist.csv');

// 2. 加载批注
await service.loadNotes('data/notes/sample_notes.json');

// 3. 扫描音频目录
await service.scanAudioDirectory();

// 4. 导出报告
await service.exportReports('all', '播客广告口播响度审查');
```

---

**交接人**：演出统筹阿蓝  
**说明**：不用再翻舞台通道表了，所有原因都在报告里
