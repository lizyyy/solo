package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.Area;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AreaRepository extends JpaRepository<Area, Long> {
    Optional<Area> findByAreaCodeAndActiveTrue(String areaCode);

    boolean existsByAreaCodeAndActiveTrue(String areaCode);
}
