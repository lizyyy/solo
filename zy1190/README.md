# Cache Lab - CPU Cache 性能实验台

一个用于教学和演示 CPU 缓存性能问题的本地实验台。通过可视化的方式帮助你理解缓存行、Cache Miss、伪共享和 NUMA 远端内存如何影响程序性能。

## 📋 功能特性

### 🔧 实验配置
- **数组大小**: 可配置 64MB 到 1GB 的测试数组
- **访问步长**: 从顺序访问到大跨步访问
- **线程数**: 1-16 线程，观察多线程场景
- **结构体布局**: 坏布局/好布局/混合布局，演示伪共享
- **缓存行大小**: 可配置 32-256 字节
- **NUMA 节点**: 支持 NUMA 架构的本地/远端内存对比
- **线程亲和性**: 可绑定线程到特定 CPU 核心

### 🧪 支持的测试类型
1. **顺序访问** - 最佳缓存利用场景
2. **跨步访问** - 观察缓存行利用率问题
3. **随机访问** - 最差缓存性能场景
4. **伪共享** - 多线程共享缓存行的性能陷阱
5. **NUMA 测试** - 本地 vs 远端内存访问对比

### 📊 可视化展示
- **Hit/Miss 比率**: 饼图展示缓存命中情况
- **延迟时间线**: 折线图展示每次迭代的延迟
- **线程冲突**: 柱状图展示线程间的缓存行冲突
- **优化建议**: 针对每个实验提供具体的优化建议

### 💾 数据管理
- **导入 workload.json**: 批量导入预设实验配置
- **保存多次实验**: 所有实验记录持久化存储
- **对比方案**: 多实验横向对比分析
- **导出报告**: Markdown / JSON 格式报告导出

## 🏗️ 项目架构

```
cache-lab/
├── engine/                    # C++ 性能测试引擎
│   ├── include/
│   │   ├── benchmark.h       # 基准测试接口定义
│   │   └── utils.h           # 工具函数 (RDTSC, Timer 等)
│   ├── src/
│   │   ├── benchmark.cpp     # 基准测试调度
│   │   ├── sequential_access.cpp
│   │   ├── stride_access.cpp
│   │   ├── random_access.cpp
│   │   ├── false_sharing.cpp
│   │   ├── numa_test.cpp
│   │   └── utils.cpp
│   ├── main.cpp              # 命令行入口
│   └── CMakeLists.txt
│
├── backend/                   # Python Flask 后端
│   ├── app.py                 # REST API 服务
│   ├── benchmark_runner.py    # 运行 C++ 引擎
│   ├── data_manager.py        # 实验数据管理
│   ├── report_generator.py    # 报告生成
│   ├── requirements.txt
│   └── tests/
│       └── test_backend.py    # 单元测试
│
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # 仪表盘
│   │   │   ├── ExperimentList.tsx # 实验列表
│   │   │   ├── NewExperiment.tsx  # 新建实验
│   │   │   ├── ExperimentDetail.tsx
│   │   │   ├── ComparisonList.tsx
│   │   │   └── ComparisonDetail.tsx
│   │   ├── services/
│   │   │   └── api.ts           # API 封装
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript 类型
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── data/                      # 数据目录
│   ├── experiments/           # 实验记录
│   ├── comparisons/           # 对比分析
│   ├── exports/               # 导出文件
│   └── workloads/
│       └── workload.json      # 预设工作负载
│
├── samples/                   # 教学示例
│   └── bad_examples.cpp       # 坏样例 vs 好样例
│
└── README.md
```

## 🚀 快速开始

### 环境要求
- C++17 编译器 (GCC 7+ 或 Clang 5+)
- CMake 3.15+
- Python 3.8+
- Node.js 16+ (前端)
- NUMA 库 (Linux 可选，用于 NUMA 测试)

### 安装步骤

#### 1. 构建 C++ 引擎
```bash
cd engine
mkdir build && cd build
cmake ..
make -j4
```

#### 2. 安装 Python 依赖
```bash
cd ../../backend
pip install -r requirements.txt
```

