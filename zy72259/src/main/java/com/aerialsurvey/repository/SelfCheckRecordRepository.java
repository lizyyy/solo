package com.aerialsurvey.repository;

import com.aerialsurvey.entity.SelfCheckRecord;
import com.aerialsurvey.enums.SelfCheckType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SelfCheckRecordRepository extends JpaRepository<SelfCheckRecord, Long> {
    List<SelfCheckRecord> findByParkingLotCode(String parkingLotCode);
    List<SelfCheckRecord> findByParkingLotCodeAndCheckType(String parkingLotCode, SelfCheckType checkType);
}
