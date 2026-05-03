const db = require('../config/database');
const { format, differenceInDays } = require('date-fns');

class ValidationService {
  static validateArtworkForFiring(artwork, firingTask, kiln, shelves, allArtworksInTask) {
    const risks = [];
    const warnings = [];
    const info = [];

    const sizeCheck = this.checkSize(artwork, shelves);
    if (sizeCheck.error) {
      risks.push({
        type: 'size',
        severity: 'error',
        message: sizeCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    } else if (sizeCheck.warning) {
      warnings.push({
        type: 'size',
        severity: 'warning',
        message: sizeCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    }

    const tempCheck = this.checkTemperatureMatch(artwork, firingTask);
    if (tempCheck.error) {
      risks.push({
        type: 'temperature',
        severity: 'error',
        message: tempCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    } else if (tempCheck.warning) {
      warnings.push({
        type: 'temperature',
        severity: 'warning',
        message: tempCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    }

    const compatibilityCheck = this.checkMaterialCompatibility(artwork, allArtworksInTask);
    if (compatibilityCheck.risks.length > 0) {
      compatibilityCheck.risks.forEach(risks.push.bind(risks));
    }
    if (compatibilityCheck.warnings.length > 0) {
      compatibilityCheck.warnings.forEach(warnings.push.bind(warnings));
    }

    const deliveryCheck = this.checkDeliveryDate(artwork, firingTask);
    if (deliveryCheck.warning) {
      warnings.push({
        type: 'delivery',
        severity: 'warning',
        message: deliveryCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    } else if (deliveryCheck.info) {
      info.push({
        type: 'delivery',
        severity: 'info',
        message: deliveryCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    }

    const spaceCheck = this.checkSpaceUsage(artwork, allArtworksInTask, shelves);
    if (spaceCheck.warning) {
      warnings.push({
        type: 'space',
        severity: 'warning',
        message: spaceCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    } else if (spaceCheck.info) {
      info.push({
        type: 'space',
        severity: 'info',
        message: spaceCheck.message,
        artwork: { id: artwork.id, name: artwork.name }
      });
    }

    return {
      valid: risks.length === 0,
      risks,
      warnings,
      info,
      summary: {
        totalRisks: risks.length,
        totalWarnings: warnings.length,
        totalInfo: info.length
      }
    };
  }

  static checkSize(artwork, shelves) {
    if (!artwork.width || !artwork.height || !artwork.depth) {
      return { warning: true, message: `作品 "${artwork.name}" 缺少尺寸信息，无法进行尺寸校验` };
    }

    const maxShelfWidth = Math.max(...shelves.map(s => s.width));
    const maxShelfHeight = Math.max(...shelves.map(s => s.height));
    const maxShelfDepth = Math.max(...shelves.map(s => s.depth));

    if (artwork.width > maxShelfWidth) {
      return { error: true, message: `作品 "${artwork.name}" 宽度(${artwork.width}cm)超过最大层架宽度(${maxShelfWidth}cm)` };
    }
    if (artwork.height > maxShelfHeight) {
      return { error: true, message: `作品 "${artwork.name}" 高度(${artwork.height}cm)超过最大层架高度(${maxShelfHeight}cm)` };
    }
    if (artwork.depth > maxShelfDepth) {
      return { error: true, message: `作品 "${artwork.name}" 深度(${artwork.depth}cm)超过最大层架深度(${maxShelfDepth}cm)` };
    }

    const widthRatio = artwork.width / maxShelfWidth;
    const heightRatio = artwork.height / maxShelfHeight;
    
    if (widthRatio > 0.8 || heightRatio > 0.8) {
      return { warning: true, message: `作品 "${artwork.name}" 尺寸接近层架极限，需要注意摆放位置` };
    }

    return {};
  }

  static checkTemperatureMatch(artwork, firingTask) {
    return new Promise((resolve) => {
      const query = `
        SELECT 
          c.temp_min as clay_temp_min, c.temp_max as clay_temp_max, c.cone as clay_cone,
          g1.temp_min as glaze1_temp_min, g1.temp_max as glaze1_temp_max, g1.cone as glaze1_cone,
          g2.temp_min as glaze2_temp_min, g2.temp_max as glaze2_temp_max, g2.cone as glaze2_cone,
          fc.max_temperature as curve_max_temp, fc.cone as curve_cone
        FROM artworks a
        LEFT JOIN clays c ON a.clay_id = c.id
        LEFT JOIN glazes g1 ON a.glaze_id = g1.id
        LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
        LEFT JOIN firing_curves fc ON ? = fc.id
        WHERE a.id = ?
      `;

      db.get(query, [firingTask.firing_curve_id, artwork.id], (err, row) => {
        if (err || !row) {
          resolve({ warning: true, message: `无法获取作品 "${artwork.name}" 的温度信息` });
          return;
        }

        if (!row.curve_max_temp) {
          resolve({ warning: true, message: `烧窑任务未配置烧成曲线，无法进行温度匹配校验` });
          return;
        }

        const messages = [];
        const warnings = [];

        if (row.clay_temp_min && row.clay_temp_max) {
          if (row.curve_max_temp < row.clay_temp_min) {
            messages.push(`泥料最低烧成温度(${row.clay_temp_min}°C)高于烧成曲线最高温度(${row.curve_max_temp}°C)`);
          } else if (row.curve_max_temp > row.clay_temp_max) {
            messages.push(`泥料最高烧成温度(${row.clay_temp_max}°C)低于烧成曲线最高温度(${row.curve_max_temp}°C)`);
          }
        }

        if (row.glaze1_temp_min && row.glaze1_temp_max) {
          if (row.curve_max_temp < row.glaze1_temp_min) {
            messages.push(`釉料最低烧成温度(${row.glaze1_temp_min}°C)高于烧成曲线最高温度(${row.curve_max_temp}°C)`);
          } else if (row.curve_max_temp > row.glaze1_temp_max) {
            warnings.push(`釉料最高烧成温度(${row.glaze1_temp_max}°C)低于烧成曲线最高温度(${row.curve_max_temp}°C)，可能导致过烧`);
          }
        }

        if (row.glaze2_temp_min && row.glaze2_temp_max) {
          if (row.curve_max_temp < row.glaze2_temp_min) {
            messages.push(`第二层釉料最低烧成温度(${row.glaze2_temp_min}°C)高于烧成曲线最高温度(${row.curve_max_temp}°C)`);
          } else if (row.curve_max_temp > row.glaze2_temp_max) {
            warnings.push(`第二层釉料最高烧成温度(${row.glaze2_temp_max}°C)低于烧成曲线最高温度(${row.curve_max_temp}°C)，可能导致过烧`);
          }
        }

        if (messages.length > 0) {
          resolve({ error: true, message: `作品 "${artwork.name}" 温度不匹配: ${messages.join('; ')}` });
        } else if (warnings.length > 0) {
          resolve({ warning: true, message: `作品 "${artwork.name}" 温度警告: ${warnings.join('; ')}` });
        } else {
          resolve({});
        }
      });
    });
  }

  static checkMaterialCompatibility(artwork, allArtworksInTask) {
    const risks = [];
    const warnings = [];

    if (!allArtworksInTask || allArtworksInTask.length === 0) {
      return { risks, warnings };
    }

    const currentArtwork = allArtworksInTask.find(a => a.id === artwork.id) || artwork;
    
    for (const otherArtwork of allArtworksInTask) {
      if (otherArtwork.id === artwork.id) continue;

      if (currentArtwork.glaze_id && otherArtwork.glaze_id) {
        const currentIncompatible = this.parseIncompatibleGlazes(currentArtwork.incompatible_glazes);
        if (currentIncompatible.includes(otherArtwork.glaze_id)) {
          risks.push({
            type: 'compatibility',
            severity: 'error',
            message: `作品 "${currentArtwork.name}" 的釉料与作品 "${otherArtwork.name}" 的釉料不兼容，可能发生化学反应`,
            artwork: { id: currentArtwork.id, name: currentArtwork.name },
            relatedArtwork: { id: otherArtwork.id, name: otherArtwork.name }
          });
        }
      }

      if (currentArtwork.clay_id && otherArtwork.clay_id && currentArtwork.clay_id !== otherArtwork.clay_id) {
        const shrinkageDiff = Math.abs((currentArtwork.clay_shrinkage || 10) - (otherArtwork.clay_shrinkage || 10));
        if (shrinkageDiff > 5) {
          warnings.push({
            type: 'compatibility',
            severity: 'warning',
            message: `作品 "${currentArtwork.name}" 和 "${otherArtwork.name}" 使用的泥料收缩率差异较大(${shrinkageDiff}%)，可能影响尺寸精度`,
            artwork: { id: currentArtwork.id, name: currentArtwork.name },
            relatedArtwork: { id: otherArtwork.id, name: otherArtwork.name }
          });
        }
      }
    }

    return { risks, warnings };
  }

  static checkDeliveryDate(artwork, firingTask) {
    if (!artwork.delivery_date) {
      return { info: true, message: `作品 "${artwork.name}" 未设置交付日期` };
    }

    const today = new Date();
    const deliveryDate = new Date(artwork.delivery_date);
    const daysUntilDelivery = differenceInDays(deliveryDate, today);

    if (daysUntilDelivery < 0) {
      return { warning: true, message: `作品 "${artwork.name}" 交付日期已过期 ${Math.abs(daysUntilDelivery)} 天` };
    } else if (daysUntilDelivery <= 3) {
      return { warning: true, message: `作品 "${artwork.name}" 交付日期临近，仅剩 ${daysUntilDelivery} 天` };
    } else if (daysUntilDelivery <= 7) {
      return { info: true, message: `作品 "${artwork.name}" 将在 ${daysUntilDelivery} 天后交付` };
    }

    return { info: true, message: `作品 "${artwork.name}" 交付日期为 ${format(deliveryDate, 'yyyy-MM-dd')}` };
  }

  static checkSpaceUsage(artwork, allArtworksInTask, shelves) {
    if (!allArtworksInTask || allArtworksInTask.length === 0) {
      return {};
    }

    const totalArtworks = allArtworksInTask.length;
    const totalShelfArea = shelves.reduce((sum, shelf) => sum + (shelf.width * shelf.depth), 0);
    const estimatedArtworkArea = allArtworksInTask.reduce((sum, a) => {
      const width = a.width || 10;
      const depth = a.depth || 10;
      return sum + (width * depth);
    }, 0);

    const spaceRatio = estimatedArtworkArea / totalShelfArea;

    if (spaceRatio > 0.85) {
      return { warning: true, message: `窑炉空间使用率已达 ${Math.round(spaceRatio * 100)}%，接近饱和，建议减少作品数量或优化摆放` };
    } else if (spaceRatio > 0.7) {
      return { info: true, message: `窑炉空间使用率为 ${Math.round(spaceRatio * 100)}%，摆放合理` };
    }

    return { info: true, message: `窑炉空间使用率为 ${Math.round(spaceRatio * 100)}%，还有富余空间` };
  }

  static parseIncompatibleGlazes(incompatibleStr) {
    if (!incompatibleStr) return [];
    try {
      return JSON.parse(incompatibleStr);
    } catch {
      return [];
    }
  }

  static validateFiringTask(taskId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ft.*,
          k.*,
          fc.*,
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
          resolve({ valid: false, errors: ['烧窑任务不存在'] });
          return;
        }

        const artworkIds = task.artwork_ids ? task.artwork_ids.split(',').map(Number) : [];
        
        if (artworkIds.length === 0) {
          resolve({ 
            valid: true, 
            warnings: ['烧窑任务中没有作品'], 
            risks: [],
            summary: { totalRisks: 0, totalWarnings: 1, totalInfo: 0 }
          });
          return;
        }

        const artworksQuery = `
          SELECT 
            a.*,
            c.name as clay_name, c.temp_min as clay_temp_min, c.temp_max as clay_temp_max,
            g1.name as glaze_name, g1.temp_min as glaze_temp_min, g1.temp_max as glaze_temp_max,
            g1.incompatible_glazes,
            g2.name as glaze2_name
          FROM artworks a
          LEFT JOIN clays c ON a.clay_id = c.id
          LEFT JOIN glazes g1 ON a.glaze_id = g1.id
          LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
          WHERE a.id IN (${artworkIds.map(() => '?').join(',')})
        `;

        db.all(artworksQuery, artworkIds, async (err, artworks) => {
          if (err) {
            reject(err);
            return;
          }

          const shelvesQuery = 'SELECT * FROM shelves WHERE kiln_id = ?';
          db.all(shelvesQuery, [task.kiln_id], async (err, shelves) => {
            if (err) {
              reject(err);
              return;
            }

            const allRisks = [];
            const allWarnings = [];
            const allInfo = [];

            for (const artwork of artworks) {
              const validation = this.validateArtworkForFiring(artwork, task, shelves, artworks);
              
              if (validation.risks) {
                allRisks.push(...validation.risks);
              }
              if (validation.warnings) {
                allWarnings.push(...validation.warnings);
              }
              if (validation.info) {
                allInfo.push(...validation.info);
              }
            }

            const uniqueRisks = this.deduplicateRisks(allRisks);
            const uniqueWarnings = this.deduplicateRisks(allWarnings);

            resolve({
              valid: uniqueRisks.length === 0,
              risks: uniqueRisks,
              warnings: uniqueWarnings,
              info: allInfo,
              summary: {
                totalRisks: uniqueRisks.length,
                totalWarnings: uniqueWarnings.length,
                totalInfo: allInfo.length,
                totalArtworks: artworks.length
              }
            });
          });
        });
      });
    });
  }

  static deduplicateRisks(risks) {
    const seen = new Set();
    return risks.filter(risks => {
      const key = JSON.stringify({
        type: risks.type,
        artwork: risks.artwork?.id,
        relatedArtwork: risks.relatedArtwork?.id
      });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = ValidationService;
