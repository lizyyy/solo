interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  items?: T;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
  newStatus?: string;
}

async function request<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });
    const json = await res.json().catch(() => ({ success: false, error: '响应解析失败' }));
    return json as ApiResponse<T>;
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败';
    return { success: false, error: message };
  }
}

export const fetcher = {
  get: <T = unknown>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T = unknown>(url: string, body?: unknown) =>
    request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T = unknown>(url: string, body?: unknown) =>
    request<T>(url, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = unknown>(url: string) => request<T>(url, { method: 'DELETE' }),
};
