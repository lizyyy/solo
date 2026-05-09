const BASE_URL = 'http://localhost:3000';

async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, data: { error: 'NETWORK_ERROR', message: error.message } };
  }
}

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function logStep(step, description) {
  console.log(`[步骤 ${step}] ${description}`);
}

function logResult(result, label = '') {
  if (label) console.log(`${label}:`);
  console.log(JSON.stringify(result, null, 2));
  console.log('');
}

function logSuccess(message) {
  console.log(`✅ ${message}\n`);
}

function logWarning(message) {
  console.log(`⚠️  ${message}\n`);
}

function logError(message) {
  console.log(`❌ ${message}\n`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  apiCall,
  logSection,
  logStep,
  logResult,
  logSuccess,
  logWarning,
  logError,
  sleep,
  BASE_URL
};
