package com.aerialsurvey.repository;

import com.aerialsurvey.entity.InspectionAlert;
import com.aerialsurvey.enums.AlertType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface InspectionAlertRepository extends JpaRepository<InspectionAlert, Long> {
    List<InspectionAlert> findByParkingLotCode(String parkingLotCode);
    List<InspectionAlert> findByParkingLotCodeAndAlertType(String parkingLotCode, AlertType alertType);
    List<InspectionAlert> findByParkingLotCodeAndIsManagerReviewedFalse(String parkingLotCode);
    List<InspectionAlert> findByInspectionId(Long inspectionId);
}
