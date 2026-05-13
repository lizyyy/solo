package com.object.lifecycle.service;

import com.object.lifecycle.dto.CreateRuleRequest;
import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.entity.ObjectPrefix;
import com.object.lifecycle.enums.RuleStatus;
import com.object.lifecycle.exception.BusinessException;
import com.object.lifecycle.repository.LifecycleRuleRepository;
import com.object.lifecycle.repository.ObjectPrefixRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LifecycleRuleService {

    private final LifecycleRuleRepository ruleRepository;
    private final ObjectPrefixRepository prefixRepository;
    private final AuditLogService auditLogService;

    @Transactional
    public LifecycleRule createRule(CreateRuleRequest request) {
        if (ruleRepository.existsByRuleId(request.getRuleId())) {
            throw new BusinessException(400, "规则ID已存在: " + request.getRuleId());
        }

        ObjectPrefix prefix = prefixRepository.findById(request.getPrefixId())
                .orElseThrow(() -> new BusinessException(404, "对象前缀不存在"));

        LifecycleRule rule = new LifecycleRule();
        rule.setRuleId(request.getRuleId());
        rule.setRuleName(request.getRuleName());
        rule.setDescription(request.getDescription());
        rule.setObjectPrefix(prefix);
        rule.setArchiveAfterDays(request.getArchiveAfterDays());
        rule.setDeleteAfterDays(request.getDeleteAfterDays());
        rule.setStorageClass(request.getStorageClass());
        rule.setStatus(RuleStatus.DRAFT);
        rule.setEnabled(true);

        LifecycleRule saved = ruleRepository.save(rule);
        auditLogService.logAction("LifecycleRule", saved.getId().toString(), "CREATE", null, null);
        log.info("创建生命周期规则: {}", saved.getRuleId());
        return saved;
    }

    public LifecycleRule getRuleByRuleId(String ruleId) {
        return ruleRepository.findByRuleId(ruleId)
                .orElseThrow(() -> new BusinessException(404, "规则不存在"));
    }

    public List<LifecycleRule> getAllRules() {
        return ruleRepository.findAll();
    }

    public List<LifecycleRule> getRulesByStatus(RuleStatus status) {
        return ruleRepository.findByStatus(status);
    }

    @Transactional
    public LifecycleRule verifyRule(String ruleId) {
        LifecycleRule rule = getRuleByRuleId(ruleId);
        if (rule.getStatus() != RuleStatus.DRAFT) {
            throw new BusinessException(400, "只有草稿状态的规则才能校验");
        }
        if (rule.getArchiveAfterDays() == null && rule.getDeleteAfterDays() == null) {
            throw new BusinessException(400, "归档天数和删除天数不能同时为空");
        }
        if (rule.getArchiveAfterDays() != null && rule.getDeleteAfterDays() != null
                && rule.getDeleteAfterDays() <= rule.getArchiveAfterDays()) {
            throw new BusinessException(400, "删除天数必须大于归档天数");
        }

        RuleStatus oldStatus = rule.getStatus();
        rule.setStatus(RuleStatus.VERIFIED);
        LifecycleRule saved = ruleRepository.save(rule);
        auditLogService.logAction("LifecycleRule", saved.getId().toString(), "VERIFY",
                "status", oldStatus.name(), RuleStatus.VERIFIED.name());
        return saved;
    }

    @Transactional
    public LifecycleRule activateRule(String ruleId) {
        LifecycleRule rule = getRuleByRuleId(ruleId);
        if (rule.getStatus() != RuleStatus.VERIFIED && rule.getStatus() != RuleStatus.SUSPENDED) {
            throw new BusinessException(400, "只有已校验或已暂停的规则才能激活");
        }

        RuleStatus oldStatus = rule.getStatus();
        rule.setStatus(RuleStatus.ACTIVE);
        LifecycleRule saved = ruleRepository.save(rule);
        auditLogService.logAction("LifecycleRule", saved.getId().toString(), "ACTIVATE",
                "status", oldStatus.name(), RuleStatus.ACTIVE.name());
        return saved;
    }

    @Transactional
    public LifecycleRule suspendRule(String ruleId) {
        LifecycleRule rule = getRuleByRuleId(ruleId);
        if (rule.getStatus() != RuleStatus.ACTIVE) {
            throw new BusinessException(400, "只有激活状态的规则才能暂停");
        }

        RuleStatus oldStatus = rule.getStatus();
        rule.setStatus(RuleStatus.SUSPENDED);
        LifecycleRule saved = ruleRepository.save(rule);
        auditLogService.logAction("LifecycleRule", saved.getId().toString(), "SUSPEND",
                "status", oldStatus.name(), RuleStatus.SUSPENDED.name());
        return saved;
    }

    @Transactional
    public LifecycleRule cancelRule(String ruleId) {
        LifecycleRule rule = getRuleByRuleId(ruleId);
        if (rule.getStatus() == RuleStatus.CANCELLED || rule.getStatus() == RuleStatus.ARCHIVED) {
            throw new BusinessException(400, "该状态下的规则不能撤销");
        }

        RuleStatus oldStatus = rule.getStatus();
        rule.setStatus(RuleStatus.CANCELLED);
        LifecycleRule saved = ruleRepository.save(rule);
        auditLogService.logAction("LifecycleRule", saved.getId().toString(), "CANCEL",
                "status", oldStatus.name(), RuleStatus.CANCELLED.name());
        return saved;
    }
}
