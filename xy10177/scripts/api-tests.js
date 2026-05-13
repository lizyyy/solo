const http = require('http');

const PORT = process.env.TEST_PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

let mockCallbackServer = null;
let callbackReceived = [];
let mockCallbackFailureCount = 0;
let mockCallbackShouldFail = 0;

function setMockCallbackFailureCount(count) {
  mockCallbackShouldFail = count;
  console.log(`[Mock Callback] Set to fail ${count} times before success`);
}

function startMockCallbackServer(port = 9999) {
  return new Promise((resolve) => {
    callbackReceived = [];
    mockCallbackFailureCount = 0;
    mockCallbackShouldFail = 0;
    
    mockCallbackServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/control/fail') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            setMockCallbackFailureCount(data.fail_times || 0);
          } catch (e) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
        return;
      }
      
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            callbackReceived.push({
              time: Date.now(),
              data,
            });
            console.log(`[Mock Callback] Received: ${data.event_type} for ${data.meeting_id}`);
          } catch (e) {}
          
          if (mockCallbackShouldFail > 0) {
            mockCallbackShouldFail--;
            mockCallbackFailureCount++;
            console.log(`[Mock Callback] Returning 500 (remaining failures: ${mockCallbackShouldFail})`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server error' }));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    mockCallbackServer.listen(port, () => {
      console.log(`[Mock Callback] Server started on port ${port}`);
      resolve();
    });
  });
}

