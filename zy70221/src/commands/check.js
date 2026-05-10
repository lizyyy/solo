const chalk = require('chalk');
const Table = require('cli-table');
const { getDb, databaseExists } = require('../database');
const { EXPIRY_THRESHOLD_DAYS, CRITICAL_EXPIRY_DAYS } = require('../config');

function getDaysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function checkInventoryEffectiveness(db, locationId = null) {
  const issues = [];
  const passed = [];

  let whereClause = '';
  const params = [];
  if (locationId) {
    whereClause = 'WHERE l.id = ?';
    params.push(locationId);
  }

  const query = `
    SELECT 
      l.id as location_id,
      l.name as location_name,
      p.id as product_id,
      p.name as product_name,
      SUM(i.quantity) as total_quantity
    FROM locations l
    CROSS JOIN products p
    LEFT JOIN inventory i ON l.id = i.location_id AND p.id = i.product_id
    ${whereClause}
    GROUP BY l.id, p.id
    HAVING total_quantity IS NULL OR total_quantity = 0
  `;

  const missingInventory = db.prepare(query).all(...params);

  if (missingInventory.length === 0) {
    passed.push({
      type: 'inventory_complete',
      message: '所有点位的商品库存配置完整'
    });
  } else {
    missingInventory.forEach(item => {
      issues.push({
        issue_type: 'missing_inventory',
        severity: 'warning',
        location_id: item.location_id,
        product_id: item.product_id,
        message: `点位 ${item.location_name} 缺少商品 ${item.product_name} 的库存记录`,
        details: JSON.stringify({ location: item.location_name, product: item.product_name })
      });
    });
  }

  const zeroQtyQuery = `
    SELECT 
      l.id as location_id,
      l.name as location_name,
      p.id as product_id,
      p.name as product_name,
      i.batch_number,
      i.quantity,
      i.expiry_date
    FROM inventory i
    JOIN locations l ON i.location_id = l.id
    JOIN products p ON i.product_id = p.id
    ${locationId ? 'WHERE l.id = ?' : ''}
  `;

  const zeroQtyParams = locationId ? [locationId] : [];
  const inventoryItems = db.prepare(zeroQtyQuery).all(...zeroQtyParams);

  inventoryItems.forEach(item => {
    if (item.quantity <= 0) {
      issues.push({
        issue_type: 'zero_quantity',
        severity: 'info',
        location_id: item.location_id,
        product_id: item.product_id,
        batch_number: item.batch_number,
        message: `点位 ${item.location_name} 的 ${item.product_name} 库存为0`,
        details: JSON.stringify({ batch: item.batch_number, expiry: item.expiry_date })
      });
    }
  });

  return { issues, passed };
}

