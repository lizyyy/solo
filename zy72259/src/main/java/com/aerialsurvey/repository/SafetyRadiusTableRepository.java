package com.aerialsurvey.repository;

import com.aerialsurvey.entity.SafetyRadiusTable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SafetyRadiusTableRepository extends JpaRepository<SafetyRadiusTable, Long> {
    List<SafetyRadiusTable> findByParkingLotCodeAndIsActiveTrue(String parkingLotCode);
    Optional<SafetyRadiusTable> findTopByParkingLotCodeAndIsActiveTrueOrderByImportedAtDesc(String parkingLotCode);
    boolean existsByParkingLotCodeAndSafetyRadiusAndCoordinateReferenceAndIsActiveTrue(
            String parkingLotCode, Double safetyRadius, String coordinateReference);
    long countByParkingLotCodeAndIsActiveTrue(String parkingLotCode);
}
