export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.animationId = null;
        this.waveAnimationProgress = 0;
        this.isAnimating = false;
        this.currentWave = null;
        this.currentPath = null;
        this.gridSize = 30;
        this.colors = {
            background: '#0f172a',
            grid: 'rgba(96, 165, 250, 0.1)',
            wall: {
                hard: '#64748b',
                soft: '#84cc16',
                absorbent: '#f97316'
            },
            player: '#3b82f6',
            teammate: {
                trapped: '#ef4444',
                rescued: '#22c55e',
                lost: '#6b7280'
            },
            wave: '#fbbf24',
            echo: '#22c55e',
            reflection: '#f472b6',
            text: '#ffffff'
        };
    }

    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawGrid() {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= this.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    drawWalls(walls) {
        for (const wall of walls) {
            const color = this.colors.wall[wall.material] || this.colors.wall.hard;
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';

            this.ctx.beginPath();
            this.ctx.moveTo(wall.x1, wall.y1);
            this.ctx.lineTo(wall.x2, wall.y2);
            this.ctx.stroke();

            this.ctx.fillStyle = color;
            this.ctx.font = '10px sans-serif';
            this.ctx.textAlign = 'center';
            const midX = (wall.x1 + wall.x2) / 2;
            const midY = (wall.y1 + wall.y2) / 2;
            const normal = wall.getNormal();
            this.ctx.fillText(
                `${(wall.reflectionCoefficient * 100).toFixed(0)}%`,
                midX + normal.x * 15,
                midY + normal.y * 15
            );
        }
    }

    drawCharacters(characters) {
        for (const char of characters) {
            if (char.type === 'player') {
                this.drawPlayer(char);
            } else if (char.type === 'teammate') {
                this.drawTeammate(char);
            }
        }
    }

    drawPlayer(player) {
        const gradient = this.ctx.createRadialGradient(
            player.x, player.y, 0,
            player.x, player.y, 20
        );
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = this.colors.player;
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, 12, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('救', player.x, player.y);

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '9px sans-serif';
        this.ctx.fillText(`HP:${player.health}`, player.x, player.y + 22);
    }

    drawTeammate(teammate) {
        const color = this.colors.teammate[teammate.status] || this.colors.teammate.trapped;

        const gradient = this.ctx.createRadialGradient(
            teammate.x, teammate.y, 0,
            teammate.x, teammate.y, 18
        );
        gradient.addColorStop(0, color + '80');
        gradient.addColorStop(1, color + '00');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(teammate.x, teammate.y, 18, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(teammate.x, teammate.y, 10, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 9px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('队', teammate.x, teammate.y);

        if (teammate.status === 'trapped') {
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.font = '8px sans-serif';
            this.ctx.fillText(`HP:${teammate.health}`, teammate.x, teammate.y + 18);
        }

        if (teammate.status === 'rescued') {
            this.ctx.strokeStyle = '#22c55e';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(teammate.x, teammate.y, 14, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }

    drawWavePath(wave, animate = true) {
        if (!wave || !wave.path || wave.path.length < 2) return;

        const path = wave.path;
        const progress = animate ? this.waveAnimationProgress : 1;
        const segmentsToDraw = Math.ceil((path.length - 1) * progress) + 1;

        for (let i = 1; i < Math.min(segmentsToDraw, path.length); i++) {
            const p1 = path[i - 1];
            const p2 = path[i];
            
            const alpha = 1 - (i / path.length) * 0.6;
            this.ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
            this.ctx.lineWidth = 2 + (1 - i / path.length);
            
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            
            if (i === segmentsToDraw - 1 && animate) {
                const segProgress = ((path.length - 1) * progress) % 1;
                const midX = p1.x + (p2.x - p1.x) * segProgress;
                const midY = p1.y + (p2.y - p1.y) * segProgress;
                this.ctx.lineTo(midX, midY);
            } else {
                this.ctx.lineTo(p2.x, p2.y);
            }
            this.ctx.stroke();
        }

        if (path.length > 0 && progress > 0) {
            const lastIndex = Math.min(Math.floor((path.length - 1) * progress), path.length - 1);
            const lastPoint = path[lastIndex];
            
            const gradient = this.ctx.createRadialGradient(
                lastPoint.x, lastPoint.y, 0,
                lastPoint.x, lastPoint.y, 20
            );
            gradient.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
            gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
            gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(lastPoint.x, lastPoint.y, 20, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = this.colors.wave;
            this.ctx.beginPath();
            this.ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawReflections(reflections, showAll = false) {
        if (!reflections || reflections.length === 0) return;

        const count = showAll ? reflections.length : 
            Math.min(Math.ceil(reflections.length * this.waveAnimationProgress), reflections.length);

        for (let i = 0; i < count; i++) {
            const reflection = reflections[i];
            
            this.ctx.fillStyle = 'rgba(244, 114, 182, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(reflection.point.x, reflection.point.y, 10, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = this.colors.reflection;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(reflection.point.x, reflection.point.y, 10, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = this.colors.reflection;
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(i + 1, reflection.point.x, reflection.point.y);
        }
    }

    drawEchoes(echoes, playerX, playerY, showAll = false) {
        if (!echoes || echoes.length === 0) return;

        const count = showAll ? echoes.length :
            Math.min(Math.ceil(echoes.length * this.waveAnimationProgress), echoes.length);

        for (let i = 0; i < count; i++) {
            const echo = echoes[i];
            if (!echo.point) continue;

            this.ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(playerX, playerY);
            this.ctx.lineTo(echo.point.x, echo.point.y);
            this.ctx.stroke();
            
            this.ctx.setLineDash([]);

            this.ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(echo.point.x, echo.point.y, 8, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = this.colors.echo;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(echo.point.x, echo.point.y, 8, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = this.colors.echo;
            this.ctx.font = '9px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(
                `${echo.time.toFixed(3)}s`,
                echo.point.x + 12,
                echo.point.y - 5
            );
            this.ctx.fillText(
                `${echo.distance.toFixed(1)}`,
                echo.point.x + 12,
                echo.point.y + 8
            );
        }
    }

    drawDirectionIndicator(x, y, angle, intensity) {
        const rad = (angle * Math.PI) / 180;
        const length = 30 + intensity * 20;

        this.ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + intensity * 0.5})`;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(
            x + Math.cos(rad) * length,
            y + Math.sin(rad) * length
        );
        this.ctx.stroke();

        const arrowSize = 8;
        const endX = x + Math.cos(rad) * length;
        const endY = y + Math.sin(rad) * length;
        
        this.ctx.fillStyle = `rgba(251, 191, 36, ${0.5 + intensity * 0.5})`;
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - Math.cos(rad - 0.3) * arrowSize,
            endY - Math.sin(rad - 0.3) * arrowSize
        );
        this.ctx.lineTo(
            endX - Math.cos(rad + 0.3) * arrowSize,
            endY - Math.sin(rad + 0.3) * arrowSize
        );
        this.ctx.closePath();
        this.ctx.fill();
    }

    render(maze, options = {}) {
        this.clear();
        this.drawGrid();
        this.drawWalls(maze.walls);
        this.drawCharacters(maze.characters);

        if (options.wave) {
            this.drawWavePath(options.wave, options.animate !== false);
        }

        if (options.reflections && (options.showAllReflections || options.animate === false)) {
            this.drawReflections(options.reflections, true);
        } else if (options.reflections) {
            this.drawReflections(options.reflections, false);
        }

        if (options.echoes && (options.showAllEchoes || options.animate === false)) {
            const player = maze.getPlayer();
            if (player) {
                this.drawEchoes(options.echoes, player.x, player.y, true);
            }
        } else if (options.echoes) {
            const player = maze.getPlayer();
            if (player) {
                this.drawEchoes(options.echoes, player.x, player.y, false);
            }
        }

        if (options.directionAngle !== undefined && options.directionIntensity !== undefined) {
            const player = maze.getPlayer();
            if (player) {
                this.drawDirectionIndicator(
                    player.x, player.y,
                    options.directionAngle,
                    options.directionIntensity
                );
            }
        }
    }

    startWaveAnimation(wave, duration = 2000, onComplete) {
        this.currentWave = wave;
        this.waveAnimationProgress = 0;
        this.isAnimating = true;
        
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            this.waveAnimationProgress = Math.min(elapsed / duration, 1);

            if (this.waveAnimationProgress < 1 && this.isAnimating) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                if (onComplete) onComplete();
            }
        };

        this.animationId = requestAnimationFrame(animate);
    }

    stopAnimation() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.waveAnimationProgress = 1;
    }

    resetAnimation() {
        this.stopAnimation();
        this.waveAnimationProgress = 0;
        this.currentWave = null;
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }

    toDataURL(type = 'image/png') {
        return this.canvas.toDataURL(type);
    }
}
