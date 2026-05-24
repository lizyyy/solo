package com.warehouse.charging.repository;

import com.warehouse.charging.enums.StationStatus;
import com.warehouse.charging.model.ChargingStation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChargingStationRepository extends JpaRepository<ChargingStation, Long> {
    Optional<ChargingStation> findByStationCode(String stationCode);
    boolean existsByStationCode(String stationCode);
    List<ChargingStation> findByStatus(StationStatus status);
}