#### 3. 安装前端依赖
```bash
cd ../../frontend
npm install
```

### 启动服务

#### 方式一：分别启动
```bash
# 终端 1: 启动后端
cd backend
python app.py

# 终端 2: 启动前端
cd frontend
npm run dev
```

#### 方式二：使用前端代理 (推荐)
只需启动后端，前端开发服务器会自动代理 API 请求：
```bash
# 终端 1: 后端 (端口 5000)
cd backend && python app.py

# 终端 2: 前端 (端口 3000)
cd frontend && npm run dev
```

然后访问 http://localhost:3000

## 📖 使用指南

### 创建第一个实验

1. 点击左侧菜单 **"新建实验"**
2. 填写实验名称和描述
3. 选择测试类型：
   - **顺序访问**: 观察最佳缓存性能
   - **跨步访问**: 观察步长对缓存的影响
   - **随机访问**: 观察最差缓存性能
   - **伪共享**: 观察多线程缓存行冲突
   - **NUMA 测试**: 观察 NUMA 架构影响 (需要多 NUMA 节点)
4. 配置参数（根据测试类型不同）
5. 点击 **"创建并运行"** 或 **"仅保存"**

### 查看实验结果

1. 在 **"实验列表"** 中选择一个实验
2. 查看：
   - **统计卡片**: 总时间、吞吐量、延迟、命中率
   - **图表分析**: 延迟时间线、Hit/Miss 饼图、线程冲突
   - **详细数据**: 完整的数值结果
   - **分析与建议**: 布局分析、NUMA 延迟、优化建议

### 对比多个实验

1. 点击 **"对比分析"** → **"新建对比"**
2. 选择至少 2 个已完成的实验
3. 选择要对比的指标
4. 查看对比表格、柱状图、相对变化分析

### 导入/导出

- **导入**: 点击任意页面的导入功能，上传 `workload.json` 格式文件
- **导出**: 在实验详情页点击 "导出 Markdown" 或 "导出 JSON"

## 🎓 学习资源

### 预设工作负载
`data/workloads/workload.json` 包含预设的教学实验：

| 实验名称 | 测试类型 | 预期行为 |
|---------|---------|---------|
| 顺序访问基准测试 | sequential | ~95%+ 命中率 |
| 大跨步访问测试 | stride=16 | ~0% 命中率 |
| 随机访问测试 | random | ~0% 命中率 |
| 伪共享 - 坏布局 | false_sharing | 极差性能 |
| 伪共享 - 好布局 | false_sharing | 优秀性能 |

### 教学示例代码
`samples/bad_examples.cpp` 包含完整的教学代码：

```cpp
// 坏样例 1: 伪共享
struct BadCounter {
    std::atomic<uint64_t> count1;  // 同一缓存行
    std::atomic<uint64_t> count2;  // 同一缓存行
    std::atomic<uint64_t> count3;  // 同一缓存行
    std::atomic<uint64_t> count4;  // 同一缓存行
};

// 好样例 1: 避免伪共享
struct GoodCounter {
    alignas(64) std::atomic<uint64_t> count1;  // 独占缓存行
    alignas(64) std::atomic<uint64_t> count2;  // 独占缓存行
    alignas(64) std::atomic<uint64_t> count3;  // 独占缓存行
    alignas(64) std::atomic<uint64_t> count4;  // 独占缓存行
};
```

### 关键概念

#### 1. 缓存行 (Cache Line)
- CPU 缓存的基本传输单位，通常为 **64 字节**
- 即使只访问 1 字节，也会加载整个缓存行
- 空间局部性：相邻数据一起加载

#### 2. Cache Miss 类型
- **Cold Miss**: 首次访问
- **Capacity Miss**: 缓存容量不足
- **Conflict Miss**: 缓存冲突 (多路组相联)
- **Coherence Miss**: 缓存一致性导致 (伪共享)

#### 3. 伪共享 (False Sharing)
- 多个线程修改同一缓存行的不同变量
- 即使没有数据依赖，缓存一致性协议也会导致性能损失
- 解决方案：`alignas(64)` 让每个变量独占缓存行

