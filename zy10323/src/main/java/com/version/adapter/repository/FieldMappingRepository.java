package com.version.adapter.repository;

import com.version.adapter.entity.FieldMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FieldMappingRepository extends JpaRepository<FieldMapping, Long> {

    List<FieldMapping> findByTemplateIdAndIsActiveTrueOrderBySortOrder(Long templateId);

    Optional<FieldMapping> findByTemplateIdAndSourceFieldAndIsActiveTrue(Long templateId, String sourceField);

    boolean existsByTemplateIdAndSourceFieldAndIsActiveTrue(Long templateId, String sourceField);
}
