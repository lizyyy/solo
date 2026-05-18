class RevokeChecker {
  constructor(data) {
    this.crowdPackages = data.crowdPackages.data;
    this.channelDelivery = data.channelDelivery.data;
    this.revokeRecords = data.revokeRecords.data;
    this.fileErrors = {
      crowdPackages: data.crowdPackages.errors || [],
      channelDelivery: data.channelDelivery.errors || [],
      revokeRecords: data.revokeRecords.errors || []
    };
  }

  check() {
    const results = [];
    const packageChannelMap = this.buildPackageChannelMap();
    const packageRevokeMap = this.buildPackageRevokeMap();

    for (const packageId of Object.keys(packageChannelMap)) {
      const packageInfo = this.crowdPackages.find(p => p.packageId === packageId);
      const deliveryChannels = packageChannelMap[packageId];
      const revokeRecords = packageRevokeMap[packageId] || [];

      const checkResult = this.checkPackageRevoke(
        packageId,
        packageInfo,
        deliveryChannels,
        revokeRecords
      );
      results.push(checkResult);
    }

    return {
      checkTime: new Date(),
      totalPackages: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      warning: results.filter(r => r.status === 'WARNING').length,
      fileErrors: this.fileErrors,
      details: results
    };
  }

  buildPackageChannelMap() {
    const map = {};
    for (const delivery of this.channelDelivery) {
      if (!map[delivery.packageId]) {
        map[delivery.packageId] = [];
      }
      map[delivery.packageId].push(delivery);
    }
    return map;
  }

  buildPackageRevokeMap() {
    const map = {};
    for (const revoke of this.revokeRecords) {
      if (!map[revoke.packageId]) {
        map[revoke.packageId] = [];
      }
      map[revoke.packageId].push(revoke);
    }
    return map;
  }

  checkPackageRevoke(packageId, packageInfo, deliveryChannels, revokeRecords) {
    const packageName = packageInfo?.packageName || '';
    
    if (revokeRecords.length === 0) {
      return {
        packageId,
        packageName,
        status: 'NO_REVOKE',
        message: '无撤销记录',
        details: this.buildDetails(deliveryChannels, [])
      };
    }

    const latestRevoke = this.getLatestRevokeRecord(revokeRecords);
    const ruleVersion = latestRevoke.ruleVersion;

    if (latestRevoke.revokeStatus !== 'completed') {
      return {
        packageId,
        packageName,
        status: 'WARNING',
        message: `撤销未完成，当前状态: ${latestRevoke.revokeStatus}`,
        ruleVersion,
        latestRevokeTime: latestRevoke.revokeTime,
        details: this.buildDetails(deliveryChannels, revokeRecords)
      };
    }

    const checkResult = this.checkAllChannelsRevoked(
      deliveryChannels,
      revokeRecords,
      latestRevoke,
      ruleVersion
    );

    return {
      packageId,
      packageName,
      status: checkResult.allRevoked ? 'PASS' : 'FAIL',
      message: checkResult.allRevoked 
        ? '全渠道撤销生效' 
        : `存在未撤销渠道: ${checkResult.unrevokedChannels.map(c => c.channelName || c.channelCode).join(', ')}`,
      ruleVersion,
      latestRevokeTime: latestRevoke.revokeTime,
      revokeCount: revokeRecords.length,
      totalChannels: deliveryChannels.length,
      revokedChannels: checkResult.revokedChannels.length,
      unrevokedChannels: checkResult.unrevokedChannels.length,
      details: checkResult
    };
  }

  getLatestRevokeRecord(revokeRecords) {
    return revokeRecords.reduce((latest, current) => {
      if (!latest.revokeTime || current.revokeTime > latest.revokeTime) {
        return current;
      }
      return latest;
    });
  }

  checkAllChannelsRevoked(deliveryChannels, revokeRecords, latestRevoke, ruleVersion) {
    const revokedChannels = [];
    const unrevokedChannels = [];
    const channelCheckDetails = [];

    for (const channel of deliveryChannels) {
      const check = this.checkSingleChannelRevoked(
        channel,
        revokeRecords,
        latestRevoke,
        ruleVersion
      );
      
      channelCheckDetails.push(check);
      
      if (check.isRevoked) {
        revokedChannels.push(channel);
      } else {
        unrevokedChannels.push(channel);
      }
    }

    const hasDuplicateRevoke = revokeRecords.length > 1;
    const hasDelay = this.checkChannelDelay(deliveryChannels, revokeRecords, latestRevoke);

    return {
      allRevoked: unrevokedChannels.length === 0,
      revokedChannels,
      unrevokedChannels,
      channelCheckDetails,
      hasDuplicateRevoke,
      hasDelay,
      ruleVersionChanged: this.checkRuleVersionChanged(revokeRecords),
      revokeRecords: revokeRecords.map(r => ({
        time: r.revokeTime,
        channel: r.revokeChannel,
        status: r.revokeStatus,
        version: r.ruleVersion
      }))
    };
  }

  checkSingleChannelRevoked(channel, revokeRecords, latestRevoke, ruleVersion) {
    const channelCode = channel.channelCode;
    const channelName = channel.channelName;
    const deliveryTime = channel.deliveryTime;
    const deliveryStatus = channel.deliveryStatus;

    if (deliveryStatus === 'revoked') {
      return {
        channelCode,
        channelName,
        isRevoked: true,
        reason: '渠道投放状态已标记为撤销',
        deliveryStatus,
        checkMethod: 'status_check'
      };
    }

    if (ruleVersion === 'v1') {
      return this.checkRuleV1(channel, revokeRecords, latestRevoke);
    } else if (ruleVersion === 'v2') {
      return this.checkRuleV2(channel, revokeRecords, latestRevoke);
    } else {
      return this.checkRuleDefault(channel, revokeRecords, latestRevoke);
    }
  }

  checkRuleV1(channel, revokeRecords, latestRevoke) {
    const hasChannelRevoke = revokeRecords.some(r => 
      r.revokeChannel === 'all' || 
      r.revokeChannel === channel.channelCode
    );

    if (hasChannelRevoke && latestRevoke.revokeStatus === 'completed') {
      return {
        channelCode: channel.channelCode,
        channelName: channel.channelName,
        isRevoked: true,
        reason: 'V1规则：存在对应撤销记录且已完成',
        ruleVersion: 'v1',
        checkMethod: 'rule_v1'
      };
    }

    return {
      channelCode: channel.channelCode,
      channelName: channel.channelName,
      isRevoked: false,
      reason: hasChannelRevoke 
        ? 'V1规则：存在撤销记录但未完成' 
        : 'V1规则：未找到对应撤销记录',
      ruleVersion: 'v1',
      checkMethod: 'rule_v1'
    };
  }

  checkRuleV2(channel, revokeRecords, latestRevoke) {
    const channelRevoke = revokeRecords.find(r => 
      (r.revokeChannel === 'all' || r.revokeChannel === channel.channelCode) &&
      r.revokeStatus === 'completed'
    );

    if (!channelRevoke) {
      return {
        channelCode: channel.channelCode,
        channelName: channel.channelName,
        isRevoked: false,
        reason: 'V2规则：未找到已完成的对应撤销记录',
        ruleVersion: 'v2',
        checkMethod: 'rule_v2'
      };
    }

    if (channel.deliveryTime && channel.deliveryTime > channelRevoke.revokeTime) {
      return {
        channelCode: channel.channelCode,
        channelName: channel.channelName,
        isRevoked: false,
        reason: 'V2规则：投放时间晚于撤销时间，可能存在重复发布',
        deliveryTime: channel.deliveryTime,
        revokeTime: channelRevoke.revokeTime,
        ruleVersion: 'v2',
        checkMethod: 'rule_v2'
      };
    }

    const timeDiff = channel.deliveryTime 
      ? Math.abs(channelRevoke.revokeTime - channel.deliveryTime) / (1000 * 60 * 60)
      : 0;

    if (timeDiff < 24 && timeDiff > 0) {
      return {
        channelCode: channel.channelCode,
        channelName: channel.channelName,
        isRevoked: true,
        reason: `V2规则：撤销生效（投放与撤销间隔${timeDiff.toFixed(1)}小时，存在延迟风险）`,
        hasDelayRisk: true,
        delayHours: timeDiff,
        ruleVersion: 'v2',
        checkMethod: 'rule_v2'
      };
    }

    return {
      channelCode: channel.channelCode,
      channelName: channel.channelName,
      isRevoked: true,
      reason: 'V2规则：撤销生效',
      ruleVersion: 'v2',
      checkMethod: 'rule_v2'
    };
  }

  checkRuleDefault(channel, revokeRecords, latestRevoke) {
    const hasChannelRevoke = revokeRecords.some(r => 
      (r.revokeChannel === 'all' || r.revokeChannel === channel.channelCode) &&
      r.revokeStatus === 'completed'
    );

    return {
      channelCode: channel.channelCode,
      channelName: channel.channelName,
      isRevoked: hasChannelRevoke,
      reason: hasChannelRevoke 
        ? '默认规则：存在对应已完成的撤销记录' 
        : '默认规则：未找到对应已完成的撤销记录',
      checkMethod: 'default'
    };
  }

  checkChannelDelay(deliveryChannels, revokeRecords, latestRevoke) {
    for (const channel of deliveryChannels) {
      if (channel.deliveryTime && latestRevoke.revokeTime) {
        const timeDiff = Math.abs(latestRevoke.revokeTime - channel.deliveryTime) / (1000 * 60 * 60);
        if (timeDiff > 0 && timeDiff < 24) {
          return true;
        }
      }
    }
    return false;
  }

  checkRuleVersionChanged(revokeRecords) {
    const versions = new Set(revokeRecords.map(r => r.ruleVersion));
    return versions.size > 1;
  }

  buildDetails(deliveryChannels, revokeRecords) {
    return {
      deliveryChannels: deliveryChannels.map(c => ({
        code: c.channelCode,
        name: c.channelName,
        status: c.deliveryStatus,
        time: c.deliveryTime
      })),
      revokeRecords: revokeRecords.map(r => ({
        time: r.revokeTime,
        channel: r.revokeChannel,
        status: r.revokeStatus,
        version: r.ruleVersion
      }))
    };
  }
}

module.exports = RevokeChecker;
