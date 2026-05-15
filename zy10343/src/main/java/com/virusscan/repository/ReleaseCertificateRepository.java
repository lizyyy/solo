package com.virusscan.repository;

import com.virusscan.entity.ReleaseCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReleaseCertificateRepository extends JpaRepository<ReleaseCertificate, Long> {
    Optional<ReleaseCertificate> findByCertificateId(String certificateId);
    List<ReleaseCertificate> findByFileId(String fileId);
    List<ReleaseCertificate> findByTaskId(String taskId);
    List<ReleaseCertificate> findByReleasedBy(String releasedBy);
    List<ReleaseCertificate> findByReleaseTimeBetween(LocalDateTime start, LocalDateTime end);
    boolean existsByCertificateId(String certificateId);
}