package com.schema.approval.repository;

import com.schema.approval.entity.CompatibilityCheck;
import com.schema.approval.entity.SchemaVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CompatibilityCheckRepository extends JpaRepository<CompatibilityCheck, Long> {
    List<CompatibilityCheck> findBySchemaVersionOrderByCreatedAtDesc(SchemaVersion schemaVersion);
}
