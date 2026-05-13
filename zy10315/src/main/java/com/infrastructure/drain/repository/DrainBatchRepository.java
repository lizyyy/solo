package com.infrastructure.drain.repository;

import com.infrastructure.drain.model.DrainBatch;
import com.infrastructure.drain.model.DrainStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DrainBatchRepository extends JpaRepository<DrainBatch, Long> {
    
    Optional<DrainBatch> findByBatchId(String batchId);
    
    boolean existsByBatchId(String batchId);
    
    List<DrainBatch> findByStatus(DrainStatus status);
    
    @Query("SELECT b FROM DrainBatch b WHERE b.createdAt BETWEEN :startTime AND :endTime ORDER BY b.createdAt DESC")
    List<DrainBatch> findByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
    
    @Query("SELECT b FROM DrainBatch b WHERE b.operator = :operator ORDER BY b.createdAt DESC")
    List<DrainBatch> findByOperator(@Param("operator") String operator);
    
    @Query("SELECT b FROM DrainBatch b ORDER BY b.createdAt DESC")
    List<DrainBatch> findAllOrderByCreatedAtDesc();
}
