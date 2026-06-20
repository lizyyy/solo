import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`宠物训练课回访追踪 API 已启动: http://localhost:${port}`);
});