#### 4. NUMA 架构
- 非一致内存访问
- 访问本地 NUMA 节点内存快
- 访问远端 NUMA 节点内存慢 (1.5x - 3x)
- 解决方案：线程和内存绑定到同一 NUMA 节点

## 🔧 API 参考

### 后端 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/tests | 获取可用测试列表 |
| GET | /api/experiments | 获取实验列表 |
| POST | /api/experiments | 创建实验 |
| GET | /api/experiments/:id | 获取实验详情 |
| POST | /api/experiments/:id/run | 同步运行实验 |
| POST | /api/experiments/:id/run-async | 异步运行实验 |
| GET | /api/comparisons | 获取对比列表 |
| POST | /api/comparisons | 创建对比 |
| GET | /api/comparisons/:id/analyze | 分析对比 |
| GET | /api/experiments/:id/report/markdown | 导出 Markdown |
| GET | /api/experiments/:id/report/json | 导出 JSON |

### C++ 引擎命令行

```bash
# 基本用法
./cache_bench --test sequential --array-size 67108864

# 所有选项
./cache_bench \
  --test sequential       # 测试类型: sequential, stride, random, false_sharing, numa
  --array-size 67108864   # 数组大小 (字节)
  --stride 1               # 访问步长
  --threads 4              # 线程数
  --cache-line 64          # 缓存行大小
  --iterations 10          # 迭代次数
  --seed 42                 # 随机种子
  --layout bad              # 结构体布局: bad, good, mixed
  --numa-node 0             # NUMA 节点
  --config config.json      # 从 JSON 读取配置
  --output result.json      # 输出结果到 JSON
  --list-tests              # 列出可用测试
```

## 🧪 运行测试

### 后端测试
```bash
cd backend
pip install pytest
pytest tests/test_backend.py -v
```

### 前端构建
```bash
cd frontend
npm run build
```

## 📋 预设实验建议

### 学习路径

1. **基础实验**: 顺序访问 vs 跨步访问 vs 随机访问
   - 观察命中率的巨大差异
   - 理解空间局部性的重要性

2. **伪共享实验**: 坏布局 vs 好布局
   - 观察性能差异 (可能 10x+)
   - 理解 `alignas(64)` 的作用

3. **步长实验**: 不同步长的性能对比
   - 步长 = 1, 2, 4, 8, 16, 32
   - 绘制步长 vs 延迟曲线

4. **NUMA 实验** (如果有条件):
   - 本地内存 vs 远端内存
   - 观察慢 down 因子

## 🐛 常见问题

### Q: 为什么有些测试运行很慢？
A: 这是预期行为！比如：
- 随机访问本来就很慢 (Cache Miss)
- 伪共享的坏布局本来就很慢 (缓存一致性开销)
- 这正是我们要观察的性能问题

### Q: 我需要 NUMA 支持吗？
A: 不需要。NUMA 测试仅在多 NUMA 节点系统上有意义。在普通系统上，可以：
- 使用 Mock 模式 (后端会生成模拟数据)
- 跳过 NUMA 相关测试

### Q: C++ 引擎编译失败怎么办？
A: 如果无法编译 C++ 引擎，后端会自动使用 Mock 模式生成模拟数据。Mock 数据：
- 基于真实的性能模型
- 足够用于教学和演示
- 但不是真实的硬件测量

### Q: 如何查看真实的硬件计数器？
A: 本项目目前使用软件模拟的延迟和命中率估算。要获取真实的硬件性能计数器：
- Linux: 使用 `perf` 工具
- Windows: 使用 Performance Monitor
- macOS: 使用 Instruments

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📚 扩展阅读

- [What Every Programmer Should Know About Memory](https://people.freebsd.org/~lstewart/articles/cpumemory.pdf) - Ulrich Drepper
- [Intel 64 and IA-32 Architectures Optimization Reference Manual](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Cache: A Place for Concealment and Safekeeping](https://www.cs.cmu.edu/afs/cs/academic/class/15213-f15/www/lectures/17-cache-basics.pdf) - CMU 15-213
