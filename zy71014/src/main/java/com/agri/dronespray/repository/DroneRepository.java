package com.agri.dronespray.repository;

import com.agri.dronespray.entity.Drone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DroneRepository extends JpaRepository<Drone, Long> {

    Optional<Drone> findByDroneCode(String droneCode);

    List<Drone> findByStatus(String status);
}
