const {
  ORDER_STATES,
  ORDER_STATE_LABELS,
  canTransition,
  canDoAction,
  getTargetState,
  validateTransition,
  getAvailableActions,
  getStateLabel
} = require('../src/utils/stateMachine');

const { StateMachineError } = require('../src/utils/errors');

describe('Order State Machine', () => {
  describe('State Definitions', () => {
    it('should have all required states', () => {
      expect(ORDER_STATES).toEqual({
        DRAFT: 'draft',
        DEPOSIT_LOCKED: 'deposit_locked',
        SHIPPED: 'shipped',
        BUYER_INSPECTING: 'buyer_inspecting',
        RELEASED: 'released',
        PARTIALLY_REFUNDED: 'partially_refunded',
        DISPUTED: 'disputed',
        COMPLETED: 'completed',
        CLOSED: 'closed'
      });
    });

    it('should have Chinese labels for all states', () => {
      const states = Object.values(ORDER_STATES);
      states.forEach(state => {
        expect(ORDER_STATE_LABELS[state]).toBeDefined();
        expect(typeof ORDER_STATE_LABELS[state]).toBe('string');
      });
    });
  });

  describe('canTransition', () => {
    it('should allow transition from draft to deposit_locked', () => {
      expect(canTransition('draft', 'deposit_locked')).toBe(true);
    });

    it('should allow transition from draft to closed', () => {
      expect(canTransition('draft', 'closed')).toBe(true);
    });

    it('should not allow transition from draft directly to shipped', () => {
      expect(canTransition('draft', 'shipped')).toBe(false);
    });

    it('should allow transition from deposit_locked to shipped', () => {
      expect(canTransition('deposit_locked', 'shipped')).toBe(true);
    });

    it('should allow transition from deposit_locked to closed', () => {
      expect(canTransition('deposit_locked', 'closed')).toBe(true);
    });

    it('should allow transition from shipped to buyer_inspecting', () => {
      expect(canTransition('shipped', 'buyer_inspecting')).toBe(true);
    });

    it('should allow transition from shipped to disputed', () => {
      expect(canTransition('shipped', 'disputed')).toBe(true);
    });

    it('should allow transition from buyer_inspecting to released', () => {
      expect(canTransition('buyer_inspecting', 'released')).toBe(true);
    });

    it('should allow transition from buyer_inspecting to partially_refunded', () => {
      expect(canTransition('buyer_inspecting', 'partially_refunded')).toBe(true);
    });

    it('should allow transition from buyer_inspecting to disputed', () => {
      expect(canTransition('buyer_inspecting', 'disputed')).toBe(true);
    });

    it('should allow transition from released to completed', () => {
      expect(canTransition('released', 'completed')).toBe(true);
    });

    it('should allow transition from partially_refunded to closed', () => {
      expect(canTransition('partially_refunded', 'closed')).toBe(true);
    });

    it('should allow transition from partially_refunded to disputed', () => {
      expect(canTransition('partially_refunded', 'disputed')).toBe(true);
    });

    it('should allow transition from disputed to released', () => {
      expect(canTransition('disputed', 'released')).toBe(true);
    });

    it('should allow transition from disputed to partially_refunded', () => {
      expect(canTransition('disputed', 'partially_refunded')).toBe(true);
    });

    it('should allow transition from disputed to closed', () => {
      expect(canTransition('disputed', 'closed')).toBe(true);
    });

    it('should not allow transitions from completed', () => {
      expect(canTransition('completed', 'any')).toBe(false);
    });

    it('should not allow transitions from closed', () => {
      expect(canTransition('closed', 'any')).toBe(false);
    });
  });

  describe('canDoAction', () => {
    it('should allow confirm_deposit action from draft', () => {
      expect(canDoAction('draft', 'confirm_deposit')).toBe(true);
    });

    it('should allow cancel action from draft', () => {
      expect(canDoAction('draft', 'cancel')).toBe(true);
    });

    it('should allow ship action from deposit_locked', () => {
      expect(canDoAction('deposit_locked', 'ship')).toBe(true);
    });

    it('should allow deliver action from shipped', () => {
      expect(canDoAction('shipped', 'deliver')).toBe(true);
    });

    it('should allow confirm_release action from buyer_inspecting', () => {
      expect(canDoAction('buyer_inspecting', 'confirm_release')).toBe(true);
    });

    it('should not allow random action', () => {
      expect(canDoAction('draft', 'random_action')).toBe(false);
    });

    it('should not allow ship action from draft', () => {
      expect(canDoAction('draft', 'ship')).toBe(false);
    });
  });

  describe('getTargetState', () => {
    it('should return correct target state for confirm_deposit', () => {
      expect(getTargetState('confirm_deposit')).toBe('deposit_locked');
    });

    it('should return correct target state for cancel', () => {
      expect(getTargetState('cancel')).toBe('closed');
    });

    it('should return correct target state for ship', () => {
      expect(getTargetState('ship')).toBe('shipped');
    });

    it('should return correct target state for deliver', () => {
      expect(getTargetState('deliver')).toBe('buyer_inspecting');
    });

    it('should return correct target state for confirm_release', () => {
      expect(getTargetState('confirm_release')).toBe('released');
    });

    it('should return undefined for invalid action', () => {
      expect(getTargetState('invalid_action')).toBeUndefined();
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid action', () => {
      expect(() => {
        validateTransition('draft', null, 'confirm_deposit');
      }).not.toThrow();
    });

    it('should throw for invalid action', () => {
      expect(() => {
        validateTransition('draft', null, 'ship');
      }).toThrow(StateMachineError);
    });

    it('should return target state for valid action', () => {
      const result = validateTransition('draft', null, 'confirm_deposit');
      expect(result.canTransition).toBe(true);
      expect(result.targetState).toBe('deposit_locked');
    });

    it('should not throw for valid state transition', () => {
      expect(() => {
        validateTransition('draft', 'deposit_locked');
      }).not.toThrow();
    });

    it('should throw for invalid state transition', () => {
      expect(() => {
        validateTransition('draft', 'shipped');
      }).toThrow(StateMachineError);
    });

    it('should throw when action target state mismatch', () => {
      expect(() => {
        validateTransition('draft', 'shipped', 'confirm_deposit');
      }).toThrow(StateMachineError);
    });
  });

  describe('getAvailableActions', () => {
    it('should return correct actions for draft state', () => {
      const actions = getAvailableActions('draft');
      expect(actions.length).toBe(2);
      expect(actions.some(a => a.action === 'confirm_deposit')).toBe(true);
      expect(actions.some(a => a.action === 'cancel')).toBe(true);
    });

    it('should return correct actions for deposit_locked state', () => {
      const actions = getAvailableActions('deposit_locked');
      expect(actions.length).toBe(2);
      expect(actions.some(a => a.action === 'ship')).toBe(true);
      expect(actions.some(a => a.action === 'cancel')).toBe(true);
    });

    it('should return correct actions for buyer_inspecting state', () => {
      const actions = getAvailableActions('buyer_inspecting');
      expect(actions.length).toBe(3);
      expect(actions.some(a => a.action === 'confirm_release')).toBe(true);
      expect(actions.some(a => a.action === 'request_partial_refund')).toBe(true);
      expect(actions.some(a => a.action === 'raise_dispute')).toBe(true);
    });

    it('should return empty array for completed state', () => {
      const actions = getAvailableActions('completed');
      expect(actions).toEqual([]);
    });

    it('should return empty array for closed state', () => {
      const actions = getAvailableActions('closed');
      expect(actions).toEqual([]);
    });

    it('should return empty array for invalid state', () => {
      const actions = getAvailableActions('invalid_state');
      expect(actions).toEqual([]);
    });
  });

  describe('getStateLabel', () => {
    it('should return Chinese label for valid state', () => {
      expect(getStateLabel('draft')).toBe('草稿');
      expect(getStateLabel('deposit_locked')).toBe('已锁定订金');
      expect(getStateLabel('shipped')).toBe('已发货');
      expect(getStateLabel('buyer_inspecting')).toBe('买家验货中');
      expect(getStateLabel('released')).toBe('确认放款');
      expect(getStateLabel('partially_refunded')).toBe('部分退款');
      expect(getStateLabel('disputed')).toBe('争议中');
      expect(getStateLabel('completed')).toBe('已完成');
      expect(getStateLabel('closed')).toBe('已关闭');
    });

    it('should return original state for invalid state', () => {
      expect(getStateLabel('invalid_state')).toBe('invalid_state');
    });
  });
});
