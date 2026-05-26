const EventType = {
    LIGHT: 'light',
    PROP: 'prop',
    ACTOR: 'actor'
};

const ConflictType = {
    PROP_BLOCKS_ENTRANCE: 'prop_blocks_entrance',
    LIGHT_ORDER: 'light_order',
    SCENECHANGE_TIMEOUT: 'scenechange_timeout',
    OVERLAP: 'overlap',
    MISSING_EVENT: 'missing_event'
};

const GamePhase = {
    PLANNING: 'planning',
    PLAYING: 'playing',
    PAUSED: 'paused',
    FINISHED: 'finished'
};

class GameEvent {
    constructor(id, type, name, duration, config = {}) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.duration = duration;
        this.startTime = null;
        this.track = null;
        this.config = config;
        this.placed = false;
        this.order = config.order || null;
        this.blockEntrance = config.blockEntrance || false;
        this.entranceId = config.entranceId || null;
        this.lightGroupId = config.lightGroupId || null;
        this.color = config.color || this.getDefaultColor();
    }

    getDefaultColor() {
        switch (this.type) {
            case EventType.LIGHT:
                return '#ffd369';
            case EventType.PROP:
                return '#4ecdc4';
            case EventType.ACTOR:
                return '#a8e6cf';
            default:
                return '#888';
        }
    }

    get endTime() {
        return this.startTime !== null ? this.startTime + this.duration : null;
    }

    clone() {
        const evt = new GameEvent(this.id, this.type, this.name, this.duration, {...this.config});
        evt.startTime = this.startTime;
        evt.track = this.track;
        evt.placed = this.placed;
        evt.color = this.color;
        return evt;
    }
}

class Track {
    constructor(id, name, type, config = {}) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.config = config;
        this.events = [];
    }

    addEvent(event) {
        event.track = this.id;
        this.events.push(event);
    }

    removeEvent(eventId) {
        const idx = this.events.findIndex(e => e.id === eventId);
        if (idx !== -1) {
            const evt = this.events[idx];
            evt.track = null;
            evt.startTime = null;
            evt.placed = false;
            this.events.splice(idx, 1);
            return evt;
        }
        return null;
    }

    clone() {
        const track = new Track(this.id, this.name, this.type, {...this.config});
        track.events = this.events.map(e => e.clone());
        return track;
    }
}

class SceneChange {
    constructor(fromScene, toScene, startTime, maxDuration) {
        this.fromScene = fromScene;
        this.toScene = toScene;
        this.startTime = startTime;
        this.maxDuration = maxDuration;
        this.actualDuration = 0;
    }
}

class Scene {
    constructor(id, name, startTime, endTime) {
        this.id = id;
        this.name = name;
        this.startTime = startTime;
        this.endTime = endTime;
        this.color = this.getRandomColor();
    }

    getRandomColor() {
        const colors = ['#e94560', '#533483', '#16213e', '#0f3460', '#1a1a2e'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

class Conflict {
    constructor(type, message, severity = 'error', details = {}) {
        this.type = type;
        this.message = message;
        this.severity = severity;
        this.details = details;
        this.time = details.time || 0;
        this.eventIds = details.eventIds || [];
    }
}

class ScheduledEvent {
    constructor(event, time, isEnd = false) {
        this.event = event;
        this.time = time;
        this.isEnd = isEnd;
        this.executed = false;
    }
}

class GameResult {
    constructor() {
        this.success = false;
        this.score = 0;
        this.maxScore = 0;
        this.conflicts = [];
        this.failReason = null;
        this.eventResults = [];
        this.totalTime = 0;
        this.sceneChanges = [];
        this.timestamp = Date.now();
    }
}

class GameState {
    constructor() {
        this.phase = GamePhase.PLANNING;
        this.currentLevel = null;
        this.tracks = [];
        this.eventPool = [];
        this.scenes = [];
        this.sceneChanges = [];
        this.conflicts = [];
        this.score = 0;
        this.playTime = 0;
        this.maxTime = 0;
        this.selectedHistoryId = null;
        this.lastResult = null;
        this.playbackSpeed = 1;
    }

    reset() {
        this.phase = GamePhase.PLANNING;
        this.tracks = [];
        this.eventPool = [];
        this.scenes = [];
        this.sceneChanges = [];
        this.conflicts = [];
        this.score = 0;
        this.playTime = 0;
        this.lastResult = null;
    }

    clone() {
        const state = new GameState();
        state.phase = this.phase;
        state.currentLevel = this.currentLevel;
        state.tracks = this.tracks.map(t => t.clone());
        state.eventPool = this.eventPool.map(e => e.clone());
        state.scenes = [...this.scenes];
        state.sceneChanges = [...this.sceneChanges];
        state.conflicts = [...this.conflicts];
        state.score = this.score;
        state.playTime = this.playTime;
        state.maxTime = this.maxTime;
        return state;
    }
}

class HistoryRecord {
    constructor(levelId, levelName, schedule, result) {
        this.id = 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.levelId = levelId;
        this.levelName = levelName;
        this.schedule = schedule;
        this.result = result;
        this.timestamp = Date.now();
    }

    getDisplayTime() {
        const d = new Date(this.timestamp);
        return d.toLocaleString('zh-CN');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EventType,
        ConflictType,
        GamePhase,
        GameEvent,
        Track,
        SceneChange,
        Scene,
        Conflict,
        ScheduledEvent,
        GameResult,
        GameState,
        HistoryRecord
    };
}
