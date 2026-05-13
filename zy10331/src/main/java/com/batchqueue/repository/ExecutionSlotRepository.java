package com.batchqueue.repository;

import com.batchqueue.model.entity.ExecutionSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExecutionSlotRepository extends JpaRepository<ExecutionSlot, Long> {
    Optional<ExecutionSlot> findBySlotNumber(Integer slotNumber);
    
    @Query("SELECT s FROM ExecutionSlot s WHERE s.isOccupied = false ORDER BY s.slotNumber ASC")
    List<ExecutionSlot> findAvailableSlots();
    
    @Query("SELECT COUNT(s) FROM ExecutionSlot s WHERE s.isOccupied = false")
    long countAvailableSlots();
    
    @Query("SELECT COUNT(s) FROM ExecutionSlot s WHERE s.isOccupied = true")
    long countOccupiedSlots();
    
    boolean existsBySlotNumber(Integer slotNumber);
}
