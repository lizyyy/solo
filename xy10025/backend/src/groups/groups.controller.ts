import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMemberDto } from './dto/add-member.dto';

@ApiTags('分组')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  async findAll(@Request() req) {
    return this.groupsService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.groupsService.findOne(id, req.user.id);
  }

  @Post()
  async create(@Body() dto: CreateGroupDto, @Request() req) {
    return this.groupsService.create(dto, req.user.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @Request() req,
  ) {
    return this.groupsService.update(id, dto, req.user.id);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @Request() req,
  ) {
    return this.groupsService.addMember(id, dto, req.user.id);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') groupId: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    return this.groupsService.removeMember(groupId, memberId, req.user.id);
  }

  @Get(':id/members')
  async getMembers(@Param('id') groupId: string, @Request() req) {
    return this.groupsService.getMembers(groupId, req.user.id);
  }
}
