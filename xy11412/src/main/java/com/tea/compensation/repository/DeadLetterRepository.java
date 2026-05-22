package com.tea.compensation.repository;

import com.tea.compensation.entity.DeadLetter;
import com.tea.compensation.enums.TaskType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeadLetterRepository extends JpaRepository<DeadLetter, Long> {

    Optional<DeadLetter> findByBatchNo(String batchNo);

    boolean existsByBatchNo(String batchNo);

    Page<DeadLetter> findByStoreId(String storeId, Pageable pageable);

    Page<DeadLetter> findByTaskType(TaskType taskType, Pageable pageable);

    Page<DeadLetter> findByRecovered(Boolean recovered, Pageable pageable);

    List<DeadLetter> findByRecoveredOrderByDeadLetterTimeDesc(Boolean recovered);

    @Query("SELECT COUNT(d) FROM DeadLetter d WHERE d.recovered = :recovered")
    long countByRecovered(@Param("recovered") Boolean recovered);

    @Query("SELECT d.taskType, COUNT(d) FROM DeadLetter d WHERE d.recovered = false GROUP BY d.taskType")
    List<Object[]> countUnrecoveredByTaskType();

    List<DeadLetter> findByDeadLetterTimeBeforeAndRecoveredFalse(LocalDateTime time);
}
