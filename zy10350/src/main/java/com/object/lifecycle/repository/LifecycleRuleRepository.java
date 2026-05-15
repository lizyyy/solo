package com.object.lifecycle.repository;

import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.enums.RuleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LifecycleRuleRepository extends JpaRepository<LifecycleRule, Long> {

    Optional<LifecycleRule> findByRuleId(String ruleId);

    List<LifecycleRule> findByStatus(RuleStatus status);

    List<LifecycleRule> findByStatusIn(List<RuleStatus> statuses);

    boolean existsByRuleId(String ruleId);

    @Query("SELECT r FROM LifecycleRule r WHERE r.objectPrefix.id = :prefixId AND r.enabled = true AND r.status = 'ACTIVE'")
    List<LifecycleRule> findActiveRulesByPrefixId(Long prefixId);
}
