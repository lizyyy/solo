package com.riskcontrol.graylist.repository;

import com.riskcontrol.graylist.entity.GraylistRecord;
import com.riskcontrol.graylist.enums.GraylistStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface GraylistRecordRepository extends JpaRepository<GraylistRecord, Long>, JpaSpecificationExecutor<GraylistRecord> {

    Optional<GraylistRecord> findByCustomerId(String customerId);

    List<GraylistRecord> findByStatus(GraylistStatus status);

    List<GraylistRecord> findByBatchNo(String batchNo);

    @Query("SELECT g FROM GraylistRecord g WHERE g.expireTime <= :now AND g.status IN :statuses")
    List<GraylistRecord> findExpiredRecords(@Param("now") LocalDateTime now, @Param("statuses") List<GraylistStatus> statuses);

    @Query("SELECT g FROM GraylistRecord g WHERE g.customerId = :customerId AND g.status NOT IN ('REMOVED')")
    Optional<GraylistRecord> findActiveByCustomerId(@Param("customerId") String customerId);

    boolean existsByCustomerIdAndStatusNot(String customerId, GraylistStatus status);
}
