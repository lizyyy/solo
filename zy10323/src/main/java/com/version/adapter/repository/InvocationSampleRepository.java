package com.version.adapter.repository;

import com.version.adapter.entity.InvocationSample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvocationSampleRepository extends JpaRepository<InvocationSample, Long> {

    Optional<InvocationSample> findByRequestId(String requestId);

    List<InvocationSample> findByClientVersionId(Long clientVersionId);

    List<InvocationSample> findByTemplateId(Long templateId);

    List<InvocationSample> findByClientVersionIdAndTemplateId(Long clientVersionId, Long templateId);

    List<InvocationSample> findByInvokedAtBetween(LocalDateTime start, LocalDateTime end);

    List<InvocationSample> findByHasErrorsTrue();

    List<InvocationSample> findByHasWarningsTrue();

    boolean existsByRequestId(String requestId);
}
