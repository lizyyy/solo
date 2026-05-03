/**
 * 时间轴控制模块
 * 负责管理轨迹回放的时间轴控制，包括播放、暂停、拖动时间等功能
 */

import store from '../state/store.js';

export class Timeline {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            showSpeedControl: options.showSpeedControl !== false,
            showTimeDisplay: options.showTimeDisplay !== false,
            showRiskMarkers: options.showRiskMarkers !== false,
            onTimeChange: options.onTimeChange || null,
            onPlayStateChange: options.onPlayStateChange || null,
            ...options
        };

        this.element = null;
        this.sliderElement = null;
        this.playButton = null;
        this.pauseButton = null;
        this.timeDisplay = null;
        this.speedControl = null;
        this.riskMarkersContainer = null;

        this.isPlaying = false;
        this.animationFrameId = null;
        this.lastUpdateTime = 0;

        this.stateListenerId = null;
    }

    init() {
        this.createElements();
        this.attachEventListeners();
        this.subscribeToStore();
        this.updateFromState();
    }

    createElements() {
        this.element = document.createElement('div');
        this.element.className = 'timeline-container';
        this.element.innerHTML = `
            <div class="timeline-controls">
                <button class="timeline-btn" id="timeline-play" title="播放">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
                <button class="timeline-btn" id="timeline-pause" title="暂停" style="display: none;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                </button>
                <button class="timeline-btn" id="timeline-prev" title="后退一秒">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                    </svg>
                </button>
                <button class="timeline-btn" id="timeline-next" title="前进一秒">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                    </svg>
                </button>
                <button class="timeline-btn" id="timeline-start" title="开始">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 18l8.5-6L4 6v12zm9-12v12h2V6h-2z"/>
                    </svg>
                </button>
                <button class="timeline-btn" id="timeline-end" title="结束">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7zM4 18h2V6H4v12z"/>
                    </svg>
                </button>
            </div>
            
            <div class="timeline-slider-container">
                <div class="timeline-risk-markers" id="timeline-risk-markers"></div>
                <input type="range" class="timeline-slider" id="timeline-slider" min="0" max="100" value="0">
            </div>
            
            <div class="timeline-info">
                <div class="timeline-time" id="timeline-time">--:--:--</div>
                <div class="timeline-duration" id="timeline-duration">00:00:00</div>
            </div>
            
            <div class="timeline-speed-container" id="timeline-speed-container">
                <label for="timeline-speed">速度:</label>
                <select class="timeline-speed" id="timeline-speed">
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1" selected>1x</option>
                    <option value="2">2x</option>
                    <option value="5">5x</option>
                    <option value="10">10x</option>
                </select>
            </div>
        `;

        this.container.appendChild(this.element);

        this.playButton = this.element.querySelector('#timeline-play');
        this.pauseButton = this.element.querySelector('#timeline-pause');
        this.sliderElement = this.element.querySelector('#timeline-slider');
        this.timeDisplay = this.element.querySelector('#timeline-time');
        this.speedControl = this.element.querySelector('#timeline-speed');
        this.riskMarkersContainer = this.element.querySelector('#timeline-risk-markers');

        if (!this.options.showSpeedControl) {
            this.element.querySelector('#timeline-speed-container').style.display = 'none';
        }

        if (!this.options.showTimeDisplay) {
            this.element.querySelector('.timeline-info').style.display = 'none';
        }
    }

    attachEventListeners() {
        this.playButton.addEventListener('click', () => {
            store.play();
        });

        this.pauseButton.addEventListener('click', () => {
            store.pause();
        });

        this.element.querySelector('#timeline-prev').addEventListener('click', () => {
            store.stepBackward(1000);
        });

        this.element.querySelector('#timeline-next').addEventListener('click', () => {
            store.stepForward(1000);
        });

        this.element.querySelector('#timeline-start').addEventListener('click', () => {
            store.seekToStart();
        });

        this.element.querySelector('#timeline-end').addEventListener('click', () => {
            store.seekToEnd();
        });

        this.sliderElement.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            const state = store.getState();
            const duration = state.playback.duration;
            const newTime = state.playback.startTime + (value / 100) * duration;
            store.setCurrentTime(newTime);
        });

        this.sliderElement.addEventListener('mousedown', () => {
            if (this.isPlaying) {
                store.pause();
            }
        });

        this.speedControl.addEventListener('change', (event) => {
            const speed = parseFloat(event.target.value);
            store.setPlaybackSpeed(speed);
        });
    }

    subscribeToStore() {
        this.stateListenerId = store.subscribe((state, changeType) => {
            if (changeType === 'playback' || changeType === 'all') {
                this.updatePlaybackState(state.playback);
            }
            if (changeType === 'risks' || changeType === 'all') {
                this.updateRiskMarkers(state.risks);
            }
            if (changeType === 'trajectoryData' || changeType === 'all') {
                this.updateFromState();
            }
        }, ['playback', 'risks', 'trajectoryData', 'all']);
    }

    updateFromState() {
        const state = store.getState();
        this.updatePlaybackState(state.playback);
        this.updateRiskMarkers(state.risks);
    }

    updatePlaybackState(playback) {
        if (!playback) return;

        const wasPlaying = this.isPlaying;
        this.isPlaying = playback.isPlaying;

        if (wasPlaying !== this.isPlaying) {
            if (this.isPlaying) {
                this.playButton.style.display = 'none';
                this.pauseButton.style.display = 'inline-flex';
                this.startPlaybackLoop();
            } else {
                this.playButton.style.display = 'inline-flex';
                this.pauseButton.style.display = 'none';
                this.stopPlaybackLoop();
            }

            if (this.options.onPlayStateChange) {
                this.options.onPlayStateChange(this.isPlaying);
            }
        }

        if (playback.duration > 0) {
            const progress = ((playback.currentTime - playback.startTime) / playback.duration) * 100;
            this.sliderElement.value = progress;
        }

        if (this.timeDisplay) {
            this.timeDisplay.textContent = this.formatTime(playback.currentTime);
            this.element.querySelector('#timeline-duration').textContent = 
                `时长: ${this.formatDuration(playback.duration)}`;
        }

        this.speedControl.value = playback.speed;
    }

    updateRiskMarkers(risks) {
        if (!this.options.showRiskMarkers) return;

        while (this.riskMarkersContainer.firstChild) {
            this.riskMarkersContainer.removeChild(this.riskMarkersContainer.firstChild);
        }

        if (!risks) return;

        const state = store.getState();
        const startTime = state.playback.startTime;
        const duration = state.playback.duration;

        if (duration <= 0) return;

        const allRisks = [
            ...(risks.collisions || []),
            ...(risks.suddenStops || []),
            ...(risks.restrictedAreaApproaches || []),
            ...(risks.speeding || []),
            ...(risks.nearMisses || [])
        ];

        const addedMarkers = new Set();

        allRisks.forEach(risk => {
            const timeKey = `${risk.id}`;
            if (addedMarkers.has(timeKey)) return;
            addedMarkers.add(timeKey);

            const position = ((risk.timestamp - startTime) / duration) * 100;

            if (position < 0 || position > 100) return;

            const marker = document.createElement('div');
            marker.className = 'timeline-risk-marker';
            marker.title = `${this.getRiskTypeLabel(risk.type)} - ${this.formatTime(risk.timestamp)}`;
            marker.style.left = `${position}%`;
            marker.dataset.riskId = risk.id;

            const severityColors = {
                'high': '#ff4444',
                'medium': '#ffaa00',
                'low': '#44aa44'
            };
            marker.style.backgroundColor = severityColors[risk.severity] || '#888888';

            marker.addEventListener('click', (event) => {
                event.stopPropagation();
                store.setSelectedRisk(risk);
            });

            this.riskMarkersContainer.appendChild(marker);
        });
    }

    startPlaybackLoop() {
        if (this.animationFrameId) return;

        this.lastUpdateTime = performance.now();
        this.playbackLoop();
    }

    stopPlaybackLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    playbackLoop() {
        if (!this.isPlaying) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        const state = store.getState();
        const playback = state.playback;

        if (playback.currentTime >= playback.endTime) {
            store.pause();
            store.setCurrentTime(playback.startTime);
            return;
        }

        const timeIncrement = deltaTime * playback.speed;
        const newTime = Math.min(playback.currentTime + timeIncrement, playback.endTime);
        
        store.setCurrentTime(newTime);

        if (this.options.onTimeChange) {
            this.options.onTimeChange(newTime);
        }

        this.animationFrameId = requestAnimationFrame(() => this.playbackLoop());
    }

    formatTime(timestamp) {
        if (!timestamp || timestamp === 0) return '--:--:--';

        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            return String(timestamp);
        }

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${hours}:${minutes}:${seconds}`;
    }

    formatDuration(ms) {
        if (ms <= 0) return '00:00:00';

        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    getRiskTypeLabel(type) {
        const labels = {
            'collision': '会车风险',
            'collisions': '会车风险',
            'suddenStop': '急停风险',
            'suddenStops': '急停风险',
            'restrictedArea': '禁行区靠近',
            'restrictedAreaApproaches': '禁行区靠近',
            'speeding': '超速风险',
            'nearMiss': '险兆事件',
            'nearMisses': '险兆事件'
        };
        return labels[type] || type;
    }

    dispose() {
        this.stopPlaybackLoop();

        if (this.stateListenerId !== null) {
            store.unsubscribe(this.stateListenerId);
        }

        if (this.element && this.container.contains(this.element)) {
            this.container.removeChild(this.element);
        }

        this.element = null;
        this.sliderElement = null;
        this.playButton = null;
        this.pauseButton = null;
        this.timeDisplay = null;
        this.speedControl = null;
        this.riskMarkersContainer = null;
    }

    setEnabled(enabled) {
        if (this.element) {
            this.element.style.opacity = enabled ? '1' : '0.5';
            this.element.style.pointerEvents = enabled ? 'auto' : 'none';
        }

        if (this.sliderElement) {
            this.sliderElement.disabled = !enabled;
        }

        if (this.speedControl) {
            this.speedControl.disabled = !enabled;
        }
    }

    getCurrentTime() {
        return store.getPlaybackState().currentTime;
    }

    getPlaybackSpeed() {
        return store.getPlaybackState().speed;
    }

    isPlaying() {
        return this.isPlaying;
    }
}

export default Timeline;
