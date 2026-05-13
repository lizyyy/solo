package com.version.adapter.repository;

import com.version.adapter.entity.VersionTemplateMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VersionTemplateMappingRepository extends JpaRepository<VersionTemplateMapping, Long> {

    List<VersionTemplateMapping> findByClientVersionIdAndIsActiveTrue(Long clientVersionId);

    List<VersionTemplateMapping> findByTemplateIdAndIsActiveTrue(Long templateId);

    Optional<VersionTemplateMapping> findByClientVersionIdAndTemplateIdAndIsActiveTrue(Long clientVersionId, Long templateId);

    boolean existsByClientVersionIdAndTemplateIdAndIsActiveTrue(Long clientVersionId, Long templateId);
}