function checkExpiryScans(db, locationId = null) {
  const issues = [];
  const passed = [];
  const today = getToday();

  let whereClause = '';
  const params = [];
  if (locationId) {
    whereClause = 'AND l.id = ?';
    params.push(locationId);
  }

  const inventoryQuery = `
    SELECT 
      i.location_id,
      l.name as location_name,
      i.product_id,
      p.name as product_name,
      i.batch_number,
      i.expiry_date,
      i.quantity
    FROM inventory i
    JOIN locations l ON i.location_id = l.id
    JOIN products p ON i.product_id = p.id
    WHERE i.quantity > 0
    ${whereClause}
  `;

  const inventoryItems = db.prepare(inventoryQuery).all(...params);

  inventoryItems.forEach(inv => {
    const daysUntilExpiry = getDaysBetween(today, inv.expiry_date);
    
    if (daysUntilExpiry <= EXPIRY_THRESHOLD_DAYS) {
      const scanQuery = `
        SELECT * FROM expiry_scans 
        WHERE location_id = ? 
          AND product_id = ? 
          AND (batch_number = ? OR batch_number IS NULL)
        ORDER BY scan_date DESC
        LIMIT 1
      `;

      const latestScan = db.prepare(scanQuery).get(
        inv.location_id, 
        inv.product_id, 
        inv.batch_number || null
      );

      if (!latestScan) {
        issues.push({
          issue_type: 'missing_expiry_scan',
          severity: daysUntilExpiry <= CRITICAL_EXPIRY_DAYS ? 'critical' : 'warning',
          location_id: inv.location_id,
          product_id: inv.product_id,
          batch_number: inv.batch_number,
          message: `临期商品缺少效期扫描: ${inv.location_name} - ${inv.product_name} (${daysUntilExpiry}天后过期)`,
          details: JSON.stringify({ 
            expiry_date: inv.expiry_date, 
            days_until_expiry: daysUntilExpiry,
            quantity: inv.quantity
          })
        });
      } else {
        const daysSinceScan = getDaysBetween(latestScan.scan_date, today);
        
        if (latestScan.expiry_date !== inv.expiry_date) {
          issues.push({
            issue_type: 'expiry_date_mismatch',
            severity: 'warning',
            location_id: inv.location_id,
            product_id: inv.product_id,
            batch_number: inv.batch_number,
            message: `效期日期不一致: ${inv.location_name} - ${inv.product_name}`,
            details: JSON.stringify({
              inventory_expiry: inv.expiry_date,
              scanned_expiry: latestScan.expiry_date
            })
          });
        }

        if (daysSinceScan > 2) {
          issues.push({
            issue_type: 'expiry_scan_stale',
            severity: 'info',
            location_id: inv.location_id,
            product_id: inv.product_id,
            batch_number: inv.batch_number,
            message: `效期扫描数据过时: ${inv.location_name} - ${inv.product_name} (${daysSinceScan}天前扫描)`,
            details: JSON.stringify({ last_scan: latestScan.scan_date })
          });
        }
      }
    }
  });

  const noIssues = issues.filter(i => 
    i.issue_type !== 'expiry_scan_stale' && i.severity !== 'info'
  ).length === 0;

  if (noIssues && inventoryItems.length > 0) {
    passed.push({
      type: 'expiry_scans_current',
      message: '所有临期商品的效期扫描数据完整且最新'
    });
  }

  return { issues, passed };
}

function generateTransferSuggestions(db, locationId = null) {
  const issues = [];
  const suggestions = [];
  const today = getToday();

  let whereClause = '';
  const params = [];
  if (locationId) {
    whereClause = 'AND l.id = ?';
    params.push(locationId);
  }

  const expiringQuery = `
    SELECT 
      i.location_id,
      l.name as location_name,
      i.product_id,
      p.name as product_name,
      p.price as original_price,
      i.batch_number,
      i.expiry_date,
      i.quantity
    FROM inventory i
    JOIN locations l ON i.location_id = l.id
    JOIN products p ON i.product_id = p.id
    WHERE i.quantity > 0
    ${whereClause}
  `;

  const expiringItems = db.prepare(expiringQuery).all(...params);

  expiringItems.forEach(sourceItem => {
    const daysUntilExpiry = getDaysBetween(today, sourceItem.expiry_date);
    
    if (daysUntilExpiry <= EXPIRY_THRESHOLD_DAYS && daysUntilExpiry > 0) {
      if (daysUntilExpiry <= CRITICAL_EXPIRY_DAYS) {
        const discountedPrice = sourceItem.original_price * 0.5;
        suggestions.push({
          from_location_id: sourceItem.location_id,
          to_location_id: null,
          product_id: sourceItem.product_id,
          batch_number: sourceItem.batch_number,
          expiry_date: sourceItem.expiry_date,
          quantity: sourceItem.quantity,
          suggested_action: 'price_reduction',
          suggested_price: discountedPrice,
          reason: `临期商品建议降价 (${daysUntilExpiry}天后过期, 5折优惠)`,
          status: 'pending'
        });

        issues.push({
          issue_type: 'critical_expiry_price_reduction',
          severity: 'critical',
          location_id: sourceItem.location_id,
          product_id: sourceItem.product_id,
          batch_number: sourceItem.batch_number,
          message: `需要紧急降价: ${sourceItem.location_name} - ${sourceItem.product_name} (${daysUntilExpiry}天后过期)`,
          details: JSON.stringify({
            original_price: sourceItem.original_price,
            suggested_price: discountedPrice,
            quantity: sourceItem.quantity
          })
        });
      } else {
        const targetQuery = `
          SELECT 
            l.id as location_id,
            l.name as location_name,
            COALESCE(SUM(i2.quantity), 0) as current_quantity
          FROM locations l
          LEFT JOIN inventory i2 ON l.id = i2.location_id 
            AND i2.product_id = ?
            AND i2.expiry_date > date('now', '+14 days')
            AND i2.quantity > 0
          WHERE l.id != ?
          GROUP BY l.id
          HAVING current_quantity < 10
          ORDER BY current_quantity ASC
          LIMIT 1
        `;

        const targetLocation = db.prepare(targetQuery).get(
          sourceItem.product_id,
          sourceItem.location_id
        );

        if (targetLocation) {
          const transferQty = Math.min(sourceItem.quantity, 10 - targetLocation.current_quantity);
          
          if (transferQty > 0) {
            suggestions.push({
              from_location_id: sourceItem.location_id,
              to_location_id: targetLocation.location_id,
              product_id: sourceItem.product_id,
              batch_number: sourceItem.batch_number,
              expiry_date: sourceItem.expiry_date,
              quantity: transferQty,
              suggested_action: 'transfer',
              suggested_price: null,
              reason: `建议调拨到库存较低的点位 (目标: ${targetLocation.location_name})`,
              status: 'pending'
            });

            issues.push({
              issue_type: 'transfer_suggested',
              severity: 'warning',
              location_id: sourceItem.location_id,
              product_id: sourceItem.product_id,
              batch_number: sourceItem.batch_number,
              message: `建议调拨: ${sourceItem.location_name} → ${targetLocation.location_name} - ${sourceItem.product_name}`,
              details: JSON.stringify({
                source_quantity: sourceItem.quantity,
                target_quantity: targetLocation.current_quantity,
                transfer_quantity: transferQty,
                days_until_expiry: daysUntilExpiry
              })
            });
          }
        }
      }
    }

    if (daysUntilExpiry <= 0) {
      issues.push({
        issue_type: 'expired_product',
        severity: 'critical',
        location_id: sourceItem.location_id,
        product_id: sourceItem.product_id,
        batch_number: sourceItem.batch_number,
        message: `商品已过期: ${sourceItem.location_name} - ${sourceItem.product_name}`,
        details: JSON.stringify({
          expiry_date: sourceItem.expiry_date,
          quantity: sourceItem.quantity,
          days_overdue: Math.abs(daysUntilExpiry)
        })
      });
    }
  });

  return { issues, suggestions };
}

