'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HOST = new URL(BASE_URL).hostname;
const PORT = new URL(BASE_URL).port;

let BOUNDARY = '----exhibit-demo-' + Date.now();

function multipartBody(fields) {
  const buf = [];
  for (const [name, value, filename] of fields) {
    buf.push(Buffer.from(`--${BOUNDARY}\r\n`));
    if (filename) {
      buf.push(Buffer.from(
        `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
      ));
      buf.push(value);
    } else {
      buf.push(Buffer.from(
        `Content-Disposition: form-data; name="${name}"\r\n\r\n`
      ));
      buf.push(Buffer.from(String(value)));
    }
    buf.push(Buffer.from('\r\n'));
  }
  buf.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(buf);
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: HOST, port: PORT, method: 'POST', path,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(raw); } catch { json = { raw }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: HOST, port: PORT, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function upload(files, label) {
  BOUNDARY = '----exhibit-demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const fields = [];
  for (const p of files) {
    fields.push(['file', fs.readFileSync(p), path.basename(p)]);
  }
  const body = multipartBody(fields);
  const r = await post('/batches?submitted_by=demo', body);
  console.log(`\n== ${label} ==`);
  console.log('status:', r.status);
  if (r.json.duplicate) {
    console.log('duplicate:', r.json.duplicate, '| message:', r.json.message);
  } else {
    const s = r.json.summary;
    console.log('summary:', s);
    console.log('groups.normal.length:', r.json.groups.normal.length);
    console.log('groups.pending.length:', r.json.groups.pending.length);
    console.log('groups.failed.length:', r.json.groups.failed.length);
    if (r.json.groups.failed.length) {
      console.log('groups.failed[0]:', JSON.stringify(r.json.groups.failed[0], null, 2).slice(0, 300), '...');
    }
  }
  return r.json;
}

async function main() {
  const csv  = path.join(__dirname, 'artifacts.csv');
  const ship = path.join(__dirname, 'shipping.json');
  const ins  = path.join(__dirname, 'insurance.json');

  const first = await upload([csv, ship, ins], '第一次：正序 CSV→shipping→insurance');
  if (first.duplicate) {
    console.log('\n[WARN] 第一次就判重，说明 data.db 有残留，请先 rm data.db* 后重试。');
  }

  const second = await upload([ins, ship, csv], '第二次：倒序 insurance→shipping→CSV');
  if (!second.duplicate) {
    console.log('\n[FAIL] 倒序上传未判重，去重逻辑仍然有问题！');
    process.exit(1);
  }
  console.log('\n[PASS] 同批文件倒序上传被正确识别为重复，未重复生效。');

  if (!first.duplicate && first.batch_id) {
    const rep = await get(`/batches/${first.batch_id}/report`);
    console.log('\n== 报告摘要 ==');
    console.log(JSON.stringify(rep.json.report || rep.json, null, 2));

    const d = (rep.json.details || []).find((x) => x.status === 'failed')
              || (rep.json.details || [])[0];
    if (d) {
      console.log(`\n== 单条明细追踪: GET /details/${d.id} ==`);
      const detail = await get(`/details/${d.id}`);
      console.log('linked_report:', detail.json.linked_report ? 'OK' : 'MISSING');
      console.log('audit_trail.length:', detail.json.audit_trail.length);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
