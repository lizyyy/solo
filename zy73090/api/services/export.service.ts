import archiver from 'archiver';
import type { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db.js';
import type { ReviewTask, CadLayer, LayerHistory, Screenshot } from '../../shared/types.js';

function isUrl(p: string): boolean {
  return /^https?:\/\//i.test(p);
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

function getExtension(mimeType: string, storedPath: string): string {
  const fromName = path.extname(storedPath).replace(/^\./, '');
  if (fromName) return fromName;
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'bin';
}

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '');
}

interface Manifest {
  exportedAt: string;
  task: ReviewTask;
  layers: CadLayer[];
  screenshots: Array<Screenshot & { zipEntry: string; layerName?: string }>;
  notes: {
    口径说明: string;
    规范标准: string;
    文件命名规则: string;
  };
}

export async function exportTask(taskId: string, res: Response): Promise<void> {
  const db = await getDb();
  const task = db.data.tasks.find((t) => t.id === taskId);
  if (!task) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }

  const layers = db.data.layers.filter((l) => l.taskId === taskId);
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  const screenshots = db.data.screenshots.filter((s) => s.taskId === taskId && !s.isDeleted);
  const histories = db.data.histories.filter((h) =>
    layers.some((l) => l.id === h.layerId),
  );

  const zipFileName = `${sanitizeName(task.projectName)}_${task.drawingVersion}_复核资料.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFileName)}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  const entries: Manifest['screenshots'] = [];

  for (const shot of screenshots) {
    const layer = layerMap.get(shot.layerId || '');
    const layerBase = layer
      ? sanitizeName(layer.displayName || layer.originalName)
      : sanitizeName(task.projectName.slice(0, 10));
    const tags = sanitizeName(shot.standardTags.join(',')) || 'notag';
    const version = shot.boundVersion ?? 0;
    const ext = getExtension(shot.mimeType, shot.storedPath);
    const zipEntry = `screenshots/${layerBase}_v${version}_[${tags}].${ext}`;

    entries.push({
      ...shot,
      zipEntry,
      layerName: layer?.displayName || layer?.originalName,
    });

    try {
      if (isUrl(shot.storedPath)) {
        const buf = await fetchToBuffer(shot.storedPath);
        archive.append(buf, { name: zipEntry });
      } else if (fs.existsSync(shot.storedPath)) {
        archive.file(shot.storedPath, { name: zipEntry });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      archive.append(`获取失败: ${errMsg}\n原始地址: ${shot.storedPath}`, {
        name: `${zipEntry}.error.txt`,
      });
    }
  }

  const manifest: Manifest = {
    exportedAt: new Date().toISOString(),
    task,
    layers,
    screenshots: entries,
    notes: {
      口径说明: '本导出包包含机电管综复核任务下的所有有效截图及全量元数据。图层状态中 needs_modify 与 rejected 视为待整改问题。',
      规范标准: '审核依据现行国家规范，包括但不限于 GB50015-2019《建筑给水排水设计标准》、GB50736-2012《民用建筑供暖通风与空气调节设计规范》、GB50052-2009《供配电系统设计规范》、GB50016-2014《建筑设计防火规范》(2018版) 等。',
      文件命名规则: '截图文件名 = {图层原始名称或任务名}_v{绑定版本}_[{规范标签用逗号分隔}].{扩展名}。标签字段做了非法字符过滤，以 "_" 替换。',
    },
  };

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  const summary: string[] = [
    `项目名称: ${task.projectName}`,
    `图纸版本: ${task.drawingVersion}`,
    `设计单位: ${task.cadSource}`,
    `导出时间: ${manifest.exportedAt}`,
    `图层数量: ${layers.length}`,
    `截图数量: ${screenshots.length}`,
    `历史记录: ${histories.length} 条`,
    `待整改数: ${layers.filter((l) => l.currentStatus !== 'approved').length}`,
  ];
  archive.append(summary.join('\n'), { name: '复核摘要.txt' });

  await archive.finalize();
}
