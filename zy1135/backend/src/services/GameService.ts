import {
  GameState,
  Action,
  LogEntry,
  ResourcesDelta,
  EventChoice,
  GameEvent,
  ERROR_CODES,
  GameError,
} from '../types';
import {
  generateId,
  applyResourceDelta,
  addToInventory,
  removeFromInventory,
  hasInventoryItem,
  getInitialInventory,
  checkGameOver,
} from '../utils/helpers';
import {
  INITIAL_RESOURCES,
  MAX_RESOURCES,
  INITIAL_LOCATIONS,
  INITIAL_FACILITIES,
  ACTIONS,
  EVENTS,
} from '../config/gameData';

export class GameService {
  private games: Map<string, GameState> = new Map();

  createGame(name: string): GameState {
    const now = new Date().toISOString();
    const state: GameState = {
      id: generateId(),
      name,
      currentDay: 1,
      actionPoints: 5,
      maxActionPoints: 5,
      resources: { ...INITIAL_RESOURCES },
      maxResources: { ...MAX_RESOURCES },
      inventory: getInitialInventory(),
      facilities: INITIAL_FACILITIES.map((f) => ({ ...f })),
      locations: INITIAL_LOCATIONS.map((l) => ({ ...l })),
      events: EVENTS.map((e) => ({ ...e })),
      logs: [],
      hasFriday: false,
      hasFire: false,
      hasShelter: false,
      rescueAttempts: 0,
      rescueSuccess: false,
      gameOver: false,
      created: now,
      lastUpdated: now,
    };

    state.logs.push(this.createLogEntry(state, 'settlement', '漂流第一天', '你在一片陌生的海滩上醒来，四周是海浪和丛林。你必须想办法生存下去，直到被救走。'));

    this.games.set(state.id, state);
    return state;
  }

  getGame(gameId: string): GameState {
    const game = this.games.get(gameId);
    if (!game) {
      throw new GameError('存档不存在', ERROR_CODES.SAVE_NOT_FOUND);
    }
    return game;
  }

  performAction(gameId: string, actionId: string, locationId?: string): GameState {
    const state = this.getGame(gameId);

    if (state.gameOver) {
      throw new GameError('游戏已结束', ERROR_CODES.GAME_ALREADY_OVER);
    }

    const action = ACTIONS.find((a) => a.id === actionId);
    if (!action) {
      throw new GameError('行动不存在', ERROR_CODES.ACTION_NOT_AVAILABLE);
    }

    if (action.location && locationId && action.location !== locationId) {
      throw new GameError('该行动不可在此地点执行', ERROR_CODES.ACTION_NOT_AVAILABLE);
    }

    if (action.location && !locationId) {
      throw new GameError('请指定执行该行动的地点', ERROR_CODES.INVALID_REQUEST);
    }

    this.validateActionRequirements(state, action);

    if (state.actionPoints < action.actionPoints) {
      throw new GameError(
        `行动点不足，需要${action.actionPoints}点，当前${state.actionPoints}点`,
        ERROR_CODES.INSUFFICIENT_ACTION_POINTS
      );
    }

    if (state.resources.energy < action.energyCost) {
      throw new GameError(
        `体力不足，需要${action.energyCost}点，当前${state.resources.energy}点`,
        ERROR_CODES.INSUFFICIENT_RESOURCES
      );
    }

    this.applyActionEffects(state, action);

    state.actionPoints -= action.actionPoints;
    state.lastUpdated = new Date().toISOString();

    state.logs.push(
      this.createLogEntry(state, 'action', action.name, action.effects.description, action.effects.resources, action.id)
    );

    const gameOverResult = checkGameOver(state);
    if (gameOverResult.gameOver) {
      state.gameOver = true;
      state.gameOverReason = gameOverResult.reason;
      state.logs.push(
        this.createLogEntry(state, 'end', '游戏结束', gameOverResult.reason || '')
      );
    }

    return state;
  }

