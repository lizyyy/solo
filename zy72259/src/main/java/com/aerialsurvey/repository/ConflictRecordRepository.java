package com.aerialsurvey.repository;

import com.aerialsurvey.entity.ConflictRecord;
import com.aerialsurvey.enums.ConflictStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ConflictRecordRepository extends JpaRepository<ConflictRecord, Long> {
    List<ConflictRecord> findByParkingLotCode(String parkingLotCode);
    List<ConflictRecord> findByParkingLotCodeAndStatus(String parkingLotCode, ConflictStatus status);
    boolean existsByParkingLotCodeAndStatus(String parkingLotCode, ConflictStatus status);
}
