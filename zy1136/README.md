# 公司网络管理台

一个本地可运行的公司网络资产管理系统，用于管理办公网络设备、IP地址、网段、VLAN、告警和防火墙变更。

## 功能特性

### 核心功能
- **资产管理**: 管理电脑、服务器、打印机、交换机、AP、摄像头等设备信息
- **IP地址管理**: IP分配、MAC绑定、状态跟踪
- **网段/VLAN管理**: 网段规划、VLAN配置、利用率监控
- **拓扑关系**: 网络设备连接关系可视化
- **风险检查**: 自动检测IP冲突、网段利用率过高、DHCP租约过期、未知设备等风险
- **告警管理**: 告警归并、确认、统计分析
- **变更管理**: 变更单工作流（待评估→已批准→执行中→已执行→已完成），影响评估
- **防火墙规则**: 规则管理、安全风险检测
- **报告导出**: 支持Markdown、HTML、CSV三种格式的报告导出

### 风险检测类型
| 风险类型 | 严重程度 | 说明 |
|---------|---------|------|
| IP地址冲突 | 严重 | 同一IP被多个设备使用 |
| 网段利用率过高 | 高/中 | 网段IP使用率超过阈值 |
| DHCP租约过期 | 低 | 租约长期未更新 |
| 未知设备接入 | 高 | 未在资产库登记的设备 |
| 端口未登记 | 中 | 交换机端口状态Up但未登记 |
| 访客网误通内网 | 严重 | 防火墙规则允许访客网访问内网 |
| 防火墙规则过宽 | 高 | 源/目的/端口过于宽松 |
| 服务端口暴露 | 高/中/低 | 敏感端口对外暴露 |

## 技术架构

### 后端
- **运行环境**: Node.js 18+
- **Web框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **数据验证**: express-validator + Joi
- **文件处理**: csv-parser + multer
- **日志记录**: morgan
- **安全防护**: helmet + cors

### 前端
- **构建工具**: Vite
- **UI框架**: React 18 + Ant Design 5
- **状态管理**: React Hooks
- **路由**: React Router 6
- **图表**: Recharts
- **HTTP请求**: Axios
- **日期处理**: Day.js

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0 或 yarn >= 1.22.0

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend
npm install
cd ..

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 启动服务

#### 开发模式（前后端同时启动）

```bash
npm run dev
```

#### 单独启动后端

```bash
cd backend
npm run dev
```

后端服务地址: http://localhost:3001

#### 单独启动前端

```bash
cd frontend
npm run dev
```

前端服务地址: http://localhost:3000

### 生产构建

```bash
# 构建前后端
npm run build

# 启动生产服务
npm start
```

## 数据导入

系统支持导入以下类型的数据文件：

### 导入格式说明

#### 1. 资产数据 (CSV)
```csv
name,type,mac_address,serial_number,department,owner,location,purchase_date,status,notes
办公电脑-001,computer,00:1A:2B:3C:4D:5E,SN-2024-001,技术部,张三,1楼办公区,2023-01-15,active,开发用台式机
```

**设备类型说明**:
- `computer`: 电脑
- `server`: 服务器
- `printer`: 打印机
- `switch`: 交换机
- `router`: 路由器
- `ap`: 无线AP
- `camera`: 摄像头
- `firewall`: 防火墙

**状态说明**:
- `active`: 在线
- `inactive`: 离线
- `maintenance`: 维护中
- `retired`: 已退役

#### 2. 拓扑数据 (JSON)
```json
{
  "nodes": [
    {"id": "core-sw", "name": "核心交换机", "type": "switch", "mac_address": "00:1A:2B:3C:4D:90"}
  ],
  "edges": [
    {"source": "core-sw", "target": "sw-1f", "type": "trunk", "relationship_type": "uplink"}
  ]
}
```

#### 3. DHCP租约 (CSV)
```csv
ip,mac_address,hostname,start_time,expire_time,server_id,status
192.168.10.100,00:1A:2B:3C:4D:5E,PC-001,2024-05-04T08:00:00,2024-05-04T20:00:00,DHCP-SRV-01,active
```

#### 4. 防火墙规则 (CSV)
```csv
rule_number,name,action,source,destination,protocol,ports,description,is_enabled
1,允许办公网访问互联网,allow,192.168.10.0/24,any,tcp,80;443,办公网HTTP/HTTPS访问,true
```

**动作说明**:
- `allow`: 允许
- `deny`: 拒绝

#### 5. 告警数据 (JSONL)
每行一个JSON对象：
```jsonl
{"title":"IP地址冲突","type":"ip_conflict","severity":"critical","ip_address":"192.168.10.100","description":"检测到IP冲突"}
{"title":"网段利用率过高","type":"high_utilization","severity":"high","description":"网段利用率超过90%"}
```

