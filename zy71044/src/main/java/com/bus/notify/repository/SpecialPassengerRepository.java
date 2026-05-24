package com.bus.notify.repository;

import com.bus.notify.entity.SpecialPassenger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpecialPassengerRepository extends JpaRepository<SpecialPassenger, Long> {
    Optional<SpecialPassenger> findByCardNo(String cardNo);
    
    List<SpecialPassenger> findByActiveTrue();
    
    List<SpecialPassenger> findByNeedPhoneCallTrueAndActiveTrue();
    
    @Query("SELECT p FROM SpecialPassenger p WHERE p.active = true AND (p.commonRoute LIKE %:route% OR p.commonStation LIKE %:station%)")
    List<SpecialPassenger> findAffectedPassengers(String route, String station);
    
    @Query("SELECT p FROM SpecialPassenger p WHERE p.active = true AND p.needPhoneCall = true AND (p.commonRoute LIKE %:route% OR p.commonStation LIKE %:station%)")
    List<SpecialPassenger> findPassengersNeedPhoneCall(String route, String station);
    
    List<SpecialPassenger> findByCommonStationContainingAndActiveTrue(String station);
}
