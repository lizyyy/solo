package com.mold.service.domain.repository;

import com.mold.service.domain.entity.Mold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MoldRepository extends JpaRepository<Mold, Long> {
    
    Optional<Mold> findByMoldCode(String moldCode);
    
    List<Mold> findByStatusIn(List<Mold.MoldStatus> statuses);
    
    List<Mold> findByProductionLine(String productionLine);
    
    @Query("SELECT m FROM Mold m WHERE m.status = 'IN_USE' AND m.totalStrokes >= m.warningThreshold")
    List<Mold> findWarningMolds();
    
    @Query("SELECT m FROM Mold m WHERE m.status = 'IN_USE' AND m.totalStrokes >= m.lifeThreshold")
    List<Mold> findExpiredMolds();
    
    @Query("SELECT m FROM Mold m WHERE m.totalStrokes >= m.warningThreshold AND m.totalStrokes < m.lifeThreshold")
    List<Mold> findMoldsInWarningZone();
}
