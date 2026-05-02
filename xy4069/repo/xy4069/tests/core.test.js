import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LogParser, CRDTTextModel, PlaybackState, Exporter } from '../src/core/index.js';

describe('LogParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LogParser();
  });

  it('should parse valid operations correctly', () => {
    const logs = [
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ];

    const result = parser.parse(logs);
    
    assert.equal(result.stats.total, 1);
    assert.equal(result.stats.valid, 1);
    assert.equal(result.operations.length, 1);
    assert.equal(result.operations[0].operationId, 'op-001');
  });

  it('should detect duplicate operation IDs', () => {
    const logs = [
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      },
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:01.000Z',
        version: 1,
        type: 'INSERT',
        payload: { position: 5, text: ' World' }
      }
    ];

    const result = parser.parse(logs);
    
    assert.equal(result.stats.total, 2);
    assert.equal(result.stats.valid, 1);
    assert.equal(result.stats.invalid, 1);
    
    const duplicateError = result.validationErrors.find(e => e.type === 'DUPLICATE_OPERATION_ID');
    assert.ok(duplicateError, 'Should have DUPLICATE_OPERATION_ID error');
  });

  it('should detect missing required fields', () => {
    const logs = [
      {
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ];

    const result = parser.parse(logs);
    
    assert.equal(result.stats.valid, 0);
    assert.equal(result.stats.invalid, 1);
    
    const missingFieldError = result.isolationList[0].errors.find(e => e.type === 'MISSING_FIELDS');
    assert.ok(missingFieldError, 'Should have MISSING_FIELDS error');
    assert.ok(missingFieldError.fields.includes('operationId'), 'Should mention missing operationId');
  });

  it('should detect version jumps', () => {
    const logs = [
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      },
      {
        operationId: 'op-002',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:01.000Z',
        version: 5,
        type: 'INSERT',
        payload: { position: 5, text: ' World' }
      }
    ];

    const result = parser.parse(logs);
    
    const versionJumpError = result.validationErrors.find(e => e.type === 'VERSION_JUMP');
    assert.ok(versionJumpError, 'Should have VERSION_JUMP error');
  });

  it('should detect out of order timestamps', () => {
    const logs = [
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:02.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'First' }
      },
      {
        operationId: 'op-002',
        userId: 'user-b',
        timestamp: '2024-05-01T10:00:01.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Second' }
      }
    ];

    const result = parser.parse(logs);
    
    const outOfOrderError = result.validationErrors.find(e => e.type === 'OUT_OF_ORDER');
    assert.ok(outOfOrderError, 'Should have OUT_OF_ORDER error');
  });

  it('should sort operations by timestamp', () => {
    const logs = [
      {
        operationId: 'op-003',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:03.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Third' }
      },
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:01.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'First' }
      },
      {
        operationId: 'op-002',
        userId: 'user-b',
        timestamp: '2024-05-01T10:00:02.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Second' }
      }
    ];

    const result = parser.parse(logs);
    
    assert.equal(result.operations[0].operationId, 'op-001');
    assert.equal(result.operations[1].operationId, 'op-002');
    assert.equal(result.operations[2].operationId, 'op-003');
  });
});

describe('CRDTTextModel', () => {
  let model;

  beforeEach(() => {
    model = new CRDTTextModel();
  });

  it('should handle insert operation', () => {
    const op = {
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hello' }
    };

    const result = model.applyOperation(op);
    
    assert.ok(result.success, 'Insert should succeed');
    assert.equal(model.getDocument(), 'Hello');
  });

  it('should handle multiple inserts', () => {
    model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hello' }
    });

    model.applyOperation({
      operationId: 'op-002',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:01.000Z',
      version: 1,
      type: 'INSERT',
      payload: { position: 5, text: ' World' }
    });

    assert.equal(model.getDocument(), 'Hello World');
  });

  it('should detect insert position out of bounds', () => {
    const result = model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 100, text: 'Invalid' }
    });

    assert.ok(result.conflicts.length > 0, 'Should have conflict');
    assert.equal(result.conflicts[0].type, 'INSERT_POSITION_OUT_OF_BOUNDS');
  });

  it('should handle delete operation', () => {
    model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hello World' }
    });

    const result = model.applyOperation({
      operationId: 'op-002',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:01.000Z',
      version: 1,
      type: 'DELETE',
      payload: { position: 5, length: 6, direction: 'forward' }
    });

    assert.ok(result.success, 'Delete should succeed');
    assert.equal(model.getDocument(), 'Hello');
  });

  it('should handle cursor move operation', () => {
    model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hello' }
    });

    const result = model.applyOperation({
      operationId: 'op-002',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:01.000Z',
      version: 1,
      type: 'CURSOR_MOVE',
      payload: { position: 3 }
    });

    assert.ok(result.success, 'Cursor move should succeed');
    assert.equal(model.getCursors()['user-a'], 3);
  });

  it('should handle undo operation', () => {
    model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hello' }
    });

    assert.equal(model.getDocument(), 'Hello');

    const result = model.applyOperation({
      operationId: 'op-002',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:01.000Z',
      version: 1,
      type: 'UNDO',
      payload: {}
    });

    assert.equal(model.getDocument(), '');
  });

  it('should handle merge operation', () => {
    const result = model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'MERGE',
      payload: {
        baseVersion: 0,
        remoteOperations: [
          {
            operationId: 'remote-001',
            type: 'INSERT',
            payload: { position: 0, text: 'Merged' }
          }
        ]
      }
    });

    assert.ok(result.success, 'Merge should succeed');
    assert.equal(model.getDocument(), 'Merged');
  });

  it('should track conflicts', () => {
    model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 100, text: 'Invalid' }
    });

    assert.equal(model.getConflicts().length, 1);
  });

  it('should reset correctly', () => {
    model.applyOperation({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: '2024-05-01T10:00:00.000Z',
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hello' }
    });

    model.reset();

    assert.equal(model.getDocument(), '');
    assert.equal(model.getConflicts().length, 0);
    assert.equal(model.getOperations().length, 0);
  });
});

