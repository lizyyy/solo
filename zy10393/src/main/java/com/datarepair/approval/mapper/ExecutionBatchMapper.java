package com.datarepair.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datarepair.approval.entity.ExecutionBatch;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ExecutionBatchMapper extends BaseMapper<ExecutionBatch> {

    List<ExecutionBatch> selectByScriptId(@Param("scriptId") Long scriptId);

    ExecutionBatch selectLatestByScriptId(@Param("scriptId") Long scriptId);

    ExecutionBatch selectByBatchNo(@Param("batchNo") String batchNo);
}
