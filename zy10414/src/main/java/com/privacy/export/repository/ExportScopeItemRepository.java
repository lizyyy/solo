package com.privacy.export.repository;

import com.privacy.export.entity.ExportScopeItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExportScopeItemRepository extends JpaRepository<ExportScopeItem, Long> {

    List<ExportScopeItem> findByExportRequestId(Long exportRequestId);

    List<ExportScopeItem> findByExportRequestIdAndIsIncludedTrue(Long exportRequestId);
}
