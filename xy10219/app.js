const express = require('express');
const app = express();
app.use(express.json());

const maintenanceRoutes = require('./routes/maintenance');

app.use('/api', maintenanceRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`电梯维保零件换件 API 服务已启动，端口: ${PORT}`);
  console.log(`使用说明: 请参考 docs/guide.md`);
});
