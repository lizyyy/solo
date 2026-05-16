package com.statuspage.repository;

import com.statuspage.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findByIncidentIdOrderByVersionDesc(Long incidentId);
    Optional<Announcement> findByIncidentIdAndVersion(Long incidentId, Integer version);
    Optional<Announcement> findFirstByIncidentIdOrderByVersionDesc(Long incidentId);
    Integer countByIncidentId(Long incidentId);
}