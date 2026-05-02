const { v4: uuidv4 } = require('uuid');
const { EVENT_TYPES, CARD_STATUSES } = require('../shared/constants');
const roomManager = require('./roomManager');

class ReplayManager {
  constructor() {
    this.activeReplays = new Map();
    this.builtinScripts = this.createBuiltinScripts();
  }

  createBuiltinScripts() {
    return {
      basic_scenario: {
        name: '基础同步场景',
        description: '两个客户端创建并移动卡片，验证实时同步',
        events: [
          {
            delay: 0,
            event: {
              id: 'evt-001',
              type: EVENT_TYPES.CARD_CREATED,
              payload: {
                cardId: 'card-001',
                title: '实现用户登录',
                status: CARD_STATUSES.TODO
              },
              clientId: 'client-a'
            }
          },
          {
            delay: 500,
            event: {
              id: 'evt-002',
              type: EVENT_TYPES.CARD_CREATED,
              payload: {
                cardId: 'card-002',
                title: '编写测试用例',
                status: CARD_STATUSES.TODO
              },
              clientId: 'client-b'
            }
          },
          {
            delay: 1000,
            event: {
              id: 'evt-003',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-001',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-a'
            }
          },
          {
            delay: 1500,
            event: {
              id: 'evt-004',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-002',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-b'
            }
          },
          {
            delay: 2000,
            event: {
              id: 'evt-005',
              type: EVENT_TYPES.CARD_UPDATED,
              payload: {
                cardId: 'card-001',
                title: '实现用户登录（含JWT）',
                assignee: 'Alice'
              },
              clientId: 'client-a'
            }
          }
        ]
      },
      
      out_of_order: {
        name: '乱序事件场景',
        description: '模拟网络延迟导致事件乱序到达，验证最终一致性',
        events: [
          {
            delay: 0,
            event: {
              id: 'evt-010',
              type: EVENT_TYPES.CARD_CREATED,
              payload: {
                cardId: 'card-010',
                title: '配置CI/CD流水线',
                status: CARD_STATUSES.TODO
              },
              clientId: 'client-a'
            },
            deliverAt: 0
          },
          {
            delay: 300,
            event: {
              id: 'evt-011',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-010',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-a'
            },
            deliverAt: 1000
          },
          {
            delay: 600,
            event: {
              id: 'evt-012',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-010',
                newStatus: CARD_STATUSES.REVIEW
              },
              clientId: 'client-b'
            },
            deliverAt: 500
          }
        ]
      },
      
      duplicate_events: {
        name: '重复事件场景',
        description: '模拟网络重发导致重复事件，验证幂等性处理',
        events: [
          {
            delay: 0,
            event: {
              id: 'evt-020',
              type: EVENT_TYPES.CARD_CREATED,
              payload: {
                cardId: 'card-020',
                title: '数据库优化',
                status: CARD_STATUSES.TODO
              },
              clientId: 'client-a'
            }
          },
          {
            delay: 500,
            event: {
              id: 'evt-021',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-020',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-a'
            }
          },
          {
            delay: 700,
            event: {
              id: 'evt-021',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-020',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-a'
            },
            isDuplicate: true
          },
          {
            delay: 900,
            event: {
              id: 'evt-021',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-020',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-a'
            },
            isDuplicate: true
          },
          {
            delay: 1200,
            event: {
              id: 'evt-022',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-020',
                newStatus: CARD_STATUSES.DONE
              },
              clientId: 'client-b'
            }
          }
        ]
      },
      
