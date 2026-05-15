package com.datarepair.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datarepair.approval.entity.ApprovalOpinion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ApprovalOpinionMapper extends BaseMapper<ApprovalOpinion> {

    List<ApprovalOpinion> selectByScriptId(@Param("scriptId") Long scriptId);
}
