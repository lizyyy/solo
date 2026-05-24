package com.floodrelief.repository;

import com.floodrelief.entity.TransferRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransferRecordRepository extends JpaRepository<TransferRecord, Long> {
    List<TransferRecord> findByShelterIdOrderByCreatedAtDesc(Long shelterId);
    
    @Query("SELECT t FROM TransferRecord t WHERE t.shelterId = ?1 ORDER BY t.createdAt DESC LIMIT 1")
    Optional<TransferRecord> findLatestByShelterId(Long shelterId);
}
