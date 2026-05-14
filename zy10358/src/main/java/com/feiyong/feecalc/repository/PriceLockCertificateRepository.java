package com.feiyong.feecalc.repository;

import com.feiyong.feecalc.entity.PriceLockCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PriceLockCertificateRepository extends JpaRepository<PriceLockCertificate, Long> {

    Optional<PriceLockCertificate> findByCertificateNo(String certificateNo);

    Optional<PriceLockCertificate> findByRequestNoAndValidTrue(String requestNo);

    List<PriceLockCertificate> findByValidTrueAndExpiredAtBefore(LocalDateTime now);

    boolean existsByRequestNoAndValidTrue(String requestNo);
}
