package com.business.recalculate.repository;

import com.business.recalculate.model.ProcessingRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessingRuleRepository extends JpaRepository<ProcessingRule, Long> {
    
    List<ProcessingRule> findByEnabledTrue();
    
    List<ProcessingRule> findByRuleCode(String ruleCode);
}