function verifySuggestionsMatchOriginalData(db, suggestions) {
  const mismatches = [];

  suggestions.forEach(suggestion => {
    const inventoryQuery = `
      SELECT quantity, expiry_date FROM inventory 
      WHERE location_id = ? 
        AND product_id = ? 
        AND (batch_number = ? OR batch_number IS NULL)
        AND expiry_date = ?
    `;

    const inventory = db.prepare(inventoryQuery).get(
      suggestion.from_location_id,
      suggestion.product_id,
      suggestion.batch_number || null,
      suggestion.expiry_date
    );

    if (!inventory) {
      mismatches.push({
        suggestion_id: suggestion.id,
        issue: '原始库存记录不存在'
      });
    } else if (inventory.quantity < suggestion.quantity) {
      mismatches.push({
        suggestion_id: suggestion.id,
        issue: `库存不足: 建议调拨${suggestion.quantity}，实际只有${inventory.quantity}`
      });
    } else if (inventory.expiry_date !== suggestion.expiry_date) {
      mismatches.push({
        suggestion_id: suggestion.id,
        issue: `效期日期不一致: 建议${suggestion.expiry_date}，实际${inventory.expiry_date}`
      });
    }
  });

  return mismatches;
}

function displayResults(results, verbose) {
  const { stats, issues, passed, suggestions } = results;

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan('              检查结果汇总'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════\n'));

  const summaryTable = new Table({
    head: [chalk.cyan('指标'), chalk.cyan('数值')],
    colWidths: [30, 20]
  });

  summaryTable.push(
    ['总点位数量', stats.total_locations],
    ['总商品数量', stats.total_products],
    ['临期商品数量', stats.expiring_items],
    ['紧急临期数量', stats.critical_items],
    ['调拨建议数量', stats.transfer_suggestions],
    ['降价建议数量', stats.price_adjustments],
    ['发现问题数量', chalk.yellow(stats.issues_found)],
    ['通过检查项', chalk.green(stats.passed)],
    ['失败检查项', chalk.red(stats.failed)]
  );

  console.log(summaryTable.toString());

  if (passed.length > 0) {
    console.log(chalk.green('\n✓ 通过的检查项:'));
    passed.forEach(item => {
      console.log(chalk.green(`  - ${item.message}`));
    });
  }

  if (issues.length > 0) {
    console.log(chalk.yellow('\n⚠ 发现的问题:'));

    const critical = issues.filter(i => i.severity === 'critical');
    const warnings = issues.filter(i => i.severity === 'warning');
    const info = issues.filter(i => i.severity === 'info');

    if (critical.length > 0) {
      console.log(chalk.red(`\n  严重问题 (${critical.length}):`));
      critical.forEach(issue => {
        console.log(chalk.red(`    - ${issue.message}`));
        if (verbose && issue.details) {
          const details = JSON.parse(issue.details);
          console.log(chalk.gray(`      详情: ${JSON.stringify(details, null, 2).split('\n').join('\n      ')}`));
        }
      });
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow(`\n  警告 (${warnings.length}):`));
      warnings.forEach(issue => {
        console.log(chalk.yellow(`    - ${issue.message}`));
        if (verbose && issue.details) {
          const details = JSON.parse(issue.details);
          console.log(chalk.gray(`      详情: ${JSON.stringify(details, null, 2).split('\n').join('\n      ')}`));
        }
      });
    }

    if (info.length > 0 && verbose) {
      console.log(chalk.blue(`\n  信息提示 (${info.length}):`));
      info.forEach(issue => {
        console.log(chalk.blue(`    - ${issue.message}`));
      });
    }
  }

  if (suggestions.length > 0) {
    console.log(chalk.cyan('\n📋 调拨和降价建议:'));
    const transferTable = new Table({
      head: [
        chalk.cyan('源点位'),
        chalk.cyan('目标点位'),
        chalk.cyan('商品'),
        chalk.cyan('数量'),
        chalk.cyan('建议动作'),
        chalk.cyan('建议价格')
      ]
    });

    suggestions.forEach(s => {
      transferTable.push([
        s.from_location_id,
        s.to_location_id || '-',
        s.product_id,
        s.quantity,
        s.suggested_action === 'transfer' ? '调拨' : '降价',
        s.suggested_price ? `¥${s.suggested_price.toFixed(2)}` : '-'
      ]);
    });

    console.log(transferTable.toString());
  }

  const hasCritical = issues.some(i => i.severity === 'critical');
  const hasWarnings = issues.some(i => i.severity === 'warning');

  if (!hasCritical && !hasWarnings) {
    console.log(chalk.green('\n✓ 检查通过！所有关键指标正常。'));
  } else if (hasCritical) {
    console.log(chalk.red('\n✗ 检查失败！存在需要紧急处理的问题。'));
  } else {
    console.log(chalk.yellow('\n⚠ 检查完成，存在需要关注的问题，建议人工处理。'));
  }

  return {
    passed: !hasCritical && !hasWarnings,
    hasCritical,
    hasWarnings
  };
}