describe('PlaybackState', () => {
  let playback;

  beforeEach(() => {
    playback = new PlaybackState();
  });

  it('should load operations', () => {
    const operations = [
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ];

    const state = playback.loadOperations(operations);
    
    assert.equal(state.totalOperations, 1);
    assert.equal(state.currentIndex, -1);
  });

  it('should step forward', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ]);

    const state = playback.stepForward();
    
    assert.equal(state.currentIndex, 0);
    assert.equal(state.document, 'Hello');
  });

  it('should step backward', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ]);

    playback.stepForward();
    assert.equal(playback.getState().currentIndex, 0);

    const state = playback.stepBackward();
    assert.equal(state.currentIndex, -1);
    assert.equal(state.document, '');
  });

  it('should play and pause', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ]);

    let playState = playback.play(1);
    assert.ok(playState.isPlaying, 'Should be playing');

    playState = playback.pause();
    assert.ok(!playState.isPlaying, 'Should be paused');
  });

  it('should toggle play', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ]);

    let state = playback.togglePlay();
    assert.ok(state.isPlaying, 'Should start playing');

    state = playback.togglePlay();
    assert.ok(!state.isPlaying, 'Should pause');
  });

  it('should go to specific index', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'A' }
      },
      {
        operationId: 'op-002',
        userId: 'user-b',
        timestamp: '2024-05-01T10:00:01.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'B' }
      },
      {
        operationId: 'op-003',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:02.000Z',
        version: 1,
        type: 'INSERT',
        payload: { position: 0, text: 'C' }
      }
    ]);

    let state = playback.goToIndex(1);
    assert.equal(state.currentIndex, 1);

    state = playback.goToIndex(0);
    assert.equal(state.currentIndex, 0);
  });

  it('should set active user', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ]);

    const state = playback.setActiveUserId('user-b');
    assert.equal(state.activeUserId, 'user-b');
  });

  it('should get unique users', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      },
      {
        operationId: 'op-002',
        userId: 'user-b',
        timestamp: '2024-05-01T10:00:01.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 5, text: ' World' }
      },
      {
        operationId: 'op-003',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:02.000Z',
        version: 1,
        type: 'INSERT',
        payload: { position: 0, text: 'Hi ' }
      }
    ]);

    const users = playback.getUniqueUsers();
    assert.deepEqual(users.sort(), ['user-a', 'user-b']);
  });

  it('should set playback speed', () => {
    const state = playback.setPlaybackSpeed(2);
    assert.equal(state.playbackSpeed, 2);
  });

  it('should clamp playback speed', () => {
    let state = playback.setPlaybackSpeed(20);
    assert.equal(state.playbackSpeed, 10, 'Max speed should be 10');

    state = playback.setPlaybackSpeed(0.01);
    assert.equal(state.playbackSpeed, 0.1, 'Min speed should be 0.1');
  });

  it('should fire events', () => {
    let eventFired = false;
    const unsubscribe = playback.on('operationsLoaded', () => {
      eventFired = true;
    });

    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ]);

    assert.ok(eventFired, 'operationsLoaded event should fire');
    unsubscribe();
  });

  it('should reset correctly', () => {
    playback.loadOperations([
      {
        operationId: 'op-001',
        userId: 'user-a',
        timestamp: '2024-05-01T10:00:00.000Z',
        version: 0,
        type: 'INSERT',
        payload: { position: 0, text: 'Hello' }
      }
    ]);

    playback.stepForward();
    const state = playback.reset();

    assert.equal(state.totalOperations, 0);
    assert.equal(state.currentIndex, -1);
    assert.equal(state.document, '');
  });
});

describe('Exporter', () => {
  it('should export markdown', () => {
    const state = {
      document: 'Hello World',
      cursors: {},
      conflicts: [],
      conflictMarkers: [],
      operations: [
        {
          operationId: 'op-001',
          userId: 'user-a',
          timestamp: '2024-05-01T10:00:00.000Z',
          version: 0,
          type: 'INSERT'
        }
      ],
      versionVector: {},
      userStates: {}
    };

    const parserResult = {
      stats: {
        total: 1,
        valid: 1,
        invalid: 0,
        uniqueUsers: 1
      },
      validationErrors: [],
      isolationList: []
    };

    const markdown = Exporter.exportMarkdown(state, parserResult);
    
    assert.ok(markdown.includes('Hello World'), 'Should include document content');
    assert.ok(markdown.includes('统计概览'), 'Should include stats section');
  });

  it('should export JSON', () => {
    const state = {
      document: 'Hello',
      cursors: {},
      conflicts: [],
      conflictMarkers: [],
      operations: [],
      versionVector: {},
      userStates: {}
    };

    const parserResult = {
      stats: { total: 0, valid: 0, invalid: 0, uniqueUsers: 0 },
      validationErrors: [],
      isolationList: []
    };

    const jsonResult = Exporter.exportJSON(state, parserResult);
    
    assert.equal(jsonResult.finalState.document, 'Hello');
    assert.ok(jsonResult.metadata.generatedAt);
  });
});
