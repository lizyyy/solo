import { BattleReport, Unit, FACTION_LABELS, TYPE_LABELS } from '../types';
import { genId, saveReport, addHistory } from '../store/localStorage';
import { calculateTurnOrder } from '../systems/turnOrder';
import { setCurrentReport, upsertReport, getState, setFilter, setActivePanel } from '../store/gameStore';
import { runBatchImport, commitBatchResults } from '../systems/batchProcessor';

function setStatus(msg: string): void {
  const bar = document.getElementById('status-bar');
  if (bar) bar.textContent = msg;
}

function parseUnitsFromCSV(csv: string): Unit[] {
  const lines = csv.trim().split('\n').filter(l => l.trim());
  const units: Unit[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 8) continue;
    units.push({
      id: genId(),
      name: cols[0],
      faction: (['steam', 'gear', 'clockwork'].includes(cols[1]) ? cols[1] : 'steam') as Unit['faction'],
      speed: parseInt(cols[2]) || 5,
      init: parseInt(cols[3]) || 10,
      hp: parseInt(cols[4]) || 100,
      maxHp: parseInt(cols[5]) || 100,
      x: parseInt(cols[6]) || 0,
      y: parseInt(cols[7]) || 0,
      type: (['melee', 'ranged', 'support', 'heavy'].includes(cols[8]) ? cols[8] : 'melee') as Unit['type'],
      skills: cols[9] ? cols[9].split(';') : [],
      statusEffects: cols[10] ? cols[10].split(';') : [],
    });
  }
  return units;
}

function parseUnitsFromJSON(json: string): Unit[] {
  const data = JSON.parse(json);
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((u: Partial<Unit>) => ({
    id: u.id || genId(),
    name: u.name || '未命名',
    faction: u.faction || 'steam',
    speed: u.speed ?? 5,
    init: u.init ?? 10,
    hp: u.hp ?? 100,
    maxHp: u.maxHp ?? 100,
    x: u.x ?? 0,
    y: u.y ?? 0,
    type: u.type || 'melee',
    skills: u.skills || [],
    statusEffects: u.statusEffects || [],
  }));
}

export function initImportPanel(): void {
  const container = document.getElementById('panel-import');
  if (!container) return;

  container.innerHTML = `
    <div class="section-title">导入战报数据</div>
    <div class="field-label">场景名称</div>
    <input type="text" id="import-scenario-name" placeholder="例：蒸汽熔炉攻坚战" />
    <div class="field-label">数据格式</div>
    <select id="import-format">
      <option value="json">JSON</option>
      <option value="csv">CSV (名称,阵营,速度,先攻,HP,最大HP,X,Y,类型,技能,状态)</option>
    </select>
    <div class="field-label">粘贴数据</div>
    <textarea id="import-data" placeholder='JSON示例:
[{"name":"蒸汽先锋","faction":"steam","speed":7,"init":12,"hp":120,"maxHp":120,"x":1,"y":3,"type":"melee","skills":["冲锋"],"statusEffects":[]}]'></textarea>
    <div style="display:flex;gap:6px;margin-bottom:12px;">
      <button class="btn btn-primary" id="import-single-btn">单条导入</button>
      <button class="btn btn-warning" id="import-batch-btn">批量导入</button>
    </div>
    <div class="section-title">批量导入日志</div>
    <div class="batch-log" id="import-batch-log">等待操作...</div>
  `;

  document.getElementById('import-single-btn')?.addEventListener('click', () => {
    try {
      const scenarioName = (document.getElementById('import-scenario-name') as HTMLInputElement).value || '未命名场景';
      const format = (document.getElementById('import-format') as HTMLSelectElement).value;
      const raw = (document.getElementById('import-data') as HTMLTextAreaElement).value.trim();
      if (!raw) { setStatus('请输入数据'); return; }

      let units: Unit[];
      if (format === 'csv') {
        units = parseUnitsFromCSV(raw);
      } else {
        units = parseUnitsFromJSON(raw);
      }

      if (units.length === 0) { setStatus('未解析到有效单位数据'); return; }

      const turnOrder = calculateTurnOrder(units);
      const report: BattleReport = {
        id: genId(),
        createdAt: Date.now(),
        scenarioName,
        units,
        turnOrder,
        corrected: false,
        correctionNote: '',
        version: 1,
      };

      const saved = upsertReport(report);
      addHistory('import', `导入场景: ${scenarioName}`, saved);
      setCurrentReport(saved);
      setActivePanel('review');
      setStatus(`导入成功: ${scenarioName}，共 ${units.length} 个单位`);
    } catch (e) {
      setStatus(`导入失败: ${(e as Error).message}`);
    }
  });

  document.getElementById('import-batch-btn')?.addEventListener('click', () => {
    try {
      const raw = (document.getElementById('import-data') as HTMLTextAreaElement).value.trim();
      if (!raw) { setStatus('请输入批量JSON数据'); return; }

      const job = runBatchImport(raw, (updatedJob) => {
        const logEl = document.getElementById('import-batch-log');
        if (logEl) {
          logEl.innerHTML = updatedJob.logs.map(l => {
            const cls = l.level === 'ok' ? 'log-ok' : l.level === 'err' ? 'log-err' : 'log-warn';
            return `<div class="${cls}">[${new Date(l.timestamp).toLocaleTimeString('zh-CN')}] ${l.message}</div>`;
          }).join('');
          logEl.scrollTop = logEl.scrollHeight;
        }
      });

      if (job.status === 'done') {
        const results = commitBatchResults(job);
        if (results.length > 0) {
          setCurrentReport(results[0]);
          setStatus(`批量导入完成，成功 ${results.length} 条`);
        }
      }

      const logEl = document.getElementById('import-batch-log');
      if (logEl) {
        logEl.innerHTML = job.logs.map(l => {
          const cls = l.level === 'ok' ? 'log-ok' : l.level === 'err' ? 'log-err' : 'log-warn';
          return `<div class="${cls}">[${new Date(l.timestamp).toLocaleTimeString('zh-CN')}] ${l.message}</div>`;
        }).join('');
      }
    } catch (e) {
      setStatus(`批量导入失败: ${(e as Error).message}`);
    }
  });
}
