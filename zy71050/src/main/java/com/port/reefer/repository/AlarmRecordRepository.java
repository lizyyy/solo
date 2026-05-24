package com.port.reefer.repository;

import com.port.reefer.entity.AlarmRecord;
import com.port.reefer.entity.enums.AlarmStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

import javax.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AlarmRecordRepository extends JpaRepository<AlarmRecord, Long> {
    List<AlarmRecord> findByContainerIdOrderByAlarmTimeDesc(Long containerId);

    List<AlarmRecord> findByStatus(AlarmStatus status);

    List<AlarmRecord> findByContainerIdAndStatus(Long containerId, AlarmStatus status);

    List<AlarmRecord> findByContainerIdAndAlarmTimeBetween(
            Long containerId, LocalDateTime start, LocalDateTime end);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AlarmRecord> findWithLockById(Long id);
}
