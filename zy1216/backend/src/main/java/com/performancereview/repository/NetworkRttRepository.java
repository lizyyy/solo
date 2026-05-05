package com.performancereview.repository;

import com.performancereview.entity.NetworkRtt;
import com.performancereview.enums.BottleneckSeverity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NetworkRttRepository extends JpaRepository<NetworkRtt, Long> {

    List<NetworkRtt> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<NetworkRtt> findByIncidentIdAndSeverityOrderByTimestampDesc(Long incidentId, BottleneckSeverity severity);

    List<NetworkRtt> findByIncidentIdAndProtocolOrderByTimestampDesc(Long incidentId, String protocol);

    List<NetworkRtt> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT n FROM NetworkRtt n WHERE n.incident.id = :incidentId ORDER BY n.rttAvgMs DESC")
    List<NetworkRtt> findTopByIncidentIdOrderByRttAvgDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT n FROM NetworkRtt n WHERE n.incident.id = :incidentId ORDER BY n.packetLossPercent DESC")
    List<NetworkRtt> findTopByIncidentIdOrderByPacketLossDesc(@Param("incidentId") Long incidentId);

    List<NetworkRtt> findByIncidentIdAndDestinationAddressOrderByTimestampDesc(
            Long incidentId, String destinationAddress);
}
