import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

const tempDir = mkdtempSync(join(tmpdir(), 'pet-tracker-'));
const app = createApp({ dbPath: join(tempDir, 'test.sqlite') });
let server;
let baseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return { response, body: await response.json() };
  }
  return { response, body: await response.text() };
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  app.locals.store.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('pet training tracker API', () => {
  it('seeds messy demo data with duplicate aliases and manual rejudges', async () => {
    const { body } = await request('/api/health');
    assert.equal(body.ok, true);
    assert.equal(body.summary.pets, 5);
    assert.equal(body.summary.manualRejudges, 2);

    const duplicate = await request('/api/pets?anomaly=alias_duplicate');
    assert.ok(duplicate.body.pets.length >= 2);

    const rejudged = await request('/api/pets?anomaly=manual_rejudge');
    assert.equal(rejudged.body.pets.length, 2);
  });

  it('keeps old snapshots in one SQLite-backed timeline', async () => {
    const { body } = await request('/api/pets/pet_doubao/timeline');
    assert.equal(body.ok, true);
    assert.ok(body.events.some((event) => event.type === 'revoke'));
    assert.ok(body.events.some((event) => event.snapshotBefore.photoUrls.includes('vaccine/old/doubao-202409.jpg')));
    assert.ok(body.events.at(-1).snapshotAfter.photoUrls.includes('vaccine/new/doubao-202412.jpg'));
  });

  it('explains how an addendum changes export output', async () => {
    const { body } = await request('/api/pets/pet_meiqiu/addendum', {
      method: 'POST',
      body: JSON.stringify({
        operator: '老周',
        note: '主人补录：脱敏课回访视频显示可正常接触陌生人',
        updates: {
          latestNote: '脱敏训练完成；主人补录视频显示可正常接触陌生人和喂食',
          photoUrls: ['vaccine/meiqiu-202410.jpg', 'owner-video/meiqiu-final-proof.png'],
        },
      }),
    });

    assert.equal(body.ok, true);
    const fields = body.exportImpact.changedFields.map((item) => item.field);
    assert.ok(fields.includes('最新备注'));
    assert.ok(fields.includes('最后更新时间'));
  });

  it('returns CSV exports with anomaly traces', async () => {
    const { response, body } = await request('/api/export?format=csv&anomaly=manual_rejudge');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-export-id'), /^exp_/);
    assert.match(body, /异常标记/);
    assert.match(body, /人工改判/);
  });
});
