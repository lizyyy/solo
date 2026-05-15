const chalk = require('chalk');
const Table = require('cli-table3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class BusReservationManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.reservationsFile = path.join(this.dataDir, 'bus-reservations.json');
    this.ensureDataDir();
    this.reservations = this.loadReservations();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadReservations() {
    if (fs.existsSync(this.reservationsFile)) {
      return JSON.parse(fs.readFileSync(this.reservationsFile, 'utf8'));
    }
    return this.getDemoReservations();
  }

  saveReservations() {
    fs.writeFileSync(this.reservationsFile, JSON.stringify(this.reservations, null, 2));
  }

  getDemoReservations() {
    return [
      {
        id: uuidv4(),
        originalLineNumber: 1,
        name: '张三',
        department: '技术部',
        route: '线路A-科技园',
        date: '2024-06-15',
        phone: '13800138001',
        manualRemark: '需要靠窗座位，晕车',
        importedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        originalLineNumber: 2,
        name: '李四',
        department: '产品部',
        route: '线路B-市中心',
        date: '2024-06-15',
        phone: '13800138002',
        manualRemark: '携带大件行李，需要额外空间',
        importedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        originalLineNumber: 3,
        name: '王五',
        department: '市场部',
        route: '线路A-科技园',
        date: '2024-06-15',
        phone: '13800138003',
        manualRemark: null,
        importedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        originalLineNumber: 4,
        name: '赵六',
        department: '人力资源',
        route: '线路C-郊区',
        date: '2024-06-15',
        phone: '13800138004',
        manualRemark: '孕妇，需要前排座位',
        importedAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        originalLineNumber: 5,
        name: '钱七',
        department: '财务部',
        route: '线路B-市中心',
        date: '2024-06-15',
        phone: '13800138005',
        manualRemark: '临时调整，只坐单程',
        importedAt: new Date().toISOString()
      }
    ];
  }

  importReservations(filePath) {
    if (!filePath) {
      this.reservations = this.getDemoReservations();
      this.saveReservations();
      return {
        success: true,
        count: this.reservations.length,
        message: '已加载演示班车预约数据'
      };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const reservation = {
          id: uuidv4(),
          originalLineNumber: i,
          importedAt: new Date().toISOString()
        };
        
        headers.forEach((header, idx) => {
          reservation[header] = values[idx] || null;
        });
        
        imported.push(reservation);
      }

      this.reservations = imported;
      this.saveReservations();

      return {
        success: true,
        count: imported.length,
        message: `成功导入 ${imported.length} 条预约记录`
      };
    } catch (error) {
      return {
        success: false,
        message: `导入失败: ${error.message}`
      };
    }
  }

  queryByLineNumber(lineNumber) {
    const num = parseInt(lineNumber, 10);
    return this.reservations.find(r => r.originalLineNumber === num) || null;
  }

  printResult(result) {
    if (!result.success) {
      console.log(chalk.red('❌ 操作失败:'), result.message);
      return;
    }

    console.log(chalk.green(`✅ ${result.message}\n`));
    console.log(chalk.blue('数据已保存，可使用 bus-query 命令按行号查询'));
  }

  printRecord(record) {
    if (!record) {
      console.log(chalk.yellow('⚠️  未找到对应行号的记录'));
      return;
    }

    console.log(chalk.green(`✅ 找到原始行号 ${record.originalLineNumber} 的记录\n`));

    const table = new Table({
      head: ['字段', '值'],
      colWidths: [20, 50]
    });

    Object.entries(record).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'importedAt') {
        let displayValue = value || '-';
        if (key === 'manualRemark' && value) {
          displayValue = chalk.yellow(displayValue);
        }
        if (key === 'originalLineNumber') {
          displayValue = chalk.blue(displayValue);
        }
        table.push([key, displayValue]);
      }
    });

    console.log(table.toString());

    if (record.manualRemark) {
      console.log(chalk.yellow('\n📝 人工备注已入库，请注意特殊处理'));
    }
  }
}

module.exports = BusReservationManager;
