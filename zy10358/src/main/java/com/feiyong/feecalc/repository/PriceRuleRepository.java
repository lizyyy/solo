package com.feiyong.feecalc.repository;

import com.feiyong.feecalc.entity.PriceRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PriceRuleRepository extends JpaRepository<PriceRule, Long> {

    Optional<PriceRule> findByRuleCodeAndEnabledTrue(String ruleCode);

    boolean existsByRuleCode(String ruleCode);
}
