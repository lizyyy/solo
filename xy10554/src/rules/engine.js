const _ = require('lodash');
const { STATUS, CHANNEL_TYPE } = require('../models/content');
const IdempotentManager = require('../utils/idempotent');

class RuleEngine {
  static runAllRules(content, store) {
    const issues = [];
    const warnings = [];
    
    issues.push(...this.checkMissingOwner(content));
    issues.push(...this.checkCacheIssue(content, store));
    issues.push(...this.checkCooperationLinks(content));
    issues.push(...this.checkMultipleVersions(content, store));
    warnings.push(...this.checkPartialUnpublish(content));
    
    return {
      issues,
      warnings,
      hasBlockingIssues: issues.length > 0,
      overallStatus: this.calculateOverallStatus(content, issues)
    };
  }

  static checkMissingOwner(content) {
    const issues = [];
    
    if (!content.owner || content.owner.trim() === '') {
      issues.push({
        type: 'missing_owner',
        severity: 'high',
        field: 'owner',
        message: '内容缺少责任人信息',
        suggestion: '请指定撤稿负责人，以便追踪后续处理'
      });
    }
    
    content.channels.forEach((channel, index) => {
      if (!channel.owner || channel.owner.trim() === '') {
        issues.push({
          type: 'missing_owner',
          severity: 'medium',
          field: `channels[${index}].owner`,
          channelName: channel.channelName,
          message: `渠道 "${channel.channelName}" 缺少负责人`,
          suggestion: '请为每个渠道指定专门的撤稿执行人'
        });
      }
    });
    
    content.referencePages.forEach((ref, index) => {
      if (!ref.owner || ref.owner.trim() === '') {
        issues.push({
          type: 'missing_owner',
          severity: 'low',
          field: `referencePages[${index}].owner`,
          pageTitle: ref.title,
          message: `引用页面 "${ref.title}" 缺少负责人`,
          suggestion: '请为引用页面指定检查人'
        });
      }
    });
    
    return issues;
  }

  static checkCacheIssue(content, store) {
    const issues = [];
    
    content.channels.forEach((channel, index) => {
      if (channel.status === STATUS.UNPUBLISHED && channel.cacheStatus === 'active') {
        issues.push({
          type: 'cache_issue',
          severity: 'high',
          field: `channels[${index}].cacheStatus`,
          channelName: channel.channelName,
          message: `渠道 "${channel.channelName}" 已下线但缓存仍可访问`,
          suggestion: '请立即执行缓存清理操作'
        });
      }
      
      if (channel.status === STATUS.UNPUBLISHED && channel.cacheStatus === 'purging') {
        issues.push({
          type: 'cache_issue',
          severity: 'medium',
          field: `channels[${index}].cacheStatus`,
          channelName: channel.channelName,
          message: `渠道 "${channel.channelName}" 缓存清理中，需等待完成`,
          suggestion: '请等待缓存清理完成后重新验证'
        });
      }
      
      if (channel.status === STATUS.UNPUBLISHED && channel.cacheStatus === 'unknown') {
        issues.push({
          type: 'cache_issue',
          severity: 'medium',
          field: `channels[${index}].cacheStatus`,
          channelName: channel.channelName,
          message: `渠道 "${channel.channelName}" 缓存状态未知`,
          suggestion: '请执行缓存检查操作'
        });
      }
    });
    
    return issues;
  }

