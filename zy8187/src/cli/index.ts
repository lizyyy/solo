#!/usr/bin/env node
import { Command } from 'commander';
import { validateTemplates, renderReceipts, exportIssues } from '../core';
import { readYamlFile, readJsonlFile, readCsvFile } from '../readers';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('receipt-validator')
  .description('热敏小票模板预检 CLI 工具')
  .version('1.0.0');

program
  .command('validate')
  .description('验证小票模板')
  .option('-t, --templates <path>', '模板文件路径', 'samples/receipt_templates.yaml')
  .option('-d, --data <path>', '交易数据文件路径', 'samples/transactions.jsonl')
  .option('-p, --printers <path>', '打印机配置文件路径', 'samples/printer_profiles.csv')
  .option('-o, --output <path>', '问题报告输出路径', 'issues.csv')
  .action(async (options) => {
    try {
      const templatesPath = path.resolve(process.cwd(), options.templates);
      const dataPath = path.resolve(process.cwd(), options.data);
      const printersPath = path.resolve(process.cwd(), options.printers);
      const outputPath = path.resolve(process.cwd(), options.output);

      console.log('正在读取模板文件...');
      const templates = await readYamlFile(templatesPath);
      console.log(`已加载 ${templates.length} 个模板`);

      console.log('正在读取交易数据...');
      const transactions = await readJsonlFile(dataPath);
      console.log(`已加载 ${transactions.length} 条交易记录`);

      console.log('正在读取打印机配置...');
      const printers = await readCsvFile(printersPath);
      console.log(`已加载 ${printers.length} 个打印机配置`);

      console.log('开始验证...');
      const issues = validateTemplates(templates, transactions, printers);

      console.log(`验证完成，共发现 ${issues.length} 个问题`);
      
      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;
      const infoCount = issues.filter(i => i.severity === 'info').length;
      
      console.log(`  - 错误: ${errorCount}`);
      console.log(`  - 警告: ${warningCount}`);
      console.log(`  - 信息: ${infoCount}`);

      if (issues.length > 0) {
        await exportIssues(issues, outputPath);
        console.log(`问题报告已导出到: ${outputPath}`);
      }

      process.exit(errorCount > 0 ? 1 : 0);
    } catch (error) {
      console.error('验证失败:', error);
      process.exit(1);
    }
  });

program
  .command('render')
  .description('渲染小票预览')
  .option('-t, --templates <path>', '模板文件路径', 'samples/receipt_templates.yaml')
  .option('-d, --data <path>', '交易数据文件路径', 'samples/transactions.jsonl')
  .option('-p, --printers <path>', '打印机配置文件路径', 'samples/printer_profiles.csv')
  .option('-o, --output <path>', 'HTML 输出目录', 'output')
  .option('-c, --count <number>', '渲染的样例数量', '3')
  .action(async (options) => {
    try {
      const templatesPath = path.resolve(process.cwd(), options.templates);
      const dataPath = path.resolve(process.cwd(), options.data);
      const printersPath = path.resolve(process.cwd(), options.printers);
      const outputDir = path.resolve(process.cwd(), options.output);
      const count = parseInt(options.count, 10);

      console.log('正在读取模板文件...');
      const templates = await readYamlFile(templatesPath);
      console.log(`已加载 ${templates.length} 个模板`);

      console.log('正在读取交易数据...');
      const transactions = await readJsonlFile(dataPath);
      console.log(`已加载 ${transactions.length} 条交易记录`);

      console.log('正在读取打印机配置...');
      const printers = await readCsvFile(printersPath);
      console.log(`已加载 ${printers.length} 个打印机配置`);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      console.log('开始渲染小票...');
      const sampleTransactions = transactions.slice(0, count);
      
      for (const template of templates) {
        const receipts = renderReceipts(template, sampleTransactions, printers);
        
        for (const receipt of receipts) {
          const htmlContent = generateHtml(receipt);
          const fileName = `${template.name}_${receipt.transactionId}.html`;
          const filePath = path.join(outputDir, fileName);
          
          fs.writeFileSync(filePath, htmlContent, 'utf-8');
          console.log(`已生成: ${filePath}`);
        }
      }

      console.log(`渲染完成，共生成 ${templates.length * sampleTransactions.length} 个预览文件`);
      console.log(`输出目录: ${outputDir}`);
    } catch (error) {
      console.error('渲染失败:', error);
      process.exit(1);
    }
  });

function generateHtml(receipt: any): string {
  const widthMm = receipt.width === '58mm' ? '58mm' : '80mm';
  const fontSize = receipt.width === '58mm' ? '12px' : '14px';
  const fontFamily = 'Consolas, Monaco, monospace';
  
  let linesHtml = '';
  for (const line of receipt.lines) {
    let lineClass = 'line';
    if (line.type === 'separator') {
      lineClass += ' separator';
    } else if (line.type === 'barcode') {
      lineClass += ' barcode';
    } else if (line.type === 'qrcode') {
      lineClass += ' qrcode';
    } else if (line.type === 'space') {
      lineClass += ' space';
    }

    const alignStyle = line.align === 'center' ? 'text-align: center;' : 
                       line.align === 'right' ? 'text-align: right;' : '';

    let lineContent = line.content;
    if (line.type === 'separator') {
      lineContent = line.content || '-'.repeat(line.width);
    } else if (line.type === 'barcode') {
      lineContent = `[条码: ${line.content || '条形码'}]`;
    } else if (line.type === 'qrcode') {
      lineContent = `[二维码: ${line.content || 'QR Code'}]`;
    } else if (line.type === 'space') {
      lineContent = ' ';
    }

    linesHtml += `<div class="${lineClass}" style="${alignStyle}">${escapeHtml(lineContent)}</div>\n`;
  }

  const commandsHtml = receipt.commands.map((cmd: any) => 
    `<div class="command ${cmd.supported ? 'supported' : 'unsupported'}">
      [${cmd.type}] - ${cmd.supported ? '支持' : '不支持'} (${cmd.printerModel})
    </div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>小票预览 - ${receipt.templateName} - ${receipt.transactionId}</title>
  <style>
    body {
      font-family: ${fontFamily};
      background-color: #f5f5f5;
      padding: 20px;
      margin: 0;
    }
    .receipt-container {
      background-color: white;
      width: ${widthMm};
      margin: 0 auto;
      padding: 10mm;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      font-size: ${fontSize};
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .line {
      margin: 0;
      padding: 0;
    }
    .separator {
      border-bottom: 1px dashed #333;
      margin: 4px 0;
    }
    .barcode, .qrcode {
      background-color: #eee;
      padding: 10px;
      text-align: center;
      margin: 8px 0;
      font-size: 10px;
      color: #666;
    }
    .space {
      height: 1em;
    }
    .commands {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px solid #ddd;
    }
    .command {
      font-size: 11px;
      color: #666;
      margin: 2px 0;
    }
    .command.supported {
      color: #2e7d32;
    }
    .command.unsupported {
      color: #c62828;
    }
    .header-info {
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
      font-size: 11px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header-info">
      模板: ${receipt.templateName}<br>
      交易ID: ${receipt.transactionId}<br>
      宽度: ${receipt.width}
    </div>
    ${linesHtml}
    <div class="commands">
      ${commandsHtml}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

program.parse(process.argv);