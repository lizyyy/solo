'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HOST = new URL(BASE_URL).hostname;
const PORT = new URL(BASE_URL).port;

const BOUNDARY = '----exhibit-demo-' + Date.now();

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

async function upload() {
  const pairs = [
    ['artifacts.csv',  path.join(__dirname, 'artifacts.csv')],
    ['shipping.json', path.join(__dirname, 'shipping.json')],
    ['insurance.json',path.join(__dirname, 'insurance.json')],
  ];
  const fields = [];
  for (const [name, p] of pairs) {
    fields.push(['file', fs.readFileSync(p), name]);
  }
  const body = multipartBody(fields);
  const r = await post('/batches?submitted_by=demo', body);
  console.log('status:', r.status);
  console.log(JSON.stringify(r.json, null, 2));
  return r.json;
}

async function main() {
  console.log('== 第一次提交 ==');
  const first = await upload();
  console.log('\n== 第二次提交（应判重复，不重复生效）==');
  const second = await upload();

  if (!first.duplicate && first.batch_id) {
    const rep = await get(`/batches/${first.batch_id}/report`);
    console.log('\n== 报告摘要 ==');
    console.log(JSON.stringify(rep.json.report || rep.json, null, 2));

    const d = (rep.json.details || []).find((x) => x.status === 'failed')
              || (rep.json.details || [])[0];
    if (d) {
      console.log(`\n== 单条明细追踪: GET /details/${d.id} ==`);
      const detail = await get(`/details/${d.id}`);
      console.log(JSON.stringify(detail.json, null, 2));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
