package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.ForbiddenLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ForbiddenLocationRepository extends JpaRepository<ForbiddenLocation, Long> {
    Optional<ForbiddenLocation> findByLocationCodeAndActiveTrue(String locationCode);

    List<ForbiddenLocation> findByAreaCodeAndActiveTrue(String areaCode);

    boolean existsByLocationCodeAndActiveTrue(String locationCode);
}
