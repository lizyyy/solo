package com.dormitory.maintenance.repository;

import com.dormitory.maintenance.entity.DormBuilding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DormBuildingRepository extends JpaRepository<DormBuilding, Long> {
    Optional<DormBuilding> findByBuildingCode(String buildingCode);
    List<DormBuilding> findByActiveTrue();
    boolean existsByBuildingCode(String buildingCode);
}
