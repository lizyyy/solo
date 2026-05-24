package com.port.reefer.repository;

import com.port.reefer.entity.Inspector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InspectorRepository extends JpaRepository<Inspector, Long> {
    Optional<Inspector> findByBadgeNumber(String badgeNumber);
}
