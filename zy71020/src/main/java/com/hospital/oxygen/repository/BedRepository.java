package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.Bed;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BedRepository extends JpaRepository<Bed, Long> {
    Optional<Bed> findByBedNumber(String bedNumber);
    List<Bed> findByWard(String ward);
    List<Bed> findByIsActiveTrue();
}
