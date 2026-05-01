const Input = {
    KEY_CODES: {
        LEFT: 37,
        DOWN: 40,
        UP: 38,
        RIGHT: 39,
        ESC: 27
    },

    KEY_NAMES: {
        37: 'left',
        40: 'down',
        38: 'up',
        39: 'right',
        27: 'esc'
    },

    keyStates: {},
    keyPressTime: {},
    keyCallbacks: {},
    debounceTime: 100,

    init: function() {
        this.keyStates = {};
        this.keyPressTime = {};
        this.keyCallbacks = {};
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    },

    handleKeyDown: function(event) {
        const keyCode = event.keyCode;
        const keyName = this.KEY_NAMES[keyCode];

        if (!keyName) return;

        event.preventDefault();

        const now = performance.now();
        const lastPressTime = this.keyPressTime[keyCode] || 0;

        if (now - lastPressTime < this.debounceTime) {
            return;
        }

        if (!this.keyStates[keyCode]) {
            this.keyStates[keyCode] = true;
            this.keyPressTime[keyCode] = now;
            this.triggerCallbacks(keyName, 'down', now);
        }
    },

    handleKeyUp: function(event) {
        const keyCode = event.keyCode;
        const keyName = this.KEY_NAMES[keyCode];

        if (!keyName) return;

        event.preventDefault();

        this.keyStates[keyCode] = false;
        const now = performance.now();
        this.triggerCallbacks(keyName, 'up', now);
    },

    isKeyDown: function(keyName) {
        const keyCode = this.getKeyCodeFromName(keyName);
        return this.keyStates[keyCode] === true;
    },

    getKeyCodeFromName: function(keyName) {
        const keyCodes = Object.entries(this.KEY_NAMES);
        const entry = keyCodes.find(([code, name]) => name === keyName);
        return entry ? parseInt(entry[0]) : null;
    },

    registerCallback: function(keyName, eventType, callback) {
        if (!this.keyCallbacks[keyName]) {
            this.keyCallbacks[keyName] = {
                down: [],
                up: []
            };
        }

        if (eventType === 'down' || eventType === 'up') {
            this.keyCallbacks[keyName][eventType].push(callback);
        }
    },

    unregisterCallback: function(keyName, eventType, callback) {
        if (!this.keyCallbacks[keyName]) return;
        if (!this.keyCallbacks[keyName][eventType]) return;

        const callbacks = this.keyCallbacks[keyName][eventType];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    },

    triggerCallbacks: function(keyName, eventType, time) {
        if (!this.keyCallbacks[keyName]) return;
        if (!this.keyCallbacks[keyName][eventType]) return;

        const callbacks = this.keyCallbacks[keyName][eventType];
        for (const callback of callbacks) {
            try {
                callback(keyName, time);
            } catch (e) {
                console.error('Callback error:', e);
            }
        }
    },

    clearAllCallbacks: function() {
        this.keyCallbacks = {};
    },

    setDebounceTime: function(time) {
        this.debounceTime = Math.max(0, time);
    },

    getDirectionKeys: function() {
        return ['left', 'down', 'up', 'right'];
    },

    isDirectionKey: function(keyName) {
        return this.getDirectionKeys().includes(keyName);
    },

    reset: function() {
        this.keyStates = {};
        this.keyPressTime = {};
    }
};

Input.init();
