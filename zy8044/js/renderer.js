export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.showGrid = true;
        this.showIssueHighlight = true;
        this.mmToPx = 3.78;
    }

    setZoom(zoom) {
        this.zoom = zoom / 100;
    }

    setOffset(x, y) {
        this.offsetX = x;
        this.offsetY = y;
    }

    resetView(pageWidth, pageHeight) {
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth - 40;
        const containerHeight = container.clientHeight - 40;

        const pagePxWidth = pageWidth * this.mmToPx;
        const pagePxHeight = pageHeight * this.mmToPx;

        const scaleX = containerWidth / pagePxWidth;
        const scaleY = containerHeight / pagePxHeight;
        const scale = Math.min(scaleX, scaleY, 2);

        this.zoom = scale;
        this.offsetX = (containerWidth - pagePxWidth * scale) / 2 + 20;
        this.offsetY = (containerHeight - pagePxHeight * scale) / 2 + 20;
    }

    clear() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    render(pageData, graphics, issues, rules) {
        this.clear();

        if (!pageData) return;

        const { pageWidth, pageHeight, dies, bleed } = pageData;

        this.ctx.setTransform(this.zoom, 0, 0, this.zoom, this.offsetX, this.offsetY);

        this.drawPage(pageWidth, pageHeight);
        this.drawBleedArea(pageWidth, pageHeight, bleed);
        this.drawSafeLine(pageWidth, pageHeight, rules?.safeLine?.width || 3);

        if (dies) {
            for (const die of dies) {
                this.drawDie(die);
            }
        }

        if (graphics) {
            for (const graphic of graphics) {
                this.drawGraphic(graphic);
            }
        }

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (this.showIssueHighlight && issues) {
            this.drawIssues(issues);
        }
    }

    drawPage(width, height) {
        const pxWidth = width * this.mmToPx;
        const pxHeight = height * this.mmToPx;

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, pxWidth, pxHeight);

        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.strokeRect(0, 0, pxWidth, pxHeight);

        if (this.showGrid) {
            this.drawGrid(width, height);
        }
    }

    drawGrid(width, height) {
        const gridSize = 10;
        const pxWidth = width * this.mmToPx;
        const pxHeight = height * this.mmToPx;

        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 0.5 / this.zoom;

        for (let x = 0; x <= pxWidth; x += gridSize * this.zoom) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, pxHeight);
            this.ctx.stroke();
        }

        for (let y = 0; y <= pxHeight; y += gridSize * this.zoom) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(pxWidth, y);
            this.ctx.stroke();
        }
    }

    drawBleedArea(width, height, bleed) {
        if (!bleed) return;

        const pxBleed = bleed * this.mmToPx;
        const pxWidth = width * this.mmToPx;
        const pxHeight = height * this.mmToPx;

        this.ctx.strokeStyle = '#ff4444';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 3 / this.zoom]);

        this.ctx.strokeRect(pxBleed, pxBleed, pxWidth - 2 * pxBleed, pxHeight - 2 * pxBleed);

        this.ctx.fillStyle = 'rgba(255, 68, 68, 0.05)';
        this.ctx.fillRect(0, 0, pxBleed, pxHeight);
        this.ctx.fillRect(pxWidth - pxBleed, 0, pxBleed, pxHeight);
        this.ctx.fillRect(0, 0, pxWidth, pxBleed);
        this.ctx.fillRect(0, pxHeight - pxBleed, pxWidth, pxBleed);

        this.ctx.setLineDash([]);
    }

    drawSafeLine(width, height, safeWidth) {
        const pxSafe = safeWidth * this.mmToPx;
        const pxWidth = width * this.mmToPx;
        const pxHeight = height * this.mmToPx;

        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);

        this.ctx.strokeRect(pxSafe, pxSafe, pxWidth - 2 * pxSafe, pxHeight - 2 * pxSafe);

        this.ctx.setLineDash([]);
    }

    drawDie(die) {
        const x = die.x * this.mmToPx;
        const y = die.y * this.mmToPx;
        const w = die.width * this.mmToPx;
        const h = die.height * this.mmToPx;

        const colors = die.colors || ['C', 'M', 'Y', 'K'];
        const colorMap = {
            'C': 'rgba(0, 180, 216, 0.3)',
            'M': 'rgba(220, 80, 120, 0.3)',
            'Y': 'rgba(240, 200, 60, 0.3)',
            'K': 'rgba(50, 50, 50, 0.4)'
        };

        let fillColor = 'rgba(100, 150, 255, 0.2)';
        if (colors.length === 1 && colorMap[colors[0]]) {
            fillColor = colorMap[colors[0]];
        }

        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(x, y, w, h);

        this.ctx.strokeStyle = '#2c5aa0';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.strokeRect(x, y, w, h);

        if (die.shape === 'custom' && die.points) {
            this.drawCustomShape(die.points, x, y);
        }

        this.drawColorIndicator(x, y, w, colors);

        this.ctx.fillStyle = '#333';
        this.ctx.font = `${10 / this.zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(die.name, x + w / 2, y + h / 2 + 4 / this.zoom);
    }

    drawCustomShape(points, offsetX, offsetY) {
        if (!points || points.length < 3) return;

        this.ctx.beginPath();
        this.ctx.moveTo(
            offsetX + points[0].x * this.mmToPx,
            offsetY + points[0].y * this.mmToPx
        );

        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(
                offsetX + points[i].x * this.mmToPx,
                offsetY + points[i].y * this.mmToPx
            );
        }

        this.ctx.closePath();
        this.ctx.strokeStyle = '#2c5aa0';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.stroke();
    }

    drawColorIndicator(x, y, w, colors) {
        const indicatorWidth = 8 / this.zoom;
        const startX = x + 2 / this.zoom;
        const startY = y + 2 / this.zoom;

        colors.forEach((color, i) => {
            this.ctx.fillStyle = this.getColorHex(color);
            this.ctx.fillRect(startX + i * (indicatorWidth + 1 / this.zoom), startY, indicatorWidth, indicatorWidth);
        });
    }

    getColorHex(color) {
        const colorMap = {
            'C': '#00b4d8',
            'M': '#dc5078',
            'Y': '#f0c83c',
            'K': '#323232'
        };
        return colorMap[color] || '#888888';
    }

    drawGraphic(graphic) {
        const x = graphic.x * this.mmToPx;
        const y = graphic.y * this.mmToPx;
        const w = graphic.width * this.mmToPx;
        const h = graphic.height * this.mmToPx;

        if (graphic.isText) {
            this.ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
            this.ctx.fillRect(x, y, w, h);

            this.ctx.strokeStyle = '#cc9900';
            this.ctx.lineWidth = 1 / this.zoom;
            this.ctx.setLineDash([2 / this.zoom, 2 / this.zoom]);
            this.ctx.strokeRect(x, y, w, h);
            this.ctx.setLineDash([]);

            this.ctx.fillStyle = '#996600';
            this.ctx.font = `${Math.min(12, h * 0.6)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const text = graphic.text?.substring(0, 10) || graphic.name;
            this.ctx.fillText(text, x + w / 2, y + h / 2, w - 4);
        } else {
            this.ctx.fillStyle = 'rgba(100, 200, 150, 0.3)';
            this.ctx.fillRect(x, y, w, h);

            this.ctx.strokeStyle = '#28a745';
            this.ctx.lineWidth = 1 / this.zoom;
            this.ctx.strokeRect(x, y, w, h);
        }

        this.ctx.textBaseline = 'alphabetic';
    }

    drawIssues(issues) {
        for (const issue of issues) {
            if (!issue.bounds) continue;

            const { x, y, width, height } = issue.bounds;
            const pxX = x * this.mmToPx + this.offsetX;
            const pxY = y * this.mmToPx + this.offsetY;
            const pxW = width * this.mmToPx;
            const pxH = height * this.mmToPx;

            const colors = {
                'bleed': '#ff4444',
                'text-on-line': '#ff8800',
                'missing-color': '#9900ff',
                'overlap': '#ff0066'
            };

            this.ctx.strokeStyle = colors[issue.type] || '#ff0000';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 4]);

            if (pxW > 0 && pxH > 0) {
                this.ctx.strokeRect(pxX, pxY, pxW, pxH);
            }

            this.ctx.fillStyle = colors[issue.type] || '#ff0000';
            this.ctx.setLineDash([]);

            const markerSize = 12;
            this.ctx.beginPath();
            this.ctx.moveTo(pxX, pxY);
            this.ctx.lineTo(pxX + markerSize, pxY);
            this.ctx.lineTo(pxX, pxY + markerSize);
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    getCanvasInfo() {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            zoom: this.zoom,
            offset: { x: this.offsetX, y: this.offsetY }
        };
    }

    screenToMM(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / (this.mmToPx * this.zoom),
            y: (screenY - this.offsetY) / (this.mmToPx * this.zoom)
        };
    }
}
