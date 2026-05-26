class InteractionManager {
    constructor(canvas, renderer, game) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.game = game;
        this.isDragging = false;
        this.isScrolling = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.poolDragEvent = null;
        this.longPressTimer = null;
        this.touchStartPos = null;

        this.bindEvents();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
        this.canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e));

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    onMouseDown(e) {
        if (this.game.state.phase === GamePhase.PLAYING) return;

        const pos = this.getCanvasPos(e);
        this.lastMousePos = pos;

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            this.isScrolling = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0) {
            const event = this.renderer.getEventAt(pos.x, pos.y);
            if (event) {
                this.isDragging = true;
                this.renderer.draggingEvent = event;
                const rect = this.renderer.getEventScreenRect(event);
                this.renderer.dragOffsetX = pos.x - rect.x;
                this.game.removeEventFromTrack(event);
            }
        }
    }

    onMouseMove(e) {
        const pos = this.getCanvasPos(e);
        this.lastMousePos = pos;

        if (this.isScrolling) {
            const dx = e.movementX || (pos.x - this.lastMousePos.x);
            const dy = e.movementY || (pos.y - this.lastMousePos.y);
            this.renderer.config.scrollX = Math.max(0, this.renderer.config.scrollX - dx);
            this.renderer.config.scrollY = Math.max(0, this.renderer.config.scrollY - dy);
            this.clampScroll();
            return;
        }

        if (this.isDragging && this.renderer.draggingEvent) {
            this.renderer.dragPreviewPos = pos;
            return;
        }

        if (this.poolDragEvent) {
            this.renderer.draggingEvent = this.poolDragEvent;
            this.renderer.dragPreviewPos = pos;
            this.renderer.dragOffsetX = (this.poolDragEvent.duration * this.renderer.config.timeScale) / 2;
            return;
        }

        const event = this.renderer.getEventAt(pos.x, pos.y);
        this.renderer.hoveredEvent = event;
        this.canvas.style.cursor = event ? 'grab' : 
            this.isScrolling ? 'grabbing' : 'default';
    }

    onMouseUp(e) {
        const pos = this.getCanvasPos(e);

        if (this.isScrolling) {
            this.isScrolling = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        if (this.isDragging && this.renderer.draggingEvent) {
            const track = this.renderer.getTrackAt(pos.y);
            if (track) {
                const snapTime = Math.round(this.renderer.screenToTime(
                    pos.x - this.renderer.dragOffsetX
                ) / 5) * 5;
                
                const validation = RuleEngine.validatePlacement(
                    this.renderer.draggingEvent, track, snapTime, this.game.state
                );

                if (validation.valid) {
                    this.game.placeEvent(this.renderer.draggingEvent, track, snapTime);
                }
            }
            this.isDragging = false;
            this.renderer.draggingEvent = null;
            this.renderer.dragPreviewPos = null;
            this.game.checkConflicts();
            return;
        }

        if (this.poolDragEvent) {
            const track = this.renderer.getTrackAt(pos.y);
            if (track) {
                const snapTime = Math.round(this.renderer.screenToTime(
                    pos.x - this.renderer.dragOffsetX
                ) / 5) * 5;
                
                const validation = RuleEngine.validatePlacement(
                    this.poolDragEvent, track, snapTime, this.game.state
                );

                if (validation.valid) {
                    this.game.placeEvent(this.poolDragEvent, track, snapTime);
                }
            }
            this.poolDragEvent = null;
            this.renderer.draggingEvent = null;
            this.renderer.dragPreviewPos = null;
            this.game.checkConflicts();
            return;
        }

        if (e.button === 2) {
            const event = this.renderer.getEventAt(pos.x, pos.y);
            if (event) {
                this.game.removeEventFromTrack(event);
                this.game.checkConflicts();
            }
        }
    }

    onWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
            const delta = e.deltaY > 0 ? 0.8 : 1.25;
            const oldScale = this.renderer.config.timeScale;
            this.renderer.config.timeScale = Math.max(0.5, Math.min(8, oldScale * delta));
            
            const pos = this.getCanvasPos(e);
            const timeAtCursor = this.renderer.screenToTime(pos.x);
            const newX = this.renderer.timeToScreen(timeAtCursor);
            this.renderer.config.scrollX += (pos.x - newX);
        } else {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                this.renderer.config.scrollX = Math.max(0, this.renderer.config.scrollX + e.deltaX);
            } else {
                this.renderer.config.scrollY = Math.max(0, this.renderer.config.scrollY + e.deltaY);
            }
        }
        
        this.clampScroll();
    }

    onTouchStart(e) {
        e.preventDefault();
        if (this.game.state.phase === GamePhase.PLAYING) return;

        const touch = e.touches[0];
        const pos = this.getCanvasPos(touch);
        this.touchStartPos = { ...pos };
        this.lastMousePos = pos;

        this.longPressTimer = setTimeout(() => {
            const event = this.renderer.getEventAt(pos.x, pos.y);
            if (event) {
                this.isDragging = true;
                this.renderer.draggingEvent = event;
                const rect = this.renderer.getEventScreenRect(event);
                this.renderer.dragOffsetX = pos.x - rect.x;
                this.game.removeEventFromTrack(event);
            } else {
                this.isScrolling = true;
            }
        }, 300);
    }

    onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = this.getCanvasPos(touch);

        if (this.longPressTimer) {
            const dx = pos.x - this.touchStartPos.x;
            const dy = pos.y - this.touchStartPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
                this.isScrolling = true;
            }
        }

        if (this.isScrolling) {
            const dx = pos.x - this.lastMousePos.x;
            const dy = pos.y - this.lastMousePos.y;
            this.renderer.config.scrollX = Math.max(0, this.renderer.config.scrollX - dx);
            this.renderer.config.scrollY = Math.max(0, this.renderer.config.scrollY - dy);
            this.clampScroll();
        }

        if (this.isDragging && this.renderer.draggingEvent) {
            this.renderer.dragPreviewPos = pos;
        }

        if (this.poolDragEvent) {
            this.renderer.draggingEvent = this.poolDragEvent;
            this.renderer.dragPreviewPos = pos;
            this.renderer.dragOffsetX = (this.poolDragEvent.duration * this.renderer.config.timeScale) / 2;
        }

        this.lastMousePos = pos;
    }

    onTouchEnd(e) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        const pos = this.lastMousePos;

        if (this.isDragging && this.renderer.draggingEvent) {
            const track = this.renderer.getTrackAt(pos.y);
            if (track) {
                const snapTime = Math.round(this.renderer.screenToTime(
                    pos.x - this.renderer.dragOffsetX
                ) / 5) * 5;
                
                const validation = RuleEngine.validatePlacement(
                    this.renderer.draggingEvent, track, snapTime, this.game.state
                );

                if (validation.valid) {
                    this.game.placeEvent(this.renderer.draggingEvent, track, snapTime);
                }
            }
            this.isDragging = false;
            this.renderer.draggingEvent = null;
            this.renderer.dragPreviewPos = null;
            this.game.checkConflicts();
        }

        if (this.poolDragEvent) {
            const track = this.renderer.getTrackAt(pos.y);
            if (track) {
                const snapTime = Math.round(this.renderer.screenToTime(
                    pos.x - this.renderer.dragOffsetX
                ) / 5) * 5;
                
                const validation = RuleEngine.validatePlacement(
                    this.poolDragEvent, track, snapTime, this.game.state
                );

                if (validation.valid) {
                    this.game.placeEvent(this.poolDragEvent, track, snapTime);
                }
            }
            this.poolDragEvent = null;
            this.renderer.draggingEvent = null;
            this.renderer.dragPreviewPos = null;
            this.game.checkConflicts();
        }

        this.isScrolling = false;
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                if (this.game.state.phase === GamePhase.PLAYING) {
                    this.game.pause();
                } else if (this.game.state.phase === GamePhase.PAUSED) {
                    this.game.resume();
                }
                break;
            case 'KeyR':
                e.preventDefault();
                this.game.restart();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.game.state.phase === GamePhase.PLANNING) {
                    this.game.startPlayback();
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (this.renderer.hoveredEvent && this.game.state.phase === GamePhase.PLANNING) {
                    e.preventDefault();
                    this.game.removeEventFromTrack(this.renderer.hoveredEvent);
                    this.game.checkConflicts();
                }
                break;
            case 'ArrowLeft':
                this.renderer.config.scrollX = Math.max(0, this.renderer.config.scrollX - 50);
                this.clampScroll();
                break;
            case 'ArrowRight':
                this.renderer.config.scrollX += 50;
                this.clampScroll();
                break;
            case 'ArrowUp':
                this.renderer.config.scrollY = Math.max(0, this.renderer.config.scrollY - 50);
                this.clampScroll();
                break;
            case 'ArrowDown':
                this.renderer.config.scrollY += 50;
                this.clampScroll();
                break;
            case 'Equal':
            case 'NumpadAdd':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.renderer.config.timeScale = Math.min(8, this.renderer.config.timeScale * 1.25);
                }
                break;
            case 'Minus':
            case 'NumpadSubtract':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.renderer.config.timeScale = Math.max(0.5, this.renderer.config.timeScale * 0.8);
                }
                break;
        }
    }

    startPoolDrag(event, clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const pos = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
        
        this.poolDragEvent = event.clone();
        this.renderer.draggingEvent = this.poolDragEvent;
        this.renderer.dragPreviewPos = pos;
        this.renderer.dragOffsetX = (event.duration * this.renderer.config.timeScale) / 2;
    }

    clampScroll() {
        const maxScrollX = Math.max(0, this.renderer.getTotalWidth() - this.renderer.width + this.renderer.config.timeColumnWidth);
        const maxScrollY = Math.max(0, this.renderer.getTotalHeight() - this.renderer.height + this.renderer.config.headerHeight);
        
        this.renderer.config.scrollX = Math.min(this.renderer.config.scrollX, maxScrollX);
        this.renderer.config.scrollY = Math.min(this.renderer.config.scrollY, maxScrollY);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InteractionManager };
}
