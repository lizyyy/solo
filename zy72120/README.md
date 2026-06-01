# 河道漂浮物轨迹推演系统

## 快速开始
```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行样例
python main.py run

# 3. 查看参数版本对比
python main.py run --compare

# 4. 列出所有参数版本
python main.py list-params

# 5. 指定参数版本运行
python main.py run --params-version v1
```

## 目录结构
```
.
├── config/          # 参数配置
│   ├── params_v1.json    # 默认参数
│   └── params_v2.json    # 何工调整的汛期参数
├── data/            # 输入数据
│   └── sample_data.csv  # 样例数据
├── src/             # 核心模块
│   ├── params_manager.py    # 参数管理
│   ├── data_loader.py       # 数据加载
│   ├── anomaly_detector.py    # 异常检测
│   ├── trajectory_deductor.py  # 轨迹推演
│   ├── conflict_resolver.py # 冲突检测
│   └── report_generator.py # 报告生成
├── output/          # 输出结果
├── main.py          # 主程序入口
└── requirements.txt # 依赖
```

## 运行说明

### 运行样例数据
```bash
python main.py run
```

**输出内容：**
1. 数据质量报告（采样缺口、单位转换、缺失值）
2. 异常检测结果（高/中/低风险统计）
3. 处理建议（按责任方分类）
4. 巡检表冲突检测
5. 轨迹推演结果
6. 生成图表（轨迹图、汇总图）
7. 导出报告（TXT/CSV/JSON）

### 查看失败原因
**输出目录**：
- 所有文件位于 `output/` 目录
- 详细错误信息打印在控制台
- 数据质量报告里有问题点标记

## 样例数据特性
- 采样缺口：08:10 → 08:25 缺15分钟
- 单位混写：m/s, km/h, m/min, m^2, m², cm2
- 明显超限：08:40 流速3.2m/s + 尺寸3.0m2 + 漂移650m
- 巡检备注：与系统检测冲突点

## 改参数
编辑 `config/params_v2.json 或创建新版本

## 常见问题

**Q: 如何创建新参数版本？**
在 config/ 下复制现有文件，版本号自动递增

**Q: 为什么巡检表和系统结果冲突怎么办？**
系统只列证据，不替您拍板，看冲突报告自己判断

**Q: 结果怎么看？**
看 output/*.txt 报告里有完整留痕（来源、时间、版本号）
