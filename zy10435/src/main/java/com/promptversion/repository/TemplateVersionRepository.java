package com.promptversion.repository;

import com.promptversion.entity.TemplateVersion;
import com.promptversion.enums.VersionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateVersionRepository extends JpaRepository<TemplateVersion, Long> {
    List<TemplateVersion> findByTemplateIdOrderByCreatedAtDesc(Long templateId);
    Optional<TemplateVersion> findByTemplateIdAndVersionNumber(Long templateId, String versionNumber);
    List<TemplateVersion> findByTemplateIdAndStatus(Long templateId, VersionStatus status);
    List<TemplateVersion> findByTemplateIdAndStatusIn(Long templateId, List<VersionStatus> statuses);

    @Query("SELECT v FROM TemplateVersion v WHERE v.templateId = ?1 AND v.status = 'ACTIVE' ORDER BY v.trafficPercentage DESC")
    List<TemplateVersion> findActiveVersionsByTemplateId(Long templateId);

    boolean existsByTemplateIdAndVersionNumber(Long templateId, String versionNumber);
}