**严重程度**:
- `critical`: 严重
- `high`: 高
- `medium`: 中
- `low`: 低
- `info`: 信息

#### 6. VLAN数据 (CSV)
```csv
vlan_id,name,type,is_guest,description
10,办公VLAN,data,false,公司内部办公网络VLAN
30,访客VLAN,guest,true,访客网络专用VLAN
```

**VLAN类型**:
- `data`: 数据VLAN
- `voice`: 语音VLAN
- `management`: 管理VLAN
- `guest`: 访客VLAN

#### 7. 网段数据 (CSV)
```csv
name,cidr,gateway,dns_servers,vlan_id,description
办公网-1楼,192.168.10.0/24,192.168.10.1,8.8.8.8;8.8.4.4,10,1楼办公网段
```

### 种子数据

系统提供了完整的种子数据和异常样例数据，位于 `backend/data/` 目录：

```
backend/data/
├── seeds/                    # 种子数据（正常数据）
│   ├── assets.csv           # 资产数据（20+设备）
│   ├── topology.json        # 拓扑关系
│   ├── leases.csv           # DHCP租约
│   ├── firewall-rules.csv   # 防火墙规则（包含风险规则）
│   ├── vlans.csv            # VLAN配置
│   ├── segments.csv         # 网段配置
│   └── alerts.jsonl         # 告警数据（包含重复告警）
├── anomalies/                # 异常样例数据
│   ├── anomalies-assets.csv # 包含格式错误、重复数据的资产
│   └── anomalies-alerts.jsonl # 测试用告警数据
└── network-mgmt.db          # SQLite数据库（运行时自动创建）
```

### 导入步骤

1. 登录系统，进入「数据导入」页面
2. 选择要导入的数据类型
3. 选择对应的CSV/JSON/JSONL文件
4. 点击「确定」开始导入
5. 系统会显示导入结果：成功数量、失败数量、详细错误信息

## API 接口

### 基础路径
`http://localhost:3001/api`

### 资产接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /assets | 获取资产列表 |
| GET | /assets/:id | 获取资产详情 |
| POST | /assets | 创建资产 |
| PUT | /assets/:id | 更新资产 |
| DELETE | /assets/:id | 删除资产 |
| GET | /assets/stats | 获取资产统计 |

### 网络接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /ips | 获取IP地址列表 |
| GET | /ips/:id | 获取IP详情 |
| POST | /ips | 创建IP地址 |
| GET | /segments | 获取网段列表 |
| GET | /segments/:id | 获取网段详情 |
| POST | /segments | 创建网段 |
| GET | /vlans | 获取VLAN列表 |
| GET | /vlans/:id | 获取VLAN详情 |
| POST | /vlans | 创建VLAN |
| GET | /dhcp-leases | 获取DHCP租约 |

### 告警接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /alerts | 获取告警列表 |
| GET | /alerts/grouped | 获取归并告警 |
| GET | /alerts/:id | 获取告警详情 |
| POST | /alerts/:id/acknowledge | 确认告警 |
| POST | /alerts/group/:groupKey/acknowledge | 批量确认告警组 |

### 变更单接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /changes | 获取变更单列表 |
| GET | /changes/:id | 获取变更单详情 |
| POST | /changes | 创建变更单 |
| POST | /changes/:id/transition | 状态流转 |
| POST | /changes/analyze | 影响评估 |

### 风险接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /risks | 获取风险列表 |
| GET | /risks/:id | 获取风险详情 |
| POST | /risks/run-checks | 执行风险检查 |
| POST | /risks/:id/resolve | 标记风险已解决 |

### 拓扑接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /topology | 获取拓扑关系 |
| GET | /topology/full | 获取完整拓扑 |
| GET | /topology/hierarchy/:assetId | 获取设备层级 |

### 导入接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /import/assets | 导入资产数据 |
| POST | /import/topology | 导入拓扑数据 |
| POST | /import/dhcp-leases | 导入DHCP租约 |
| POST | /import/firewall-rules | 导入防火墙规则 |
| POST | /import/alerts | 导入告警数据 |
| POST | /import/segments | 导入网段数据 |
| POST | /import/vlans | 导入VLAN数据 |

### 报告接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /reports?format=markdown | 导出Markdown报告 |
| GET | /reports?format=html | 导出HTML报告 |
| GET | /reports?format=csv | 导出CSV报告 |
| GET | /reports/preview | 获取报告预览数据 |

## 变更单状态流

