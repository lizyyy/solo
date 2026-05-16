package com.promptversion.repository;

import com.promptversion.entity.RollbackEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RollbackEventRepository extends JpaRepository<RollbackEvent, Long> {
    List<RollbackEvent> findByTemplateIdOrderByRollbackTimeDesc(Long templateId);
    List<RollbackEvent> findByVersionIdOrderByRollbackTimeDesc(Long versionId);
    List<RollbackEvent> findByTemplateIdAndProcessedFalse(Long templateId);
    boolean existsByVersionIdAndProcessedFalse(Long versionId);
}