package com.dormitory.maintenance.repository;

import com.dormitory.maintenance.entity.DormBuilding;
import com.dormitory.maintenance.entity.QuietPeriod;
import com.dormitory.maintenance.enums.QuietPeriodType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface QuietPeriodRepository extends JpaRepository<QuietPeriod, Long> {
    List<QuietPeriod> findByActiveTrue();

    @Query("SELECT q FROM QuietPeriod q WHERE q.active = true " +
           "AND (q.allBuildings = true OR q.building = :building) " +
           "AND q.startDate <= :endTime AND q.endDate >= :startTime")
    List<QuietPeriod> findConflictingPeriods(
            @Param("building") DormBuilding building,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    List<QuietPeriod> findByPeriodTypeAndActiveTrue(QuietPeriodType periodType);
}
