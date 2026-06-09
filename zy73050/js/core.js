// ============================================================
// 核心功能模块：去重校验、历史版本保留、采样断档识别
// ============================================================

const Core = {
  // ----------------------------------------------------------
  // 1. 重复提交去重：相同工单请求不能把边界样本算成两份
  // ----------------------------------------------------------
  // 已提交的工单哈希集合（用于去重校验）
  submittedHashes: new Set(),

  // 生成工单唯一性哈希（塔吊编号 + 维保类型 + 停机窗口起始时间）
  generateWorkorderHash(wo) {
    const raw = `${wo.craneId}|${wo.type}|${wo.downtimeWindow.start}|${wo.parts.map(p => p.id).sort().join(',')}`;
    // 简单哈希（模拟），生产环境可使用 SHA-256
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'H' + Math.abs(hash).toString(36).toUpperCase();
  },

  // 检查重复提交 - 传入拟提交的工单对象，返回 { isDuplicate, existingWo, hash }
  checkDuplicate(workorder) {
    const hash = this.generateWorkorderHash(workorder);
    const existing = WORKORDERS.find(wo => this.generateWorkorderHash(wo) === hash);
    if (existing) {
      // 注册到已提交哈希集合
      this.submittedHashes.add(hash);
      return {
        isDuplicate: true,
        existingWo: existing,
        hash,
      };
    }
    // 新工单，注册哈希
    this.submittedHashes.add(hash);
    return {
      isDuplicate: false,
      existingWo: null,
      hash,
    };
  },

  // ----------------------------------------------------------
  // 2. 分类筛选：已确认、待补件、退回
  // ----------------------------------------------------------
  filterWorkorders(filter = 'all', searchKeyword = '') {
    let list = [...WORKORDERS];

    // 按状态筛选
    switch (filter) {
      case 'confirmed':
        list = list.filter(wo => wo.status === STATUS.CONFIRMED);
        break;
      case 'pending':
        list = list.filter(wo => wo.status === STATUS.PENDING);
        break;
      case 'returned':
        list = list.filter(wo => wo.status === STATUS.RETURNED);
        break;
      case 'abnormal':
        // 采样断档筛选：有异常采样的工单
        list = list.filter(wo => wo.hasAbnormalSampling);
        break;
      case 'all':
      default:
        break;
    }

    // 搜索关键词
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      list = list.filter(wo =>
        wo.id.toLowerCase().includes(kw) ||
        wo.craneId.toLowerCase().includes(kw) ||
        wo.craneName.toLowerCase().includes(kw) ||
        wo.title.toLowerCase().includes(kw)
      );
    }

    return list;
  },

  // 获取分类统计数量
  getCounts() {
    return {
      all: WORKORDERS.length,
      confirmed: WORKORDERS.filter(wo => wo.status === STATUS.CONFIRMED).length,
      pending: WORKORDERS.filter(wo => wo.status === STATUS.PENDING).length,
      returned: WORKORDERS.filter(wo => wo.status === STATUS.RETURNED).length,
      abnormal: WORKORDERS.filter(wo => wo.hasAbnormalSampling).length,
    };
  },

  // ----------------------------------------------------------
  // 3. 备件清单：版本历史管理（备注 + 截图）
  // ----------------------------------------------------------
  // 获取备件的最新备注（始终展示最新版本，但历史版本可回溯）
  getLatestRemark(part) {
    if (!part.remarkVersions || part.remarkVersions.length === 0) return null;
    return part.remarkVersions.find(v => v.isLatest) || part.remarkVersions[0];
  },

  // 获取备件的所有备注版本（按版本号倒序）
  getAllRemarkVersions(part) {
    if (!part.remarkVersions) return [];
    return [...part.remarkVersions].sort((a, b) => b.version - a.version);
  },

  // 获取备件的所有截图版本
  getAllScreenshotVersions(part) {
    if (!part.screenshotVersions) return [];
    return [...part.screenshotVersions].sort((a, b) => b.version - a.version);
  },

  // 追加新版本（模拟补录备注）
  addRemarkVersion(workorderId, partId, content, author = '宋建国', role = '现场调度') {
    const wo = WORKORDERS.find(w => w.id === workorderId);
    if (!wo) return false;
    const part = wo.parts.find(p => p.id === partId);
    if (!part) return false;

    // 旧版本全部置为非最新
    part.remarkVersions.forEach(v => { v.isLatest = false; });

    // 生成新版本
    const newVersion = {
      version: (part.remarkVersions[0]?.version || 0) + 1,
      isLatest: true,
      content,
      author,
      role,
      createdAt: this.formatNow(),
    };
    part.remarkVersions.unshift(newVersion);
    return newVersion;
  },

  // 追加截图版本
  addScreenshotVersion(workorderId, partId, name, preview = '🖼️', author = '宋建国', role = '现场调度') {
    const wo = WORKORDERS.find(w => w.id === workorderId);
    if (!wo) return false;
    const part = wo.parts.find(p => p.id === partId);
    if (!part) return false;

    part.screenshotVersions.forEach(v => { v.isLatest = false; });

    const newVersion = {
      version: (part.screenshotVersions[0]?.version || 0) + 1,
      isLatest: true,
      name,
      author,
      role,
      createdAt: this.formatNow(),
      preview,
    };
    part.screenshotVersions.unshift(newVersion);
    return newVersion;
  },

  // ----------------------------------------------------------
  // 4. 采样断档识别：单独拎出，不揉进正常结果
  // ----------------------------------------------------------
  // 获取正常采样记录
  getNormalSamplings(workorder) {
    return workorder.sampling.filter(s => s.status === 'normal');
  },

  // 获取异常（断档）采样记录
  getAbnormalSamplings(workorder) {
    return workorder.sampling.filter(s => s.status === 'abnormal');
  },

  // 采样统计（排除断档）
  getSamplingStats(workorder) {
    const normals = this.getNormalSamplings(workorder);
    const abnormals = this.getAbnormalSamplings(workorder);
    if (normals.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0, abnormalCount: abnormals.length, gapRate: 100 };
    }
    const values = normals.map(s => s.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const total = workorder.sampling.length;
    const gapRate = Math.round((abnormals.length / total) * 100);
    return {
      avg: avg.toFixed(1),
      min: min.toFixed(1),
      max: max.toFixed(1),
      count: normals.length,
      abnormalCount: abnormals.length,
      gapRate,
    };
  },

  // ----------------------------------------------------------
  // 5. 停机窗口 vs 备件到货 对比（小宋最费劲的场景）
  // ----------------------------------------------------------
  analyzePartsTiming(workorder) {
    const windowStart = new Date(workorder.downtimeWindow.start.replace(' ', 'T'));
    const windowEnd = new Date(workorder.downtimeWindow.end.replace(' ', 'T'));
    const windowDuration = (windowEnd - windowStart) / (1000 * 60 * 60);

    const lateParts = workorder.parts.filter(p => p.isLate);
    const onTimeParts = workorder.parts.filter(p => !p.isLate);

    // 分析每个备件相对于窗口的位置
    const partsTiming = workorder.parts.map(p => {
      const actual = new Date(p.actualArrival.replace(' ', 'T'));
      const planned = new Date(p.plannedArrival.replace(' ', 'T'));
      const delayHours = p.isLate ? ((actual - windowStart) / (1000 * 60 * 60)).toFixed(1) : null;
      return {
        ...p,
        isLate: p.isLate,
        delayHours,
        beforeWindow: actual < windowStart,
        withinWindow: actual >= windowStart && actual <= windowEnd,
        afterWindow: actual > windowEnd,
      };
    });

    return {
      windowDuration: windowDuration.toFixed(1),
      lateCount: lateParts.length,
      onTimeCount: onTimeParts.length,
      partsTiming,
      hasLateAffect: lateParts.some(p => new Date(p.actualArrival.replace(' ', 'T')) > windowStart),
    };
  },

  // ----------------------------------------------------------
  // 6. 导出功能：按当前视图重新导出
  // ----------------------------------------------------------
  exportCurrentView(filter, keyword, workorder) {
    const wos = this.filterWorkorders(filter, keyword);
    const ts = new Date();
    const tsStr = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`;

    // 导出为可下载的 JSON 文件
    const data = {
      exportMeta: {
        exportedAt: this.formatNow(),
        filter,
        keyword,
        totalCount: wos.length,
        currentWorkorder: workorder ? workorder.id : null,
      },
      summary: this.getCounts(),
      workorders: wos.map(wo => ({
        id: wo.id,
        craneId: wo.craneId,
        craneName: wo.craneName,
        title: wo.title,
        status: wo.status,
        statusLabel: STATUS_LABEL[wo.status],
        scheduler: wo.scheduler,
        downtimeWindow: wo.downtimeWindow,
        partsCount: wo.parts.length,
        latePartsCount: wo.parts.filter(p => p.isLate).length,
        abnormalSamplingCount: wo.sampling.filter(s => s.status === 'abnormal').length,
        confirmedAt: wo.status === STATUS.CONFIRMED ? wo.timeline.findLast?.(t => t.type === 'confirmed')?.time : null,
      })),
      detail: workorder ? {
        workorder,
        partsTimingAnalysis: this.analyzePartsTiming(workorder),
        samplingStats: this.getSamplingStats(workorder),
      } : null,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `塔吊维保工单回放_导出_${tsStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return data;
  },

  // ----------------------------------------------------------
  // 工具方法
  // ----------------------------------------------------------
  formatNow() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  getStatusLabel(status) {
    return STATUS_LABEL[status] || status;
  },
};
