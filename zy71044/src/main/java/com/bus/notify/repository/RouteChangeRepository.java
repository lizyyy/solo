package com.bus.notify.repository;

import com.bus.notify.entity.RouteChange;
import com.bus.notify.enums.RouteChangeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface RouteChangeRepository extends JpaRepository<RouteChange, Long> {
    Optional<RouteChange> findByChangeNo(String changeNo);
    
    List<RouteChange> findByStatus(RouteChangeStatus status);
    
    List<RouteChange> findByStatusIn(List<RouteChangeStatus> statuses);
    
    @Query("SELECT r FROM RouteChange r WHERE r.effectiveDate <= :date AND r.status NOT IN ('COMPLETED', 'CANCELLED')")
    List<RouteChange> findActiveRouteChangesByDate(LocalDate date);
    
    List<RouteChange> findByRouteNo(String routeNo);
    
    boolean existsByChangeNo(String changeNo);
}
