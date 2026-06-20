#!/usr/bin/env python3
import os, json, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_SRC = os.path.join(ROOT, 'backend', 'src')

INDEX_TS = r"""import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { initDatabase } from './database';
import routes from './routes';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const FRONTEND_DIST = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    mode: fs.existsSync(FRONTEND_DIST) ? 'production' : 'development',
    frontend_served: fs.existsSync(FRONTEND_DIST),
    data_dir: DATA_DIR,
  });
});

if (fs.existsSync(FRONTEND_DIST)) {
  console.log('[生产模式] 检测到前端构建产物，启用静态资源服务:', FRONTEND_DIST);
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  console.log('[开发模式] 未检测到前端构建产物，仅提供API服务');
}

app.listen(PORT, () => {
  console.log(`🚀 聊天机器人越权拦截系统已启动`);
  console.log(`   - 后端API:  http://localhost:${PORT}/api`);
  if (fs.existsSync(FRONTEND_DIST)) {
    console.log(`   - 前端页面: http://localhost:${PORT}/`);
  } else {
    console.log(`   - 前端DEV:  http://localhost:3000/`);
  }
});
"""

DATABASE_TS_REPLACEMENT = r"""let dbPath: string;
let data: DatabaseData;

export function initDatabase() {
  const DATA_DIR = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbPath = path.join(DATA_DIR, 'chatbot.json');"""


def main():
    os.makedirs(os.path.join(ROOT, 'scripts'), exist_ok=True)

    index_path = os.path.join(BACKEND_SRC, 'index.ts')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(INDEX_TS)
    print(f'✓ 已更新 {index_path}')

    db_path = os.path.join(BACKEND_SRC, 'database.ts')
    with open(db_path, 'r', encoding='utf-8') as f:
        old = f.read()
    marker_old = """let dbPath: string;
let data: DatabaseData;

export function initDatabase() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'chatbot.json');"""
    if marker_old in old:
        new = old.replace(marker_old, DATABASE_TS_REPLACEMENT)
        with open(db_path, 'w', encoding='utf-8') as f:
            f.write(new)
        print(f'✓ 已更新 {db_path} （dataDir 改为基于 __dirname）')
    else:
        print(f'⚠ {db_path} 未匹配到旧片段，跳过')

    print()
    print('完成。接下来可以执行:')
    print('  npm run build       # 同时构建后端和前端')
    print('  npm start           # 启动生产服务')


if __name__ == '__main__':
    main()
