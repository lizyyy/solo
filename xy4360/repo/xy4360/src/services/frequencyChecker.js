const config = require('../config');

class FrequencyChecker {
  constructor() {
    this.minTolerance = config.frequency.minTolerance;
    this.safeDistance = config.frequency.safeDistance;
    this.intermodTolerance = config.intermod.tolerance;
    this.intermodOrders = config.intermod.orders;
  }

  checkAll(frequencies, forbiddenBands = []) {
    const conflicts = [];
    
    conflicts.push(...this.checkSameFrequency(frequencies));
    conflicts.push(...this.checkProximity(frequencies));
    conflicts.push(...this.checkForbiddenBands(frequencies, forbiddenBands));
    conflicts.push(...this.checkIntermodulation(frequencies));
    conflicts.push(...this.checkBackupCoverage(frequencies));

    return conflicts;
  }

  checkSameFrequency(frequencies) {
    const conflicts = [];
    const freqMap = new Map();

    frequencies.forEach((freq, index) => {
      const freqKey = freq.frequency.toFixed(3);
      if (freqMap.has(freqKey)) {
        const existingIndex = freqMap.get(freqKey);
        const existingFreq = frequencies[existingIndex];
        
        conflicts.push({
          type: 'same_frequency',
          severity: 'critical',
          frequency_1_id: existingFreq.id,
          frequency_2_id: freq.id,
          details: `频点冲突: ${freq.device_name}(${freq.frequency} MHz) 与 ${existingFreq.device_name}(${existingFreq.frequency} MHz) 完全相同`
        });
      } else {
        freqMap.set(freqKey, index);
      }
    });

    return conflicts;
  }

  checkProximity(frequencies) {
    const conflicts = [];
    const sortedFreqs = [...frequencies].sort((a, b) => a.frequency - b.frequency);

    for (let i = 0; i < sortedFreqs.length - 1; i++) {
      for (let j = i + 1; j < sortedFreqs.length; j++) {
        const freq1 = sortedFreqs[i];
        const freq2 = sortedFreqs[j];
        const distance = Math.abs(freq2.frequency - freq1.frequency);

        if (distance < this.minTolerance) {
          conflicts.push({
            type: 'proximity_critical',
            severity: 'critical',
            frequency_1_id: freq1.id,
            frequency_2_id: freq2.id,
            details: `频点距离过近(极危险): ${freq1.device_name}(${freq1.frequency} MHz) 与 ${freq2.device_name}(${freq2.frequency} MHz) 间距仅 ${distance.toFixed(3)} MHz`
          });
        } else if (distance < this.safeDistance) {
          conflicts.push({
            type: 'proximity_warning',
            severity: 'high',
            frequency_1_id: freq1.id,
            frequency_2_id: freq2.id,
            details: `频点距离较近: ${freq1.device_name}(${freq1.frequency} MHz) 与 ${freq2.device_name}(${freq2.frequency} MHz) 间距为 ${distance.toFixed(3)} MHz (建议 > 1 MHz)`
          });
        }
      }
    }

    return conflicts;
  }

  checkForbiddenBands(frequencies, forbiddenBands) {
    const conflicts = [];

    frequencies.forEach(freq => {
      forbiddenBands.forEach(band => {
        if (freq.frequency >= band.freq_start && freq.frequency <= band.freq_end) {
          conflicts.push({
            type: 'forbidden_band',
            severity: 'critical',
            frequency_1_id: freq.id,
            details: `频点在禁用频段内: ${freq.device_name}(${freq.frequency} MHz) 位于禁用频段 "${band.name}" (${band.freq_start}-${band.freq_end} MHz) - ${band.reason || '原因未知'}`
          });
        }
      });
    });

    return conflicts;
  }

  checkIntermodulation(frequencies) {
    const conflicts = [];
    const freqList = frequencies.map(f => f.frequency);

    for (let i = 0; i < frequencies.length; i++) {
      for (let j = i + 1; j < frequencies.length; j++) {
        const f1 = frequencies[i];
        const f2 = frequencies[j];
        const f1Val = f1.frequency;
        const f2Val = f2.frequency;

        if (this.intermodOrders.includes(2)) {
          const im2Plus = f1Val + f2Val;
          const im2Minus = Math.abs(f1Val - f2Val);

          this._checkIntermodValue(conflicts, frequencies, im2Plus, [f1, f2], 2, '+');
          this._checkIntermodValue(conflicts, frequencies, im2Minus, [f1, f2], 2, '-');
        }

        if (this.intermodOrders.includes(3)) {
          const im3_1 = 2 * f1Val - f2Val;
          const im3_2 = 2 * f2Val - f1Val;
          const im3_3 = f1Val + 2 * f2Val;
          const im3_4 = 2 * f1Val + f2Val;

          if (im3_1 > 0) this._checkIntermodValue(conflicts, frequencies, im3_1, [f1, f2], 3, '2f1-f2');
          if (im3_2 > 0) this._checkIntermodValue(conflicts, frequencies, im3_2, [f1, f2], 3, '2f2-f1');
          this._checkIntermodValue(conflicts, frequencies, im3_3, [f1, f2], 3, 'f1+2f2');
          this._checkIntermodValue(conflicts, frequencies, im3_4, [f1, f2], 3, '2f1+f2');
        }
      }
    }

    return conflicts;
  }

