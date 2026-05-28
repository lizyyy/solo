import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { useGameStore } from './gameStore';

describe('gameStore - 状态管理测试', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      games: [],
      gameStates: {},
      currentGameId: null,
    });
  });

  afterEach(() => {
    localStorage.clear();
    useGameStore.setState({
      games: [],
      gameStates: {},
      currentGameId: null,
    });
  });

  describe('创建游戏', () => {
    it('应正确创建新游戏', () => {
      const gameId = useGameStore.getState().createGame('测试对局', 'normal');

      const state = useGameStore.getState();
      expect(state.games).toHaveLength(1);
      expect(state.games[0].id).toBe(gameId);
      expect(state.games[0].title).toBe('测试对局');
      expect(state.games[0].status).toBe('active');
      expect(state.gameStates[gameId]).toBeDefined();
      expect(state.currentGameId).toBe(gameId);
    });
  });

  describe('状态不允许测试', () => {
    let gameId: string;

    beforeEach(() => {
      gameId = useGameStore.getState().createGame('测试对局', 'normal');
    });

    it('已确认的操作不能改为临时状态', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'tentative',
        });
      });

      const gameState = useGameStore.getState().gameStates[gameId];
      const actionId = gameState.policyActions[0].id;

      act(() => {
        store.setActionStatus(gameId, actionId, 'confirmed');
      });

      const confirmedAction = useGameStore.getState().gameStates[gameId].policyActions[0];
      expect(confirmedAction.status).toBe('confirmed');

      act(() => {
        store.setActionStatus(gameId, actionId, 'tentative');
      });

      const resultAction = useGameStore.getState().gameStates[gameId].policyActions[0];
      expect(resultAction.status).toBe('confirmed');

      const error = useGameStore.getState().gameStates[gameId].error;
      expect(error).toBe('已确认的操作无法改为临时状态');
    });

    it('已确认的操作不能删除', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'tentative',
        });
      });

      const gameState = useGameStore.getState().gameStates[gameId];
      const actionId = gameState.policyActions[0].id;

      act(() => {
        store.setActionStatus(gameId, actionId, 'confirmed');
      });

      act(() => {
        store.removePolicyAction(gameId, actionId);
      });

      const finalActions = useGameStore.getState().gameStates[gameId].policyActions;
      expect(finalActions).toHaveLength(1);

      const error = useGameStore.getState().gameStates[gameId].error;
      expect(error).toBe('已确认的操作无法删除');
    });

    it('临时状态的操作可以删除', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'tentative',
        });
      });

      const gameState = useGameStore.getState().gameStates[gameId];
      const actionId = gameState.policyActions[0].id;

      act(() => {
        store.removePolicyAction(gameId, actionId);
      });

      const finalActions = useGameStore.getState().gameStates[gameId].policyActions;
      expect(finalActions).toHaveLength(0);
    });

    it('已确认的备注不能改为临时状态', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addClassNote(gameId, '测试备注', 'report');
      });

      const gameState = useGameStore.getState().gameStates[gameId];
      const noteId = gameState.classNotes[0].id;

      act(() => {
        store.updateNoteStatus(gameId, noteId, 'confirmed');
      });

      act(() => {
        store.updateNoteStatus(gameId, noteId, 'tentative');
      });

      const resultNote = useGameStore.getState().gameStates[gameId].classNotes[0];
      expect(resultNote.status).toBe('confirmed');

      const error = useGameStore.getState().gameStates[gameId].error;
      expect(error).toBe('已确认的备注无法改为临时状态');
    });

    it('已确认的备注不能删除', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addClassNote(gameId, '测试备注', 'report');
      });

      const gameState = useGameStore.getState().gameStates[gameId];
      const noteId = gameState.classNotes[0].id;

      act(() => {
        store.updateNoteStatus(gameId, noteId, 'confirmed');
      });

      act(() => {
        store.deleteClassNote(gameId, noteId);
      });

      const finalNotes = useGameStore.getState().gameStates[gameId].classNotes;
      expect(finalNotes).toHaveLength(1);

      const error = useGameStore.getState().gameStates[gameId].error;
      expect(error).toBe('已确认的备注无法删除');
    });

    it('重复提交回合同一回合应被拦截', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'confirmed',
        });
      });

      const result1 = store.submitRound(gameId);
      expect(result1.success).toBe(true);

      const result2 = store.submitRound(gameId);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('本回合已确认提交，请勿重复操作');
    });
  });

  describe('添加政策操作', () => {
    let gameId: string;

    beforeEach(() => {
      gameId = useGameStore.getState().createGame('测试对局', 'normal');
    });

    it('应正确添加临时政策操作', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'tentative',
        });
      });

      const gameState = useGameStore.getState().gameStates[gameId];
      expect(gameState.policyActions).toHaveLength(1);
      expect(gameState.policyActions[0].amount).toBe(500);
      expect(gameState.policyActions[0].status).toBe('tentative');
    });

    it('应正确将临时操作改为已确认', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'tentative',
        });
      });

      const gameState = useGameStore.getState().gameStates[gameId];
      const actionId = gameState.policyActions[0].id;

      act(() => {
        store.setActionStatus(gameId, actionId, 'confirmed');
      });

      const resultAction = useGameStore.getState().gameStates[gameId].policyActions[0];
      expect(resultAction.status).toBe('confirmed');
    });
  });

  describe('回合提交', () => {
    let gameId: string;

    beforeEach(() => {
      gameId = useGameStore.getState().createGame('测试对局', 'normal');
    });

    it('提交回合应正确推进游戏', () => {
      const store = useGameStore.getState();
      const initialRound = store.games[0].currentRound;

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'confirmed',
        });
      });

      const result = store.submitRound(gameId);
      expect(result.success).toBe(true);

      const newRound = useGameStore.getState().games[0].currentRound;
      expect(newRound).toBe(initialRound + 1);
    });

    it('没有确认的操作时提交应失败', () => {
      const store = useGameStore.getState();

      act(() => {
        store.addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'tentative',
        });
      });

      const result = store.submitRound(gameId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('请至少确认一项政策操作后再提交');
    });
  });

  describe('重新开局', () => {
    let gameId: string;

    beforeEach(() => {
      gameId = useGameStore.getState().createGame('测试对局', 'normal');

      act(() => {
        useGameStore.getState().addClassNote(gameId, '测试备注', 'report');
      });

      act(() => {
        useGameStore.getState().addPolicyAction(gameId, {
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'confirmed',
        });
      });

      act(() => {
        useGameStore.getState().submitRound(gameId);
      });
    });

    it('重新开局应重置游戏状态', () => {
      const store = useGameStore.getState();
      const roundBefore = store.games[0].currentRound;
      expect(roundBefore).toBeGreaterThan(1);

      act(() => {
        store.restartGame(gameId);
      });

      const gameAfter = useGameStore.getState().games[0];
      expect(gameAfter.currentRound).toBe(1);
      expect(gameAfter.status).toBe('active');

      const stateAfter = useGameStore.getState().gameStates[gameId];
      expect(stateAfter.policyActions).toHaveLength(0);
      expect(stateAfter.marketHistory).toHaveLength(1);
    });

    it('重新开局后备注应重置为临时状态', () => {
      const store = useGameStore.getState();

      const gameState = useGameStore.getState().gameStates[gameId];
      const noteId = gameState.classNotes[0].id;

      act(() => {
        store.updateNoteStatus(gameId, noteId, 'confirmed');
      });

      act(() => {
        store.restartGame(gameId);
      });

      const noteAfter = useGameStore.getState().gameStates[gameId].classNotes[0];
      expect(noteAfter.status).toBe('tentative');
    });
  });

  describe('删除游戏', () => {
    it('应正确删除游戏', () => {
      const store = useGameStore.getState();
      const gameId = store.createGame('测试对局', 'normal');

      const stateAfterCreate = useGameStore.getState();
      expect(stateAfterCreate.games).toHaveLength(1);

      act(() => {
        useGameStore.getState().deleteGame(gameId);
      });

      const stateAfter = useGameStore.getState();
      expect(stateAfter.games).toHaveLength(0);
      expect(stateAfter.gameStates[gameId]).toBeUndefined();
      expect(stateAfter.currentGameId).toBeNull();
    });
  });

  describe('导入导出', () => {
    it('导出和导入游戏应正确工作', () => {
      const store = useGameStore.getState();
      const gameId = store.createGame('测试对局', 'normal');

      const json = store.exportGame(gameId);
      expect(json).toBeTruthy();
      expect(json).toContain('测试对局');

      const importedId = store.importGame(json);
      expect(importedId).toBeTruthy();
      expect(importedId).not.toBe(gameId);

      const stateAfter = useGameStore.getState();
      expect(stateAfter.games).toHaveLength(2);
      expect(stateAfter.games.find(g => g.id === importedId)?.title).toContain('(导入)');
    });

    it('导入无效JSON应返回null', () => {
      const store = useGameStore.getState();
      const result = store.importGame('invalid json');
      expect(result).toBeNull();
    });
  });
});
