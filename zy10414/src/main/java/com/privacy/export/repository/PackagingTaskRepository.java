package com.privacy.export.repository;

import com.privacy.export.entity.PackagingTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PackagingTaskRepository extends JpaRepository<PackagingTask, Long> {

    Optional<PackagingTask> findByExportRequestId(Long exportRequestId);

    Optional<PackagingTask> findByTaskId(String taskId);

    boolean existsByExportRequestId(Long exportRequestId);
}
