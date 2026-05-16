package com.promptversion.repository;

import com.promptversion.entity.HitRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface HitRecordRepository extends JpaRepository<HitRecord, Long> {
    List<HitRecord> findByVersionIdOrderByHitTimeDesc(Long versionId);
    List<HitRecord> findByTemplateIdOrderByHitTimeDesc(Long templateId);
    List<HitRecord> findByTemplateIdAndHitTimeBetween(Long templateId, LocalDateTime startTime, LocalDateTime endTime);

    @Query("SELECT h.versionId, COUNT(h) FROM HitRecord h WHERE h.templateId = ?1 GROUP BY h.versionId")
    List<Object[]> countHitsByVersionIdForTemplate(Long templateId);
}