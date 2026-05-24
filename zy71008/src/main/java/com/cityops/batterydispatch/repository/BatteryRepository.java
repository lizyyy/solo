package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.Battery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BatteryRepository extends JpaRepository<Battery, Long> {
    Optional<Battery> findByBatteryNoAndActiveTrue(String batteryNo);

    boolean existsByBatteryNoAndActiveTrue(String batteryNo);
}
