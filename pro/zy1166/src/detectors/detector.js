class Detector {
  constructor(analysisData) {
    this.data = analysisData;
    this.issues = [];
  }

  detectAll() {
    this.detectSpaceGrowth();
    this.detectMajorGCReclamation();
    this.detectFastPromotion();
    this.detectClosureEventListenerLeaks();
    this.detectBufferNativeMemory();
    this.detectObjectPoolWaste();
    this.detectWeakRefMisuse();
    this.detectCacheIssues();
    
    return this.issues.sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  addIssue(issue) {
    this.issues.push({
      id: `issue_${this.issues.length + 1}`,
      ...issue,
      detectedAt: new Date().toISOString()
    });
  }

  detectSpaceGrowth() {
    const gcLog = this.data.gcLog;
    if (!gcLog || !gcLog.stats) return;

    const stats = gcLog.stats;

    if (stats.oldSpaceGrowthKB && stats.oldSpaceGrowthKB > 50 * 1024) {
      this.addIssue({
        category: 'space_growth',
        type: 'old_space_continuous_growth',
        severity: 'critical',
        title: '老年代持续增长',
        description: `老代内存增长了 ${(stats.oldSpaceGrowthKB / 1024).toFixed(2)} MB，可能存在内存泄漏`,
        details: {
          growthKB: stats.oldSpaceGrowthKB,
          growthMB: (stats.oldSpaceGrowthKB / 1024).toFixed(2),
          thresholdKB: 50 * 1024
        },
        suggestion: '检查是否有对象持续晋升到老年代且未被释放'
      });
    }

    if (stats.youngSpaceGrowth && stats.youngSpaceGrowth.length > 0) {
      const firstYoung = stats.youngSpaceGrowth[0];
      const lastYoung = stats.youngSpaceGrowth[stats.youngSpaceGrowth.length - 1];
      const youngGrowth = lastYoung.afterKB - firstYoung.beforeKB;

      if (youngGrowth > 20 * 1024) {
        this.addIssue({
          category: 'space_growth',
          type: 'young_space_growth',
          severity: 'warning',
          title: '年轻代异常增长',
          description: `年轻代内存增长了 ${(youngGrowth / 1024).toFixed(2)} MB`,
          details: {
            growthKB: youngGrowth,
            growthMB: (youngGrowth / 1024).toFixed(2),
            thresholdKB: 20 * 1024
          },
          suggestion: '检查是否有大量短期对象创建，考虑优化对象分配'
        });
      }
    }

    const heapSummary = this.data.heapSummary;
    if (heapSummary && heapSummary.stats) {
      const heapStats = heapSummary.stats;
      
      if (heapStats.heapUsagePercent > 85) {
        this.addIssue({
          category: 'space_growth',
          type: 'heap_usage_high',
          severity: 'critical',
          title: '堆使用率过高',
          description: `堆使用率达到 ${heapStats.heapUsagePercent.toFixed(1)}%，接近容量限制`,
          details: {
            usagePercent: heapStats.heapUsagePercent,
            thresholdPercent: 85
          },
          suggestion: '考虑增加 --max-old-space-size 或检查内存泄漏'
        });
      }

      if (heapStats.spaceWithHighestUsage && heapStats.spaceWithHighestUsage.usagePercent > 90) {
        this.addIssue({
          category: 'space_growth',
          type: 'specific_space_full',
          severity: 'warning',
          title: '特定空间接近饱和',
          description: `${heapStats.spaceWithHighestUsage.name} 使用率达到 ${heapStats.spaceWithHighestUsage.usagePercent.toFixed(1)}%`,
          details: {
            spaceName: heapStats.spaceWithHighestUsage.name,
            usagePercent: heapStats.spaceWithHighestUsage.usagePercent
          },
          suggestion: '检查该空间的对象类型，可能需要优化'
        });
      }
    }
  }

  detectMajorGCReclamation() {
    const gcLog = this.data.gcLog;
    if (!gcLog || !gcLog.stats) return;

    const stats = gcLog.stats;

    if (stats.lastMajorGCReclamationRate !== undefined && stats.lastMajorGCReclamationRate < 30) {
      this.addIssue({
        category: 'gc_reclamation',
        type: 'major_gc_low_reclamation',
        severity: 'critical',
        title: 'Major GC 回收不足',
        description: `最后一次 Major GC 仅回收了 ${stats.lastMajorGCReclamationRate.toFixed(1)}% 的内存，正常值应 > 30%`,
        details: {
          reclamationRate: stats.lastMajorGCReclamationRate,
          reclaimedKB: stats.lastMajorGCReclaimedKB,
          thresholdRate: 30
        },
        suggestion: '这是内存泄漏的典型特征，检查老年代中持续存在的对象引用'
      });
    }

    if (stats.marksweepCount > 0) {
      const marksweepEvents = gcLog.events.filter(e => e.type === 'marksweep');
      const recentMarksweeps = marksweepEvents.slice(-5);
      
      let consecutiveLowReclamation = 0;
      for (const event of recentMarksweeps) {
        if (event.beforeSize && event.afterSize) {
          const reclaimed = event.beforeSize - event.afterSize;
          const rate = event.beforeSize > 0 ? (reclaimed / event.beforeSize) * 100 : 0;
          if (rate < 30) {
            consecutiveLowReclamation++;
          }
        }
      }

      if (consecutiveLowReclamation >= 3) {
        this.addIssue({
          category: 'gc_reclamation',
          type: 'consecutive_low_reclamation',
          severity: 'critical',
          title: '连续多次 Major GC 回收不足',
          description: `最近 ${consecutiveLowReclamation} 次 Major GC 回收效率都低于 30%`,
          details: {
            consecutiveCount: consecutiveLowReclamation,
            thresholdCount: 3
          },
          suggestion: '极可能存在内存泄漏，建议使用 heap snapshot 分析对象引用链'
        });
      }
    }

    if (gcLog.events.length > 10) {
      const recentEvents = gcLog.events.slice(-10);
      const marksweepEvents = recentEvents.filter(e => e.type === 'marksweep');
      
      if (marksweepEvents.length >= 3) {
        this.addIssue({
          category: 'gc_reclamation',
          type: 'frequent_major_gc',
          severity: 'warning',
          title: 'Major GC 频率异常',
          description: `最近 10 次 GC 中有 ${marksweepEvents.length} 次是 Major GC`,
          details: {
            recentGCCount: 10,
            majorGCCount: marksweepEvents.length
          },
          suggestion: '可能是老年代空间不足或对象晋升过快'
        });
      }
    }
  }

  detectFastPromotion() {
    const gcLog = this.data.gcLog;
    if (!gcLog || !gcLog.stats) return;

    const stats = gcLog.stats;

    if (stats.avgSurvivalRate !== undefined && stats.avgSurvivalRate > 60) {
      this.addIssue({
        category: 'promotion',
        type: 'high_survival_rate',
        severity: 'warning',
        title: '对象存活率过高',
        description: `平均存活率达到 ${stats.avgSurvivalRate.toFixed(1)}%，正常值应 < 60%`,
        details: {
          survivalRate: stats.avgSurvivalRate,
          thresholdRate: 60
        },
        suggestion: '可能有过多长期存活对象，考虑增加 young generation 大小或检查对象生命周期'
      });
    }

    if (stats.avgPromotionKB !== undefined && stats.avgPromotionKB > 1024) {
      this.addIssue({
        category: 'promotion',
        type: 'high_promotion_rate',
        severity: 'warning',
        title: '对象晋升过快',
        description: `平均每次 GC 晋升 ${(stats.avgPromotionKB / 1024).toFixed(2)} MB 到老年代`,
        details: {
          avgPromotionKB: stats.avgPromotionKB,
          totalPromotedKB: stats.totalPromotedKB,
          thresholdKB: 1024
        },
        suggestion: '考虑增加 --semi-space-size 或检查是否有大对象直接分配到老年代'
      });
    }

    if (stats.scavengeCount > 0) {
      const scavengeEvents = gcLog.events.filter(e => e.type === 'scavenge');
      if (scavengeEvents.length > 5) {
        const promotionTrend = [];
        for (const event of scavengeEvents) {
          if (event.promotedKB !== undefined) {
            promotionTrend.push(event.promotedKB);
          }
        }

        if (promotionTrend.length >= 5) {
          const increasing = this.checkIncreasingTrend(promotionTrend);
          if (increasing) {
            this.addIssue({
              category: 'promotion',
              type: 'promotion_increasing',
              severity: 'warning',
              title: '晋升量持续增加',
              description: '最近几次 GC 的对象晋升量呈上升趋势',
              details: {
                trend: promotionTrend.map(kb => (kb / 1024).toFixed(2) + ' MB')
              },
              suggestion: '可能存在内存泄漏，或对象生命周期管理有问题'
            });
          }
        }
      }
    }
  }

  checkIncreasingTrend(values) {
    if (values.length < 3) return false;
    
    let increases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) {
        increases++;
      }
    }
    
    return increases >= values.length * 0.6;
  }

  detectClosureEventListenerLeaks() {
    const retainerPaths = this.data.retainerPaths;
    if (!retainerPaths || !retainerPaths.suspiciousPaths) return;

    const suspicious = retainerPaths.suspiciousPaths;

    const criticalPaths = suspicious.filter(p => p.highestSeverity === 'critical');
    if (criticalPaths.length > 0) {
      const eventListenerPaths = criticalPaths.filter(p => 
        p.matchedPatterns.some(mp => mp.name === '事件监听器')
      );
      
      if (eventListenerPaths.length > 0) {
        this.addIssue({
          category: 'reference_leak',
          type: 'event_listener_leak',
          severity: 'critical',
          title: '事件监听器泄漏',
          description: `发现 ${eventListenerPaths.length} 个疑似事件监听器泄漏的引用链`,
          details: {
            count: eventListenerPaths.length,
            examples: eventListenerPaths.slice(0, 5).map(p => p.pathString)
          },
          suggestion: '确保事件监听器在不需要时被正确移除，使用 weak references 或清理函数'
        });
      }

      const globalPaths = criticalPaths.filter(p => 
        p.matchedPatterns.some(mp => mp.name === '全局对象引用')
      );

      if (globalPaths.length > 0) {
        this.addIssue({
          category: 'reference_leak',
          type: 'global_reference_leak',
          severity: 'critical',
          title: '全局对象引用泄漏',
          description: `发现 ${globalPaths.length} 个对象被全局变量引用`,
          details: {
            count: globalPaths.length,
            examples: globalPaths.slice(0, 5).map(p => p.pathString)
          },
          suggestion: '检查全局变量，考虑使用 WeakMap/WeakSet 或将引用移到局部作用域'
        });
      }
    }

    const closurePaths = suspicious.filter(p => 
      p.matchedPatterns.some(mp => mp.name === 'Closure 引用')
    );

    if (closurePaths.length > 10) {
      this.addIssue({
        category: 'reference_leak',
        type: 'closure_reference_warning',
        severity: 'warning',
        title: '大量闭包引用',
        description: `发现 ${closurePaths.length} 个闭包引用，可能持有外部变量`,
        details: {
          count: closurePaths.length,
          examples: closurePaths.slice(0, 5).map(p => p.pathString)
        },
        suggestion: '检查闭包是否意外持有大对象引用，考虑使用解构赋值减少引用'
      });
    }

    const timeoutPaths = suspicious.filter(p => 
      p.matchedPatterns.some(mp => mp.name === '定时器引用')
    );

    if (timeoutPaths.length > 5) {
      this.addIssue({
        category: 'reference_leak',
        type: 'timer_reference',
        severity: 'warning',
        title: '定时器引用过多',
        description: `发现 ${timeoutPaths.length} 个定时器相关引用`,
        details: {
          count: timeoutPaths.length,
          examples: timeoutPaths.slice(0, 5).map(p => p.pathString)
        },
        suggestion: '确保 setTimeout/setInterval 在不需要时被 clearTimeout/clearInterval 清理'
      });
    }
  }

  detectBufferNativeMemory() {
    const heapSummary = this.data.heapSummary;
    if (!heapSummary) return;

    if (heapSummary.bufferAnalysis) {
      const bufferAnalysis = heapSummary.bufferAnalysis;
      
      if (bufferAnalysis.totalBuffers > 1000) {
        this.addIssue({
          category: 'buffer_memory',
          type: 'too_many_buffers',
          severity: 'warning',
          title: 'Buffer 对象数量过多',
          description: `发现 ${bufferAnalysis.totalBuffers} 个 Buffer 对象`,
          details: {
            count: bufferAnalysis.totalBuffers,
            totalSizeMB: (bufferAnalysis.totalBufferSize / (1024 * 1024)).toFixed(2),
            avgSizeKB: (bufferAnalysis.avgBufferSize / 1024).toFixed(2),
            thresholdCount: 1000
          },
          suggestion: '考虑使用对象池复用 Buffer，或检查是否有 Buffer 泄漏'
        });
      }

      if (bufferAnalysis.totalBufferSize > 50 * 1024 * 1024) {
        this.addIssue({
          category: 'buffer_memory',
          type: 'large_buffer_memory',
          severity: 'critical',
          title: 'Buffer 内存占用过大',
          description: `Buffer 对象共占用 ${(bufferAnalysis.totalBufferSize / (1024 * 1024)).toFixed(2)} MB 内存`,
          details: {
            totalSizeMB: (bufferAnalysis.totalBufferSize / (1024 * 1024)).toFixed(2),
            largestBufferMB: (bufferAnalysis.largestBuffer / (1024 * 1024)).toFixed(2),
            thresholdMB: 50
          },
          suggestion: '检查是否有大 Buffer 未释放，考虑使用 Streaming 处理大数据'
        });
      }

      if (bufferAnalysis.largestBuffer > 10 * 1024 * 1024) {
        this.addIssue({
          category: 'buffer_memory',
          type: 'oversized_buffer',
          severity: 'warning',
          title: '超大 Buffer 对象',
          description: `存在超过 10MB 的单个 Buffer，最大为 ${(bufferAnalysis.largestBuffer / (1024 * 1024)).toFixed(2)} MB`,
          details: {
            largestBufferMB: (bufferAnalysis.largestBuffer / (1024 * 1024)).toFixed(2),
            thresholdMB: 10
          },
          suggestion: '考虑将大 Buffer 拆分为小片段，或使用流式处理'
        });
      }
    }

    if (heapSummary.nativeMemory) {
      const nativeMemory = heapSummary.nativeMemory;
      
      if (nativeMemory.totalExternal > 100 * 1024 * 1024) {
        this.addIssue({
          category: 'buffer_memory',
          type: 'external_memory_high',
          severity: 'critical',
          title: '外部内存占用过高',
          description: `外部内存 (external memory) 达到 ${(nativeMemory.totalExternal / (1024 * 1024)).toFixed(2)} MB`,
          details: {
            totalExternalMB: (nativeMemory.totalExternal / (1024 * 1024)).toFixed(2),
            thresholdMB: 100
          },
          suggestion: '检查是否有 Native Module 或 C++ 扩展泄漏内存'
        });
      }

      if (nativeMemory.categories && nativeMemory.categories.length > 0) {
        const topCategory = nativeMemory.categories[0];
        if (topCategory.totalSize > 50 * 1024 * 1024) {
          this.addIssue({
            category: 'buffer_memory',
            type: 'native_category_high',
            severity: 'warning',
            title: '特定类型 Native 内存过高',
            description: `${topCategory.type} 类型的 Native 内存达到 ${(topCategory.totalSize / (1024 * 1024)).toFixed(2)} MB`,
            details: {
              category: topCategory.type,
              sizeMB: (topCategory.totalSize / (1024 * 1024)).toFixed(2),
              count: topCategory.count
            },
            suggestion: `检查 ${topCategory.type} 相关的资源释放逻辑`
          });
        }
      }
    }
  }

  detectObjectPoolWaste() {
    const config = this.data.config;
    if (!config || !config.objectPools) return;

    for (const pool of config.objectPools) {
      if (pool.maxSize === Infinity) {
        this.addIssue({
          category: 'pool_issue',
          type: 'unbounded_pool',
          severity: 'critical',
          title: '无界对象池',
          description: `对象池 "${pool.name}" 没有设置最大容量限制`,
          details: {
            poolName: pool.name,
            objectType: pool.objectType,
            currentSize: pool.currentSize
          },
          suggestion: '必须设置 maxSize 限制，否则可能导致内存无限增长'
        });
      }

      if (pool.idleTimeout === null && pool.maxIdleTime === null) {
        this.addIssue({
          category: 'pool_issue',
          type: 'no_idle_timeout',
          severity: 'warning',
          title: '对象池无空闲超时',
          description: `对象池 "${pool.name}" 没有设置空闲超时，空闲对象可能永远不会被释放`,
          details: {
            poolName: pool.name,
            idleCount: pool.idleCount,
            activeCount: pool.activeCount
          },
          suggestion: '设置 idleTimeout 或 maxIdleTime，定期清理长期空闲的对象'
        });
      }

      if (pool.idleCount > 100 && pool.idleCount > pool.activeCount * 2) {
        this.addIssue({
          category: 'pool_issue',
          type: 'too_many_idle',
          severity: 'warning',
          title: '空闲对象过多',
          description: `对象池 "${pool.name}" 有 ${pool.idleCount} 个空闲对象，但只有 ${pool.activeCount} 个活跃对象`,
          details: {
            poolName: pool.name,
            idleCount: pool.idleCount,
            activeCount: pool.activeCount,
            ratio: (pool.idleCount / Math.max(pool.activeCount, 1)).toFixed(2)
          },
          suggestion: '考虑减少 minSize 或缩短 idleTimeout，避免浪费内存'
        });
      }

      if (pool.maxSize !== Infinity && pool.maxSize > 5000) {
        this.addIssue({
          category: 'pool_issue',
          type: 'pool_too_large',
          severity: 'warning',
          title: '对象池容量过大',
          description: `对象池 "${pool.name}" 最大容量为 ${pool.maxSize}，可能占用过多内存`,
          details: {
            poolName: pool.name,
            maxSize: pool.maxSize,
            currentSize: pool.currentSize,
            thresholdSize: 5000
          },
          suggestion: '评估实际需求，考虑减少 maxSize，或检查对象大小'
        });
      }
    }

    if (config.objectPools.length > 10) {
      this.addIssue({
        category: 'pool_issue',
        type: 'too_many_pools',
        severity: 'info',
        title: '对象池数量过多',
        description: `共有 ${config.objectPools.length} 个对象池，管理复杂度高`,
        details: {
          poolCount: config.objectPools.length,
          thresholdCount: 10
        },
        suggestion: '考虑合并功能相似的对象池，或使用通用对象池'
      });
    }
  }

  detectWeakRefMisuse() {
    const config = this.data.config;
    if (!config) return;

    if (config.weakRefUsage && config.weakRefUsage.length > 0) {
      for (const wr of config.weakRefUsage) {
        if (wr.hasHeldValue) {
          this.addIssue({
            category: 'weakref_misuse',
            type: 'weakref_with_held_value',
            severity: 'warning',
            title: 'WeakRef 持有强引用',
            description: `WeakRef "${wr.name}" 同时持有强引用，这会抵消弱引用的效果`,
            details: {
              weakRefName: wr.name,
              usage: wr.usage
            },
            suggestion: '确保 WeakRef 不持有目标对象的强引用'
          });
        }

        if (!wr.hasDeref) {
          this.addIssue({
            category: 'weakref_misuse',
            type: 'weakref_no_deref_check',
            severity: 'warning',
            title: 'WeakRef 未检查 deref 结果',
            description: `WeakRef "${wr.name}" 没有检查 deref() 返回值，可能导致空引用错误`,
            details: {
              weakRefName: wr.name,
              usage: wr.usage
            },
            suggestion: '使用 deref() 后检查返回值是否为 undefined'
          });
        }
      }
    }

    if (config.finalizationRegistryUsage && config.finalizationRegistryUsage.length > 0) {
      for (const fr of config.finalizationRegistryUsage) {
        if (fr.hasCleanupCallback && !fr.hasUnregister) {
          this.addIssue({
            category: 'weakref_misuse',
            type: 'finalization_without_unregister',
            severity: 'critical',
            title: 'FinalizationRegistry 回调可能泄漏',
            description: `FinalizationRegistry "${fr.name}" 有回调但没有 unregister，回调可能持有对象引用`,
            details: {
              registryName: fr.name,
              usage: fr.usage
            },
            suggestion: '必须在对象销毁时调用 registry.unregister(token)，否则回调中的引用可能导致内存泄漏'
          });
        }

        if (!fr.hasUnregister) {
          this.addIssue({
            category: 'weakref_misuse',
            type: 'finalization_no_unregister',
            severity: 'warning',
            title: 'FinalizationRegistry 未使用 unregister',
            description: `FinalizationRegistry "${fr.name}" 没有使用 unregister()`,
            details: {
              registryName: fr.name,
              usage: fr.usage
            },
            suggestion: '建议使用 unregister() 在对象生命周期结束时清理注册'
          });
        }
      }
    }

    const retainerPaths = this.data.retainerPaths;
    if (retainerPaths && retainerPaths.suspiciousPaths) {
      const weakRefPaths = retainerPaths.suspiciousPaths.filter(p => 
        p.matchedPatterns.some(mp => mp.name === 'WeakRef/FinalizationRegistry 引用')
      );

      if (weakRefPaths.length > 5) {
        this.addIssue({
          category: 'weakref_misuse',
          type: 'excessive_weakrefs',
          severity: 'info',
          title: 'WeakRef/FinalizationRegistry 使用较多',
          description: `发现 ${weakRefPaths.length} 个 WeakRef 或 FinalizationRegistry 相关引用`,
          details: {
            count: weakRefPaths.length
          },
          suggestion: '确认这些弱引用的使用是否必要，过多使用可能影响性能和可预测性'
        });
      }
    }
  }

  detectCacheIssues() {
    const config = this.data.config;
    if (!config || !config.caches) return;

    for (const cache of config.caches) {
      if (cache.maxSize === Infinity && cache.ttl === null) {
        this.addIssue({
          category: 'cache_issue',
          type: 'unbounded_cache_no_ttl',
          severity: 'critical',
          title: '无界缓存且无 TTL',
          description: `缓存 "${cache.name}" 既没有容量限制也没有过期时间，这是内存泄漏的高风险`,
          details: {
            cacheName: cache.name,
            type: cache.type,
            currentSize: cache.currentSize
          },
          suggestion: '必须设置 maxSize 和/或 ttl，否则缓存会无限增长'
        });
      }

      if (cache.maxSize === Infinity) {
        this.addIssue({
          category: 'cache_issue',
          type: 'unbounded_cache',
          severity: 'warning',
          title: '无界缓存',
          description: `缓存 "${cache.name}" 没有设置容量限制`,
          details: {
            cacheName: cache.name,
            type: cache.type,
            currentSize: cache.currentSize
          },
          suggestion: '设置合理的 maxSize，或确保有其他清理机制'
        });
      }

      if (cache.ttl === null) {
        this.addIssue({
          category: 'cache_issue',
          type: 'cache_no_ttl',
          severity: 'warning',
          title: '缓存无过期时间',
          description: `缓存 "${cache.name}" 没有设置 TTL，对象可能永远不会过期`,
          details: {
            cacheName: cache.name,
            type: cache.type,
            currentSize: cache.currentSize
          },
          suggestion: '设置合理的 ttl，定期清理过期数据'
        });
      }

      if (cache.maxSize !== Infinity && cache.maxSize > 100000) {
        this.addIssue({
          category: 'cache_issue',
          type: 'cache_too_large',
          severity: 'warning',
          title: '缓存容量过大',
          description: `缓存 "${cache.name}" 最大容量为 ${cache.maxSize}，可能占用过多内存`,
          details: {
            cacheName: cache.name,
            maxSize: cache.maxSize,
            currentSize: cache.currentSize,
            thresholdSize: 100000
          },
          suggestion: '评估实际需求，考虑减少 maxSize，或使用分级缓存'
        });
      }

      if (cache.currentSize > cache.maxSize * 0.9 && cache.maxSize !== Infinity) {
        this.addIssue({
          category: 'cache_issue',
          type: 'cache_near_capacity',
          severity: 'warning',
          title: '缓存接近容量',
          description: `缓存 "${cache.name}" 使用率超过 90% (当前: ${cache.currentSize}, 最大: ${cache.maxSize})`,
          details: {
            cacheName: cache.name,
            currentSize: cache.currentSize,
            maxSize: cache.maxSize,
            usagePercent: ((cache.currentSize / cache.maxSize) * 100).toFixed(1)
          },
          suggestion: '考虑增加 maxSize，或检查缓存命中率是否过低'
        });
      }

      if (cache.hitRate !== null && cache.hitRate < 0.5) {
        this.addIssue({
          category: 'cache_issue',
          type: 'low_cache_hit_rate',
          severity: 'info',
          title: '缓存命中率低',
          description: `缓存 "${cache.name}" 命中率仅为 ${(cache.hitRate * 100).toFixed(1)}%`,
          details: {
            cacheName: cache.name,
            hitRate: cache.hitRate,
            missRate: cache.missRate,
            thresholdRate: 0.5
          },
          suggestion: '考虑调整缓存策略，或检查是否适合使用缓存'
        });
      }
    }

    const endpointTraffic = this.data.endpointTraffic;
    if (endpointTraffic && endpointTraffic.memoryTrends) {
      const memoryTrends = endpointTraffic.memoryTrends;
      
      if (memoryTrends.trend === 'growing') {
        this.addIssue({
          category: 'cache_issue',
          type: 'memory_growing_with_traffic',
          severity: 'warning',
          title: '内存随流量持续增长',
          description: '内存使用量随时间持续增长，可能与缓存或对象池未正确清理有关',
          details: {
            trend: memoryTrends.trend,
            totalMemoryIncreaseMB: (memoryTrends.totalMemoryIncrease / (1024 * 1024)).toFixed(2)
          },
          suggestion: '检查缓存清理策略和对象池 idleTimeout'
        });
      }
    }
  }
}

module.exports = Detector;
