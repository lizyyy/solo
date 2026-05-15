package com.virusscan.repository;

import com.virusscan.entity.Quarantine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuarantineRepository extends JpaRepository<Quarantine, Long> {
    Optional<Quarantine> findByQuarantineId(String quarantineId);
    Optional<Quarantine> findByFileIdAndIsReleasedFalse(String fileId);
    List<Quarantine> findByFileId(String fileId);
    List<Quarantine> findByIsReleasedFalse();
    List<Quarantine> findByQuarantineTimeBetween(LocalDateTime start, LocalDateTime end);
    boolean existsByQuarantineId(String quarantineId);
    boolean existsByFileIdAndIsReleasedFalse(String fileId);
}