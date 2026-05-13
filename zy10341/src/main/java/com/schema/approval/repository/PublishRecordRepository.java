package com.schema.approval.repository;

import com.schema.approval.entity.PublishRecord;
import com.schema.approval.entity.SchemaVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PublishRecordRepository extends JpaRepository<PublishRecord, Long> {
    List<PublishRecord> findBySchemaVersionOrderByCreatedAtDesc(SchemaVersion schemaVersion);
}