  endTurn(gameId: string): GameState {
    const state = this.getGame(gameId);

    if (state.gameOver) {
      throw new GameError('游戏已结束', ERROR_CODES.GAME_ALREADY_OVER);
    }

    let dailyResourceChange: ResourcesDelta = {
      food: -5,
      water: -8,
      spirit: -3,
    };

    if (state.hasFriday) {
      dailyResourceChange.food = (dailyResourceChange.food || 0) + 3;
      dailyResourceChange.spirit = (dailyResourceChange.spirit || 0) + 10;
    }

    const garden = state.facilities.find((f) => f.id === 'garden');
    if (garden && garden.built && garden.level > 0) {
      dailyResourceChange.food = (dailyResourceChange.food || 0) + 5 * garden.level;
    }

    if (state.hasFire) {
      dailyResourceChange.spirit = (dailyResourceChange.spirit || 0) + 5;
    }

    if (state.hasShelter) {
      dailyResourceChange.safety = (dailyResourceChange.safety || 0) + 5;
    }

    state.resources = applyResourceDelta(state.resources, dailyResourceChange, state.maxResources);

    const triggeredEvents = this.checkTriggeredEvents(state);

    state.actionPoints = state.maxActionPoints;
    state.currentDay += 1;
    state.lastUpdated = new Date().toISOString();

    const logContent = `第${state.currentDay - 1}天结束。资源变化：${this.formatDailyChange(dailyResourceChange)}`;
    state.logs.push(this.createLogEntry(state, 'settlement', '日结算', logContent, dailyResourceChange));

    if (triggeredEvents.length > 0) {
      triggeredEvents.forEach((event) => {
        state.logs.push(
          this.createLogEntry(
            state,
            'event',
            event.name,
            event.description,
            undefined,
            undefined,
            event.id
          )
        );
      });
    }

    const gameOverResult = checkGameOver(state);
    if (gameOverResult.gameOver) {
      state.gameOver = true;
      state.gameOverReason = gameOverResult.reason;
      state.logs.push(
        this.createLogEntry(state, 'end', '游戏结束', gameOverResult.reason || '')
      );
    }

    return state;
  }

  handleEventChoice(gameId: string, eventId: string, choiceId: string): GameState {
    const state = this.getGame(gameId);

    if (state.gameOver) {
      throw new GameError('游戏已结束', ERROR_CODES.GAME_ALREADY_OVER);
    }

    const event = state.events.find((e) => e.id === eventId);
    if (!event) {
      throw new GameError('事件不存在', ERROR_CODES.EVENT_NOT_FOUND);
    }

    if (!event.triggered) {
      throw new GameError('该事件尚未触发', ERROR_CODES.INVALID_REQUEST);
    }

    const choice = event.choices.find((c) => c.id === choiceId);
    if (!choice) {
      throw new GameError('选项不存在', ERROR_CODES.CHOICE_NOT_FOUND);
    }

    this.validateEventChoiceRequirements(state, choice);

    this.applyEventChoiceEffects(state, choice);

    state.logs.push(
      this.createLogEntry(
        state,
        'event',
        `事件选择: ${choice.text}`,
        choice.effects.outcome,
        choice.effects.resources,
        undefined,
        eventId
      )
    );

    if (event.id === 'friday_14' && choiceId === 'friday_save') {
      state.hasFriday = true;
    }

    if (event.id === 'rescue_21' && choiceId === 'rescue_signal') {
      state.rescueSuccess = true;
    }

    state.lastUpdated = new Date().toISOString();

    const gameOverResult = checkGameOver(state);
    if (gameOverResult.gameOver) {
      state.gameOver = true;
      state.gameOverReason = gameOverResult.reason;
      state.logs.push(
        this.createLogEntry(state, 'end', '游戏结束', gameOverResult.reason || '')
      );
    }

    return state;
  }

  getAvailableActions(state: GameState, locationId?: string): Action[] {
    let actions = ACTIONS.filter((a) => !a.location);

    if (locationId) {
      const location = state.locations.find((l) => l.id === locationId);
      if (location && location.discovered) {
        const locationActions = ACTIONS.filter((a) => a.location === locationId);
        actions = [...actions, ...locationActions];
      }
    }

    return actions;
  }

