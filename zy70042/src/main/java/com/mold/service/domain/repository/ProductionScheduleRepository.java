package com.mold.service.domain.repository;

import com.mold.service.domain.entity.ProductionSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductionScheduleRepository extends JpaRepository<ProductionSchedule, Long> {
    
    Optional<ProductionSchedule> findByScheduleNo(String scheduleNo);
    
    List<ProductionSchedule> findByStatusIn(List<ProductionSchedule.ScheduleStatus> statuses);
    
    List<ProductionSchedule> findByProductionLineAndStatusIn(String productionLine, List<ProductionSchedule.ScheduleStatus> statuses);
    
    List<ProductionSchedule> findByMoldIdAndStatusIn(Long moldId, List<ProductionSchedule.ScheduleStatus> statuses);
    
    @Query("SELECT s FROM ProductionSchedule s WHERE s.productionLine = :line AND s.status IN ('PLANNED', 'READY', 'IN_PROGRESS') ORDER BY s.plannedStartTime ASC")
    List<ProductionSchedule> findActiveSchedulesByLine(String line);
    
    @Query("SELECT s FROM ProductionSchedule s WHERE s.moldId = :moldId AND s.status = 'IN_PROGRESS'")
    List<ProductionSchedule> findInProgressSchedulesByMoldId(Long moldId);
    
    @Query("SELECT s FROM ProductionSchedule s WHERE s.productionLine = :line AND s.plannedStartTime <= :time AND s.plannedEndTime >= :time")
    List<ProductionSchedule> findSchedulesAtTime(String line, LocalDateTime time);
}