```
待评估 (pending_evaluation)
    ↓
┌───┴───┐
↓       ↓
已批准  已拒绝
(approved) (rejected)
    ↓
执行中 (executing)
    ↓
┌───┴───┐
↓       ↓
已执行  已回滚
(executed) (rolled_back)
    ↓
┌───┴───┐
↓       ↓
已完成  回滚中
(completed) (rolling_back)
              ↓
           已回滚
          (rolled_back)
              ↓
           已完成
          (completed)
```

## 报告内容

导出的报告包含以下内容：

1. **执行摘要**
   - 总资产数量
   - 未处理告警数
   - 待处理变更数
   - 未解决风险数
   - 高风险项数量

2. **高风险设备列表**
3. **IP地址冲突列表**
4. **待处理变更单列表**
5. **近期告警摘要**
6. **网段利用率统计**
7. **整改建议**

## 测试

### 运行测试

```bash
cd backend
npm test
```

### 测试覆盖范围

- 资产模型测试（增删改查、唯一性约束）
- 网络模型测试（VLAN、网段、IP地址）
- 风险引擎测试
- API接口测试
- 数据验证测试

## 错误处理

### 常见错误提示

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| MAC地址或序列号已存在 | 重复数据 | 检查导入数据是否重复 |
| IP地址已存在 | IP冲突 | 检查IP分配是否正确 |
| VLAN ID已存在 | 重复VLAN | 使用不同的VLAN ID |
| 无效的MAC地址格式 | 格式错误 | MAC应为 xx:xx:xx:xx:xx:xx 格式 |
| 无效的IP地址格式 | 格式错误 | IP应为 x.x.x.x 格式 |
| 缺少必要字段 | 数据不完整 | 检查必填字段是否填写 |

### 日志查看

后端服务运行时会输出详细日志，包含：
- HTTP请求日志（方法、路径、状态码、响应时间）
- 数据库操作日志
- 错误堆栈信息

## 目录结构

```
network-management-console/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── app.js             # Express应用入口
│   │   ├── config/
│   │   │   └── database.js    # 数据库配置
│   │   ├── controllers/
│   │   │   └── index.js       # 所有控制器
│   │   ├── models/
│   │   │   ├── AssetModel.js           # 资产模型
│   │   │   ├── NetworkModel.js         # 网络模型
│   │   │   ├── AlertChangeRiskModel.js # 告警/变更/风险模型
│   │   │   └── TopologyRiskModel.js    # 拓扑/风险引擎模型
│   │   ├── routes/
│   │   │   └── api.js         # API路由
│   │   └── services/
│   │       ├── ImportService.js    # 数据导入服务
│   │       └── ReportService.js    # 报告生成服务
│   ├── data/
│   │   ├── seeds/            # 种子数据
│   │   └── anomalies/        # 异常样例
│   ├── tests/
│   │   └── api.test.js       # 测试文件
│   └── package.json
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── main.jsx          # 入口文件
│   │   ├── App.jsx           # 主应用组件
│   │   ├── index.css         # 全局样式
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx   # 主布局
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # 资产看板
│   │   │   ├── NetworkView.jsx   # 网段/VLAN视图
│   │   │   ├── RiskList.jsx      # 风险列表
│   │   │   ├── ChangeOrder.jsx   # 变更单管理
│   │   │   ├── AlertHandler.jsx  # 告警处理
│   │   │   ├── ImportPage.jsx    # 数据导入
│   │   │   └── ReportPage.jsx    # 报告导出
│   │   ├── services/
│   │   │   └── api.js        # API服务
│   │   └── utils/
│   │       └── constants.js  # 常量定义
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json
└── README.md
```

## 许可证

MIT License

## 贡献说明

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 常见问题

### Q: 数据库文件在哪里？
A: SQLite数据库文件位于 `backend/data/network-mgmt.db`，首次运行时自动创建。

### Q: 如何重置所有数据？
A: 删除 `backend/data/network-mgmt.db` 文件，重启服务后会重新创建空数据库。

### Q: 支持哪些浏览器？
A: 支持所有现代浏览器（Chrome、Firefox、Safari、Edge），建议使用最新版本。

### Q: 如何修改服务端口？
A: 修改 `backend/src/app.js` 中的 `PORT` 常量，或设置环境变量 `PORT`。

### Q: 风险检查多久执行一次？
A: 风险检查需要手动触发（风险列表页面的「执行风险检查」按钮），也可以通过API `/api/risks/run-checks` 定时调用。

## 更新日志

### v1.0.0 (2024-05-04)
- 初始版本发布
- 完整的资产管理功能
- 网段/VLAN管理
- 拓扑关系展示
- 风险检测引擎
- 告警归并和管理
- 变更单工作流
- 防火墙规则管理
- 报告导出（Markdown/HTML/CSV）
- 数据导入功能
- 完整的测试覆盖
