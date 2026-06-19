import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3002/api';
const STATIC_BASE = 'http://localhost:3002';

type Result<T> = { success: boolean; data: T; error?: string };

const pass = (m: string) => console.log(`  ✅ ${m}`);
const fail = (m: string) => { console.log(`  ❌ ${m}`); process.exitCode = 1; };
let total = 0, ok = 0;
function assert(c: boolean, d: string) { total++; if (c) { ok++; pass(d); } else fail(d); }
function sep(t: string) { console.log(`\n${'═'.repeat(60)}\n ${t}\n${'─'.repeat(60)}`); }
function info(l: string, v: unknown) {
  console.log(`  ℹ️  ${l}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
}

async function api<T>(p: string, opts?: RequestInit): Promise<Result<T>> {
  const r = await fetch(`${API_BASE}${p}`, opts);
  return (await r.json()) as Result<T>;
}

function createFakeJpeg(filePath: string, width = 20, height = 20): Buffer {
  const sig = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const filler = Buffer.alloc(width * height * 3, 0x99);
  const eoi = Buffer.from([0xff, 0xd9]);
  const buf = Buffer.concat([sig, filler, eoi]);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  return buf;
}

async function main() {
  sep('0. 健康检查：3002 端口服务');
  const h = await api<any>('/health');
  assert(h.success === true, `健康检查 success=true，端口 3002`);

  sep('1. filePathToUrl 规范化测试（服务层逻辑）');
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const { filePathToUrl } = await import('./api/services/photoService.js');
  const absPath = path.join(uploadsDir, '2026', 'photo123.jpg');
  info('绝对路径', absPath);
  const url = filePathToUrl(absPath);
  info('转换后URL', url);
  assert(url === '/uploads/2026/photo123.jpg', `绝对路径 → /uploads/2026/photo123.jpg`);

  const oldBogus = '/Users/other/uploads/random.png';
  const bogusUrl = filePathToUrl(oldBogus);
  info('历史遗留路径', oldBogus);
  info('转换后URL', bogusUrl);
  assert(bogusUrl.startsWith('/uploads/'), '历史遗留路径也能产出 /uploads/xxx URL');

  sep('2. 初始化：导入 15 条样例');
  const csvBuf = fs.readFileSync('./test-data.csv');
  const f = new FormData();
  const f2 = new File([csvBuf], 'test-data.csv', { type: 'text/csv' });
  f.append('file', f2);
  const imp = await api<any>('/records/import', { method: 'POST', body: f });
  assert(imp.success === true, '导入成功');
  assert(imp.data.imported === 15, '导入 15 条');
  assert(imp.data.mixed === 10, '混用 10 条');

  sep('3. 找出 S001 行号 3 的混用记录（整条样例贯穿始终）');
  const list = await api<any>('/records?pageSize=100&status=mixed_unit');
  const s001_3 = list.data.records.find((r: any) => r.sensorId === 'S001' && r.originalLineNo === 3);
  info('S001 #3 ID', s001_3.id);
  assert(s001_3.status === 'mixed_unit', '目标记录初始状态 = mixed_unit');
  assert(s001_3.credibility === 'pending_confirmation', '初始可信度 = pending_confirmation');
  assert(s001_3.temperatureValue === 26, '原始值 26°C 保留');
  assert(s001_3.photoCount === 0, '初始照片数 = 0');

  sep('4. 服务层照片 API：上传一张假的工况照片（S001 行号3）');
  const tmpJpg = path.join(__dirname, 'tmp_s001_line3.jpg');
  createFakeJpeg(tmpJpg, 40, 30);
  const imgBuf = fs.readFileSync(tmpJpg);
  const formPhoto = new FormData();
  formPhoto.append('file', new File([imgBuf], 's001_line3_sensorphoto.jpg', { type: 'image/jpeg' }));
  formPhoto.append('description', '工况照片：S001水槽右侧温度传感器，读数为开尔文');
  const up = await api<any>(`/records/${s001_3.id}/photos`, { method: 'POST', body: formPhoto });
  assert(up.success === true, '照片上传成功');
  const ph = up.data as any;
  info('照片记录', { id: ph.id, fileUrl: ph.fileUrl, accessStatus: ph.accessStatus, desc: ph.description });
  assert(ph.fileUrl.startsWith('/uploads/'), `fileUrl = /uploads/xxx.jpg，实际: ${ph.fileUrl}`);
  assert(ph.accessStatus === 'accessible', 'accessStatus = accessible');
  assert(ph.description === '工况照片：S001水槽右侧温度传感器，读数为开尔文', '照片描述完整');

  sep('5. 静态目录服务：通过 3002 端口实际访问上传的照片');
  const photoResp = await fetch(`${STATIC_BASE}${ph.fileUrl}`);
  assert(photoResp.status === 200, `GET ${ph.fileUrl} 返回 200`);
  const body = Buffer.from(await photoResp.arrayBuffer());
  assert(body.length > 100, '照片内容非空');
  info('HTTP返回字节数', body.length);
  assert(body[0] === 0xff && body[1] === 0xd8, 'HTTP返回的JPEG签名正确 (FF D8)');

  sep('6. 查询该记录的照片列表（fetchPhotos 返回 fileUrl + accessStatus）');
  const photosRes = await api<any>(`/records/${s001_3.id}/photos`);
  assert(photosRes.success === true, '查询照片列表成功');
  const photos = photosRes.data as any[];
  assert(photos.length === 1, '该记录 1 张照片');
  assert(photos[0].fileUrl === ph.fileUrl, '照片 URL 和上传时一致');
  assert(photos[0].accessStatus === 'accessible', '照片访问状态 = accessible');
  assert(photos[0].description !== null, '照片描述不为空');

  sep('7. 维修师傅 review：photo_trusted + 修正值 + 存照片证据');
  const rev = await api<any>(`/records/${s001_3.id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operatorRole: 'maintenance_worker',
      credibility: 'photo_trusted',
      correctedValue: 299.15,
      correctedUnit: 'K',
      note: '根据上传的工况照片（s001_line3），读数应取开尔文 299.15K',
    }),
  });
  assert(rev.success === true, '维修师傅 review 成功');
  const rv = rev.data as any;
  assert(rv.status === 'anomaly', 'review 后 status = anomaly');
  assert(rv.credibility === 'photo_trusted', 'review 后 credibility = photo_trusted');
  assert(rv.correctedValue === 299.15, 'review 后 correctedValue = 299.15K');
  assert(rv.source === 'photo_corrected', 'source = photo_corrected');

  sep('8. getRecordById 最新状态：photoCount 字段同步');
  const detail = await api<any>(`/records/${s001_3.id}`);
  assert(detail.success === true, '详情查询成功');
  const dd = detail.data as any;
  info('详情字段', { photoCount: dd.photoCount, status: dd.status, credibility: dd.credibility, source: dd.source });
  assert(dd.photoCount === 1, 'photoCount = 1（和实际照片表一致）');
  assert(dd.status === 'anomaly', '详情 status = anomaly 同步');
  assert(dd.temperatureValue === 26, '详情原始值仍保留 26°C');

  sep('9. 报告摘要与分组：photoCount 同步');
  const rp = await api<any>('/report');
  const grp = rp.data.groups.find((g: any) => g.sensorId === 'S001');
  const rec = grp.records.find((r: any) => r.id === s001_3.id);
  info('报告中该记录', { status: rec.status, photoCount: rec.photoCount, credibility: rec.credibility });
  assert(rec.photoCount === 1, '报告分组记录 photoCount = 1（与详情一致）');
  assert(rec.status === 'anomaly', '报告分组记录 status = anomaly 同步');
  assert(rp.data.summary.totalRecords === 15, '报告总数 = 15');

  sep('10. 手动造一个缺失照片场景：上传后物理删除文件');
  const tmpJpg2 = path.join(__dirname, 'tmp_s001_line3_bad.jpg');
  createFakeJpeg(tmpJpg2);
  const formBad = new FormData();
  formBad.append('file', new File([fs.readFileSync(tmpJpg2)], 's001_line3_willdelete.jpg', { type: 'image/jpeg' }));
  formBad.append('description', '故意要删除的测试照片');
  const up2 = await api<any>(`/records/${s001_3.id}/photos`, { method: 'POST', body: formBad });
  assert(up2.success === true, '第二张照片上传成功');
  const badPhoto = up2.data as any;
  info('删除前路径', badPhoto.filePath);
  fs.unlinkSync(badPhoto.filePath);
  assert(!fs.existsSync(badPhoto.filePath), '物理文件已删除');

  const photosAfter = (await api<any>(`/records/${s001_3.id}/photos`)).data as any[];
  info('重新查询后 accessStatus', photosAfter.map(p => ({ id: p.id.substring(0,6), url: p.fileUrl, s: p.accessStatus })));
  const p1 = photosAfter.find(p => p.id === ph.id);
  const p2 = photosAfter.find(p => p.id === badPhoto.id);
  assert(p1.accessStatus === 'accessible', '第一张仍 accessible');
  assert(p2.accessStatus === 'missing', '第二张被删后 accessStatus = missing');

  sep('11. CSV 导出：21列完整，照片相关字段同步同一条记录');
  const csvR = await fetch(`${API_BASE}/report/export?format=csv`);
  const csv = await csvR.text();
  const lines = csv.split('\n').filter(Boolean);
  assert(lines.length === 16, 'CSV 1表头+15行');
  const header = lines[0];
  const colCount = header.split(',').length;
  info('列数', colCount);
  assert(colCount === 21, `列数 = 21（实际 ${colCount}）`);
  ['工况照片数', '照片访问状态', '照片地址', '照片说明'].forEach(c =>
    assert(header.includes(c), `CSV 包含列：${c}`)
  );

  const s001Line = lines.find(l => l.includes('S001') && l.includes('"26"') && l.includes('°C'));
  assert(!!s001Line, 'CSV 能找到同一条样例记录（S001 26°C）');
  const s001Cells: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < s001Line!.length; i++) {
    const ch = s001Line![i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { s001Cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  s001Cells.push(cur);
  info('该记录关键列', {
    '工况照片数': s001Cells[11],
    '照片访问状态': s001Cells[12],
    '照片地址': s001Cells[13],
    '照片说明': s001Cells[14],
    '处理备注': s001Cells[16],
    '下一步找谁': s001Cells[17],
  });
  assert(s001Cells[11] === '2', `工况照片数 = 2（实际 ${s001Cells[11]}）`);
  assert(s001Cells[12].includes('1张文件不存在'), `照片访问状态标注缺失（实际: ${s001Cells[12]}）`);
  assert(s001Cells[13].includes(ph.fileUrl.substring(0, 20)), '照片地址包含真实可访问 /uploads/xxx URL');
  assert(s001Cells[14].includes('工况照片'), '照片说明包含真实描述');
  assert(s001Cells[16].includes('⚠️ 标记为照片可信但部分照片不可访问'),
    `处理备注含照片不可访问警告（实际: ${s001Cells[16].substring(0,50)}）`);

  sep('12. 审计日志：照片状态变更和 review 全部链路贯通');
  const logs = (await api<any>(`/records/${s001_3.id}/audit-log`)).data as any[];
  info('审计条数', logs.length);
  const actions = logs.map(l => `${l.action}@${l.operatorRole}`).join(', ');
  info('审计动作序列', actions);
  assert(logs.length >= 2, '至少 2 条审计（import + review）');
  const reviewLog = logs.find(l => l.action === 'review');
  assert(!!reviewLog, '存在 review 审计记录');
  assert(reviewLog.operatorRole === 'maintenance_worker', 'review 操作人角色规范化 = maintenance_worker');
  assert(reviewLog.note?.includes('工况照片'), 'review 备注包含工况照片字样');

  sep('13. 清洗删除临时文件');
  [tmpJpg, tmpJpg2].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

  console.log(`\n${'═'.repeat(60)}\n📊 照片链路测试：${ok}/${total} 通过\n${'═'.repeat(60)}`);
  if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
