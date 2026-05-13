package com.version.adapter.repository;

import com.version.adapter.entity.CompatibilityWarning;
import com.version.adapter.entity.enums.WarningLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CompatibilityWarningRepository extends JpaRepository<CompatibilityWarning, Long> {

    List<CompatibilityWarning> findByClientVersionId(Long clientVersionId);

    List<CompatibilityWarning> findByTemplateId(Long templateId);

    List<CompatibilityWarning> findByClientVersionIdAndTemplateId(Long clientVersionId, Long templateId);

    List<CompatibilityWarning> findByLevel(WarningLevel level);

    List<CompatibilityWarning> findByIsResolvedFalse();

    List<CompatibilityWarning> findByIsResolvedTrue();
}
