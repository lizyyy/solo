package com.statuspage.repository;

import com.statuspage.model.Confirmation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfirmationRepository extends JpaRepository<Confirmation, Long> {
    List<Confirmation> findByIncidentIdOrderByConfirmedAtDesc(Long incidentId);
    List<Confirmation> findByAnnouncementIdOrderByConfirmedAtDesc(Long announcementId);
    Optional<Confirmation> findByIncidentIdAndAnnouncementIdAndSubscriberId(Long incidentId, Long announcementId, String subscriberId);
    boolean existsByIncidentIdAndAnnouncementIdAndSubscriberId(Long incidentId, Long announcementId, String subscriberId);
    List<Confirmation> findBySubscriberId(String subscriberId);
}