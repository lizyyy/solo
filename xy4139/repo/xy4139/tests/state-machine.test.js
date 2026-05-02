const { RequestStateMachine, StateMachineError, TRANSITIONS, STATES } = require('../src/state-machine/RequestStateMachine');

describe('State Machine Tests', () => {
  let stateMachine;
  
  beforeEach(() => {
    stateMachine = new RequestStateMachine();
  });
  
  test('should be singleton', () => {
    const machine1 = RequestStateMachine.getInstance();
    const machine2 = RequestStateMachine.getInstance();
    expect(machine1).toBe(machine2);
  });
  
  test('should have correct initial state', () => {
    expect(stateMachine.initialState).toBe(STATES.DRAFT);
  });
  
  test('should get allowed transitions correctly', () => {
    const draftTransitions = stateMachine.getAllowedTransitions(STATES.DRAFT);
    expect(draftTransitions).toContain(STATES.PENDING);
    expect(draftTransitions).not.toContain(STATES.APPROVED);
    
    const pendingTransitions = stateMachine.getAllowedTransitions(STATES.PENDING);
    expect(pendingTransitions).toContain(STATES.APPROVED);
    expect(pendingTransitions).toContain(STATES.REJECTED);
    expect(pendingTransitions).not.toContain(STATES.EXECUTED);
    
    const approvedTransitions = stateMachine.getAllowedTransitions(STATES.APPROVED);
    expect(approvedTransitions).toContain(STATES.EXECUTED);
    expect(approvedTransitions).not.toContain(STATES.PENDING);
  });
  
  test('should check can transition correctly', () => {
    expect(stateMachine.canTransition(STATES.DRAFT, STATES.PENDING)).toBe(true);
    expect(stateMachine.canTransition(STATES.DRAFT, STATES.APPROVED)).toBe(false);
    expect(stateMachine.canTransition(STATES.PENDING, STATES.APPROVED)).toBe(true);
    expect(stateMachine.canTransition(STATES.APPROVED, STATES.EXECUTED)).toBe(true);
    expect(stateMachine.canTransition(STATES.EXECUTED, STATES.RETURNED)).toBe(true);
    expect(stateMachine.canTransition(STATES.EXECUTED, STATES.DISCARDED)).toBe(true);
  });
  
  test('should validate transition correctly', () => {
    expect(() => {
      stateMachine.validateTransition(STATES.DRAFT, STATES.PENDING);
    }).not.toThrow();
    
    expect(() => {
      stateMachine.validateTransition(STATES.DRAFT, STATES.APPROVED);
    }).toThrow(StateMachineError);
  });
  
  test('should perform transition correctly', () => {
    const request = { status: STATES.DRAFT };
    
    const result = stateMachine.transition(request, STATES.PENDING);
    expect(result.status).toBe(STATES.PENDING);
    expect(result.status_history).toBeDefined();
    expect(result.status_history.length).toBe(2);
    expect(result.status_history[0].from).toBe(null);
    expect(result.status_history[0].to).toBe(STATES.DRAFT);
    expect(result.status_history[1].from).toBe(STATES.DRAFT);
    expect(result.status_history[1].to).toBe(STATES.PENDING);
  });
  
  test('should throw error when transition is invalid', () => {
    const request = { status: STATES.DRAFT };
    
    expect(() => {
      stateMachine.transition(request, STATES.APPROVED);
    }).toThrow(StateMachineError);
  });
  
  test('should get status text correctly', () => {
    expect(stateMachine.getStatusText(STATES.DRAFT)).toBe('草稿');
    expect(stateMachine.getStatusText(STATES.PENDING)).toBe('待审批');
    expect(stateMachine.getStatusText(STATES.APPROVED)).toBe('已批准');
    expect(stateMachine.getStatusText(STATES.REJECTED)).toBe('已驳回');
    expect(stateMachine.getStatusText(STATES.EXECUTED)).toBe('已领出');
    expect(stateMachine.getStatusText(STATES.RETURNED)).toBe('已归还');
    expect(stateMachine.getStatusText(STATES.DISCARDED)).toBe('已报废');
  });
  
  test('should check if state is terminal correctly', () => {
    expect(stateMachine.isTerminalState(STATES.DRAFT)).toBe(false);
    expect(stateMachine.isTerminalState(STATES.PENDING)).toBe(false);
    expect(stateMachine.isTerminalState(STATES.APPROVED)).toBe(false);
    expect(stateMachine.isTerminalState(STATES.REJECTED)).toBe(true);
    expect(stateMachine.isTerminalState(STATES.EXECUTED)).toBe(false);
    expect(stateMachine.isTerminalState(STATES.RETURNED)).toBe(true);
    expect(stateMachine.isTerminalState(STATES.DISCARDED)).toBe(true);
  });
  
  test('should check if state is modifiable correctly', () => {
    expect(stateMachine.canModify(STATES.DRAFT)).toBe(true);
    expect(stateMachine.canModify(STATES.PENDING)).toBe(false);
    expect(stateMachine.canModify(STATES.APPROVED)).toBe(false);
    expect(stateMachine.canModify(STATES.RETURNED)).toBe(false);
  });
  
  test('should check if state is cancellable correctly', () => {
    expect(stateMachine.canCancel(STATES.DRAFT)).toBe(true);
    expect(stateMachine.canCancel(STATES.PENDING)).toBe(true);
    expect(stateMachine.canCancel(STATES.APPROVED)).toBe(false);
    expect(stateMachine.canCancel(STATES.EXECUTED)).toBe(false);
  });
  
  test('should get all states correctly', () => {
    const allStates = stateMachine.getAllStates();
    expect(allStates).toContain(STATES.DRAFT);
    expect(allStates).toContain(STATES.PENDING);
    expect(allStates).toContain(STATES.APPROVED);
    expect(allStates).toContain(STATES.REJECTED);
    expect(allStates).toContain(STATES.EXECUTED);
    expect(allStates).toContain(STATES.RETURNED);
    expect(allStates).toContain(STATES.DISCARDED);
  });
  
  test('should get all transitions correctly', () => {
    const allTransitions = stateMachine.getAllTransitions();
    expect(allTransitions).toContainEqual({ from: STATES.DRAFT, to: STATES.PENDING });
    expect(allTransitions).toContainEqual({ from: STATES.PENDING, to: STATES.APPROVED });
    expect(allTransitions).toContainEqual({ from: STATES.PENDING, to: STATES.REJECTED });
    expect(allTransitions).toContainEqual({ from: STATES.APPROVED, to: STATES.EXECUTED });
    expect(allTransitions).toContainEqual({ from: STATES.EXECUTED, to: STATES.RETURNED });
    expect(allTransitions).toContainEqual({ from: STATES.EXECUTED, to: STATES.DISCARDED });
  });
  
  test('should handle status history correctly', () => {
    const request = { status: STATES.DRAFT };
    
    stateMachine.transition(request, STATES.PENDING);
    expect(request.status_history.length).toBe(2);
    expect(request.status_history[1].timestamp).toBeDefined();
    
    stateMachine.transition(request, STATES.APPROVED);
    expect(request.status_history.length).toBe(3);
    expect(request.status_history[2].from).toBe(STATES.PENDING);
    expect(request.status_history[2].to).toBe(STATES.APPROVED);
  });
  
  test('should export constants correctly', () => {
    expect(STATES.DRAFT).toBe('draft');
    expect(STATES.PENDING).toBe('pending');
    expect(STATES.APPROVED).toBe('approved');
    expect(STATES.REJECTED).toBe('rejected');
    expect(STATES.EXECUTED).toBe('executed');
    expect(STATES.RETURNED).toBe('returned');
    expect(STATES.DISCARDED).toBe('discarded');
    
    expect(TRANSITIONS).toBeDefined();
    expect(TRANSITIONS[STATES.DRAFT]).toContain(STATES.PENDING);
  });
});
