package com.object.lifecycle.service;

import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.entity.ObjectPrefix;
import com.object.lifecycle.repository.LifecycleRuleRepository;
import com.object.lifecycle.repository.ObjectPrefixRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RuleMatcherService {

    private final LifecycleRuleRepository ruleRepository;
    private final ObjectPrefixRepository prefixRepository;

    public Optional<LifecycleRule> matchRule(String objectKey, String bucketName) {
        log.debug("匹配规则: objectKey={}, bucketName={}", objectKey, bucketName);

        return prefixRepository.findByEnabledTrue().stream()
                .filter(prefix -> prefix.getBucketName().equals(bucketName))
                .filter(prefix -> objectKey.startsWith(prefix.getPrefix()))
                .findFirst()
                .flatMap(prefix -> ruleRepository.findActiveRulesByPrefixId(prefix.getId()).stream()
                        .filter(rule -> rule.getEnabled())
                        .findFirst());
    }

    public boolean isObjectMatchRule(LifecycleRule rule, String objectKey, String bucketName) {
        if (rule.getObjectPrefix() == null) {
            return false;
        }
        ObjectPrefix prefix = rule.getObjectPrefix();
        return prefix.getBucketName().equals(bucketName) && objectKey.startsWith(prefix.getPrefix());
    }
}
