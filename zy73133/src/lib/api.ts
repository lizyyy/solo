import type { BatchResponse, RemarkInput, VerifyResult } from '@/types';

const API_BASE = '/api';

// 统一错误处理
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const e = await res.json();
      msg = e.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// 1. GET /api/load-sample — 加载示例浮标日志
export function loadSample(): Promise<BatchResponse> {
  return request<BatchResponse>(`${API_BASE}/load-sample`);
}

// 2. POST /api/parse-logs — 解析粘贴的日志文本
export function parseLogs(logs_text: string): Promise<BatchResponse> {
  return request<BatchResponse>(`${API_BASE}/parse-logs`, {
    method: 'POST',
    body: JSON.stringify({ logs_text }),
  });
}

// 3. POST /api/remark-reprocess — 应用备注并重算
export function remarkReprocess(
  batch_id: string,
  remarks: RemarkInput[],
): Promise<BatchResponse> {
  return request<BatchResponse>(`${API_BASE}/remark-reprocess`, {
    method: 'POST',
    body: JSON.stringify({ batch_id, remarks }),
  });
}

// 4. GET /api/export-csv?batch_id=&version= — 触发浏览器下载 CSV
export function exportCsv(batch_id: string, version: '1' | '2' = '1'): void {
  const url = `${API_BASE}/export-csv?batch_id=${encodeURIComponent(batch_id)}&version=${version}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 5. POST /api/handoff-verify — 执行接班验证
export function handoffVerify(
  batch_id: string,
  version: '1' | '2' = '2',
): Promise<VerifyResult> {
  return request<VerifyResult>(`${API_BASE}/handoff-verify`, {
    method: 'POST',
    body: JSON.stringify({ batch_id, version }),
  });
}