  _checkIntermodValue(conflicts, frequencies, imValue, sourceFreqs, order, formula) {
    if (imValue <= 0 || imValue > 1000) return;

    frequencies.forEach(targetFreq => {
      if (targetFreq.id === sourceFreqs[0].id || targetFreq.id === sourceFreqs[1].id) return;

      const distance = Math.abs(targetFreq.frequency - imValue);
      if (distance < this.intermodTolerance) {
        const deviceNames = sourceFreqs.map(f => f.device_name).join('、');
        const freqValues = sourceFreqs.map(f => `${f.frequency} MHz`).join('、');
        
        conflicts.push({
          type: 'intermodulation',
          severity: distance < this.minTolerance ? 'critical' : 'high',
          frequency_1_id: sourceFreqs[0].id,
          frequency_2_id: targetFreq.id,
          details: `互调冲突(${order}阶): ${formula}公式计算值 ${imValue.toFixed(3)} MHz 与 ${targetFreq.device_name}(${targetFreq.frequency} MHz) 距离仅 ${distance.toFixed(3)} MHz。源频点: ${deviceNames}(${freqValues})`,
          intermod_value: imValue,
          intermod_orders: `${order}`
        });
      }
    });
  }

  checkBackupCoverage(frequencies) {
    const conflicts = [];
    const mainFreqs = frequencies.filter(f => !f.is_backup);
    const backupFreqs = frequencies.filter(f => f.is_backup);

    mainFreqs.forEach(mainFreq => {
      const relatedBackups = backupFreqs.filter(b => b.backup_for_id === mainFreq.id);
      
      if (relatedBackups.length === 0) {
        conflicts.push({
          type: 'no_backup',
          severity: 'medium',
          frequency_1_id: mainFreq.id,
          details: `无备用频点: ${mainFreq.device_name}(${mainFreq.frequency} MHz) 没有配置备用频点，建议为重要设备准备1-2个备用频点`
        });
      } else {
        relatedBackups.forEach(backup => {
          const distance = Math.abs(backup.frequency - mainFreq.frequency);
          if (distance < this.safeDistance) {
            conflicts.push({
              type: 'backup_proximity',
              severity: 'low',
              frequency_1_id: mainFreq.id,
              frequency_2_id: backup.id,
              details: `备用频点距离较近: ${mainFreq.device_name} 的主频点 ${mainFreq.frequency} MHz 与备用频点 ${backup.frequency} MHz 间距仅 ${distance.toFixed(3)} MHz，建议保持足够距离以确保真正可用`
            });
          }
        });
      }
    });

    return conflicts;
  }

  getConflictTypeLabel(type) {
    const labels = {
      'same_frequency': '同频冲突',
      'proximity_critical': '距离过近',
      'proximity_warning': '距离较近',
      'forbidden_band': '禁用频段',
      'intermodulation': '互调干扰',
      'no_backup': '无备用',
      'backup_proximity': '备用距离'
    };
    return labels[type] || type;
  }

  getSeverityLabel(severity) {
    const labels = {
      'critical': '严重',
      'high': '高危',
      'medium': '中等',
      'low': '轻微'
    };
    return labels[severity] || severity;
  }

  getSuggestedAction(conflictType) {
    const actions = {
      'same_frequency': '必须修改其中一个频点',
      'proximity_critical': '建议调整频点，拉开距离',
      'proximity_warning': '可考虑调整，或现场监听确认',
      'forbidden_band': '必须更换频点',
      'intermodulation': '建议调整频点或使用不同频段',
      'no_backup': '建议添加备用频点',
      'backup_proximity': '可考虑调整备用频点位置'
    };
    return actions[conflictType] || '请检查详情';
  }
}

module.exports = FrequencyChecker;
