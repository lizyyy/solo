package com.performancereview.repository;

import com.performancereview.entity.IoBlock;
import com.performancereview.enums.BottleneckSeverity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IoBlockRepository extends JpaRepository<IoBlock, Long> {

    List<IoBlock> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<IoBlock> findByIncidentIdAndSeverityOrderByTimestampDesc(Long incidentId, BottleneckSeverity severity);

    List<IoBlock> findByIncidentIdAndIoTypeOrderByTimestampDesc(Long incidentId, String ioType);

    List<IoBlock> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT i FROM IoBlock i WHERE i.incident.id = :incidentId ORDER BY i.blockDurationMs DESC")
    List<IoBlock> findTopByIncidentIdOrderByBlockDurationDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT i FROM IoBlock i WHERE i.incident.id = :incidentId ORDER BY i.bytesTransferred DESC")
    List<IoBlock> findTopByIncidentIdOrderByBytesTransferredDesc(@Param("incidentId") Long incidentId);

    List<IoBlock> findByIncidentIdAndResourcePathOrderByTimestampDesc(Long incidentId, String resourcePath);
}
