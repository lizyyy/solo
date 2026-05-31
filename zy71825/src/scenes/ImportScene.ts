import Phaser from 'phaser';
import { ImportService } from '../services/ImportService';
import { ErrorService } from '../services/ErrorService';
import { StorageService } from '../services/StorageService';

export class ImportScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ImportScene' });
  }

  create(): void {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 50, '📥 导入关卡草表', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 90, '支持 CSV / JSON 格式导入', {
      fontSize: '14px',
      color: '#a7d129'
    }).setOrigin(0.5);

    this.add.text(200, 140, '下载导入模板：', {
      fontSize: '16px',
      color: '#ffffff'
    });

    const templateBtn = this.add.text(350, 140, '📄 关卡模板.csv', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      padding: { x: 12, y: 6 }
    }).setInteractive({ useHandCursor: true });

    templateBtn.on('pointerdown', () => {
      ImportService.downloadTemplate('levels');
      ErrorService.showToast('模板已下载！', 'success');
    });

    this.add.text(200, 190, '选择要导入的文件：', {
      fontSize: '16px',
      color: '#ffffff'
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.json';
    fileInput.style.cssText = 'position:absolute;top:210px;left:200px;opacity:0;z-index:100;cursor:pointer;';
    fileInput.multiple = false;
    document.body.appendChild(fileInput);

    const fileBtn = this.add.text(400, 220, '📂 点击选择文件', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#4a7c59',
      padding: { x: 30, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    fileBtn.on('pointerdown', () => fileInput.click());

    const resultText = this.add.text(400, 320, '', {
      fontSize: '14px',
      color: '#fbbf24'
    }).setOrigin(0.5);

    const errorList = this.add.text(200, 360, '', {
      fontSize: '12px',
      color: '#f87171',
      align: 'left',
      wordWrap: { width: 400 }
    });

    fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        fileBtn.setText(`✅ 已选: ${file.name}`);
        
        let result;
        if (file.name.endsWith('.csv')) {
          result = ImportService.importLevelsFromCSV(content);
        } else if (file.name.endsWith('.json')) {
          result = ImportService.importLevelsFromJSON(content);
        } else {
          ErrorService.showToast('不支持的文件格式', 'error');
          return;
        }

        resultText.setText(result.message);
        
        if (result.errors.length > 0) {
          const errorMsg = result.errors.slice(0, 5).map(e => 
            `第${e.row}行 - ${e.field}: ${e.message}`
          ).join('\n');
          errorList.setText('❌ 错误详情:\n' + errorMsg);
          ErrorService.showToast(result.success ? '部分导入成功' : '导入失败', result.success ? 'warning' : 'error');
        } else {
          errorList.setText('');
          ErrorService.showToast('导入成功！', 'success');
        }

        this.updateLevelList();
      };
      reader.readAsText(file);
    });

    this.add.text(200, 450, '📋 已导入的关卡:', {
      fontSize: '16px',
      color: '#ffffff'
    });

    this.updateLevelList();

    const backBtn = this.add.text(100, 550, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      fileInput.remove();
      this.scene.start('MainScene');
    });

    this.events.on('shutdown', () => {
      fileInput.remove();
    });
  }

  private updateLevelList(): void {
    const levels = StorageService.getLevels();
    const levelList = this.add.text(200, 480, '', {
      fontSize: '12px',
      color: '#d1d5db',
      align: 'left',
      wordWrap: { width: 500 }
    });

    if (levels.length === 0) {
      levelList.setText('（暂无关卡数据，请先导入）');
    } else {
      const listText = levels.slice(0, 5).map(l => 
        `  • ${l.name} - ${l.expectedReward} x${l.rewardAmount}`
      ).join('\n') + (levels.length > 5 ? `\n  ...还有 ${levels.length - 5} 个关卡` : '');
      levelList.setText(listText);
    }
  }
}
