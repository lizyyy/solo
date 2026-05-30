# 微分方程药量模拟 - 快速启动

## 5分钟快速上手

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 打开浏览器
访问 `http://localhost:5173`

### 4. 运行第一个模拟
1. 从"样例管理"选择"常规给药方案"
2. 点击"运行模拟"按钮
3. 观察浓度曲线的积累和衰减

### 5. 查看详情
- 点击曲线上任意点查看该时间点的详细数据
- 右侧面板显示：模拟结论、事件时间线、参数对比验证

### 6. 导出结果
- **CSV**: 导出所有时间点的浓度数据
- **JSON**: 导出当前配置和结论
- **图片**: 导出当前图表为PNG

---

## 项目结构速览
```
src/
├── components/          # UI组件
│   ├── ParameterPanel   # 参数配置面板
│   ├── ConcentrationChart # 浓度曲线图
│   ├── DetailPanel      # 详情侧边栏
│   ├── SampleManager    # 样例管理
│   └── ExportControls   # 导出控制
├── store/
│   └── simulationStore  # Zustand状态管理
├── utils/
│   ├── odeSolver        # 微分方程求解器(RK4)
│   └── pharmacokinetics # 药代动力学公式
├── data/
│   └── samples          # 内置样例数据
└── types/
    └── simulation       # TypeScript类型定义
```

---

## 核心算法说明

### 一室模型微分方程
```
dC/dt = -k * C + (D/V) * δ(t - τ)
```
- C: 血药浓度
- k: 消除速率常数 (= ln2/t½)
- D: 给药剂量
- V: 分布容积
- δ: 脉冲给药

### 数值解法
采用**四阶龙格-库塔法(RK4)** 进行数值积分，确保计算精度。

---

## 特殊业务规则

1. **剂量-半衰期不一致**：详情面板中用醒目标识显示，给药间隔作为补充证据
2. **间隔为零**：按时间先后展示浓度越界事件，带顺序标记
3. **结论印证**：阈值线与参数对比表格联动，数值一致高亮显示

---

## 自定义样例格式(JSON)
```json
{
  "drug": {
    "name": "药物名称",
    "halfLife": 6,
    "volumeOfDistribution": 40,
    "therapeuticMin": 5,
    "therapeuticMax": 20,
    "unit": "mg/L"
  },
  "dosing": {
    "dose": 500,
    "interval": 6,
    "dosesCount": 10,
    "startTime": 0
  },
  "simulationDuration": 72,
  "timeStep": 0.1
}
```
