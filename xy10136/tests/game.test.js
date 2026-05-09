const { CustomsGame, GameState, RiskLevel, RiskConfig, MAX_QUEUE_SIZE, MAX_CONTRABAND_MISSES } = require('../src/game.js');

jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');
jest.spyOn(global, 'setInterval');
jest.spyOn(global, 'clearTimeout');
jest.spyOn(global, 'clearInterval');

describe('CustomsGame', () => {
  let game;

  beforeEach(() => {
    game = new CustomsGame();
    jest.clearAllTimers();
  });

  afterEach(() => {
    if (game) {
      game._clearAllTimers();
    }
  });

  describe('初始状态', () => {
    it('应该以IDLE状态初始化', () => {
      const status = game.getStatus();
      expect(status.state).toBe(GameState.IDLE);
      expect(status.score).toBe(0);
      expect(status.queue).toEqual([]);
      expect(status.windows).toEqual([null, null]);
      expect(status.contrabandMisses).toBe(0);
    });
  });

  describe('游戏启动', () => {
    it('启动后状态变为PLAYING', () => {
      game.start();
      expect(game.getStatus().state).toBe(GameState.PLAYING);
    });

    it('启动后队列中至少有一个物品', () => {
      game.start();
      expect(game.getStatus().queue.length).toBeGreaterThan(0);
    });

    it('重复启动不会改变状态', () => {
      game.start();
      const initialQueueLength = game.getStatus().queue.length;
      game.start();
      expect(game.getStatus().state).toBe(GameState.PLAYING);
      expect(game.getStatus().queue.length).toBe(initialQueueLength);
    });
  });

  describe('暂停和恢复', () => {
    it('可以暂停正在进行的游戏', () => {
      game.start();
      game.pause();
      expect(game.getStatus().state).toBe(GameState.PAUSED);
    });

    it('可以从暂停恢复游戏', () => {
      game.start();
      game.pause();
      game.resume();
      expect(game.getStatus().state).toBe(GameState.PLAYING);
    });

    it('暂停时无法进行查验操作', () => {
      game.start();
      game.pause();
      const result = game.inspect(0);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('游戏未进行中');
    });

    it('暂停时无法进行放行操作', () => {
      game.start();
      game.pause();
      const result = game.pass();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('游戏未进行中');
    });
  });

  describe('查验操作', () => {
    it('可以将物品放入空闲窗口查验', () => {
      game.start();
      const initialQueueLength = game.getStatus().queue.length;
      const result = game.inspect(0);
      
      expect(result.success).toBe(true);
      expect(game.getStatus().queue.length).toBe(initialQueueLength - 1);
      expect(game.getStatus().windows[0]).not.toBeNull();
    });

    it('不能重复点击同一窗口进行查验', () => {
      game.start();
      game.inspect(0);
      const result = game.inspect(0);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('窗口正在使用中');
    });

    it('不能使用无效窗口索引', () => {
      game.start();
      const result1 = game.inspect(-1);
      const result2 = game.inspect(2);
      
      expect(result1.success).toBe(false);
      expect(result1.reason).toBe('窗口索引无效');
      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('窗口索引无效');
    });

    it('队列为空时不能查验', () => {
      game.start();
      while (game.getStatus().queue.length > 0) {
        game.pass();
      }
      const result = game.inspect(0);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('队列为空');
    });

    it('两个窗口可以同时查验', () => {
      game.start();
      game.queue = [
        { id: 1, riskLevel: RiskLevel.LOW, type: '测试1', status: 'queued' },
        { id: 2, riskLevel: RiskLevel.MEDIUM, type: '测试2', status: 'queued' },
        { id: 3, riskLevel: RiskLevel.HIGH, type: '测试3', status: 'queued' }
      ];
      
      const result1 = game.inspect(0);
      const result2 = game.inspect(1);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(game.getStatus().windows[0]).not.toBeNull();
      expect(game.getStatus().windows[1]).not.toBeNull();
    });
  });

  describe('放行操作', () => {
    it('可以放行队列中的物品', () => {
      game.start();
      const initialQueueLength = game.getStatus().queue.length;
      const result = game.pass();
      
      expect(result.success).toBe(true);
      expect(game.getStatus().queue.length).toBe(initialQueueLength - 1);
    });

    it('队列为空时不能放行', () => {
      game.start();
      while (game.getStatus().queue.length > 0) {
        game.pass();
      }
      const result = game.pass();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('队列为空');
    });
  });

  describe('计分系统', () => {
    it('放行低风险物品应该加分', () => {
      game.start();
      game.queue = [{ id: 1, riskLevel: RiskLevel.LOW, type: '测试', status: 'queued' }];
      
      const initialScore = game.getStatus().score;
      const result = game.pass();
      
      expect(result.scoreChange).toBe(RiskConfig[RiskLevel.LOW].correctPassScore);
      expect(game.getStatus().score).toBe(initialScore + RiskConfig[RiskLevel.LOW].correctPassScore);
      expect(result.isCorrect).toBe(true);
    });

    it('放行违禁品应该扣分并增加违禁品放行计数', () => {
      game.start();
      game.queue = [{ id: 1, riskLevel: RiskLevel.CONTRABAND, type: '测试', status: 'queued' }];
      
      const initialMisses = game.getStatus().contrabandMisses;
      const result = game.pass();
      
      expect(result.scoreChange).toBe(RiskConfig[RiskLevel.CONTRABAND].wrongPassScore);
      expect(result.isContrabandMiss).toBe(true);
      expect(game.getStatus().contrabandMisses).toBe(initialMisses + 1);
    });

    it('查验中高风险和违禁品应该加分', () => {
      game.start();
      
      const riskLevels = [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CONTRABAND];
      riskLevels.forEach(riskLevel => {
        game.queue = [{ id: 1, riskLevel, type: '测试', status: 'queued' }];
        const initialScore = game.getStatus().score;
        game.inspect(0);
        
        jest.advanceTimersByTime(RiskConfig[riskLevel].inspectionTime * 1000);
        
        expect(game.getStatus().score).toBeGreaterThan(initialScore);
      });
    });

    it('查验低风险物品应该扣分', () => {
      game.start();
      game.queue = [{ id: 1, riskLevel: RiskLevel.LOW, type: '测试', status: 'queued' }];
      const initialScore = game.getStatus().score;
      game.inspect(0);
      
      jest.advanceTimersByTime(RiskConfig[RiskLevel.LOW].inspectionTime * 1000);
      
      expect(game.getStatus().score).toBeLessThan(initialScore);
    });

    it('计分历史应该记录所有操作', () => {
      game.start();
      game.queue = [
        { id: 1, riskLevel: RiskLevel.LOW, type: '测试1', status: 'queued' },
        { id: 2, riskLevel: RiskLevel.HIGH, type: '测试2', status: 'queued' }
      ];
      
      game.pass();
      game.inspect(0);
      jest.advanceTimersByTime(RiskConfig[RiskLevel.HIGH].inspectionTime * 1000);
      
      const history = game.getStatus().scoreHistory;
      expect(history.length).toBe(2);
      expect(history[0].action).toBe('pass');
      expect(history[1].action).toBe('inspect');
    });
  });

  describe('游戏失败条件', () => {
    it('放行3个违禁品应该游戏结束', () => {
      game.start();
      
      for (let i = 0; i < MAX_CONTRABAND_MISSES; i++) {
        game.queue = [{ id: i + 1, riskLevel: RiskLevel.CONTRABAND, type: '违禁品', status: 'queued' }];
        game.pass();
      }
      
      expect(game.getStatus().state).toBe(GameState.GAME_OVER);
      expect(game.getStatus().contrabandMisses).toBe(MAX_CONTRABAND_MISSES);
    });

    it('队列超过最大容量应该游戏结束', () => {
      game.start();
      
      for (let i = 0; i <= MAX_QUEUE_SIZE; i++) {
        game._spawnItem();
      }
      
      expect(game.getStatus().state).toBe(GameState.GAME_OVER);
    });
  });

  describe('重新开始', () => {
    it('游戏结束后可以重新开始', () => {
      game.start();
      for (let i = 0; i < MAX_CONTRABAND_MISSES; i++) {
        game.queue = [{ id: i + 1, riskLevel: RiskLevel.CONTRABAND, type: '违禁品', status: 'queued' }];
        game.pass();
      }
      
      expect(game.getStatus().state).toBe(GameState.GAME_OVER);
      
      game.restart();
      
      expect(game.getStatus().state).toBe(GameState.PLAYING);
      expect(game.getStatus().score).toBe(0);
      expect(game.getStatus().contrabandMisses).toBe(0);
      expect(game.getStatus().windows).toEqual([null, null]);
    });
  });

  describe('边界情况保护', () => {
    it('游戏未开始时操作应该被拒绝', () => {
      const inspectResult = game.inspect(0);
      const passResult = game.pass();
      
      expect(inspectResult.success).toBe(false);
      expect(inspectResult.reason).toBe('游戏未进行中');
      expect(passResult.success).toBe(false);
      expect(passResult.reason).toBe('游戏未进行中');
    });

    it('游戏结束后操作应该被拒绝', () => {
      game.start();
      for (let i = 0; i < MAX_CONTRABAND_MISSES; i++) {
        game.queue = [{ id: i + 1, riskLevel: RiskLevel.CONTRABAND, type: '违禁品', status: 'queued' }];
        game.pass();
      }
      
      const inspectResult = game.inspect(0);
      const passResult = game.pass();
      
      expect(inspectResult.success).toBe(false);
      expect(passResult.success).toBe(false);
    });

    it('getStatus返回的状态是副本，不会被外部修改影响', () => {
      game.start();
      const status = game.getStatus();
      status.score = 9999;
      status.queue.push({ id: 999, riskLevel: RiskLevel.HIGH });
      
      const newStatus = game.getStatus();
      expect(newStatus.score).not.toBe(9999);
      expect(newStatus.queue.find(i => i.id === 999)).toBeUndefined();
    });
  });
});
