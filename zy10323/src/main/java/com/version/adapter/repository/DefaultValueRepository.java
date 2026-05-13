package com.version.adapter.repository;

import com.version.adapter.entity.DefaultValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DefaultValueRepository extends JpaRepository<DefaultValue, Long> {

    List<DefaultValue> findByFieldMappingIdAndIsActiveTrue(Long fieldMappingId);

    Optional<DefaultValue> findByFieldMappingIdAndIsActiveTrue(Long fieldMappingId);

    boolean existsByFieldMappingIdAndIsActiveTrue(Long fieldMappingId);
}
