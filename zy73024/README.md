# 宠物减重回访追踪

救助站志愿者小乔用来复核宠物减重回访材料的前端工作台。它把体重曲线、改名补充材料、口头备注、疫苗日期缺失、人工改判和交付说明放在同一个可追溯流程里。

## 本地运行

```bash
npm install
npm run dev
```

默认入口是 `/dashboard`。常用页面：

- `/dashboard`：先扫所有在访宠物、异常数量和处理状态。
- `/pet/:id`：查看单只宠物的体重曲线、异常原因、材料链路和人工改判记录。
- `/delivery`：生成给接手同事看的汇总表、截图说明卡和人工改判说明。

## 验证

```bash
npm run lint
npm run build
npm run preview
```

构建链路只依赖 `package.json` 和 `package-lock.json` 中声明的包，不需要修改 `node_modules`，也不需要额外的本机补丁文件。
