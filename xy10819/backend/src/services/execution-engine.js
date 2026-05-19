const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const db = require('../config/database');
const { evaluateAssertion, injectVariables } = require('../utils/assertion-utils');
const { saveScreenshot } = require('../utils/file-utils');

let activeExecutions = new Map();

async function executeCollection(collectionId, batchId) {
  if (activeExecutions.has(batchId)) {
    throw new Error('Execution already in progress for this batch');
  }

  activeExecutions.set(batchId, { status: 'running' });

  try {
    const collection = await db.get('SELECT * FROM collections WHERE id = ?', [collectionId]);
    const steps = await db.all('SELECT * FROM steps WHERE collection_id = ? ORDER BY order_index ASC', [collectionId]);
    
    let environment = null;
    let variables = [];
    if (collection.environment_id) {
      environment = await db.get('SELECT * FROM environments WHERE id = ?', [collection.environment_id]);
      variables = JSON.parse(environment.variables || '[]');
    }

    let passedCount = 0;
    let failedCount = 0;

    for (const step of steps) {
      const result = await executeStep(step, variables, batchId);
      if (result.status === 'passed') {
        passedCount++;
      } else {
        failedCount++;
      }
    }

    const finalStatus = failedCount === 0 ? 'completed' : 'failed';
    await db.run(
      'UPDATE batches SET status = ?, passed_steps = ?, failed_steps = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [finalStatus, passedCount, failedCount, batchId]
    );

    activeExecutions.delete(batchId);
    return { batchId, status: finalStatus, passedCount, failedCount };
  } catch (error) {
    await db.run(
      'UPDATE batches SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['failed', batchId]
    );
    activeExecutions.delete(batchId);
    throw error;
  }
}

async function executeStep(step, variables, batchId) {
  const resultId = uuidv4();
  const startTime = Date.now();
  
  let response = null;
  let error = null;
  let assertionsResult = [];
  let screenshotPath = null;

  const stepHeaders = JSON.parse(step.headers || '[]');
  const stepBody = JSON.parse(step.body || '{}');
  const stepAssertions = JSON.parse(step.assertions || '[]');

  const url = injectVariables(step.url, variables);
  const headers = {};
  stepHeaders.forEach(h => {
    headers[injectVariables(h.key, variables)] = injectVariables(h.value, variables);
  });

  function injectVariablesRecursive(obj, vars) {
    if (typeof obj === 'string') {
      return injectVariables(obj, vars);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => injectVariablesRecursive(item, vars));
    }
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const key in obj) {
        result[key] = injectVariablesRecursive(obj[key], vars);
      }
      return result;
    }
    return obj;
  }

  const processedBody = injectVariablesRecursive(stepBody, variables);

  const requestData = {
    method: step.method,
    url,
    headers,
    body: processedBody
  };

  try {
    const axiosConfig = {
      method: step.method,
      url,
      headers,
      timeout: 30000,
      validateStatus: () => true
    };

    if (step.method !== 'GET' && Object.keys(processedBody).length > 0) {
      axiosConfig.data = processedBody;
    }

    response = await axios(axiosConfig);
    
    const responseTime = Date.now() - startTime;

    assertionsResult = stepAssertions.map(assertion => 
      evaluateAssertion(assertion, {
        status: response.status,
        data: response.data,
        responseTime
      })
    );

    const allPassed = assertionsResult.every(a => a.passed);

    if (!allPassed) {
      try {
        screenshotPath = await captureScreenshot(url, resultId);
      } catch (screenshotErr) {
        console.error('Screenshot failed:', screenshotErr.message);
      }
    }

    await db.run(
      `INSERT INTO execution_results (id, batch_id, step_id, status, request_data, response_data, 
       response_status, response_time, assertions_result, error_message, screenshot_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        batchId,
        step.id,
        allPassed ? 'passed' : 'failed',
        JSON.stringify(requestData),
        JSON.stringify(response.data),
        response.status,
        responseTime,
        JSON.stringify(assertionsResult),
        null,
        screenshotPath
      ]
    );

    return { id: resultId, status: allPassed ? 'passed' : 'failed' };
  } catch (err) {
    error = err;
    
    try {
      screenshotPath = await captureScreenshot(url, resultId);
    } catch (screenshotErr) {
      console.error('Screenshot failed:', screenshotErr.message);
    }

    await db.run(
      `INSERT INTO execution_results (id, batch_id, step_id, status, request_data, response_data, 
       response_status, response_time, assertions_result, error_message, screenshot_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        batchId,
        step.id,
        'failed',
        JSON.stringify(requestData),
        JSON.stringify({}),
        null,
        Date.now() - startTime,
        JSON.stringify([]),
        error.message,
        screenshotPath
      ]
    );

    return { id: resultId, status: 'failed', error: error.message };
  }
}

async function captureScreenshot(url, resultId) {
  let browser = null;
  try {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    const screenshot = await page.screenshot({ type: 'png' });
    const filename = `screenshot-${resultId}.png`;
    await saveScreenshot(screenshot, filename);
    await browser.close();
    return filename;
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

async function retryStep(resultId) {
  const result = await db.get('SELECT * FROM execution_results WHERE id = ?', [resultId]);
  if (!result) {
    throw new Error('Result not found');
  }

  const step = await db.get('SELECT * FROM steps WHERE id = ?', [result.step_id]);
  const batch = await db.get('SELECT * FROM batches WHERE id = ?', [result.batch_id]);
  const collection = await db.get('SELECT * FROM collections WHERE id = ?', [batch.collection_id]);

  let variables = [];
  if (collection.environment_id) {
    const environment = await db.get('SELECT * FROM environments WHERE id = ?', [collection.environment_id]);
    variables = JSON.parse(environment.variables || '[]');
  }

  await db.run('DELETE FROM execution_results WHERE id = ?', [resultId]);

  const newResult = await executeStep(step, variables, result.batch_id);
  
  const allResults = await db.all('SELECT * FROM execution_results WHERE batch_id = ?', [result.batch_id]);
  const passedCount = allResults.filter(r => r.status === 'passed').length;
  const failedCount = allResults.filter(r => r.status === 'failed').length;
  const finalStatus = failedCount === 0 ? 'completed' : 'failed';

  await db.run(
    'UPDATE batches SET status = ?, passed_steps = ?, failed_steps = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
    [finalStatus, passedCount, failedCount, result.batch_id]
  );

  return newResult;
}

function getExecutionStatus(batchId) {
  return activeExecutions.get(batchId) || null;
}

module.exports = { executeCollection, executeStep, retryStep, getExecutionStatus };
