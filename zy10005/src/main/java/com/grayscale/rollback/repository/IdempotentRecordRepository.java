package com.grayscale.rollback.repository;

import com.grayscale.rollback.entity.IdempotentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface IdempotentRecordRepository extends JpaRepository<IdempotentRecord, Long> {
    
    Optional<IdempotentRecord> findByIdempotentKey(String idempotentKey);
    
    @Modifying
    @Query("DELETE FROM IdempotentRecord ir WHERE ir.expiresAt < :now")
    void deleteExpiredRecords(@Param("now") LocalDateTime now);
}
