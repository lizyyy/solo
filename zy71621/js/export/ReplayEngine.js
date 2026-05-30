import { Maze } from '../models/Maze.js';
import { GameState } from '../models/GameState.js';
import { SoundWave } from '../physics/SoundWave.js';

export class ReplayEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.currentReplay = null;
        this.currentFrame = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.animationId = null;
        this.fps = 30;
        this.frameInterval = 1000 / this.fps;
        this.lastFrameTime = 0;
        this.listeners = {};
        this.replaySpeed = 1;
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    loadReplay(failureData) {
        if (!failureData || !failureData.history) {
            return { success: false, message: '无效的回放数据' };
        }

        this.currentReplay = {
            id: failureData.id,
            reason: failureData.reason,
            turn: failureData.turn,
            finalState: failureData.finalState,
            maze: failureData.mazeSnapshot || failureData.maze,
            history: failureData.history,
            totalFrames: failureData.history.length
        };

        this.currentFrame = 0;
        this.isPlaying = false;
        this.isPaused = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        this.emit('replayLoaded', this.currentReplay);
        return { success: true, totalFrames: this.currentReplay.totalFrames };
    }

    play() {
        if (!this.currentReplay) {
            return { success: false, message: '没有加载回放数据' };
        }

        if (this.isPlaying && !this.isPaused) {
            return { success: true, message: '已经在播放中' };
        }

        this.isPlaying = true;
        this.isPaused = false;
        this.lastFrameTime = performance.now();
        this.animationLoop();
        this.emit('playbackStarted');
        return { success: true };
    }

    pause() {
        this.isPaused = true;
        this.emit('paused');
        return { success: true };
    }

    resume() {
        if (!this.isPlaying) {
            return this.play();
        }
        this.isPaused = false;
        this.lastFrameTime = performance.now();
        this.emit('resumed');
        return { success: true };
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.emit('stopped');
        return { success: true };
    }

    reset() {
        this.stop();
        this.currentFrame = 0;
        this.renderFrame(this.currentFrame);
        this.emit('reset');
        return { success: true };
    }

    seekToFrame(frameNumber) {
        if (!this.currentReplay) return false;
        this.currentFrame = Math.max(0, Math.min(frameNumber, this.currentReplay.totalFrames - 1));
        this.renderFrame(this.currentFrame);
        this.emit('seek', { frame: this.currentFrame });
        return true;
    }

    seekToTurn(turnNumber) {
        if (!this.currentReplay) return false;
        const frameIndex = this.currentReplay.history.findIndex(h => h.turn === turnNumber);
        if (frameIndex >= 0) {
            return this.seekToFrame(frameIndex);
        }
        return false;
    }

    animationLoop(currentTime = 0) {
        if (!this.isPlaying || this.isPaused) return;

        this.animationId = requestAnimationFrame((t) => this.animationLoop(t));

        const elapsed = currentTime - this.lastFrameTime;
        const interval = this.frameInterval / this.replaySpeed;

        if (elapsed >= interval) {
            this.lastFrameTime = currentTime - (elapsed % interval);
            
            if (this.currentFrame < this.currentReplay.totalFrames - 1) {
                this.currentFrame++;
                this.renderFrame(this.currentFrame);
                this.emit('frameUpdated', { 
                    frame: this.currentFrame, 
                    total: this.currentReplay.totalFrames 
                });
            } else {
                this.stop();
                this.emit('replayComplete');
            }
        }
    }

    renderFrame(frameIndex) {
        if (!this.ctx || !this.canvas || !this.currentReplay) return;

        const action = this.currentReplay.history[frameIndex];
        if (!action) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        this.drawGrid(ctx, width, height);
        this.drawWalls(ctx, this.currentReplay.maze.walls);
        this.drawCharacters(ctx, action, frameIndex);
        this.drawWavePath(ctx, action);
        this.drawReflections(ctx, action);
        this.drawFrameInfo(ctx, action, frameIndex);
    }

    drawGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.1)';
        ctx.lineWidth = 1;

        const gridSize = 30;
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    drawWalls(ctx, walls) {
        for (const wall of walls) {
            const colors = {
                hard: '#64748b',
                soft: '#84cc16',
                absorbent: '#f97316'
            };

            ctx.strokeStyle = colors[wall.material] || '#64748b';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.stroke();
        }
    }

    drawCharacters(ctx, action, frameIndex) {
        if (action.type === 'move' && action.parameters) {
            const progress = this.currentFrame % 1;
            
            const fromX = action.parameters.fromX;
            const fromY = action.parameters.fromY;
            const toX = action.parameters.toX;
            const toY = action.parameters.toY;

            const currentX = fromX + (toX - fromX) * progress;
            const currentY = fromY + (toY - fromY) * progress;

            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(currentX, currentY, 12, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('救', currentX, currentY);
        } else if (action.type === 'sound_pulse' && action.waveData) {
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(action.waveData.startX, action.waveData.startY, 12, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('救', action.waveData.startX, action.waveData.startY);
        }

        if (this.currentReplay.maze.characters) {
            for (const char of this.currentReplay.maze.characters) {
                if (char.type === 'teammate') {
                    const color = char.status === 'trapped' ? '#ef4444' : 
                                  char.status === 'rescued' ? '#22c55e' : '#6b7280';
                    
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(char.x, char.y, 10, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('队', char.x, char.y);
                }
            }
        }
    }

    drawWavePath(ctx, action) {
        if (action.type !== 'sound_pulse' || !action.waveData || !action.waveData.path) return;

        const path = action.waveData.path;
        if (path.length < 2) return;

        const maxFrames = 30;
        const frameProgress = (this.currentFrame % 1) * maxFrames;
        const pointsToDraw = Math.min(Math.floor(frameProgress) + 2, path.length);

        for (let i = 1; i < pointsToDraw; i++) {
            const p1 = path[i - 1];
            const p2 = path[i];
            
            const alpha = 1 - (i / path.length) * 0.5;
            ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            
            if (i === pointsToDraw - 1 && frameProgress < maxFrames) {
                const progress = frameProgress - Math.floor(frameProgress);
                const midX = p1.x + (p2.x - p1.x) * progress;
                const midY = p1.y + (p2.y - p1.y) * progress;
                ctx.lineTo(midX, midY);
            } else {
                ctx.lineTo(p2.x, p2.y);
            }
            ctx.stroke();
        }

        if (pointsToDraw > 0) {
            const lastPoint = path[Math.min(pointsToDraw - 1, path.length - 1)];
            const gradient = ctx.createRadialGradient(
                lastPoint.x, lastPoint.y, 0,
                lastPoint.x, lastPoint.y, 15
            );
            gradient.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
            gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 15, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawReflections(ctx, action) {
        if (action.type !== 'sound_pulse' || !action.echoes) return;

        for (const echo of action.echoes) {
            if (!echo.point) continue;

            ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            
            if (action.waveData) {
                ctx.beginPath();
                ctx.moveTo(action.waveData.startX, action.waveData.startY);
                ctx.lineTo(echo.point.x, echo.point.y);
                ctx.stroke();
            }
            
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.beginPath();
            ctx.arc(echo.point.x, echo.point.y, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(echo.point.x, echo.point.y, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawFrameInfo(ctx, action, frameIndex) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 80);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        ctx.fillText(`回合: ${action.turn}`, 20, 20);
        ctx.fillText(`操作: ${this.getActionLabel(action.type)}`, 20, 40);
        ctx.fillText(`帧: ${frameIndex + 1} / ${this.currentReplay.totalFrames}`, 20, 60);

        if (this.currentReplay.reason) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(`失败原因: ${this.currentReplay.reason}`, 20, 90);
        }
    }

    getActionLabel(type) {
        const labels = {
            move: '移动',
            sound_pulse: '发射声波',
            rescue: '救援'
        };
        return labels[type] || type;
    }

    setSpeed(speed) {
        this.replaySpeed = Math.max(0.25, Math.min(4, speed));
        this.emit('speedChanged', { speed: this.replaySpeed });
    }

    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentFrame: this.currentFrame,
            totalFrames: this.currentReplay ? this.currentReplay.totalFrames : 0,
            speed: this.replaySpeed,
            hasReplay: this.currentReplay !== null
        };
    }

    generateReplayFrames(failureData) {
        const frames = [];
        
        for (let i = 0; i < failureData.history.length; i++) {
            const action = failureData.history[i];
            const nextAction = failureData.history[i + 1];
            
            if (action.type === 'move') {
                for (let t = 0; t < 10; t++) {
                    const progress = t / 10;
                    frames.push({
                        type: 'move',
                        turn: action.turn,
                        x: action.parameters.fromX + (action.parameters.toX - action.parameters.fromX) * progress,
                        y: action.parameters.fromY + (action.parameters.toY - action.parameters.fromY) * progress,
                        action: action
                    });
                }
            } else if (action.type === 'sound_pulse' && action.waveData) {
                const path = action.waveData.path;
                for (let j = 1; j < path.length; j++) {
                    for (let t = 0; t < 5; t++) {
                        const progress = t / 5;
                        const p1 = path[j - 1];
                        const p2 = path[j];
                        frames.push({
                            type: 'wave',
                            turn: action.turn,
                            x: p1.x + (p2.x - p1.x) * progress,
                            y: p1.y + (p2.y - p1.y) * progress,
                            pathIndex: j,
                            action: action
                        });
                    }
                }
            }
        }
        
        return frames;
    }

    toJSON() {
        return {
            currentReplay: this.currentReplay,
            currentFrame: this.currentFrame,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            replaySpeed: this.replaySpeed
        };
    }

    loadJSON(data) {
        if (data.currentReplay) {
            this.currentReplay = data.currentReplay;
        }
        if (data.currentFrame !== undefined) {
            this.currentFrame = data.currentFrame;
        }
        if (data.replaySpeed !== undefined) {
            this.replaySpeed = data.replaySpeed;
        }
    }
}
