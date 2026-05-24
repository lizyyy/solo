package com.livestock.transfer.repository;

import com.livestock.transfer.entity.QuarantineCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QuarantineCertificateRepository extends JpaRepository<QuarantineCertificate, Long> {
    Optional<QuarantineCertificate> findByCertificateNo(String certificateNo);
}
