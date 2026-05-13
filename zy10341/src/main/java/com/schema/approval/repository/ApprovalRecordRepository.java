package com.schema.approval.repository;

import com.schema.approval.entity.ApprovalRecord;
import com.schema.approval.entity.SchemaVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApprovalRecordRepository extends JpaRepository<ApprovalRecord, Long> {
    List<ApprovalRecord> findBySchemaVersionOrderByCreatedAtDesc(SchemaVersion schemaVersion);
}
