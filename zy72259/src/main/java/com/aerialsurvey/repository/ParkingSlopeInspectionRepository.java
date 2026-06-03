package com.aerialsurvey.repository;

import com.aerialsurvey.entity.ParkingSlopeInspection;
import com.aerialsurvey.enums.InspectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ParkingSlopeInspectionRepository extends JpaRepository<ParkingSlopeInspection, Long> {
    List<ParkingSlopeInspection> findByParkingLotCode(String parkingLotCode);
    List<ParkingSlopeInspection> findByParkingLotCodeAndStatus(String parkingLotCode, InspectionStatus status);
    List<ParkingSlopeInspection> findByParkingLotCodeAndIsScreenshotBlockedTrue(String parkingLotCode);
    boolean existsByParkingLotCodeAndParkingSpaceNo(String parkingLotCode, String parkingSpaceNo);
    long countByParkingLotCode(String parkingLotCode);
}
