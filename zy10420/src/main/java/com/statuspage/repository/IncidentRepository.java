package com.statuspage.repository;

import com.statuspage.model.Incident;
import com.statuspage.model.IncidentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    Optional<Incident> findByIncidentNumber(String incidentNumber);
    boolean existsByIncidentNumber(String incidentNumber);
    List<Incident> findByStatus(IncidentStatus status);
    List<Incident> findByStatusNot(IncidentStatus status);
    List<Incident> findAllByOrderByCreatedAtDesc();
}