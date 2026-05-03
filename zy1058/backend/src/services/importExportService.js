const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const { format } = require('date-fns');
const db = require('../config/database');

class ImportExportService {
  static importArtworksFromCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => {
          rowNumber++;
          try {
            const artwork = this.parseCSVRow(data, rowNumber);
            if (artwork) {
              results.push(artwork);
            }
          } catch (err) {
            errors.push({ row: rowNumber, error: err.message, data });
          }
        })
        .on('end', () => {
          resolve({
            success: results.length > 0,
            imported: results.length,
            errors: errors.length,
            errorDetails: errors,
            artworks: results
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  static parseCSVRow(data, rowNumber) {
    const artwork = {};

    if (!data.name && !data.作品名称) {
      throw new Error('缺少作品名称');
    }
    artwork.name = data.name || data.作品名称;

    if (data.customer_name || data.客户名称) {
      artwork.customer_name = data.customer_name || data.客户名称;
    }
    if (data.customer_phone || data.客户电话) {
      artwork.customer_phone = data.customer_phone || data.客户电话;
    }

    if (data.clay_name || data.泥料名称) {
      artwork.clay_name = data.clay_name || data.泥料名称;
    }

    if (data.glaze_name || data.釉料名称) {
      artwork.glaze_name = data.glaze_name || data.釉料名称;
    }
    if (data.glaze2_name || data.第二层釉料) {
      artwork.glaze2_name = data.glaze2_name || data.第二层釉料;
    }

    artwork.width = parseFloat(data.width || data.宽度) || null;
    artwork.height = parseFloat(data.height || data.高度) || null;
    artwork.depth = parseFloat(data.depth || data.深度) || null;
    artwork.weight = parseFloat(data.weight || data.重量) || null;

    if (data.delivery_date || data.交付日期) {
      artwork.delivery_date = data.delivery_date || data.交付日期;
    }

    if (data.notes || data.备注) {
      artwork.notes = data.notes || data.备注;
    }

    return artwork;
  }

  static saveImportedArtworks(artworks) {
    return new Promise((resolve, reject) => {
      const results = [];
      let processed = 0;

      artworks.forEach((artwork, index) => {
        this.findOrCreateCustomer(artwork.customer_name, artwork.customer_phone)
          .then(customerId => {
            return this.findOrCreateClay(artwork.clay_name)
              .then(clayId => ({ customerId, clayId }));
          })
          .then(({ customerId, clayId }) => {
            return this.findOrCreateGlaze(artwork.glaze_name)
              .then(glazeId => ({ customerId, clayId, glazeId }));
          })
          .then(({ customerId, clayId, glazeId }) => {
            return this.findOrCreateGlaze(artwork.glaze2_name)
              .then(glaze2Id => ({ customerId, clayId, glazeId, glaze2Id }));
          })
          .then(({ customerId, clayId, glazeId, glaze2Id }) => {
            const query = `
              INSERT INTO artworks (
                name, customer_id, clay_id, glaze_id, glaze2_id,
                width, height, depth, weight, delivery_date, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(query, [
              artwork.name,
              customerId,
              clayId,
              glazeId,
              glaze2Id,
              artwork.width,
              artwork.height,
              artwork.depth,
              artwork.weight,
              artwork.delivery_date,
              artwork.notes
            ], function(err) {
              processed++;
              if (err) {
                results.push({
                  index,
                  artwork: artwork.name,
                  success: false,
                  error: err.message
                });
              } else {
                results.push({
                  index,
                  artwork: artwork.name,
                  success: true,
                  id: this.lastID
                });
              }

              if (processed === artworks.length) {
                const successCount = results.filter(r => r.success).length;
                const errorCount = results.filter(r => !r.success).length;
                resolve({
                  success: successCount > 0,
                  total: artworks.length,
                  successCount,
                  errorCount,
                  details: results
                });
              }
            });
          })
          .catch(err => {
            processed++;
            results.push({
              index,
              artwork: artwork.name,
              success: false,
              error: err.message
            });

            if (processed === artworks.length) {
              const successCount = results.filter(r => r.success).length;
              const errorCount = results.filter(r => !r.success).length;
              resolve({
                success: successCount > 0,
                total: artworks.length,
                successCount,
                errorCount,
                details: results
              });
            }
          });
      });
    });
  }

  static findOrCreateCustomer(name, phone) {
    return new Promise((resolve, reject) => {
      if (!name) {
        resolve(null);
        return;
      }

      db.get('SELECT id FROM customers WHERE name = ?', [name], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve(row.id);
        } else {
          db.run('INSERT INTO customers (name, phone) VALUES (?, ?)', [name, phone], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.lastID);
          });
        }
      });
    });
  }

  static findOrCreateClay(name) {
    return new Promise((resolve, reject) => {
      if (!name) {
        resolve(null);
        return;
      }

      db.get('SELECT id FROM clays WHERE name = ?', [name], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve(row.id);
        } else {
          db.run('INSERT INTO clays (name) VALUES (?)', [name], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.lastID);
          });
        }
      });
    });
  }

  static findOrCreateGlaze(name) {
    return new Promise((resolve, reject) => {
      if (!name) {
        resolve(null);
        return;
      }

      db.get('SELECT id FROM glazes WHERE name = ?', [name], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve(row.id);
        } else {
          db.run('INSERT INTO glazes (name) VALUES (?)', [name], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(this.lastID);
          });
        }
      });
    });
  }

  static exportArtworksToCSV(artworks) {
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '作品名称', value: 'name' },
      { label: '客户名称', value: 'customer_name' },
      { label: '泥料名称', value: 'clay_name' },
      { label: '釉料名称', value: 'glaze_name' },
      { label: '第二层釉料', value: 'glaze2_name' },
      { label: '宽度(cm)', value: 'width' },
      { label: '高度(cm)', value: 'height' },
      { label: '深度(cm)', value: 'depth' },
      { label: '重量(kg)', value: 'weight' },
      { label: '交付日期', value: 'delivery_date' },
      { label: '状态', value: 'status_label' },
      { label: '备注', value: 'notes' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(artworks);
  }

  static exportArtworksToJSON(artworks) {
    return JSON.stringify(artworks, null, 2);
  }

  static generateFiringReport(taskId, format = 'markdown') {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ft.*,
          k.name as kiln_name, k.type as kiln_type, k.max_temperature,
          fc.name as curve_name, fc.type as curve_type, fc.cone, fc.max_temperature as curve_temp,
          GROUP_CONCAT(DISTINCT a.id) as artwork_ids
        FROM firing_tasks ft
        LEFT JOIN kilns k ON ft.kiln_id = k.id
        LEFT JOIN firing_curves fc ON ft.firing_curve_id = fc.id
        LEFT JOIN task_artworks ta ON ft.id = ta.task_id
        LEFT JOIN artworks a ON ta.artwork_id = a.id
        WHERE ft.id = ?
        GROUP BY ft.id
      `;

      db.get(query, [taskId], (err, task) => {
        if (err) {
          reject(err);
          return;
        }

        if (!task) {
          reject(new Error('烧窑任务不存在'));
          return;
        }

        const artworkIds = task.artwork_ids ? task.artwork_ids.split(',').map(Number) : [];

        const artworksQuery = `
          SELECT 
            a.*,
            c.name as customer_name, c.phone as customer_phone,
            cl.name as clay_name,
            g1.name as glaze_name,
            g2.name as glaze2_name,
            sh.name as shelf_name
          FROM artworks a
          LEFT JOIN customers c ON a.customer_id = c.id
          LEFT JOIN clays cl ON a.clay_id = cl.id
          LEFT JOIN glazes g1 ON a.glaze_id = g1.id
          LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
          LEFT JOIN task_artworks ta ON a.id = ta.artwork_id
          LEFT JOIN shelves sh ON ta.shelf_id = sh.id
          WHERE a.id IN (${artworkIds.map(() => '?').join(',')})
          ORDER BY sh.level, a.name
        `;

        db.all(artworksQuery, artworkIds, (err, artworks) => {
          if (err) {
            reject(err);
            return;
          }

          const shelvesQuery = 'SELECT * FROM shelves WHERE kiln_id = ? ORDER BY level';
          db.all(shelvesQuery, [task.kiln_id], (err, shelves) => {
            if (err) {
              reject(err);
              return;
            }

            const reportData = {
              task: {
                ...task,
                created_at_formatted: task.created_at ? format(new Date(task.created_at), 'yyyy-MM-dd HH:mm') : ''
              },
              artworks,
              shelves,
              generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
            };

            if (format === 'markdown') {
              resolve(this.generateMarkdownReport(reportData));
            } else {
              resolve(this.generateHTMLReport(reportData));
            }
          });
        });
      });
    });
  }

  static generateMarkdownReport(data) {
    const { task, artworks, shelves, generatedAt } = data;

    let markdown = `# 烧窑任务报告\n\n`;
    markdown += `**任务名称**: ${task.name}\n`;
    markdown += `**生成时间**: ${generatedAt}\n\n`;

    markdown += `## 一、烧窑任务信息\n\n`;
    markdown += `| 项目 | 内容 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 窑炉 | ${task.kiln_name || '未指定'} |\n`;
    markdown += `| 窑炉类型 | ${task.kiln_type || '-'} |\n`;
    markdown += `| 最高温度 | ${task.max_temperature ? task.max_temperature + '°C' : '-'} |\n`;
    markdown += `| 烧成曲线 | ${task.curve_name || '未指定'} |\n`;
    markdown += `| 曲线类型 | ${task.curve_type || '-'} |\n`;
    markdown += `| 锥号 | ${task.cone || '-'} |\n`;
    markdown += `| 任务状态 | ${task.status || 'planning'} |\n`;
    markdown += `| 创建时间 | ${task.created_at_formatted} |\n\n`;

    markdown += `## 二、作品清单 (${artworks.length}件)\n\n`;
    
    if (artworks.length > 0) {
      markdown += `| 序号 | 作品名称 | 客户 | 泥料 | 釉料 | 尺寸(cm) | 重量(kg) | 交付日期 | 层架 |\n`;
      markdown += `|------|----------|------|------|------|----------|----------|----------|------|\n`;
      
      artworks.forEach((artwork, index) => {
        const dimensions = [artwork.width, artwork.height, artwork.depth].filter(d => d).join('×') || '-';
        markdown += `| ${index + 1} | ${artwork.name} | ${artwork.customer_name || '-'} | ${artwork.clay_name || '-'} | ${artwork.glaze_name || '-'} | ${dimensions} | ${artwork.weight || '-'} | ${artwork.delivery_date || '-'} | ${artwork.shelf_name || '-'} |\n`;
      });
    } else {
      markdown += `暂无作品\n`;
    }
    markdown += `\n`;

    markdown += `## 三、层架配置\n\n`;
    if (shelves.length > 0) {
      markdown += `| 层架 | 层级 | 宽度(cm) | 高度(cm) | 深度(cm) | 最大承重(kg) |\n`;
      markdown += `|------|------|----------|----------|----------|--------------|\n`;
      
      shelves.forEach(shelf => {
        markdown += `| ${shelf.name} | ${shelf.level} | ${shelf.width || '-'} | ${shelf.height || '-'} | ${shelf.depth || '-'} | ${shelf.max_weight || '-'} |\n`;
      });
    } else {
      markdown += `暂无层架配置\n`;
    }
    markdown += `\n`;

    markdown += `## 四、风险提示与待确认事项\n\n`;
    markdown += `### ⚠️ 风险提示\n\n`;
    markdown += `- [ ] 确认所有作品的泥料和釉料温度匹配\n`;
    markdown += `- [ ] 确认没有不兼容的釉料混烧\n`;
    markdown += `- [ ] 确认所有作品尺寸不超过层架限制\n`;
    markdown += `- [ ] 检查交付日期临近的作品\n\n`;

    markdown += `### ✅ 待确认事项\n\n`;
    markdown += `- [ ] 窑炉预热检查\n`;
    markdown += `- [ ] 作品摆放确认\n`;
    markdown += `- [ ] 烧成曲线设置确认\n`;
    markdown += `- [ ] 安全防护检查\n\n`;

    markdown += `## 五、备注\n\n`;
    markdown += `${task.notes || '暂无备注'}\n\n`;

    markdown += `---\n`;
    markdown += `*报告由窑炉排烧系统自动生成 | ${generatedAt}*\n`;

    return markdown;
  }

  static generateHTMLReport(data) {
    const { task, artworks, shelves, generatedAt } = data;

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>烧窑任务报告 - ${task.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px; background: #f5f5f5; }
    .report-container { max-width: 900px; margin: 0 auto; background: white; padding: 60px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { font-size: 28px; color: #333; margin-bottom: 20px; border-bottom: 3px solid #4A90D9; padding-bottom: 15px; }
    h2 { font-size: 20px; color: #4A90D9; margin: 30px 0 15px; }
    h3 { font-size: 16px; color: #666; margin: 20px 0 10px; }
    .meta-info { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px; }
    .meta-info p { margin: 5px 0; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #4A90D9; color: white; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .risk-section { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .checklist { list-style: none; padding: 0; }
    .checklist li { padding: 8px 0; padding-left: 30px; position: relative; }
    .checklist li:before { content: '☐'; position: absolute; left: 0; color: #666; font-size: 18px; }
    .notes { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 14px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-planning { background: #e3f2fd; color: #1976d2; }
    .status-loading { background: #fff3e0; color: #f57c00; }
    .status-firing { background: #ffebee; color: #d32f2f; }
    .status-completed { background: #e8f5e9; color: #388e3c; }
  </style>
</head>
<body>
  <div class="report-container">
    <h1>烧窑任务报告</h1>
    
    <div class="meta-info">
      <p><strong>任务名称：</strong>${task.name}</p>
      <p><strong>生成时间：</strong>${generatedAt}</p>
    </div>

    <h2>一、烧窑任务信息</h2>
    <table>
      <tr><th>项目</th><th>内容</th></tr>
      <tr><td>窑炉</td><td>${task.kiln_name || '未指定'}</td></tr>
      <tr><td>窑炉类型</td><td>${task.kiln_type || '-'}</td></tr>
      <tr><td>最高温度</td><td>${task.max_temperature ? task.max_temperature + '°C' : '-'}</td></tr>
      <tr><td>烧成曲线</td><td>${task.curve_name || '未指定'}</td></tr>
      <tr><td>曲线类型</td><td>${task.curve_type || '-'}</td></tr>
      <tr><td>锥号</td><td>${task.cone || '-'}</td></tr>
      <tr><td>任务状态</td><td><span class="status-badge status-${task.status || 'planning'}">${task.status || 'planning'}</span></td></tr>
      <tr><td>创建时间</td><td>${task.created_at_formatted || '-'}</td></tr>
    </table>

    <h2>二、作品清单 (${artworks.length}件)</h2>`;

    if (artworks.length > 0) {
      html += `
    <table>
      <tr>
        <th>序号</th>
        <th>作品名称</th>
        <th>客户</th>
        <th>泥料</th>
        <th>釉料</th>
        <th>尺寸(cm)</th>
        <th>重量(kg)</th>
        <th>交付日期</th>
        <th>层架</th>
      </tr>`;
      
      artworks.forEach((artwork, index) => {
        const dimensions = [artwork.width, artwork.height, artwork.depth].filter(d => d).join('×') || '-';
        html += `
      <tr>
        <td>${index + 1}</td>
        <td>${artwork.name}</td>
        <td>${artwork.customer_name || '-'}</td>
        <td>${artwork.clay_name || '-'}</td>
        <td>${artwork.glaze_name || '-'}</td>
        <td>${dimensions}</td>
        <td>${artwork.weight || '-'}</td>
        <td>${artwork.delivery_date || '-'}</td>
        <td>${artwork.shelf_name || '-'}</td>
      </tr>`;
      });
      html += `
    </table>`;
    } else {
      html += `<p style="color: #666; padding: 20px;">暂无作品</p>`;
    }

    html += `

    <h2>三、层架配置</h2>`;
    
    if (shelves.length > 0) {
      html += `
    <table>
      <tr>
        <th>层架</th>
        <th>层级</th>
        <th>宽度(cm)</th>
        <th>高度(cm)</th>
        <th>深度(cm)</th>
        <th>最大承重(kg)</th>
      </tr>`;
      
      shelves.forEach(shelf => {
        html += `
      <tr>
        <td>${shelf.name}</td>
        <td>${shelf.level}</td>
        <td>${shelf.width || '-'}</td>
        <td>${shelf.height || '-'}</td>
        <td>${shelf.depth || '-'}</td>
        <td>${shelf.max_weight || '-'}</td>
      </tr>`;
      });
      html += `
    </table>`;
    } else {
      html += `<p style="color: #666; padding: 20px;">暂无层架配置</p>`;
    }

    html += `

    <h2>四、风险提示与待确认事项</h2>
    
    <div class="risk-section">
      <h3>⚠️ 风险提示</h3>
      <ul class="checklist">
        <li>确认所有作品的泥料和釉料温度匹配</li>
        <li>确认没有不兼容的釉料混烧</li>
        <li>确认所有作品尺寸不超过层架限制</li>
        <li>检查交付日期临近的作品</li>
      </ul>
    </div>

    <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <h3>✅ 待确认事项</h3>
      <ul class="checklist">
        <li>窑炉预热检查</li>
        <li>作品摆放确认</li>
        <li>烧成曲线设置确认</li>
        <li>安全防护检查</li>
      </ul>
    </div>

    <h2>五、备注</h2>
    <div class="notes">
      ${task.notes || '<p style="color: #999;">暂无备注</p>'}
    </div>

    <div class="footer">
      报告由窑炉排烧系统自动生成 | ${generatedAt}
    </div>
  </div>
</body>
</html>`;

    return html;
  }
}

module.exports = ImportExportService;