  static checkCooperationLinks(content) {
    const issues = [];
    
    content.channels.forEach((channel, index) => {
      if (channel.channelType === CHANNEL_TYPE.COOPERATION) {
        if (channel.status === STATUS.PENDING) {
          issues.push({
            type: 'cooperation_unconfirmed',
            severity: 'high',
            field: `channels[${index}].status`,
            channelName: channel.channelName,
            message: `合作方 "${channel.channelName}" 撤稿未确认`,
            suggestion: '请联系合作方确认撤稿执行情况'
          });
        }
        
        if (channel.status === STATUS.ACTIVE) {
          issues.push({
            type: 'cooperation_active',
            severity: 'high',
            field: `channels[${index}].status`,
            channelName: channel.channelName,
            message: `合作方 "${channel.channelName}" 内容仍在线`,
            suggestion: '请联系合作方立即下线内容'
          });
        }
        
        if (channel.errors && channel.errors.length > 0) {
          issues.push({
            type: 'cooperation_error',
            severity: 'medium',
            field: `channels[${index}].errors`,
            channelName: channel.channelName,
            message: `合作方 "${channel.channelName}" 撤稿异常: ${channel.errors[0]}`,
            suggestion: '请联系合作方技术支持排查问题'
          });
        }
      }
    });
    
    content.referencePages.forEach((ref, index) => {
      if (ref.status === STATUS.PENDING || ref.hasLink === null) {
        issues.push({
          type: 'reference_unverified',
          severity: 'medium',
          field: `referencePages[${index}].hasLink`,
          pageTitle: ref.title,
          message: `引用页面 "${ref.title}" 链接未确认`,
          suggestion: '请检查该页面是否仍包含撤稿内容链接'
        });
      }
      
      if (ref.hasLink === true) {
        issues.push({
          type: 'reference_has_link',
          severity: 'high',
          field: `referencePages[${index}].hasLink`,
          pageTitle: ref.title,
          message: `引用页面 "${ref.title}" 仍包含撤稿内容链接`,
          suggestion: '请联系页面负责人移除相关链接'
        });
      }
    });
    
    return issues;
  }

  static checkMultipleVersions(content, store) {
    const issues = [];
    
    const sameUrlContents = store.findContentByUrl(content.contentUrl);
    const allVersions = store.findContents({ contentUrl: content.contentUrl });
    
    if (allVersions.length > 1) {
      const activeVersions = allVersions.filter(c => c.id !== content.id && c.status === STATUS.ACTIVE);
      
      if (activeVersions.length > 0) {
        issues.push({
          type: 'multiple_versions',
          severity: 'medium',
          field: 'version',
          message: `发现 ${activeVersions.length} 个相同URL的其他活跃版本`,
          versions: activeVersions.map(v => ({
            id: v.id,
            title: v.title,
            version: v.version,
            status: v.status
          })),
          suggestion: '请确认这些版本是否也需要同步处理'
        });
      }
      
      const partialVersions = allVersions.filter(c => 
        c.id !== content.id && 
        (c.status === STATUS.PARTIAL || c.status === STATUS.FAILED)
      );
      
      if (partialVersions.length > 0) {
        issues.push({
          type: 'incomplete_versions',
          severity: 'high',
          field: 'status',
          message: `发现 ${partialVersions.length} 个相同URL的未完成撤稿版本`,
          versions: partialVersions.map(v => ({
            id: v.id,
            title: v.title,
            version: v.version,
            status: v.status
          })),
          suggestion: '请完成之前未完成的撤稿操作'
        });
      }
    }
    
    return issues;
  }

  static checkPartialUnpublish(content) {
    const warnings = [];
    
    const unpublishedCount = content.channels.filter(c => c.status === STATUS.UNPUBLISHED).length;
    const totalChannels = content.channels.length;
    
    if (unpublishedCount > 0 && unpublishedCount < totalChannels) {
      warnings.push({
        type: 'partial_unpublish',
        severity: 'info',
        message: `仅 ${unpublishedCount}/${totalChannels} 个渠道完成撤稿`,
        remaining: content.channels.filter(c => c.status !== STATUS.UNPUBLISHED).map(c => ({
          name: c.channelName,
          status: c.status
        })),
        suggestion: '请继续处理剩余渠道的撤稿工作'
      });
    }
    
    return warnings;
  }

  static calculateOverallStatus(content, issues) {
    const hasHighPriority = issues.some(i => i.severity === 'high');
    
    if (hasHighPriority) {
      return STATUS.FAILED;
    }
    
    return IdempotentManager.calculateContentStatus(content.channels);
  }

  static validateUnpublishRequest(contentId, store) {
    const content = store.getContent(contentId);
    if (!content) {
      return {
        valid: false,
        error: `内容记录不存在: ${contentId}`
      };
    }
    
    const duplicateCheck = IdempotentManager.checkDuplicateUnpublish(store, contentId);
    if (duplicateCheck.isDuplicate) {
      return {
        valid: true,
        isDuplicate: true,
        message: duplicateCheck.message
      };
    }
    
    const rules = this.runAllRules(content, store);
    
    return {
      valid: true,
      isDuplicate: false,
      rules,
      warnings: rules.warnings
    };
  }
}

module.exports = RuleEngine;
