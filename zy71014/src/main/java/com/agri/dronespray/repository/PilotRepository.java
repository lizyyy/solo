package com.agri.dronespray.repository;

import com.agri.dronespray.entity.Pilot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PilotRepository extends JpaRepository<Pilot, Long> {

    Optional<Pilot> findByPilotCode(String pilotCode);

    List<Pilot> findByStatus(String status);

    List<Pilot> findByQualificationLevel(String qualificationLevel);
}
