package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, Long> {
    Optional<Vehicle> findByVehicleNoAndActiveTrue(String vehicleNo);

    boolean existsByVehicleNoAndActiveTrue(String vehicleNo);
}
