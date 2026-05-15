package com.observability.tagvalidation.repository;

import com.observability.tagvalidation.entity.ReportSample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReportSampleRepository extends JpaRepository<ReportSample, Long> {
    Optional<ReportSample> findBySampleId(String sampleId);
    boolean existsBySampleId(String sampleId);
    List<ReportSample> findByApiInfoId(Long apiInfoId);
    List<ReportSample> findByApiInfoIdAndValidated(Long apiInfoId, Boolean validated);
}
