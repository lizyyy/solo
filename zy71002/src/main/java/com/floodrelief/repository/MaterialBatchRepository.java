package com.floodrelief.repository;

import com.floodrelief.entity.MaterialBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MaterialBatchRepository extends JpaRepository<MaterialBatch, Long> {
    Optional<MaterialBatch> findByBatchNo(String batchNo);
    List<MaterialBatch> findByMaterialType(String materialType);
}
