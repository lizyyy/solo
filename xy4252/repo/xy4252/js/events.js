class EventManager {
    constructor(gameMap, levelConfig) {
        this.gameMap = gameMap;
        this.levelConfig = levelConfig;
        this.events = [];
        this.activeEvents = [];
        this.triggeredEvents = [];
        
        this._initialize();
    }

    _initialize() {
        const eventConfig = this.levelConfig.events;
        if (!eventConfig || !eventConfig.enabled) {
            return;
        }
        
        this._generateRandomEvents(eventConfig);
    }

    _generateRandomEvents(config) {
        const eventTypes = CONFIG.EVENTS;
        const eventTypeKeys = Object.keys(eventTypes);
        const maxEvents = config.maxEvents || 3;
        const eventChance = config.eventChance || 0.3;
        
        this.events = [];
        
        for (let i = 0; i < maxEvents; i++) {
            if (Math.random() < eventChance) {
                const eventTypeKey = Utils.randomChoice(eventTypeKeys);
                const eventType = eventTypes[eventTypeKey];
                
                const position = this._getRandomEventPosition(eventType);
                
                if (position) {
                    const event = {
                        id: Utils.generateId(),
                        type: eventType.type,
                        name: eventType.name,
                        icon: eventType.icon,
                        delay: eventType.delay || 0,
                        probability: eventType.probability,
                        color: eventType.color,
                        x: position.x,
                        y: position.y,
                        triggered: false,
                        handled: false,
                        triggerTime: null,
                        description: this._getEventDescription(eventType.type)
                    };
                    
                    this.events.push(event);
                }
            }
        }
    }

    _getRandomEventPosition(eventType) {
        const map = this.gameMap;
        const width = map.width;
        const height = map.height;
        
        const aedLocations = map.getAllAEDLocations();
        const patient = map.getPatientPosition();
        const resources = this.levelConfig.resources;
        
        const keyPoints = [];
        
        aedLocations.forEach(aed => {
            keyPoints.push({ x: aed.x, y: aed.y, type: 'aed' });
        });
        
        keyPoints.push({ x: patient.x, y: patient.y, type: 'patient' });
        
        if (resources.volunteerStart) {
            keyPoints.push({ ...resources.volunteerStart, type: 'volunteer_start' });
        }
        
        if (resources.ambulanceStart) {
            keyPoints.push({ ...resources.ambulanceStart, type: 'ambulance_start' });
        }
        
        const pathPoints = [];
        for (let i = 0; i < keyPoints.length - 1; i++) {
            const start = keyPoints[i];
            const end = keyPoints[i + 1];
            
            const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
            for (let step = 1; step < steps; step++) {
                const t = step / steps;
                const x = Math.round(Utils.linearInterpolation(start.x, end.x, t));
                const y = Math.round(Utils.linearInterpolation(start.y, end.y, t));
                
                if (map.isWalkable(x, y)) {
                    pathPoints.push({ x, y });
                }
            }
        }
        
        const allCandidates = [...keyPoints, ...pathPoints];
        
        for (let attempt = 0; attempt < 20; attempt++) {
            const candidate = Utils.randomChoice(allCandidates);
            if (candidate && map.isWalkable(candidate.x, candidate.y)) {
                const hasEventHere = this.events.some(e => 
                    e.x === candidate.x && e.y === candidate.y
                );
                if (!hasEventHere) {
                    return candidate;
                }
            }
        }
        
        for (let attempt = 0; attempt < 50; attempt++) {
            const x = Utils.randomInt(0, width - 1);
            const y = Utils.randomInt(0, height - 1);
            
            if (map.isWalkable(x, y)) {
                const hasEventHere = this.events.some(e => e.x === x && e.y === y);
                if (!hasEventHere) {
                    return { x, y };
                }
            }
        }
        
        return null;
    }

    _getEventDescription(eventType) {
        const descriptions = {
            gate: '门禁需要密码验证，延误10秒',
            congestion: '前方道路拥堵，等待20秒',
            battery: 'AED电池电量不足，无法使用',
            false_alarm: '疑似误报，请确认情况'
        };
        return descriptions[eventType] || '未知事件';
    }

    checkPositionForEvent(x, y, resourceType) {
        const event = this.events.find(e => 
            e.x === x && e.y === y && !e.triggered && !e.handled
        );
        
        if (event) {
            return this._triggerEvent(event, resourceType);
        }
        
        return null;
    }

    _triggerEvent(event, resourceType) {
        event.triggered = true;
        event.triggerTime = Date.now();
        this.triggeredEvents.push(event);
        
        if (event.type === 'battery' && resourceType !== 'aed') {
            event.handled = true;
            return null;
        }
        
        this.activeEvents.push(event);
        
        return event;
    }

    handleEvent(eventId) {
        const event = this.activeEvents.find(e => e.id === eventId);
        if (event) {
            event.handled = true;
            this.activeEvents = this.activeEvents.filter(e => e.id !== eventId);
            return event;
        }
        return null;
    }

    getActiveEvents() {
        return [...this.activeEvents];
    }

    getAllEvents() {
        return [...this.events];
    }

    getTriggeredEvents() {
        return [...this.triggeredEvents];
    }

    hasActiveEventOfType(eventType) {
        return this.activeEvents.some(e => e.type === eventType);
    }

    getDelayForEventType(eventType) {
        const event = this.activeEvents.find(e => e.type === eventType);
        return event ? event.delay : 0;
    }

    getEventEffect(event) {
        switch (event.type) {
            case 'gate':
                return {
                    type: 'delay',
                    delay: event.delay,
                    message: `遇到门禁障碍，延误${event.delay}秒`
                };
            case 'congestion':
                return {
                    type: 'delay',
                    delay: event.delay,
                    message: `遇到交通拥堵，延误${event.delay}秒`
                };
            case 'battery':
                return {
                    type: 'disable',
                    message: 'AED电量不足，无法使用！请更换AED'
                };
            case 'false_alarm':
                return {
                    type: 'fail',
                    message: '误报！救援任务失败'
                };
            default:
                return {
                    type: 'none',
                    message: '未知事件'
                };
        }
    }

    reset() {
        this.events.forEach(event => {
            event.triggered = false;
            event.handled = false;
            event.triggerTime = null;
        });
        this.activeEvents = [];
        this.triggeredEvents = [];
        
        const eventConfig = this.levelConfig.events;
        if (eventConfig && eventConfig.enabled) {
            this._generateRandomEvents(eventConfig);
        }
    }

    getState() {
        return {
            events: Utils.deepClone(this.events),
            activeEvents: Utils.deepClone(this.activeEvents),
            triggeredEvents: Utils.deepClone(this.triggeredEvents)
        };
    }

    restoreState(state) {
        this.events = Utils.deepClone(state.events);
        this.activeEvents = Utils.deepClone(state.activeEvents);
        this.triggeredEvents = Utils.deepClone(state.triggeredEvents);
    }
}

window.EventManager = EventManager;