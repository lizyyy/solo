package com.observability.tagvalidation.repository;

import com.observability.tagvalidation.entity.ViolationRecord;
import com.observability.tagvalidation.enums.ViolationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ViolationRecordRepository extends JpaRepository<ViolationRecord, Long> {
    List<ViolationRecord> findByApiInfoId(Long apiInfoId);
    List<ViolationRecord> findByApiInfoIdAndResolved(Long apiInfoId, Boolean resolved);
    List<ViolationRecord> findBySampleId(String sampleId);
    Optional<ViolationRecord> findByApiInfoIdAndViolationTypeAndTagKeyAndTagValue(
            Long apiInfoId, ViolationType violationType, String tagKey, String tagValue);
}
