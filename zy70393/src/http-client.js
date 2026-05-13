export async function makeRequest(baseUrl, method, path, options = {}) {
  const url = baseUrl + path;
  const { headers = {}, body, queryParams = {} } = options;
  
  const finalUrl = new URL(url);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null) {
      finalUrl.searchParams.set(key, value);
    }
  }
  
  const requestOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  if (body && method !== 'GET' && method !== 'HEAD') {
    requestOptions.body = JSON.stringify(body);
  }
  
  const startTime = Date.now();
  let response;
  
  try {
    response = await fetch(finalUrl.toString(), requestOptions);
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
  
  const duration = Date.now() - startTime;
  const text = await response.text();
  
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  
  return {
    success: true,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    data,
    duration,
  };
}
