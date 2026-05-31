import Phaser from 'phaser';
import { BattleReport, Unit, FACTION_LABELS, TYPE_LABELS } from '../types';
import { subscribe, getState } from '../store/gameStore';

const GRID_COLS = 12;
const GRID_ROWS = 8;
const CELL_SIZE = 64;

const FACTION_COLORS: Record<string, number> = {
  steam: 0xe94560,
  gear: 0x533483,
  clockwork: 0xf39c12,
};

const TYPE_SHAPES: Record<string, string> = {
  melee: '◆',
  ranged: '▲',
  support: '●',
  heavy: '■',
};

export class BoardScene extends Phaser.Scene {
  private gridGroup!: Phaser.GameObjects.Group;
  private unitGroup!: Phaser.GameObjects.Group;
  private orderLabels: Phaser.GameObjects.Text[] = [];
  private reportId: string | null = null;

  constructor() {
    super({ key: 'BoardScene' });
  }

  create(): void {
    this.gridGroup = this.add.group();
    this.unitGroup = this.add.group();

    this.drawGrid();
    this.drawUnits(getState().currentReport);

    subscribe(() => {
      const report = getState().currentReport;
      this.drawUnits(report);
    });
  }

  private getOrigin(): { ox: number; oy: number } {
    const { width, height } = this.cameras.main;
    const boardW = GRID_COLS * CELL_SIZE;
    const boardH = GRID_ROWS * CELL_SIZE;
    return {
      ox: (width - boardW) / 2,
      oy: (height - boardH) / 2,
    };
  }

  private drawGrid(): void {
    this.gridGroup.clear(true, true);
    const { ox, oy } = this.getOrigin();

    const bg = this.add.graphics();
    bg.fillStyle(0x0f3460, 0.3);
    bg.fillRect(ox, oy, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);

    const lines = this.add.graphics();
    lines.lineStyle(1, 0x533483, 0.4);

    for (let c = 0; c <= GRID_COLS; c++) {
      lines.lineBetween(ox + c * CELL_SIZE, oy, ox + c * CELL_SIZE, oy + GRID_ROWS * CELL_SIZE);
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      lines.lineBetween(ox, oy + r * CELL_SIZE, ox + GRID_COLS * CELL_SIZE, oy + r * CELL_SIZE);
    }

    for (let r = 0; r < GRID_ROWS; r++) {
      const label = this.add.text(ox - 20, oy + r * CELL_SIZE + CELL_SIZE / 2, String(r), {
        fontSize: '10px',
        color: '#a0a0c0',
      });
      label.setOrigin(0.5);
      this.gridGroup.add(label);
    }
    for (let c = 0; c < GRID_COLS; c++) {
      const label = this.add.text(ox + c * CELL_SIZE + CELL_SIZE / 2, oy - 12, String(c), {
        fontSize: '10px',
        color: '#a0a0c0',
      });
      label.setOrigin(0.5);
      this.gridGroup.add(label);
    }

    this.gridGroup.add(bg);
    this.gridGroup.add(lines);
  }

  private drawUnits(report: BattleReport | null): void {
    this.unitGroup.clear(true, true);
    this.orderLabels.forEach(l => l.destroy());
    this.orderLabels = [];

    if (!report) {
      this.reportId = null;
      const { width, height } = this.cameras.main;
      const empty = this.add.text(width / 2, height / 2, '暂无战报\n请在右侧面板导入数据', {
        fontSize: '16px',
        color: '#a0a0c0',
        align: 'center',
      });
      empty.setOrigin(0.5);
      this.unitGroup.add(empty);
      return;
    }

    this.reportId = report.id;
    const { ox, oy } = this.getOrigin();

    const orderMap = new Map<string, number>();
    report.turnOrder.entries.forEach(e => {
      orderMap.set(e.unitId, e.order);
    });

    report.units.forEach(unit => {
      const cx = ox + unit.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = oy + unit.y * CELL_SIZE + CELL_SIZE / 2;
      const color = FACTION_COLORS[unit.faction] || 0xe94560;

      const circle = this.add.circle(cx, cy, CELL_SIZE * 0.35, color, 0.7);
      circle.setStrokeStyle(2, 0xffffff, 0.5);
      this.unitGroup.add(circle);

      const shape = TYPE_SHAPES[unit.type] || '?';
      const icon = this.add.text(cx, cy - 6, shape, {
        fontSize: '18px',
        color: '#ffffff',
      });
      icon.setOrigin(0.5);
      this.unitGroup.add(icon);

      const nameText = this.add.text(cx, cy + 12, unit.name, {
        fontSize: '9px',
        color: '#ffffff',
      });
      nameText.setOrigin(0.5);
      this.unitGroup.add(nameText);

      const order = orderMap.get(unit.id);
      if (order !== undefined) {
        const orderBg = this.add.circle(cx + CELL_SIZE * 0.35, cy - CELL_SIZE * 0.35, 10, 0xe94560, 1);
        this.unitGroup.add(orderBg);
        const orderText = this.add.text(cx + CELL_SIZE * 0.35, cy - CELL_SIZE * 0.35, String(order), {
          fontSize: '11px',
          color: '#ffffff',
          fontStyle: 'bold',
        });
        orderText.setOrigin(0.5);
        this.orderLabels.push(orderText);
      }
    });

    const titleText = this.add.text(ox, oy - 28, `${report.scenarioName}`, {
      fontSize: '14px',
      color: '#e94560',
      fontStyle: 'bold',
    });
    this.unitGroup.add(titleText);

    const legendY = oy + GRID_ROWS * CELL_SIZE + 16;
    const factions = Object.entries(FACTION_LABELS);
    factions.forEach(([key, label], i) => {
      const lx = ox + i * 100;
      const dot = this.add.circle(lx, legendY, 5, FACTION_COLORS[key] || 0xffffff, 1);
      const text = this.add.text(lx + 10, legendY, label, {
        fontSize: '11px',
        color: '#a0a0c0',
      });
      text.setOrigin(0, 0.5);
      this.unitGroup.add(dot);
      this.unitGroup.add(text);
    });
  }

  update(): void {
  }
}
