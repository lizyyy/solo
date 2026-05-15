package com.apidiff.repository;

import com.apidiff.entity.DiffField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DiffFieldRepository extends JpaRepository<DiffField, Long> {

    List<DiffField> findByDiffRecordId(Long diffRecordId);

    @Query("SELECT f FROM DiffField f WHERE f.diffRecord.id = :diffRecordId ORDER BY f.fieldPath")
    List<DiffField> findByDiffRecordIdOrderByFieldPath(@Param("diffRecordId") Long diffRecordId);

    @Query("SELECT DISTINCT f.fieldPath FROM DiffField f WHERE f.diffRecord.id = :diffRecordId")
    List<String> findDistinctFieldPathsByDiffRecordId(@Param("diffRecordId") Long diffRecordId);

    void deleteByDiffRecordId(Long diffRecordId);
}
