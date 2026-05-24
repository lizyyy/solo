package com.livestock.transfer.repository;

import com.livestock.transfer.entity.TransportVehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TransportVehicleRepository extends JpaRepository<TransportVehicle, Long> {
    Optional<TransportVehicle> findByPlateNo(String plateNo);
}