function stopMockCallbackServer() {
  return new Promise((resolve) => {
    if (mockCallbackServer) {
      mockCallbackServer.close(() => {
        console.log('[Mock Callback] Server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function setMockFailTimes(times) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'POST',
      hostname: 'localhost',
      port: 4568,
      path: '/control/fail',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(JSON.stringify({ fail_times: times }));
    req.end();
  });
}

function test(name, fn) {
  return async () => {
    console.log(`[Test] ${name}`);
    try {
      await fn();
      console.log(`[✓] ${name}`);
      passed++;
    } catch (err) {
      console.log(`[✗] ${name}`);
      console.log(`    Error: ${err.message}`);
      failed++;
    }
    console.log('');
  };
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected: ${expected}, Actual: ${actual}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || PORT,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = data;
        try {
          if (data) parsed = JSON.parse(data);
        } catch (e) {}
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

let room1Id = null;
let room2Id = null;
let device1Id = null;
let catering1Id = null;
let meeting1Id = null;
let transactionId = null;

const tests = [
  test('Create meeting room A101', async () => {
    const res = await makeRequest('POST', '/api/resources/rooms', {
      name: 'A101 - Large Room',
      capacity: 20,
      location: '1F East',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success, 'Response should be successful');
    assertTrue(res.body.room, 'Room should be created');
    room1Id = res.body.room.id;
  }),

  test('Create meeting room A102', async () => {
    const res = await makeRequest('POST', '/api/resources/rooms', {
      name: 'A102 - Medium Room',
      capacity: 10,
      location: '1F East',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    room2Id = res.body.room.id;
  }),

  test('Create projector device', async () => {
    const res = await makeRequest('POST', '/api/resources/devices', {
      name: 'Projector-01',
      type: 'projector',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    device1Id = res.body.device.id;
  }),

  test('Create catering service', async () => {
    const res = await makeRequest('POST', '/api/resources/catering', {
      name: 'Tea Break Package A',
      description: 'Coffee, snacks, fruits',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    catering1Id = res.body.catering.id;
  }),

  test('Book meeting with all resources', async () => {
    const res = await makeRequest('POST', '/api/meetings/book', {
      title: 'Product Review',
      organizer: 'Alice',
      start_time: '2026-05-15 09:00:00',
      end_time: '2026-05-15 10:00:00',
      room_id: room1Id,
      device_id: device1Id,
      catering_id: catering1Id,
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    assertTrue(res.body.meeting);
    meeting1Id = res.body.meeting.id;
  }),

  test('Reject booking with non-existent room', async () => {
    const res = await makeRequest('POST', '/api/meetings/book', {
      title: 'Invalid Meeting',
      organizer: 'Bob',
      start_time: '2026-05-15 11:00:00',
      end_time: '2026-05-15 12:00:00',
      room_id: 'non-existent-id-12345',
    });
    assertEqual(res.status, 404, 'Should return 404 for non-existent room');
    assertTrue(res.body.error, 'Should have error message');
  }),

  test('Detect resource conflict', async () => {
    const res = await makeRequest('POST', '/api/meetings/book', {
      title: 'Conflicting Meeting',
      organizer: 'Bob',
      start_time: '2026-05-15 09:30:00',
      end_time: '2026-05-15 10:30:00',
      room_id: room1Id,
    });
    assertEqual(res.status, 409, 'Should return 409 for conflict');
    assertEqual(res.body.error, 'RESOURCE_CONFLICT');
  }),

  test('Check reschedule availability', async () => {
    const res = await makeRequest(
      'GET',
      `/api/meetings/${meeting1Id}/check-reschedule?start_time=2026-05-15%2014:00:00&end_time=2026-05-15%2015:00:00`
    );
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    assertTrue(res.body.available, 'Should be available at new time');
  }),

  test('Execute reschedule transaction (change room and time)', async () => {
    const res = await makeRequest('POST', `/api/meetings/${meeting1Id}/reschedule`, {
      start_time: '2026-05-15 14:00:00',
      end_time: '2026-05-15 15:00:00',
      room_id: room2Id,
      actor: 'Alice',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    assertTrue(res.body.transaction_id);
    transactionId = res.body.transaction_id;
  }),

  test('Verify transaction details with steps', async () => {
    const res = await makeRequest('GET', `/api/transactions/${transactionId}`);
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    assertTrue(res.body.transaction);
    assertEqual(res.body.transaction.status, 'completed');
    assertTrue(res.body.transaction.steps.length > 0, 'Should have transaction steps');
  }),

  test('Verify old room is available after reschedule', async () => {
    const res = await makeRequest(
      'GET',
      `/api/resources/rooms/${room1Id}/availability?start_time=2026-05-15%2009:00:00&end_time=2026-05-15%2010:00:00`
    );
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    assertTrue(res.body.availability.available, 'Old room should be available');
  }),

  test('Reschedule to same resource again (test lock cleanup)', async () => {
    const res = await makeRequest('POST', `/api/meetings/${meeting1Id}/reschedule`, {
      start_time: '2026-05-15 16:00:00',
      end_time: '2026-05-15 17:00:00',
      room_id: room2Id,
      actor: 'Alice',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success, 'Should be able to reschedule again without LOCK_FAILED');
  }),

  test('Verify meeting history records', async () => {
    const res = await makeRequest('GET', `/api/meetings/${meeting1Id}/history`);
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    assertTrue(res.body.history.length >= 2, 'Should have at least 2 history records');
  }),

  test('Cancel meeting transaction', async () => {
    const res = await makeRequest('POST', `/api/meetings/${meeting1Id}/cancel`, {
      actor: 'Alice',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
  }),

  test('Verify resources are released after cancel', async () => {
    const roomRes = await makeRequest(
      'GET',
      `/api/resources/rooms/${room2Id}/availability?start_time=2026-05-15%2016:00:00&end_time=2026-05-15%2017:00:00`
    );
    assertTrue(roomRes.body.success);
    assertTrue(roomRes.body.availability.available, 'Room should be available after cancel');

    const deviceRes = await makeRequest(
      'GET',
      `/api/resources/devices/${device1Id}/availability?start_time=2026-05-15%2016:00:00&end_time=2026-05-15%2017:00:00`
    );
    assertTrue(deviceRes.body.success);
    assertTrue(deviceRes.body.availability.available, 'Device should be available after cancel');
  }),

  test('Export meeting calendar (ICS)', async () => {
    const res = await makeRequest('GET', '/api/meetings/calendar');
    assertEqual(res.status, 200);
    assertTrue(
      res.headers['content-type']?.includes('text/calendar') || res.body.message === 'No meetings found',
      'Should be calendar or empty response'
    );
  }),

  test('Book new meeting for callback test', async () => {
    const res = await makeRequest('POST', '/api/meetings/book', {
      title: 'Callback Test Meeting',
      organizer: 'CallbackUser',
      start_time: '2026-05-16 10:00:00',
      end_time: '2026-05-16 11:00:00',
      room_id: room1Id,
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
  }),

  test('Reschedule with callback_url - verify callback sent', async () => {
    callbackReceived = [];
    
    const meetingRes = await makeRequest('GET', '/api/meetings');
    assertEqual(meetingRes.status, 200);
    const meetings = meetingRes.body.meetings;
    const targetMeeting = meetings.find(m => m.title === 'Callback Test Meeting');
    assertTrue(targetMeeting, 'Should find callback test meeting');
    
    const res = await makeRequest('POST', `/api/meetings/${targetMeeting.id}/reschedule`, {
      start_time: '2026-05-16 14:00:00',
      end_time: '2026-05-16 15:00:00',
      room_id: room2Id,
      actor: 'CallbackUser',
      callback_url: 'http://localhost:4568/webhook',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    
    await new Promise(r => setTimeout(r, 2000));
    
    assertTrue(callbackReceived.length > 0, 'Should have received callback');
    const callback = callbackReceived[0].data;
    assertEqual(callback.event_type, 'reschedule');
    assertEqual(callback.meeting_id, targetMeeting.id);
    assertTrue(callback.data.old, 'Callback should have old values');
    assertTrue(callback.data.new, 'Callback should have new values');
    console.log(`    Callback received: event_type=${callback.event_type}, meeting_id=${callback.meeting_id}`);
  }),

  test('Cancel with callback_url - verify callback sent', async () => {
    callbackReceived = [];
    
    const meetingRes = await makeRequest('GET', '/api/meetings');
    assertEqual(meetingRes.status, 200);
    const meetings = meetingRes.body.meetings;
    const targetMeeting = meetings.find(m => m.title === 'Callback Test Meeting');
    assertTrue(targetMeeting, 'Should find callback test meeting');
    
    const res = await makeRequest('POST', `/api/meetings/${targetMeeting.id}/cancel`, {
      actor: 'CallbackUser',
      callback_url: 'http://localhost:4568/webhook',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    
    await new Promise(r => setTimeout(r, 2000));
    
    assertTrue(callbackReceived.length > 0, 'Should have received cancel callback');
    const callback = callbackReceived[0].data;
    assertEqual(callback.event_type, 'cancel');
    assertEqual(callback.meeting_id, targetMeeting.id);
    console.log(`    Callback received: event_type=${callback.event_type}, meeting_id=${callback.meeting_id}`);
  }),

  test('Book meeting for callback retry test', async () => {
    const res = await makeRequest('POST', '/api/meetings/book', {
      title: 'Retry Test Meeting',
      organizer: 'RetryUser',
      start_time: '2026-05-17 10:00:00',
      end_time: '2026-05-17 11:00:00',
      room_id: room1Id,
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    console.log(`    Meeting booked: ${res.body.meeting.id}`);
  }),

  test('Callback fail first, then scheduler retries successfully', async () => {
    const meetingRes = await makeRequest('GET', '/api/meetings');
    assertEqual(meetingRes.status, 200);
    const meetings = meetingRes.body.meetings;
    const targetMeeting = meetings.find(m => m.title === 'Retry Test Meeting');
    assertTrue(targetMeeting, 'Should find retry test meeting');
    
    callbackReceived = [];
    
    await setMockFailTimes(10);
    
    console.log('    [Phase 1] Reschedule with callback_url (mock will fail 10 times)');
    const res = await makeRequest('POST', `/api/meetings/${targetMeeting.id}/reschedule`, {
      start_time: '2026-05-17 14:00:00',
      end_time: '2026-05-17 15:00:00',
      room_id: room2Id,
      actor: 'RetryUser',
      callback_url: 'http://localhost:4568/webhook',
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    const transactionId = res.body.transaction_id;
    console.log(`    Transaction ID: ${transactionId}`);
    
    console.log('    Waiting for initial callback attempts to fail...');
    await new Promise(r => setTimeout(r, 15000));
    
    console.log('    [Phase 2] Verify transaction is in callback_failed state');
    const txRes1 = await makeRequest('GET', `/api/transactions/${transactionId}`);
    assertEqual(txRes1.status, 200);
    assertTrue(txRes1.body.success);
    const tx1 = txRes1.body.transaction;
    assertEqual(tx1.status, 'callback_failed', 'Transaction should be in callback_failed state');
    assertEqual(tx1.original_status, 'completed', 'original_status should be completed');
    console.log(`    Transaction status: ${tx1.status}, original_status: ${tx1.original_status}`);
    
    const callbacksBeforeRetry = callbackReceived.length;
    console.log(`    Callbacks received before retry: ${callbacksBeforeRetry}`);
    
    console.log('    [Phase 3] Clear mock failure, let next request succeed');
    await setMockFailTimes(0);
    
    console.log('    [Phase 4] Wait for scheduler to retry (3s interval)...');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('    [Phase 5] Verify transaction recovered to completed state');
    const txRes2 = await makeRequest('GET', `/api/transactions/${transactionId}`);
    assertEqual(txRes2.status, 200);
    assertTrue(txRes2.body.success);
    const tx2 = txRes2.body.transaction;
    assertEqual(tx2.status, 'completed', 'Transaction should be recovered to completed state');
    assertTrue(tx2.original_status === null || tx2.original_status === undefined, 
               'original_status should be cleared after success');
    console.log(`    Transaction status: ${tx2.status}`);
    
    const callbacksAfterRetry = callbackReceived.length;
    console.log(`    Callbacks received after scheduler retry: ${callbacksAfterRetry}`);
    assertTrue(callbacksAfterRetry > callbacksBeforeRetry, 
               'Scheduler should have retried the callback');
    
    console.log('    [Phase 6] Wait and verify no more retries (convergence)');
    await new Promise(r => setTimeout(r, 6000));
    
    const txRes3 = await makeRequest('GET', `/api/transactions/${transactionId}`);
    const tx3 = txRes3.body.transaction;
    assertEqual(tx3.status, 'completed', 'Transaction should remain in completed state');
    
    const finalCallbackCount = callbackReceived.length;
    console.log(`    Final callback count: ${finalCallbackCount}`);
    
    assertTrue(finalCallbackCount <= callbacksAfterRetry + 1,
               'Should not have excessive repeated callbacks (convergence achieved)');
    
    console.log('    ✓ Callback retry scheduler works correctly: failed -> callback_failed -> (scheduler retry) -> completed -> (no more retries)');
  }),

  test('Book meeting for invalid state test', async () => {
    const res = await makeRequest('POST', '/api/meetings/book', {
      title: 'Invalid State Test Meeting',
      organizer: 'StateTester',
      start_time: '2026-05-18 10:00:00',
      end_time: '2026-05-18 11:00:00',
      room_id: room1Id,
    });
    assertEqual(res.status, 200);
    assertTrue(res.body.success);
    console.log(`    Meeting booked: ${res.body.meeting.id}`);
  }),

  test('Reject reschedule with invalid time range (start >= end)', async () => {
    const meetingRes = await makeRequest('GET', '/api/meetings');
    assertEqual(meetingRes.status, 200);
    const meetings = meetingRes.body.meetings;
    const targetMeeting = meetings.find(m => m.title === 'Invalid State Test Meeting');
    assertTrue(targetMeeting, 'Should find invalid state test meeting');
    const originalTime = targetMeeting.start_time;
    
    console.log('    [Phase 1] Attempt reschedule with start_time >= end_time');
    const res = await makeRequest('POST', `/api/meetings/${targetMeeting.id}/reschedule`, {
      start_time: '2026-05-18 15:00:00',
      end_time: '2026-05-18 14:00:00',
      actor: 'StateTester',
    });
    
    assertEqual(res.status, 409, 'Response should be 409 (transaction validation failed)');
    assertTrue(!res.body.success, 'Transaction should fail');
    assertEqual(res.body.error, 'INVALID_TIME_RANGE', 'Error should be INVALID_TIME_RANGE');
    assertTrue(res.body.transaction_id, 'Should have transaction ID');
    
    console.log(`    Transaction ID: ${res.body.transaction_id}`);
    console.log(`    Error: ${res.body.error}`);
    
    console.log('    [Phase 2] Verify transaction is in failed state with steps');
    const txRes = await makeRequest('GET', `/api/transactions/${res.body.transaction_id}`);
    assertEqual(txRes.status, 200);
    assertTrue(txRes.body.success);
    const tx = txRes.body.transaction;
    assertEqual(tx.status, 'failed', 'Transaction should be in failed state');
    assertTrue(tx.steps.length > 0, 'Should have transaction steps');
    
    const validateStep = tx.steps.find(s => s.step_name === 'validate_input');
    assertTrue(validateStep, 'Should have validate_input step');
    assertEqual(validateStep.status, 'failed', 'validate_input step should be failed');
    console.log(`    Transaction status: ${tx.status}`);
    console.log(`    validate_input step status: ${validateStep.status}`);
    
    console.log('    [Phase 3] Verify meeting time was NOT changed');
    const meetingAfter = await makeRequest('GET', `/api/meetings/${targetMeeting.id}`);
    assertEqual(meetingAfter.status, 200);
    assertEqual(meetingAfter.body.meeting.start_time, originalTime, 
                'Meeting time should not be changed after failed validation');
    console.log(`    Meeting time unchanged: ${meetingAfter.body.meeting.start_time}`);
    
    console.log('    ✓ Invalid time range rejected correctly, transaction recorded, meeting unchanged');
  }),

  test('Reject reschedule with start_time == end_time', async () => {
    const meetingRes = await makeRequest('GET', '/api/meetings');
    assertEqual(meetingRes.status, 200);
    const meetings = meetingRes.body.meetings;
    const targetMeeting = meetings.find(m => m.title === 'Invalid State Test Meeting');
    assertTrue(targetMeeting, 'Should find invalid state test meeting');
    
    console.log('    Attempt reschedule with start_time == end_time');
    const res = await makeRequest('POST', `/api/meetings/${targetMeeting.id}/reschedule`, {
      start_time: '2026-05-18 12:00:00',
      end_time: '2026-05-18 12:00:00',
      actor: 'StateTester',
    });
    
    assertEqual(res.status, 409);
    assertTrue(!res.body.success);
    assertEqual(res.body.error, 'INVALID_TIME_RANGE');
    console.log(`    Correctly rejected with: ${res.body.error}`);
  }),
];

async function runApiTests() {
  try {
    await startMockCallbackServer(4568);
    console.log('');
  } catch (err) {
    console.error('[Error] Failed to start mock callback server:', err.message);
  }

  try {
    for (const testFn of tests) {
      await testFn();
    }
  } finally {
    await stopMockCallbackServer();
  }

  console.log('----------------------------------------');
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------');

  return {
    passed,
    failed,
    total: tests.length,
  };
}

module.exports = {
  runApiTests,
};
