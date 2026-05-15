package com.datarepair.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.datarepair.approval.dto.ScriptQueryDTO;
import com.datarepair.approval.entity.RepairScript;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RepairScriptMapper extends BaseMapper<RepairScript> {

    IPage<RepairScript> queryPage(Page<RepairScript> page, @Param("query") ScriptQueryDTO query);

    RepairScript selectByRequestId(@Param("requestId") String requestId);
}
