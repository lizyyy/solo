import { EventCard, LogEntry } from '../types';

export class EventSystem {
  private eventCards: EventCard[];
  private activeEvents: EventCard[];
  private logs: LogEntry[];
  private currentTurn: number;

  constructor(eventCards: EventCard[]) {
    this.eventCards = this.cloneEventCards(eventCards);
    this.activeEvents = [];
    this.logs = [];
    this.currentTurn = 1;
  }

  private cloneEventCards(events: EventCard[]): EventCard[] {
    return events.map(event => ({
      ...event,
      isActive: false,
      turnsRemaining: 0
    }));
  }

  setCurrentTurn(turn: number): void {
    this.currentTurn = turn;
  }

  getActiveEvents(): EventCard[] {
    return [...this.activeEvents];
  }

  getEventCards(): EventCard[] {
    return this.cloneEventCards(this.eventCards);
  }

  triggerEventsForTurn(turn: number): EventCard[] {
    const triggeredEvents: EventCard[] = [];

    for (const event of this.eventCards) {
      if (event.triggerTurns.includes(turn) && !event.isActive) {
        const activatedEvent = this.activateEvent(event);
        triggeredEvents.push(activatedEvent);
      }
    }

    return triggeredEvents;
  }

  private activateEvent(event: EventCard): EventCard {
    const activatedEvent: EventCard = {
      ...event,
      isActive: true,
      turnsRemaining: event.duration
    };

    const existingIndex = this.eventCards.findIndex(e => e.id === event.id);
    if (existingIndex !== -1) {
      this.eventCards[existingIndex] = activatedEvent;
    }

    this.activeEvents.push(activatedEvent);

    const logEntry: LogEntry = {
      turn: this.currentTurn,
      timestamp: Date.now(),
      type: event.type === 'negative' ? 'warning' : 'info',
      message: `事件触发: ${event.name}`,
      details: event.description
    };
    this.logs.push(logEntry);

    return activatedEvent;
  }

  updateActiveEvents(): { ended: EventCard[]; continued: EventCard[] } {
    const endedEvents: EventCard[] = [];
    const continuedEvents: EventCard[] = [];

    this.activeEvents = this.activeEvents.filter(event => {
      event.turnsRemaining--;

      if (event.turnsRemaining <= 0) {
        event.isActive = false;
        endedEvents.push(event);

        const logEntry: LogEntry = {
          turn: this.currentTurn,
          timestamp: Date.now(),
          type: 'info',
          message: `事件结束: ${event.name}`,
          details: event.description
        };
        this.logs.push(logEntry);

        const cardIndex = this.eventCards.findIndex(e => e.id === event.id);
        if (cardIndex !== -1) {
          this.eventCards[cardIndex] = { ...event };
        }

        return false;
      } else {
        continuedEvents.push(event);

        const cardIndex = this.eventCards.findIndex(e => e.id === event.id);
        if (cardIndex !== -1) {
          this.eventCards[cardIndex] = { ...event };
        }

        return true;
      }
    });

    return { ended: endedEvents, continued: continuedEvents };
  }

  isPowerOutageActive(): boolean {
    return this.activeEvents.some(event => event.id === 'power_outage');
  }

  getPowerOutageTurnsRemaining(): number {
    const powerEvent = this.activeEvents.find(event => event.id === 'power_outage');
    return powerEvent ? powerEvent.turnsRemaining : 0;
  }

  hasEventOfType(eventType: string): boolean {
    return this.activeEvents.some(event => event.id === eventType);
  }

  getEventById(eventId: string): EventCard | null {
    return (
      this.activeEvents.find(e => e.id === eventId) ||
      this.eventCards.find(e => e.id === eventId) ||
      null
    );
  }

  triggerRandomEvent(turn: number): EventCard | null {
    const availableEvents = this.eventCards.filter(
      event => !event.isActive && !event.triggerTurns.includes(turn)
    );

    if (availableEvents.length === 0) {
      return null;
    }

    if (Math.random() > 0.3) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableEvents.length);
    const randomEvent = availableEvents[randomIndex];

    return this.activateEvent(randomEvent);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  reset(): void {
    this.activeEvents = [];
    this.logs = [];
    this.currentTurn = 1;
    this.eventCards = this.cloneEventCards(this.eventCards);
  }
}