  checkTriggeredEvents(state: GameState): GameEvent[] {
    const triggered: GameEvent[] = [];

    state.events.forEach((event) => {
      if (event.triggered) return;

      let shouldTrigger = false;

      switch (event.triggerCondition.type) {
        case 'day':
          if (event.triggerCondition.comparator === 'eq') {
            shouldTrigger = state.currentDay === event.triggerCondition.value;
          } else if (event.triggerCondition.comparator === 'gte') {
            shouldTrigger = state.currentDay >= event.triggerCondition.value;
          }
          break;
        case 'resource':
          {
            const resourceKey = event.triggerCondition.value as keyof typeof state.resources;
            if (resourceKey in state.resources) {
              if (event.triggerCondition.comparator === 'lte') {
                shouldTrigger = state.resources[resourceKey] <= (event.triggerCondition.value as number);
              }
            }
          }
          break;
        case 'random':
          shouldTrigger = Math.random() < 0.1;
          break;
      }

      if (shouldTrigger) {
        event.triggered = true;
        event.dayTriggered = state.currentDay;
        triggered.push(event);
      }
    });

    return triggered;
  }

  private validateActionRequirements(state: GameState, action: Action): void {
    if (!action.requirements) return;

    if (action.requirements.resources) {
      for (const [key, value] of Object.entries(action.requirements.resources)) {
        const resourceKey = key as keyof typeof state.resources;
        if (state.resources[resourceKey] < (value as number)) {
          throw new GameError(
            `${resourceKey}不足，需要${value}，当前${state.resources[resourceKey]}`,
            ERROR_CODES.INSUFFICIENT_RESOURCES
          );
        }
      }
    }

    if (action.requirements.inventory) {
      for (const item of action.requirements.inventory) {
        if (!hasInventoryItem(state.inventory, item.itemId, item.quantity)) {
          const inventoryItem = state.inventory.find((i) => i.id === item.itemId);
          throw new GameError(
            `物品${item.itemId}不足，需要${item.quantity}，当前${inventoryItem?.quantity || 0}`,
            ERROR_CODES.INSUFFICIENT_INVENTORY
          );
        }
      }
    }

    if (action.requirements.facility) {
      const facility = state.facilities.find((f) => f.id === action.requirements!.facility!.facilityId);
      if (!facility || facility.level < action.requirements.facility.minLevel) {
        throw new GameError(
          `设施${action.requirements.facility.facilityId}等级不足，需要至少${action.requirements.facility.minLevel}级`,
          ERROR_CODES.FACILITY_REQUIREMENT_NOT_MET
        );
      }
    }

    if (action.requirements.toolDurability !== undefined) {
      if (state.resources.toolDurability < action.requirements.toolDurability) {
        throw new GameError(
          `工具耐久不足，需要${action.requirements.toolDurability}，当前${state.resources.toolDurability}`,
          ERROR_CODES.INSUFFICIENT_TOOL_DURABILITY
        );
      }
    }
  }

  private validateEventChoiceRequirements(state: GameState, choice: EventChoice): void {
    if (!choice.requirements) return;

    if (choice.requirements.resources) {
      for (const [key, value] of Object.entries(choice.requirements.resources)) {
        const resourceKey = key as keyof typeof state.resources;
        if (state.resources[resourceKey] < (value as number)) {
          throw new GameError(
            `${resourceKey}不足，需要${value}，当前${state.resources[resourceKey]}`,
            ERROR_CODES.INSUFFICIENT_RESOURCES
          );
        }
      }
    }

    if (choice.requirements.inventory) {
      for (const item of choice.requirements.inventory) {
        if (!hasInventoryItem(state.inventory, item.itemId, item.quantity)) {
          const inventoryItem = state.inventory.find((i) => i.id === item.itemId);
          throw new GameError(
            `物品${item.itemId}不足，需要${item.quantity}，当前${inventoryItem?.quantity || 0}`,
            ERROR_CODES.INSUFFICIENT_INVENTORY
          );
        }
      }
    }

    if (choice.requirements.facility) {
      const facility = state.facilities.find((f) => f.id === choice.requirements!.facility!.facilityId);
      if (!facility || facility.level < choice.requirements.facility.minLevel) {
        throw new GameError(
          `设施${choice.requirements.facility.facilityId}等级不足，需要至少${choice.requirements.facility.minLevel}级`,
          ERROR_CODES.FACILITY_REQUIREMENT_NOT_MET
        );
      }
    }
  }

