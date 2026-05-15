package com.resource.tag.repository;

import com.resource.tag.model.OverrideRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OverrideRuleRepository extends JpaRepository<OverrideRule, Long> {
    List<OverrideRule> findByTargetNodeIdAndEnabledTrue(String targetNodeId);
    List<OverrideRule> findByTagKeyAndEnabledTrue(String tagKey);
}
