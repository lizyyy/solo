import { Level, SimulationState, Position, Direction, CELL_SIZE } from '../models/types';

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number = CELL_SIZE;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width * this.cellSize;
    this.canvas.height = height * this.cellSize;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  renderLevel(level: Level): void {
    this.clear();
    
    this.drawGrid(level.width, level.height);
    
    for (const wall of level.walls) {
      this.drawWall(wall);
    }
    
    for (const exit of level.exits) {
      this.drawExit(exit);
    }
    
    for (const smokeSource of level.smokeSources) {
      this.drawSmokeSource(smokeSource);
    }
    
    for (const sign of level.signs) {
      this.drawSign(sign.position, sign.direction);
    }
    
    for (const customer of level.customers) {
      this.drawCustomer(customer.position);
    }
  }

  renderSimulation(level: Level, state: SimulationState): void {
    this.clear();
    
    this.drawGrid(level.width, level.height);
    
    for (const wall of level.walls) {
      this.drawWall(wall);
    }
    
    for (const exit of level.exits) {
      this.drawExit(exit);
    }
    
    for (const smokeSource of level.smokeSources) {
      this.drawSmokeSource(smokeSource);
    }
    
    for (const smokeCell of state.smokeCells) {
      this.drawSmoke(smokeCell.position, smokeCell.density);
    }
    
    for (const sign of level.signs) {
      this.drawSign(sign.position, sign.direction);
    }
    
    for (const customer of state.customers) {
      if (!customer.isEvacuated && !customer.isTrapped) {
        this.drawCustomer(customer.position);
      }
      if (customer.isTrapped) {
        this.drawTrappedCustomer(customer.position);
      }
    }
  }

  private drawGrid(width: number, height: number): void {
    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 1;
    
    for (let x = 0; x <= width; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.cellSize, 0);
      this.ctx.lineTo(x * this.cellSize, height * this.cellSize);
      this.ctx.stroke();
    }
    
    for (let y = 0; y <= height; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.cellSize);
      this.ctx.lineTo(width * this.cellSize, y * this.cellSize);
      this.ctx.stroke();
    }
  }

  private drawWall(position: Position): void {
    const x = position.x * this.cellSize;
    const y = position.y * this.cellSize;
    
    this.ctx.fillStyle = '#4a4a4a';
    this.ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
    
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
    
    this.ctx.strokeStyle = '#555';
    this.ctx.lineWidth = 1;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + this.cellSize / 2, y + 2);
    this.ctx.lineTo(x + this.cellSize / 2, y + this.cellSize - 2);
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + 2, y + this.cellSize / 2);
    this.ctx.lineTo(x + this.cellSize - 2, y + this.cellSize / 2);
    this.ctx.stroke();
  }

  private drawExit(position: Position): void {
    const x = position.x * this.cellSize;
    const y = position.y * this.cellSize;
    const centerX = x + this.cellSize / 2;
    const centerY = y + this.cellSize / 2;
    
    this.ctx.fillStyle = '#27ae60';
    this.ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
    
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('EXIT', centerX, centerY);
    
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, this.cellSize / 2 - 4, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawSmokeSource(position: Position): void {
    const x = position.x * this.cellSize;
    const y = position.y * this.cellSize;
    const centerX = x + this.cellSize / 2;
    const centerY = y + this.cellSize / 2;
    
    this.ctx.fillStyle = '#8B0000';
    this.ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
    
    this.ctx.fillStyle = '#FF4500';
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, y + 8);
    this.ctx.lineTo(centerX + 10, centerY + 8);
    this.ctx.lineTo(centerX - 10, centerY + 8);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.fillStyle = '#FFD700';
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, y + 12);
    this.ctx.lineTo(centerX + 6, centerY + 6);
    this.ctx.lineTo(centerX - 6, centerY + 6);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawSmoke(position: Position, density: number): void {
    const x = position.x * this.cellSize;
    const y = position.y * this.cellSize;
    
    const alpha = Math.min(density, 0.7);
    
    this.ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
    
    if (density > 0.5) {
      this.ctx.fillStyle = `rgba(80, 80, 80, ${alpha * 0.5})`;
      this.ctx.beginPath();
      this.ctx.arc(x + this.cellSize / 3, y + this.cellSize / 3, this.cellSize / 5, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.arc(x + this.cellSize * 2 / 3, y + this.cellSize * 2 / 3, this.cellSize / 6, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawCustomer(position: Position): void {
    const x = position.x * this.cellSize;
    const y = position.y * this.cellSize;
    const centerX = x + this.cellSize / 2;
    const centerY = y + this.cellSize / 2;
    
    this.ctx.fillStyle = '#3498db';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY - 4, 8, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#2980b9';
    this.ctx.fillRect(centerX - 8, centerY + 2, 16, 14);
    
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, this.cellSize / 2 - 3, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawTrappedCustomer(position: Position): void {
    const x = position.x * this.cellSize;
    const y = position.y * this.cellSize;
    
    this.ctx.fillStyle = 'rgba(231, 76, 60, 0.6)';
    this.ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
    
    this.ctx.strokeStyle = '#c0392b';
    this.ctx.lineWidth = 3;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + 8, y + 8);
    this.ctx.lineTo(x + this.cellSize - 8, y + this.cellSize - 8);
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + this.cellSize - 8, y + 8);
    this.ctx.lineTo(x + 8, y + this.cellSize - 8);
    this.ctx.stroke();
  }

  private drawSign(position: Position, direction: Direction): void {
    const x = position.x * this.cellSize;
    const y = position.y * this.cellSize;
    const centerX = x + this.cellSize / 2;
    const centerY = y + this.cellSize / 2;
    
    this.ctx.fillStyle = '#2ecc71';
    this.ctx.fillRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8);
    
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    let arrow = '';
    switch (direction) {
      case Direction.UP:
        arrow = '↑';
        break;
      case Direction.DOWN:
        arrow = '↓';
        break;
      case Direction.LEFT:
        arrow = '←';
        break;
      case Direction.RIGHT:
        arrow = '→';
        break;
    }
    
    this.ctx.fillText(arrow, centerX, centerY);
    
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8);
  }

  getGridPosition(clientX: number, clientY: number): Position | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / this.cellSize);
    const y = Math.floor((clientY - rect.top) / this.cellSize);
    
    return { x, y };
  }

  setCellSize(size: number): void {
    this.cellSize = size;
  }

  getCellSize(): number {
    return this.cellSize;
  }
}
