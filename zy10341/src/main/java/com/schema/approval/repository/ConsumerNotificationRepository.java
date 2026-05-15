package com.schema.approval.repository;

import com.schema.approval.entity.ConsumerNotification;
import com.schema.approval.entity.SchemaVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConsumerNotificationRepository extends JpaRepository<ConsumerNotification, Long> {
    List<ConsumerNotification> findBySchemaVersionOrderByCreatedAtDesc(SchemaVersion schemaVersion);
}
