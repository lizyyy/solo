package com.bus.notify.repository;

import com.bus.notify.entity.StationChange;
import com.bus.notify.enums.StationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StationChangeRepository extends JpaRepository<StationChange, Long> {
    List<StationChange> findByRouteChangeId(Long routeChangeId);
    
    List<StationChange> findByRouteChangeIdAndStatus(Long routeChangeId, StationStatus status);
    
    @Query("SELECT s FROM StationChange s WHERE s.routeChange.id = :routeChangeId AND s.notified = false")
    List<StationChange> findUnnotifiedStationsByRouteChangeId(Long routeChangeId);
    
    @Query("SELECT s FROM StationChange s WHERE s.routeChange.id = :routeChangeId AND s.status = 'TEMPORARY_CLOSED' AND s.recoveryNotified = false")
    List<StationChange> findRecoveryPendingStations(Long routeChangeId);
    
    @Query("SELECT s FROM StationChange s WHERE s.routeChange.id = :routeChangeId AND s.isTemporary = true")
    List<StationChange> findTemporaryStationsByRouteChangeId(Long routeChangeId);
}
