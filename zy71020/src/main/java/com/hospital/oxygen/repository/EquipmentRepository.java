package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Long> {
    Optional<Equipment> findByEquipmentCode(String equipmentCode);
    List<Equipment> findByWard(String ward);
    List<Equipment> findByIsAvailableTrue();
    List<Equipment> findByWardAndIsAvailableTrue(String ward);
    List<Equipment> findByIsActiveTrue();
}
