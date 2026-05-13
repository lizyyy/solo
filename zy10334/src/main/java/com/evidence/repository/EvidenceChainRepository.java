package com.evidence.repository;

import com.evidence.entity.EvidenceChain;
import com.evidence.enums.EvidenceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EvidenceChainRepository extends JpaRepository<EvidenceChain, Long> {

    Optional<EvidenceChain> findByRequestId(String requestId);

    List<EvidenceChain> findByBusinessNo(String businessNo);

    List<EvidenceChain> findByStatus(EvidenceStatus status);

    List<EvidenceChain> findByCreatedAtBetween(LocalDateTime startTime, LocalDateTime endTime);

    @Query("SELECT e FROM EvidenceChain e WHERE e.businessNo = :businessNo ORDER BY e.createdAt DESC")
    List<EvidenceChain> findByBusinessNoOrderByCreatedAtDesc(@Param("businessNo") String businessNo);

    boolean existsByRequestId(String requestId);

    @Query("SELECT e FROM EvidenceChain e WHERE " +
           "(:businessNo IS NULL OR e.businessNo LIKE %:businessNo%) AND " +
           "(:status IS NULL OR e.status = :status) AND " +
           "(:sourceSystem IS NULL OR e.sourceSystem = :sourceSystem) " +
           "ORDER BY e.createdAt DESC")
    List<EvidenceChain> findByConditions(
            @Param("businessNo") String businessNo,
            @Param("status") EvidenceStatus status,
            @Param("sourceSystem") String sourceSystem);
}
