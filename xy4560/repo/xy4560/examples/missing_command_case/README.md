# 命令缺失示例项目

这个示例项目演示了 README 中提到的命令在 package.json 中不存在的情况。

## 安装依赖

```bash
npm install
```

## 运行测试

```bash
npm run test
```

## 构建项目

```bash
npm run build
```

## 运行代码检查

```bash
npm run lint
```

## 格式化代码

```bash
npm run format
```

## 启动开发服务器

```bash
npm run dev
```

开发服务器将在 **端口 5173** 上运行。

## 预期输出

构建完成后将生成：
- `dist/bundle.js`

## 验证

```bash
curl -s http://localhost:5173/health
```
