// 稳定启动脚本：每次确保在端口并持久化
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

function check(port) {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const health = JSON.parse(d);
          resolve({
            ok: res.statusCode === 200 && health.ok === true,
            body: d
          });
        } catch (e) {
          resolve({ok: false, body: d});
        }
      });
    });
    req.on('error', () => resolve({ok: false}));
    req.setTimeout(2000, () => req.destroy());
  });
}

(async function main() {
  const PROJECT = process.cwd();
  const PORT = Number(process.env.PORT || 3000);
  let r = await check(PORT);
  if (!r.ok) {
    console.log(`服务未在端口 ${PORT} 正常响应，启动中...`);
    await new Promise(res => setTimeout(res, 800));
    const proc = spawn('node', ['server.js'], {
      cwd: PROJECT,
      detached: true,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'ignore'
    });
    proc.unref();
    let started = false;
    for (let i=0; i<10; i++) {
      await new Promise(res => setTimeout(res, 500));
      const rr = await check(PORT);
      if (rr.ok) {
        started = true;
        console.log('启动成功', rr.body);
        break;
      }
    }
    if (!started) {
      console.error(`端口 ${PORT} 没有返回本服务健康状态，请确认端口未被其他服务占用，或用 PORT=其他端口 node ensure-up.js 启动。`);
      process.exit(1);
    }
  } else {
    console.log('服务已在运行', r.body);
  }
})();
