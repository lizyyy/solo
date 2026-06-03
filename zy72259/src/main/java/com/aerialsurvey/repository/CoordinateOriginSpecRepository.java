package com.aerialsurvey.repository;

import com.aerialsurvey.entity.CoordinateOriginSpec;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CoordinateOriginSpecRepository extends JpaRepository<CoordinateOriginSpec, Long> {
    List<CoordinateOriginSpec> findByParkingLotCodeAndIsActiveTrue(String parkingLotCode);
    Optional<CoordinateOriginSpec> findTopByParkingLotCodeAndIsActiveTrueOrderByReviewedAtDesc(String parkingLotCode);
}
