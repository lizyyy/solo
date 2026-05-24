package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.OxygenPort;
import com.hospital.oxygen.enums.PortStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OxygenPortRepository extends JpaRepository<OxygenPort, Long> {
    Optional<OxygenPort> findByPortCode(String portCode);
    List<OxygenPort> findByWard(String ward);
    List<OxygenPort> findByStatus(PortStatus status);
    List<OxygenPort> findByWardAndStatus(String ward, PortStatus status);
    List<OxygenPort> findByIsActiveTrue();
}
