package com.lineage.repository;

import com.lineage.entity.FieldLineage;
import com.lineage.enums.LineageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FieldLineageRepository extends JpaRepository<FieldLineage, Long> {

    Optional<FieldLineage> findByApiPathAndResponseField(String apiPath, String responseField);

    List<FieldLineage> findByApiPath(String apiPath);

    List<FieldLineage> findByStatus(LineageStatus status);

    @Query("SELECT fl FROM FieldLineage fl JOIN fl.dependentApis da WHERE da.apiPath = :dependentApiPath")
    List<FieldLineage> findByDependentApiPath(@Param("dependentApiPath") String dependentApiPath);

    @Query("SELECT fl FROM FieldLineage fl JOIN fl.sourceTables st WHERE st.tableName = :tableName AND st.columnName = :columnName")
    List<FieldLineage> findBySourceTableAndColumn(@Param("tableName") String tableName, @Param("columnName") String columnName);

    boolean existsByApiPathAndResponseField(String apiPath, String responseField);
}
