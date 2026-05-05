package com.performancereview.repository;

import com.performancereview.entity.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    List<Incident> findByStatusOrderByCreatedAtDesc(String status);

    List<Incident> findBySeverityOrderByCreatedAtDesc(String severity);

    List<Incident> findByIncidentTimeBetweenOrderByIncidentTimeDesc(LocalDateTime start, LocalDateTime end);

    @Query("SELECT i FROM Incident i LEFT JOIN FETCH i.uploadedFiles WHERE i.id = :id")
    Incident findByIdWithUploadedFiles(@Param("id") Long id);

    @Query("SELECT i FROM Incident i WHERE i.title LIKE %:keyword% OR i.description LIKE %:keyword%")
    List<Incident> searchByKeyword(@Param("keyword") String keyword);
}
