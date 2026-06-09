import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/guide', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      启动命令: [
        '首次安装依赖: pnpm install 或 npm install',
        '仅启动后端服务: pnpm server:dev 或 npm run server:dev',
        '前后端同时启动: pnpm dev 或 npm run dev',
        '仅校验类型: pnpm check 或 npm run check (等价于 tsc --noEmit)',
      ],
      重跑方式: [
        '清空数据: 删除项目根目录下 data/db.json 文件后重启后端服务，会自动重新执行 seed() 生成示例数据。',
        '不触发种子: 若 db.json 中至少存在一条任务/图层/历史/截图，initDb() 将跳过 seed()。',
        '后端热重载: nodemon 默认监听 api/ 与 shared/ 目录，修改 .ts/.json 文件会自动重启服务。',
      ],
      截图规范: [
        '支持格式: jpg / jpeg / png / gif / webp，单张上限 10MB。',
        '必传字段: standardTags（非空数组，元素为对应规范编号，如 GB50015-2019）。',
        '可选字段: layerId 绑定图层、caption 文字说明、boundVersion 绑定审核版本号。',
        '上传方式: multipart/form-data，文件字段名 file，其余字段位于 body。',
        '命名规则: 导出 ZIP 时按 {图层名}_v{绑定版本}_[{规范标签}].{扩展名} 重命名。',
      ],
      接口速览: [
        'GET    /api/tasks                    任务列表(支持 ?status=&search=)',
        'POST   /api/tasks                    创建任务',
        'GET    /api/tasks/:id                任务详情(含 layerCount/openIssueCount)',
        'PUT    /api/tasks/:id                更新任务',
        'GET    /api/tasks/:id/layers         任务下的图层列表',
        'GET    /api/tasks/:id/history        任务全量审核历史(含 layerName)',
        'GET    /api/tasks/:id/history/compare 图层版本对比(?layerId=&v1=&v2=)',
        'POST   /api/tasks/:id/export         导出复核资料 ZIP',
        'GET    /api/layers/:id               图层详情 + 版本历史',
        'POST   /api/layers/:id/reviews       提交复核意见(生成新历史版本)',
        'PUT    /api/layers/:id/notes         追加备注(仅变更 note)',
        'POST   /api/tasks/:taskId/screenshots 上传截图',
        'GET    /api/tasks/:taskId/screenshots 截图列表',
        'GET    /api/screenshots/:id/download  下载/跳转截图',
        'DELETE /api/screenshots/:id          软删除截图',
        'GET    /api/guide                    本说明',
      ],
    },
  });
});

export default router;
