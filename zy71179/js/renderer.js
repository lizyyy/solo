class TimelineRenderer {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = state;
        this.config = {
            timeColumnWidth: 60,
            rowHeight: 50,
            headerHeight: 60,
            sceneHeight: 30,
            timeScale: 2,
            scrollX: 0,
            scrollY: 0,
            playheadX: 0,
            showPlayhead: false,
            currentTime: 0
        };
        this.draggingEvent = null;
        this.dragOffsetX = 0;
        this.hoveredEvent = null;
        this.conflictHighlightEvents = new Set();
        this.resize();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    getTotalHeight() {
        return this.config.headerHeight + this.config.sceneHeight + 
               this.state.tracks.length * this.config.rowHeight;
    }

    getTotalWidth() {
        return this.config.timeColumnWidth + this.state.maxTime * this.config.timeScale;
    }

    screenToTime(x) {
        return Math.max(0, (x - this.config.timeColumnWidth + this.config.scrollX) / this.config.timeScale);
    }

    timeToScreen(time) {
        return this.config.timeColumnWidth + time * this.config.timeScale - this.config.scrollX;
    }

    getTrackAt(y) {
        const adjustedY = y + this.config.scrollY - this.config.headerHeight - this.config.sceneHeight;
        if (adjustedY < 0) return null;
        const trackIdx = Math.floor(adjustedY / this.config.rowHeight);
        if (trackIdx >= 0 && trackIdx < this.state.tracks.length) {
            return this.state.tracks[trackIdx];
        }
        return null;
    }

    getEventAt(x, y) {
        const track = this.getTrackAt(y);
        if (!track) return null;

        const time = this.screenToTime(x);
        for (const evt of track.events) {
            if (evt.startTime !== null && time >= evt.startTime && time <= evt.endTime) {
                return evt;
            }
        }
        return null;
    }

    getEventScreenRect(event) {
        const trackIdx = this.state.tracks.findIndex(t => t.id === event.track);
        if (trackIdx === -1 || event.startTime === null) return null;

        const x = this.timeToScreen(event.startTime);
        const y = this.config.headerHeight + this.config.sceneHeight + 
                  trackIdx * this.config.rowHeight - this.config.scrollY;
        const width = event.duration * this.config.timeScale;
        const height = this.config.rowHeight - 6;

        return { x, y: y + 3, width, height };
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        this.drawBackground();
        this.drawTimeAxis();
        this.drawScenes();
        this.drawTracks();
        this.drawEvents();
        this.drawPlayhead();
        this.drawDragPreview();
        this.drawScrollIndicators();
    }

    drawBackground() {
        const ctx = this.ctx;
        ctx.fillStyle = '#0f0f1e';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1;

        const startTime = this.config.scrollX / this.config.timeScale;
        const endTime = startTime + (this.width - this.config.timeColumnWidth) / this.config.timeScale;

        for (let t = Math.floor(startTime / 10) * 10; t <= endTime; t += 10) {
            const x = this.timeToScreen(t);
            ctx.beginPath();
            ctx.moveTo(x, this.config.headerHeight);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
    }

    drawTimeAxis() {
        const ctx = this.ctx;
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, this.width, this.config.headerHeight);

        ctx.fillStyle = '#e94560';
        ctx.fillRect(0, this.config.headerHeight - 3, this.width, 3);

        ctx.strokeStyle = '#2d3a5c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.config.timeColumnWidth, 0);
        ctx.lineTo(this.config.timeColumnWidth, this.config.headerHeight);
        ctx.stroke();

        ctx.fillStyle = '#eaeaea';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('时间轴', this.config.timeColumnWidth / 2, this.config.headerHeight / 2 + 5);

        const startTime = this.config.scrollX / this.config.timeScale;
        const endTime = startTime + (this.width - this.config.timeColumnWidth) / this.config.timeScale;

        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        for (let t = Math.floor(startTime / 10) * 10; t <= endTime; t += 10) {
            const x = this.timeToScreen(t);
            const mins = Math.floor(t / 60);
            const secs = Math.floor(t % 60);
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            ctx.fillStyle = '#888';
            ctx.fillText(timeStr, x, 25);
            
            ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(x, 35);
            ctx.lineTo(x, this.config.headerHeight);
            ctx.stroke();
        }

        for (let t = startTime; t <= endTime; t += 5) {
            if (t % 10 !== 0) {
                const x = this.timeToScreen(t);
                ctx.strokeStyle = '#333';
                ctx.beginPath();
                ctx.moveTo(x, 40);
                ctx.lineTo(x, this.config.headerHeight);
                ctx.stroke();
            }
        }
    }

    drawScenes() {
        const ctx = this.ctx;
        const y = this.config.headerHeight;
        const height = this.config.sceneHeight;

        ctx.fillStyle = '#0f3460';
        ctx.fillRect(0, y, this.width, height);

        this.state.scenes.forEach(scene => {
            const x = this.timeToScreen(scene.startTime);
            const width = (scene.endTime - scene.startTime) * this.config.timeScale;
            const endX = this.timeToScreen(scene.endTime);

            if (endX > this.config.timeColumnWidth && x < this.width) {
                ctx.fillStyle = scene.color || '#533483';
                ctx.globalAlpha = 0.6;
                ctx.fillRect(Math.max(x, this.config.timeColumnWidth), y, 
                           Math.min(width, this.width - Math.max(x, this.config.timeColumnWidth)), height);
                ctx.globalAlpha = 1;

                ctx.fillStyle = '#eaeaea';
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'center';
                const centerX = Math.max(x, this.config.timeColumnWidth) + 
                              Math.min(width, this.width - Math.max(x, this.config.timeColumnWidth)) / 2;
                if (width > 100) {
                    ctx.fillText(scene.name, centerX, y + height / 2 + 5);
                }
            }
        });

        this.state.sceneChanges.forEach(sc => {
            const x = this.timeToScreen(sc.startTime);
            const endX = this.timeToScreen(sc.startTime + sc.maxDuration);
            
            ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
            ctx.fillRect(x, y, endX - x, height);
            
            ctx.strokeStyle = '#e94560';
            ctx.setLineDash([5, 3]);
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, endX - x, height);
            ctx.setLineDash([]);

            ctx.fillStyle = '#e94560';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`换景 ${sc.maxDuration}s`, (x + endX) / 2, y + height - 5);
        });

        ctx.strokeStyle = '#2d3a5c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + height);
        ctx.lineTo(this.width, y + height);
        ctx.stroke();
    }

    drawTracks() {
        const ctx = this.ctx;
        const startY = this.config.headerHeight + this.config.sceneHeight;

        this.state.tracks.forEach((track, idx) => {
            const y = startY + idx * this.config.rowHeight - this.config.scrollY;
            
            if (y < -this.config.rowHeight || y > this.height) return;

            ctx.fillStyle = idx % 2 === 0 ? '#16213e' : '#1a1a2e';
            ctx.fillRect(0, y, this.width, this.config.rowHeight);

            ctx.fillStyle = '#0f3460';
            ctx.fillRect(0, y, this.config.timeColumnWidth, this.config.rowHeight);

            ctx.fillStyle = this.getTrackTypeColor(track.type);
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(track.name, this.config.timeColumnWidth / 2, y + this.config.rowHeight / 2 + 4);

            ctx.strokeStyle = '#2d3a5c';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.config.timeColumnWidth, y);
            ctx.lineTo(this.width, y);
            ctx.moveTo(this.config.timeColumnWidth, y + this.config.rowHeight);
            ctx.lineTo(this.width, y + this.config.rowHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(this.config.timeColumnWidth, y);
            ctx.lineTo(this.config.timeColumnWidth, y + this.config.rowHeight);
            ctx.stroke();
        });
    }

    drawEvents() {
        const ctx = this.ctx;

        this.state.tracks.forEach(track => {
            track.events.forEach(event => {
                const rect = this.getEventScreenRect(event);
                if (!rect) return;
                if (rect.x + rect.width < this.config.timeColumnWidth || rect.x > this.width) return;

                this.drawEventBlock(ctx, event, rect);
            });
        });
    }

    drawEventBlock(ctx, event, rect) {
        const isHovered = this.hoveredEvent && this.hoveredEvent.id === event.id;
        const isDragging = this.draggingEvent && this.draggingEvent.id === event.id;
        const isConflict = this.conflictHighlightEvents.has(event.id);

        const visibleX = Math.max(rect.x, this.config.timeColumnWidth);
        const visibleWidth = Math.min(rect.width, this.width - visibleX);
        const clipWidth = rect.width - (visibleX - rect.x);

        ctx.save();
        ctx.beginPath();
        ctx.rect(visibleX, rect.y, visibleWidth, rect.height);
        ctx.clip();

        const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
        let baseColor = event.color;
        
        if (isConflict) {
            baseColor = '#e94560';
        }
        
        gradient.addColorStop(0, this.lightenColor(baseColor, 30));
        gradient.addColorStop(1, baseColor);
        ctx.fillStyle = gradient;

        const radius = 6;
        this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
        ctx.fill();

        if (isConflict) {
            ctx.strokeStyle = '#ff0040';
            ctx.lineWidth = 3;
        } else if (isHovered || isDragging) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = this.darkenColor(baseColor, 20);
            ctx.lineWidth = 1;
        }
        this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
        ctx.stroke();

        if (rect.width > 40) {
            ctx.fillStyle = '#1a1a2e';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            const padding = 8;
            const textX = rect.x + padding;
            const textY = rect.y + rect.height / 2 + 4;
            
            const displayName = rect.width > 100 ? event.name : 
                               rect.width > 60 ? event.name.substring(0, 8) + '...' : '';
            ctx.fillText(displayName, textX, textY);

            if (rect.width > 80) {
                ctx.font = '10px sans-serif';
                ctx.fillStyle = 'rgba(26, 26, 46, 0.7)';
                ctx.textAlign = 'right';
                ctx.fillText(`${event.duration}s`, rect.x + rect.width - padding, textY);
            }

            if (event.order !== null && event.order > 0 && rect.width > 120) {
                ctx.fillStyle = 'rgba(26, 26, 46, 0.8)';
                ctx.beginPath();
                ctx.arc(rect.x + 15, rect.y + 12, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = baseColor;
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(event.order.toString(), rect.x + 15, rect.y + 15);
            }
        }

        ctx.restore();
    }

    drawPlayhead() {
        if (!this.config.showPlayhead) return;

        const ctx = this.ctx;
        const x = this.timeToScreen(this.config.currentTime);

        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, this.config.headerHeight);
        ctx.lineTo(x, this.height);
        ctx.stroke();

        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.moveTo(x, this.config.headerHeight);
        ctx.lineTo(x - 8, this.config.headerHeight - 12);
        ctx.lineTo(x + 8, this.config.headerHeight - 12);
        ctx.closePath();
        ctx.fill();

        const mins = Math.floor(this.config.currentTime / 60);
        const secs = Math.floor(this.config.currentTime % 60);
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        ctx.fillStyle = '#4ecdc4';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(timeStr, x, this.config.headerHeight - 16);
    }

    drawDragPreview() {
        if (!this.draggingEvent || !this.dragPreviewPos) return;

        const ctx = this.ctx;
        const event = this.draggingEvent;
        const pos = this.dragPreviewPos;
        
        const track = this.getTrackAt(pos.y);
        const snapTime = Math.round(this.screenToTime(pos.x - this.dragOffsetX) / 5) * 5;
        const width = event.duration * this.config.timeScale;
        
        let y = pos.y - this.config.rowHeight / 2;
        if (track) {
            const trackIdx = this.state.tracks.findIndex(t => t.id === track.id);
            y = this.config.headerHeight + this.config.sceneHeight + 
                trackIdx * this.config.rowHeight - this.config.scrollY + 3;
        }
        
        const previewX = this.timeToScreen(snapTime);
        
        ctx.globalAlpha = 0.7;
        const gradient = ctx.createLinearGradient(previewX, y, previewX, y + this.config.rowHeight - 6);
        gradient.addColorStop(0, this.lightenColor(event.color, 30));
        gradient.addColorStop(1, event.color);
        ctx.fillStyle = gradient;
        
        this.roundRect(ctx, previewX, y, width, this.config.rowHeight - 6, 6);
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        this.roundRect(ctx, previewX, y, width, this.config.rowHeight - 6, 6);
        ctx.stroke();

        if (track) {
            const validation = RuleEngine.validatePlacement(event, track, snapTime, this.state);
            ctx.fillStyle = validation.valid ? 'rgba(78, 205, 196, 0.9)' : 'rgba(233, 69, 96, 0.9)';
            ctx.fillRect(previewX, y - 20, validation.valid ? 60 : 120, 16);
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(validation.valid ? `✓ ${snapTime}s` : `✗ ${validation.reason}`, previewX + (validation.valid ? 30 : 60), y - 8);
        }

        ctx.globalAlpha = 1;
    }

    drawScrollIndicators() {
        const ctx = this.ctx;
        const totalWidth = this.getTotalWidth();

        if (this.config.scrollX > 0) {
            ctx.fillStyle = 'rgba(233, 69, 96, 0.8)';
            ctx.beginPath();
            ctx.moveTo(this.config.timeColumnWidth + 5, this.config.headerHeight / 2);
            ctx.lineTo(this.config.timeColumnWidth + 15, this.config.headerHeight / 2 - 8);
            ctx.lineTo(this.config.timeColumnWidth + 15, this.config.headerHeight / 2 + 8);
            ctx.closePath();
            ctx.fill();
        }

        if (this.config.scrollX + this.width < totalWidth) {
            ctx.fillStyle = 'rgba(233, 69, 96, 0.8)';
            ctx.beginPath();
            ctx.moveTo(this.width - 5, this.config.headerHeight / 2);
            ctx.lineTo(this.width - 15, this.config.headerHeight / 2 - 8);
            ctx.lineTo(this.width - 15, this.config.headerHeight / 2 + 8);
            ctx.closePath();
            ctx.fill();
        }
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    getTrackTypeColor(type) {
        switch (type) {
            case 'light': return '#ffd369';
            case 'prop': return '#4ecdc4';
            case 'actor': return '#a8e6cf';
            default: return '#888';
        }
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    highlightConflicts(conflicts) {
        this.conflictHighlightEvents.clear();
        conflicts.forEach(c => {
            c.eventIds.forEach(id => this.conflictHighlightEvents.add(id));
        });
    }

    clearHighlight() {
        this.conflictHighlightEvents.clear();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TimelineRenderer };
}