      disconnection_reconnect: {
        name: '断线重连场景',
        description: '模拟客户端断线期间的事件补发',
        events: [
          {
            delay: 0,
            event: {
              id: 'evt-030',
              type: EVENT_TYPES.CARD_CREATED,
              payload: {
                cardId: 'card-030',
                title: '性能监控',
                status: CARD_STATUSES.TODO
              },
              clientId: 'client-a'
            },
            broadcastTo: ['client-a', 'client-b']
          },
          {
            delay: 500,
            event: {
              id: 'evt-031',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-030',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-a'
            },
            broadcastTo: ['client-a'],
            skipClient: 'client-b'
          },
          {
            delay: 1000,
            event: {
              id: 'evt-032',
              type: EVENT_TYPES.CARD_UPDATED,
              payload: {
                cardId: 'card-030',
                assignee: 'Bob'
              },
              clientId: 'client-a'
            },
            broadcastTo: ['client-a'],
            skipClient: 'client-b'
          },
          {
            delay: 1500,
            type: 'reconnect',
            clientId: 'client-b',
            description: 'client-b 重连，需要补发 evt-031 和 evt-032'
          },
          {
            delay: 2000,
            event: {
              id: 'evt-033',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-030',
                newStatus: CARD_STATUSES.DONE
              },
              clientId: 'client-b'
            },
            broadcastTo: ['client-a', 'client-b']
          }
        ]
      },
      
      complex_scenario: {
        name: '综合复杂场景',
        description: '结合乱序、重复、并发操作的综合测试',
        events: [
          {
            delay: 0,
            event: {
              id: 'evt-050',
              type: EVENT_TYPES.CARD_CREATED,
              payload: {
                cardId: 'card-050',
                title: '重构代码',
                status: CARD_STATUSES.TODO
              },
              clientId: 'client-a'
            }
          },
          {
            delay: 200,
            event: {
              id: 'evt-051',
              type: EVENT_TYPES.CARD_CREATED,
              payload: {
                cardId: 'card-051',
                title: '写文档',
                status: CARD_STATUSES.TODO
              },
              clientId: 'client-b'
            }
          },
          {
            delay: 400,
            event: {
              id: 'evt-052',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-050',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-a'
            },
            deliverAt: 800
          },
          {
            delay: 600,
            event: {
              id: 'evt-053',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-050',
                newStatus: CARD_STATUSES.REVIEW
              },
              clientId: 'client-b'
            },
            deliverAt: 500
          },
          {
            delay: 800,
            event: {
              id: 'evt-054',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-051',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-b'
            }
          },
          {
            delay: 1000,
            event: {
              id: 'evt-055',
              type: EVENT_TYPES.CARD_MOVED,
              payload: {
                cardId: 'card-051',
                newStatus: CARD_STATUSES.IN_PROGRESS
              },
              clientId: 'client-b'
            },
            isDuplicate: true
          },
          {
            delay: 1200,
            event: {
              id: 'evt-056',
              type: EVENT_TYPES.CARD_DELETED,
              payload: {
                cardId: 'card-050'
              },
              clientId: 'client-a'
            }
          }
        ]
      }
    };
  }

  getBuiltinScripts() {
    return this.builtinScripts;
  }

  getScript(scriptId) {
    return this.builtinScripts[scriptId] || null;
  }

  async startReplay(roomId, scriptId, options = {}) {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const script = this.builtinScripts[scriptId];
    if (!script) {
      return { success: false, error: 'Script not found' };
    }

    const replayId = uuidv4();
    const replay = {
      id: replayId,
      roomId,
      scriptId,
      script: { ...script },
      options,
      startTime: Date.now(),
      currentStep: 0,
      isRunning: true,
      results: []
    };

    this.activeReplays.set(replayId, replay);
    
    await this.executeReplay(replayId);

    return { 
      success: true, 
      replayId,
      script: script.name,
      eventCount: script.events.length
    };
  }

  async executeReplay(replayId) {
    const replay = this.activeReplays.get(replayId);
    if (!replay) return;

    const { script, roomId } = replay;
    const events = script.events;

    for (let i = 0; i < events.length && replay.isRunning; i++) {
      const step = events[i];
      replay.currentStep = i;

      if (step.delay > 0) {
        await this.delay(step.delay);
      }

      if (!replay.isRunning) break;

      if (step.type === 'reconnect') {
        const result = {
          type: 'reconnect',
          clientId: step.clientId,
          description: step.description,
          eventsToReplay: roomManager.getEventsSince(roomId, 0),
          timestamp: Date.now()
        };
        replay.results.push(result);
      } else if (step.event) {
        const eventWithRoom = {
          ...step.event,
          roomId,
          timestamp: Date.now()
        };

        const result = roomManager.applyEvent(roomId, eventWithRoom);
        replay.results.push({
          step: i,
          event: eventWithRoom,
          result,
          isDuplicate: step.isDuplicate,
          deliverAt: step.deliverAt,
          broadcastTo: step.broadcastTo,
          skipClient: step.skipClient,
          timestamp: Date.now()
        });
      }
    }

    replay.isRunning = false;
    replay.endTime = Date.now();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stopReplay(replayId) {
    const replay = this.activeReplays.get(replayId);
    if (replay) {
      replay.isRunning = false;
      return { success: true };
    }
    return { success: false, error: 'Replay not found' };
  }

  getReplayStatus(replayId) {
    const replay = this.activeReplays.get(replayId);
    if (!replay) return null;

    return {
      id: replay.id,
      roomId: replay.roomId,
      scriptId: replay.scriptId,
      isRunning: replay.isRunning,
      currentStep: replay.currentStep,
      totalSteps: replay.script.events.length,
      results: replay.results
    };
  }

  getAllActiveReplays() {
    return Array.from(this.activeReplays.values()).map(replay => ({
      id: replay.id,
      roomId: replay.roomId,
      scriptId: replay.scriptId,
      isRunning: replay.isRunning,
      currentStep: replay.currentStep,
      totalSteps: replay.script.events.length
    }));
  }
}

const replayManager = new ReplayManager();

module.exports = replayManager;
