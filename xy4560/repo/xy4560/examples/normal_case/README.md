# 正常示例项目

这是一个配置完全正确的示例项目，用于演示正常情况下的验收检查。

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

## 启动开发服务器

```bash
npm run dev
```

开发服务器将在 **端口 3000** 上运行，访问 http://localhost:3000 查看效果。

## 预期输出

构建完成后将生成以下文件：
- `dist/index.js`
- `dist/style.css`

## 验证 API

```bash
curl -s http://localhost:3000/api/health
```
