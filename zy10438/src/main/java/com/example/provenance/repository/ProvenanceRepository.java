package com.example.provenance.repository;

import com.example.provenance.model.ProvenanceRecord;
import com.example.provenance.model.ProvenanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProvenanceRepository extends JpaRepository<ProvenanceRecord, String> {

    Optional<ProvenanceRecord> findByImageTag(String imageTag);

    Optional<ProvenanceRecord> findByImageTagAndImageDigest(String imageTag, String imageDigest);

    List<ProvenanceRecord> findByStatus(ProvenanceStatus status);

    List<ProvenanceRecord> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT p FROM ProvenanceRecord p WHERE p.repository = :repository ORDER BY p.createdAt DESC")
    List<ProvenanceRecord> findByRepository(@Param("repository") String repository);

    @Query("SELECT p FROM ProvenanceRecord p WHERE p.status IN :statuses ORDER BY p.createdAt DESC")
    List<ProvenanceRecord> findByStatusIn(@Param("statuses") List<ProvenanceStatus> statuses);

    boolean existsByImageTag(String imageTag);
}
