package com.certificate.health.repository;

import com.certificate.health.enums.HealthStatus;
import com.certificate.health.model.CertificateFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CertificateFileRepository extends JpaRepository<CertificateFile, Long> {

    Optional<CertificateFile> findByRawCertificateData(String rawCertificateData);

    List<CertificateFile> findByStatus(HealthStatus status);

    List<CertificateFile> findByFileName(String fileName);
}
