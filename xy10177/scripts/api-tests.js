const http = require('http');

const PORT = process.env.TEST_PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

let mockCallbackServer = null;
let callbackReceived = [];

function startMockCallbackServer(port = 9999) {
  return new Promise((resolve) => {
    callbackReceived = [];
    mockCallbackServer = http.createServer((req, res) => {
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
      port: url.port || 3000,
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
      callback_url: 'http://localhost:9999/webhook',
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
      callback_url: 'http://localhost:9999/webhook',
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
];

async function runApiTests() {
  try {
    await startMockCallbackServer(9999);
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