  private applyActionEffects(state: GameState, action: Action): void {
    if (action.requirements?.inventory) {
      for (const item of action.requirements.inventory) {
        state.inventory = removeFromInventory(state.inventory, item);
      }
    }

    state.resources = applyResourceDelta(state.resources, action.effects.resources, state.maxResources);

    if (action.effects.inventory) {
      for (const item of action.effects.inventory) {
        state.inventory = addToInventory(state.inventory, item);
      }
    }

    if (action.effects.facilityProgress) {
      const facility = state.facilities.find((f) => f.id === action.effects.facilityProgress!.facilityId);
      if (facility) {
        facility.built = true;
        if (action.effects.facilityProgress.facilityId === 'shelter') {
          state.hasShelter = true;
        }
        if (action.effects.facilityProgress.facilityId === 'fire') {
          state.hasFire = true;
        }
      }
    }

    if (action.effects.locationProgress) {
      const location = state.locations.find((l) => l.id === action.effects.locationProgress!.locationId);
      if (location) {
        location.explorationProgress = Math.min(
          location.explorationProgress + action.effects.locationProgress.progress,
          location.maxProgress
        );
        if (location.explorationProgress >= location.maxProgress) {
          location.explored = true;
        }

        if (location.id === 'forest' && location.explorationProgress >= 50) {
          const cave = state.locations.find((l) => l.id === 'cave');
          if (cave) cave.discovered = true;
        }
        if (location.id === 'forest' && location.explorationProgress >= 75) {
          const stream = state.locations.find((l) => l.id === 'stream');
          if (stream) stream.discovered = true;
        }
        if (location.id === 'forest' && location.explorationProgress >= 30) {
          const cliff = state.locations.find((l) => l.id === 'cliff');
          if (cliff) cliff.discovered = true;
        }
      }
    }
  }

  private applyEventChoiceEffects(state: GameState, choice: EventChoice): void {
    if (choice.requirements?.resources) {
      for (const [key, value] of Object.entries(choice.requirements.resources)) {
        const resourceKey = key as keyof typeof state.resources;
        const delta: ResourcesDelta = {};
        delta[resourceKey] = -(value as number);
        state.resources = applyResourceDelta(state.resources, delta, state.maxResources);
      }
    }

    if (choice.requirements?.inventory) {
      for (const item of choice.requirements.inventory) {
        state.inventory = removeFromInventory(state.inventory, item);
      }
    }

    const effects = { ...choice.effects.resources };
    if ('health' in effects) {
      effects.energy = (effects.energy || 0) + (effects as any).health;
      delete (effects as any).health;
    }
    state.resources = applyResourceDelta(state.resources, effects, state.maxResources);

    if (choice.effects.inventory) {
      for (const item of choice.effects.inventory) {
        state.inventory = addToInventory(state.inventory, item);
      }
    }
  }

  private createLogEntry(
    state: GameState,
    type: LogEntry['type'],
    title: string,
    content: string,
    resourceChanges?: ResourcesDelta,
    actionTaken?: string,
    eventId?: string
  ): LogEntry {
    return {
      id: generateId(),
      day: state.currentDay,
      timestamp: new Date().toISOString(),
      type,
      title,
      content,
      resourceChanges,
      actionTaken,
      eventId,
    };
  }

  private formatDailyChange(delta: ResourcesDelta): string {
    const parts: string[] = [];
    if (delta.food) parts.push(`食物: ${delta.food}`);
    if (delta.water) parts.push(`水: ${delta.water}`);
    if (delta.energy) parts.push(`体力: ${delta.energy}`);
    if (delta.spirit) parts.push(`精神: ${delta.spirit}`);
    if (delta.safety) parts.push(`安全值: ${delta.safety}`);
    return parts.join(', ') || '无变化';
  }
}

export const gameService = new GameService();
