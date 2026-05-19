function evaluateAssertion(assertion, response) {
  const { type, expected, actual } = assertion;
  
  try {
    switch (type) {
      case 'status_code':
        const expectedStatus = Number(expected);
        return {
          passed: response.status === expectedStatus,
          actual: response.status,
          expected: expectedStatus,
          message: `Status code: expected ${expectedStatus}, got ${response.status}`
        };
      
      case 'response_time':
        const expectedTime = Number(expected);
        return {
          passed: response.responseTime <= expectedTime,
          actual: response.responseTime,
          expected: expectedTime,
          message: `Response time: expected <= ${expectedTime}ms, got ${response.responseTime}ms`
        };
      
      case 'json_path':
        const value = getJsonPath(response.data, assertion.path);
        return {
          passed: JSON.stringify(value) === JSON.stringify(expected),
          actual: value,
          expected,
          message: `JSON path ${assertion.path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`
        };
      
      case 'contains':
        const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        return {
          passed: bodyStr.includes(expected),
          actual: bodyStr.substring(0, 200),
          expected,
          message: `Body contains: expected "${expected}"`
        };
      
      default:
        return {
          passed: false,
          actual: null,
          expected,
          message: `Unknown assertion type: ${type}`
        };
    }
  } catch (err) {
    return {
      passed: false,
      actual: null,
      expected,
      message: `Assertion error: ${err.message}`
    };
  }
}

function getJsonPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function injectVariables(str, variables) {
  if (!str) return str;
  let result = str;
  variables.forEach(({ key, value }) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  });
  return result;
}

module.exports = { evaluateAssertion, injectVariables };
