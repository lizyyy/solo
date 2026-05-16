package com.query.regression.repository;

import com.query.regression.entity.QueryParameter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QueryParameterRepository extends JpaRepository<QueryParameter, Long> {
    List<QueryParameter> findByRegressionRecordId(Long regressionRecordId);
}
