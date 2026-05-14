package com.account.freeze.service;

import com.account.freeze.dto.FreezeRuleCreateDTO;
import com.account.freeze.entity.FreezeRule;
import com.account.freeze.mapper.FreezeRuleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FreezeRuleService {

    private final FreezeRuleMapper freezeRuleMapper;

    public Integer getCurrentRuleVersion() {
        Integer maxVersion = freezeRuleMapper.getMaxActiveVersion();
        return maxVersion != null ? maxVersion : 1;
    }

    public String getRuleDesc(Integer ruleVersion) {
        FreezeRule rule = freezeRuleMapper.selectByVersion(ruleVersion);
        if (rule != null) {
            return rule.getRuleDesc();
        }
        return "规则版本 " + ruleVersion + "：短信内容完整即可冻结";
    }

    public FreezeRule getRuleByVersion(Integer version) {
        return freezeRuleMapper.selectByVersion(version);
    }

    @Transactional(rollbackFor = Exception.class)
    public FreezeRule createNewRule(FreezeRuleCreateDTO dto) {
        Integer currentVersion = getCurrentRuleVersion();
        Integer newVersion = currentVersion + 1;

        FreezeRule newRule = new FreezeRule();
        newRule.setRuleVersion(newVersion);
        newRule.setRuleName(dto.getRuleName());
        newRule.setRuleContent(dto.getRuleContent() != null ? dto.getRuleContent() : "{}");
        newRule.setRuleDesc(dto.getRuleDesc());
        newRule.setStatus("ACTIVE");
        newRule.setEffectiveTime(LocalDateTime.now());
        newRule.setOperator(dto.getOperator());
        newRule.setCreatedTime(LocalDateTime.now());
        newRule.setUpdatedTime(LocalDateTime.now());

        freezeRuleMapper.insert(newRule);

        log.info("创建新规则成功，版本: {}", newVersion);
        return newRule;
    }

    public List<FreezeRule> listAllRules() {
        return freezeRuleMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeRule>()
                .orderByDesc(FreezeRule::getRuleVersion)
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public void disableRule(Integer version, String operator) {
        FreezeRule rule = freezeRuleMapper.selectByVersion(version);
        if (rule == null) {
            throw new RuntimeException("规则不存在");
        }

        rule.setStatus("INACTIVE");
        rule.setExpireTime(LocalDateTime.now());
        rule.setUpdatedTime(LocalDateTime.now());
        freezeRuleMapper.updateById(rule);

        log.info("禁用规则成功，版本: {}, 操作人: {}", version, operator);
    }

    public void initDefaultRules(String operator) {
        Integer currentVersion = getCurrentRuleVersion();
        if (currentVersion == 1 && freezeRuleMapper.selectByVersion(1) == null) {
            FreezeRule defaultRule = new FreezeRule();
            defaultRule.setRuleVersion(1);
            defaultRule.setRuleName("初始冻结规则");
            defaultRule.setRuleContent("{\"requireSmsEvidence\":true,\"requireLogisticsEvidence\":false,\"allowPartialSuccess\":true}");
            defaultRule.setRuleDesc("规则版本 1：短信内容完整即可冻结");
            defaultRule.setStatus("ACTIVE");
            defaultRule.setEffectiveTime(LocalDateTime.now());
            defaultRule.setOperator(operator);
            defaultRule.setCreatedTime(LocalDateTime.now());
            defaultRule.setUpdatedTime(LocalDateTime.now());
            freezeRuleMapper.insert(defaultRule);
            log.info("初始化默认规则，版本: 1");
        }
    }
}
