package com.dns.preplay.repository;

import com.dns.preplay.model.entity.DiffResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DiffResultRepository extends JpaRepository<DiffResult, Long> {

    List<DiffResult> findByPreplayId(Long preplayId);

    void deleteByPreplayId(Long preplayId);
}
