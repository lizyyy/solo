## 1. 架构设计

```mermaid
graph TD
    A["用户浏览器"] --> B["React SPA (Vite)"]
    B --> C["统一状态层 useReconciliationStore"]
    C --> D["结果集 derivedResult"]
    D --> E["筛选条件区 FilterPanel"]
    D --> F["统计数字卡 StatsCards"]
    D --> G["页面摘要 SummaryCard"]
    D --> H["明细表 DetailTable"]
    C --> I["原始Mock数据 rawRecords"]
    C --> J["核心处理函数 processRecords()"]
    J --> K["体重标准化 normalizeWeight()"]
    J --> L["状态分类 classifyStatus()"]
    J --> M["备注异常检测 detectRemarkIssue()"]
```

## 2. 技术说明
- 前端：React@18 + TypeScript + Vite@5 + TailwindCSS@3
- 状态管理：Zustand（轻量，四组件共享结果集）
- 图标：lucide-react
- 字体：Google Fonts（ZCOOL XiaoWei + LXGW WenKai）
- 后端：无，纯前端Mock数据

## 3. 路由定义
| 路由 | 用途 |
|------|------|
| / | 异宠温控排程对账主页 |

## 4. 数据模型

### 4.1 数据模型定义
```mermaid
erDiagram
    RAW_RECORD {
        string id PK "记录ID"
        string scheduleDate "排程日期 YYYY-MM-DD"
        string petType "异宠类型"
        string ownerName "主人昵称"
        string wechatRemark "微信备注原文"
        string rawWeight "原始体重（带单位或无单位）"
        string tempPlan "温控方案"
        string status "原始状态 raw/pending/returned"
        string missingItems "缺件材料逗号分隔"
        string returnReason "退回原因"
        boolean hasFollowUp "回访是否已跟进"
    }
    PROCESSED_RECORD {
        string id PK
        string scheduleDate
        string petType
        string ownerName
        string wechatRemark
        string rawWeight
        number normalizedWeightGrams "标准化体重(g)"
        boolean weightUnitMixed "原始单位是否异常"
        string weightUnitNote "单位换算说明"
        string tempPlan
        string displayStatus "已确认/待补件/退回"
        string missingItems
        string returnReason
        boolean remarkIssue "备注含回访结论但未跟进"
    }
    FILTER_STATE {
        string statusFilter "all/confirmed/pending/returned"
        string dateFrom
        string dateTo
        string ownerKeyword
    }
```

### 4.2 核心处理逻辑
- `normalizeWeight(rawWeight: string): { grams: number, mixed: boolean, note: string }`
  - "2.3kg" → 2300g，mixed=true，note="kg→g"
  - "5斤" → 2500g，mixed=true，note="斤→g (×500)"
  - "1200"（无单位）→ 1200g，mixed=true，note="无单位，默认克"
  - "800g" → 800g，mixed=false
- `classifyStatus(status, missingItems, returnReason)` 生成 displayStatus
- `detectRemarkIssue(wechatRemark, hasFollowUp)` 标记备注异常
- 四组件全部消费 `derivedResult = filter + sort(processedRecords)`

## 5. 目录结构
```
src/
  types/
    reconciliation.ts       # 类型定义
  data/
    mockRecords.ts          # 样例数据（15-20条，混合各场景）
  store/
    useReconciliationStore.ts  # Zustand store：raw数据 + process函数 + 筛选状态 + 派生结果集
  components/
    FilterPanel.tsx         # 筛选条件区
    StatsCards.tsx          # 统计数字卡（4张）
    SummaryCard.tsx         # 页面摘要
    DetailTable.tsx         # 明细表
  App.tsx                   # 组装全部组件
  main.tsx
  index.css
```
