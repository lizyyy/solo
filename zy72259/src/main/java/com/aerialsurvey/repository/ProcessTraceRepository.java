package com.aerialsurvey.repository;

import com.aerialsurvey.entity.ProcessTrace;
import com.aerialsurvey.enums.ProcessStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProcessTraceRepository extends JpaRepository<ProcessTrace, Long> {
    List<ProcessTrace> findByParkingLotCodeOrderByOperatedAtAsc(String parkingLotCode);
    List<ProcessTrace> findByParkingLotCodeAndProcessStep(String parkingLotCode, ProcessStep processStep);
    boolean existsByParkingLotCodeAndProcessStep(String parkingLotCode, ProcessStep processStep);
}
