package com.manufacture.outsourcing.repository;

import com.manufacture.outsourcing.entity.DeductionRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface DeductionRuleRepository extends JpaRepository<DeductionRule, Long>, JpaSpecificationExecutor<DeductionRule> {

    Optional<DeductionRule> findByRuleCode(String ruleCode);

    List<DeductionRule> findByIsActiveTrue();

    List<DeductionRule> findBySupplierIdAndIsActiveTrue(Long supplierId);

    List<DeductionRule> findByDefectTypeAndIsActiveTrue(String defectType);

    List<DeductionRule> findBySupplierIdAndDefectTypeAndIsActiveTrue(Long supplierId, String defectType);
}