async function checkCommand(options) {
  const { location, verbose, fix } = options;

  if (!databaseExists()) {
    console.log(chalk.yellow('数据库不存在，请先运行: vending-transfer init'));
    return;
  }

  console.log(chalk.cyan('正在执行检查...'));
  if (location) {
    console.log(chalk.gray(`  限定点位: ${location}`));
  }
  if (verbose) {
    console.log(chalk.gray('  详细模式: 开启'));
  }
  if (fix) {
    console.log(chalk.yellow('  自动修复模式: 开启'));
  }

  const db = getDb();
  const today = getToday();

  try {
    const inventoryCheck = checkInventoryEffectiveness(db, location);
    const expiryCheck = checkExpiryScans(db, location);
    const transferCheck = generateTransferSuggestions(db, location);

    const locationCount = location 
      ? 1 
      : db.prepare('SELECT COUNT(*) as count FROM locations').get().count;
    
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;

    const allIssues = [...inventoryCheck.issues, ...expiryCheck.issues, ...transferCheck.issues];
    const allPassed = [...inventoryCheck.passed, ...expiryCheck.passed];

    const expiringQuery = `
      SELECT COUNT(*) as count 
      FROM inventory i
      WHERE i.quantity > 0
        AND i.expiry_date <= date('now', '+${EXPIRY_THRESHOLD_DAYS} days')
        AND i.expiry_date >= date('now')
      ${location ? 'AND i.location_id = ?' : ''}
    `;
    const expiringParams = location ? [location] : [];
    const expiringCount = db.prepare(expiringQuery).get(...expiringParams).count;

    const criticalQuery = `
      SELECT COUNT(*) as count 
      FROM inventory i
      WHERE i.quantity > 0
        AND i.expiry_date <= date('now', '+${CRITICAL_EXPIRY_DAYS} days')
        AND i.expiry_date >= date('now')
      ${location ? 'AND i.location_id = ?' : ''}
    `;
    const criticalParams = location ? [location] : [];
    const criticalCount = db.prepare(criticalQuery).get(...criticalParams).count;

    const transferSuggestions = transferCheck.suggestions.filter(s => s.suggested_action === 'transfer');
    const priceAdjustments = transferCheck.suggestions.filter(s => s.suggested_action === 'price_reduction');

    const stats = {
      total_locations: locationCount,
      total_products: productCount,
      expiring_items: expiringCount,
      critical_items: criticalCount,
      transfer_suggestions: transferSuggestions.length,
      price_adjustments: priceAdjustments.length,
      issues_found: allIssues.length,
      passed: allPassed.length,
      failed: allIssues.filter(i => i.severity === 'critical' || i.severity === 'warning').length
    };

    const mismatches = verifySuggestionsMatchOriginalData(db, transferCheck.suggestions);
    if (mismatches.length > 0) {
      console.log(chalk.red(`\n发现 ${mismatches.length} 个调拨建议与原始数据不匹配:`));
      mismatches.forEach(m => {
        console.log(chalk.red(`  - 建议 #${m.suggestion_id}: ${m.issue}`));
      });
    }

    const transaction = db.transaction(() => {
      const insertCheckRun = db.prepare(`
        INSERT INTO check_runs (
          run_date, total_locations, total_products, expiring_items,
          critical_items, transfer_suggestions, price_adjustments,
          issues_found, passed, failed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertCheckRun.run(
        today,
        stats.total_locations,
        stats.total_products,
        stats.expiring_items,
        stats.critical_items,
        stats.transfer_suggestions,
        stats.price_adjustments,
        stats.issues_found,
        stats.passed,
        stats.failed
      );

      const checkRunId = result.lastInsertRowid;

      if (allIssues.length > 0) {
        const insertIssue = db.prepare(`
          INSERT INTO check_issues (
            check_run_id, issue_type, severity, location_id,
            product_id, batch_number, message, details
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        allIssues.forEach(issue => {
          insertIssue.run(
            checkRunId,
            issue.issue_type,
            issue.severity,
            issue.location_id,
            issue.product_id,
            issue.batch_number,
            issue.message,
            issue.details
          );
        });
      }

      if (transferCheck.suggestions.length > 0) {
        const insertSuggestion = db.prepare(`
          INSERT INTO transfer_suggestions (
            from_location_id, to_location_id, product_id, batch_number,
            expiry_date, quantity, suggested_action, suggested_price, reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        transferCheck.suggestions.forEach(s => {
          insertSuggestion.run(
            s.from_location_id,
            s.to_location_id,
            s.product_id,
            s.batch_number,
            s.expiry_date,
            s.quantity,
            s.suggested_action,
            s.suggested_price,
            s.reason
          );
        });
      }
    });

    transaction();

    const result = displayResults({
      stats,
      issues: allIssues,
      passed: allPassed,
      suggestions: transferCheck.suggestions
    }, verbose);

    if (fix) {
      console.log(chalk.cyan('\n正在应用自动修复...'));
      const autoFixed = applyAutoFixes(db, allIssues, location);
      if (autoFixed > 0) {
        console.log(chalk.green(`✓ 自动修复了 ${autoFixed} 个问题`));
      } else {
        console.log(chalk.gray('没有可自动修复的问题'));
      }
    }

    db.close();

    process.exit(result.passed ? 0 : 1);

  } catch (err) {
    db.close();
    console.log(chalk.red(`检查失败: ${err.message}`));
    process.exit(1);
  }
}

function applyAutoFixes(db, issues, location) {
  let fixedCount = 0;

  const zeroQtyIssues = issues.filter(i => i.issue_type === 'zero_quantity');
  if (zeroQtyIssues.length > 0) {
    const updateStmt = db.prepare(`
      DELETE FROM inventory 
      WHERE location_id = ? 
        AND product_id = ? 
        AND quantity = 0
    `);

    zeroQtyIssues.forEach(issue => {
      if (!location || issue.location_id === location) {
        const result = updateStmt.run(issue.location_id, issue.product_id);
        if (result.changes > 0) fixedCount++;
      }
    });
  }

  return fixedCount;
}

module.exports = checkCommand;
