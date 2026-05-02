# 微震事件复核工具

一个用于矿山地压监测的本地 Streamlit 微震事件复核工具，支持数据导入、P波拾取、事件定位和结果导出。

## 功能特性

- **数据导入**：支持导入台站文件 (stations.csv)、波形数据 (waveforms/*.csv) 和速度模型 (velocity_model.yaml)
- **数据校验**：自动校验台站坐标、采样率等数据有效性
- **P波拾取**：支持 STA/LTA 方法和简化阈值方法两种拾取算法
- **事件定位**：基于到时差的最小二乘定位算法
- **波形查看**：多台站波形对比、拾取细节放大查看
- **边界处理**：自动处理缺台站、跨午夜采样等边界情况
- **结果导出**：支持导出 events.csv 和 review_report.md

## 项目结构

```
microseismic-review-tool/
├── app.py                    # Streamlit 主应用
├── config.py                 # 配置参数
├── data_loader.py            # 数据加载模块
├── validator.py              # 数据校验模块
├── picker.py                 # P波拾取模块
├── locator.py                # 事件定位模块
├── test_minimal.py           # 最小测试脚本
├── generate_sample_data.py   # 示例数据生成脚本
├── requirements.txt          # Python 依赖
├── README.md                 # 本文档
└── sample_data/              # 示例数据目录
    ├── stations.csv          # 台站配置
    ├── velocity_model.yaml   # 速度模型
    └── waveforms/            # 波形数据目录
        ├── STA001.csv
        ├── STA002.csv
        ├── STA003.csv
        ├── STA004.csv
        ├── STA005.csv
        ├── STA006.csv
        └── STA_MIDNIGHT.csv  # 跨午夜测试波形
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行应用

```bash
streamlit run app.py
```

应用将在浏览器中自动打开，默认地址为 `http://localhost:8501`

### 3. 使用示例数据

应用内置示例数据生成功能，在「数据导入」页面点击「加载示例数据」按钮即可快速体验。

或者手动生成示例数据：

```bash
python3 generate_sample_data.py
```

### 4. 运行测试

```bash
python3 test_minimal.py
```

## 数据格式说明

### 1. 台站文件 (stations.csv)

必需列：
- `station_id`: 台站唯一标识
- `x`: X坐标 (米)
- `y`: Y坐标 (米)
- `z`: Z坐标 (米，根据约定，向上或向下为正)

可选列：
- `sampling_rate`: 采样率 (Hz)，默认 1000
- `channel`: 通道类型，默认 Z

示例：
```csv
station_id,x,y,z,sampling_rate,channel
STA001,0,0,0,1000,Z
STA002,500,0,0,1000,Z
STA003,0,500,0,1000,Z
```

### 2. 波形数据 (waveforms/*.csv)

每个台站一个CSV文件，文件名建议使用台站ID命名（如 `STA001.csv`）。

必需列：
- 时间列：列名包含 `time` 或 `timestamp`（可选，用于计算采样率）
- 数据列：列名包含 `velocity`, `amplitude`, `data`, `value`, `x`, `y`, `z`, `n`, `e` 等

示例：
```csv
time,velocity
0.0,0.0123
0.001,-0.0045
0.002,0.0089
...
```

### 3. 速度模型 (velocity_model.yaml) - 可选

均匀速度模型示例：
```yaml
p_velocity: 5000.0  # P波速度 (m/s)
s_velocity: 2890.0  # S波速度 (m/s)
```

分层速度模型示例：
```yaml
layers:
  - depth: 0
    vp: 4500
    vs: 2600
  - depth: 200
    vp: 5000
    vs: 2890
  - depth: 500
    vp: 5500
    vs: 3180
```

## 使用流程

### 1. 数据导入
- 上传台站文件、波形文件和可选的速度模型
- 或点击「加载示例数据」快速体验
- 查看数据加载状态和统计信息

### 2. 数据校验
- 自动检查台站坐标有效性
- 检查采样率范围
- 检测缺台站、缺波形情况
- 检测跨午夜采样

### 3. P波拾取
- 选择拾取方法：STA/LTA 或 阈值方法
- 调整拾取参数（在侧边栏）
- 执行拾取并查看结果
- 查看各台站拾取质量和详细波形

### 4. 事件定位
- 确认有效台站数量（至少需要3个）
- 执行事件定位
- 查看定位坐标、残差、质量等级
- 查看台站和事件位置分布图

### 5. 波形查看
- 多台站波形对比
- 拾取附近放大查看
- 波形统计信息

### 6. 结果导出
- 添加复核评论
- 导出 events.csv：事件定位结果
- 导出 review_report.md：完整复核报告

## 边界处理说明

### 1. 缺台站处理
- 检测有波形但无台站配置的情况
- 检测有台站配置但无波形的情况
- 在数据校验页面显示警告信息

### 2. 跨午夜采样处理
- 自动检测波形是否跨越午夜
- 提供波形分割功能
- 不影响正常的拾取和定位流程

### 3. 不足台站定位
- 定位需要至少3个有效台站
- 台站数量不足时给出明确提示

## 算法说明

### STA/LTA 拾取算法
STA (Short-Term Average) / LTA (Long-Term Average) 是经典的地震波拾取算法：
- 计算短时平均和长时平均的比值
- 当比值超过阈值时触发拾取
- 参数：STA窗口、LTA窗口、触发阈值

### 阈值拾取算法
简化的阈值检测方法：
- 估计前N秒的噪声水平
- 阈值 = 噪声水平 × 倍数
- 检测超过阈值且持续时间足够的信号

### 定位算法
基于 Geiger 方法的最小二乘反演：
- 目标函数：最小化到时残差
- 使用 Levenberg-Marquardt 算法优化
- 支持台站权重（基于拾取质量）
- 计算定位误差估计

## 配置参数

主要配置参数位于 `config.py`：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| DEFAULT_STA_WINDOW | 0.05 | STA窗口长度（秒） |
| DEFAULT_LTA_WINDOW | 0.5 | LTA窗口长度（秒） |
| DEFAULT_STA_LTA_THRESHOLD | 3.0 | STA/LTA触发阈值 |
| DEFAULT_THRESHOLD_MULTIPLIER | 3.0 | 阈值方法倍数 |
| MIN_STATIONS_FOR_LOCATION | 3 | 定位最小台站数 |
| DEFAULT_VELOCITY_P | 5000.0 | 默认P波速度 (m/s) |

## 输出文件说明

### events.csv
事件定位结果表格，包含以下字段：
- `event_id`: 事件ID
- `x, y, z`: 定位坐标
- `origin_time`: 发震时刻
- `residual, rms`: 残差指标
- `azimuthal_gap`: 方位角间隙
- `x_err, y_err, z_err`: 坐标误差
- `n_used_stations`: 使用台站数
- `quality_class`: 质量等级

### review_report.md
Markdown格式的完整复核报告，包含：
- 数据摘要
- 台站信息
- P波拾取结果
- 事件定位结果
- 复核评论
- 数据校验记录

## 依赖说明

主要依赖包：
- `streamlit>=1.30.0`: Web应用框架
- `pandas>=2.0.0`: 数据处理
- `numpy>=1.24.0`: 数值计算
- `matplotlib>=3.7.0`: 静态绘图
- `scipy>=1.11.0`: 科学计算（优化、信号处理）
- `pyyaml>=6.0`: YAML解析
- `plotly>=5.15.0`: 交互式绘图

## 开发说明

### 添加新的拾取方法
1. 在 `picker.py` 中继承或扩展现有拾取器类
2. 实现 `pick()` 方法，返回 `PickResult` 对象
3. 在 `PWavePicker` 类中添加新方法的支持

### 添加新的定位算法
1. 在 `locator.py` 中扩展 `EventLocator` 类
2. 实现新的定位方法
3. 保持 `LocationResult` 输出格式一致

## 常见问题

### Q: 定位失败或质量差？
A: 可能原因：
- 有效台站数量不足（至少需要3个）
- 拾取质量差，到时误差大
- 台站分布不均匀，方位角间隙大
- 速度模型不准确

### Q: 如何提高拾取精度？
A: 建议：
- 调整 STA/LTA 窗口参数
- 检查波形信噪比
- 必要时手动调整拾取（后续版本支持）

### Q: 支持哪些波形格式？
A: 当前支持 CSV 格式，包含时间列和数据列。如需支持其他格式（如 MiniSEED, SAC），可扩展 `data_loader.py`。

## 版本历史

- v1.0.0 (2024-05-03)
  - 初始版本发布
  - 支持数据导入、校验、拾取、定位
  - 支持缺台站、跨午夜边界处理
  - 提供示例数据和测试脚本

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue 或 PR。
