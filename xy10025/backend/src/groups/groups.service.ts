import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException,
  ConflictException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Group } from './group.entity';
import { User } from '../users/user.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AuditService } from '../audit/audit.service';
import { AuditEntityType, AuditAction } from '../audit/audit-log.entity';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(userId: string) {
    return this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.members', 'member')
      .where('member.id = :userId', { userId })
      .getMany();
  }

  async findOne(id: string, userId: string) {
    const group = await this.groupRepository.findOne({
      where: { id },
      relations: ['members'],
    });

    if (!group) {
      throw new NotFoundException('分组不存在');
    }

    const isMember = group.members.some((m) => m.id === userId);
    if (!isMember) {
      throw new ForbiddenException('您不是该分组成员');
    }

    return group;
  }

  async create(dto: CreateGroupDto, userId: string) {
    const owner = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!owner) {
      throw new NotFoundException('用户不存在');
    }

    const group = this.groupRepository.create({
      name: dto.name,
      description: dto.description,
      ownerId: userId,
      members: [owner],
      createdBy: userId,
      updatedBy: userId,
    });

    const savedGroup = await this.groupRepository.save(group);

    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.GROUP,
      entityId: savedGroup.id,
      userId,
      groupId: savedGroup.id,
      newValue: {
        id: savedGroup.id,
        name: savedGroup.name,
        description: savedGroup.description,
      },
    });

    return savedGroup;
  }

  async update(id: string, dto: UpdateGroupDto, userId: string) {
    const group = await this.findOne(id, userId);

    if (group.ownerId !== userId) {
      throw new ForbiddenException('只有分组创建者可以修改');
    }

    const oldValue = {
      id: group.id,
      name: group.name,
      description: group.description,
    };

    group.name = dto.name ?? group.name;
    group.description = dto.description ?? group.description;
    group.updatedBy = userId;

    const savedGroup = await this.groupRepository.save(group);

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.GROUP,
      entityId: group.id,
      userId,
      groupId: group.id,
      oldValue,
      newValue: {
        id: savedGroup.id,
        name: savedGroup.name,
        description: savedGroup.description,
      },
    });

    return savedGroup;
  }

  async addMember(id: string, dto: AddMemberDto, userId: string) {
    const group = await this.findOne(id, userId);

    if (group.ownerId !== userId) {
      throw new ForbiddenException('只有分组创建者可以添加成员');
    }

    const userToAdd = await this.userRepository.findOne({
      where: {
        username: dto.username,
      },
    });

    if (!userToAdd) {
      throw new NotFoundException('用户不存在');
    }

    const alreadyMember = group.members.some((m) => m.id === userToAdd.id);
    if (alreadyMember) {
      throw new ConflictException('该用户已在分组中');
    }

    group.members.push(userToAdd);
    const savedGroup = await this.groupRepository.save(group);

    await this.auditService.log({
      action: AuditAction.JOIN,
      entityType: AuditEntityType.GROUP,
      entityId: group.id,
      userId,
      groupId: group.id,
      newValue: {
        addedUserId: userToAdd.id,
        addedUsername: userToAdd.username,
      },
    });

    return savedGroup;
  }

  async removeMember(groupId: string, memberId: string, currentUserId: string) {
    const group = await this.findOne(groupId, currentUserId);

    if (group.ownerId !== currentUserId && memberId !== currentUserId) {
      throw new ForbiddenException('没有权限移除该成员');
    }

    if (memberId === group.ownerId) {
      throw new ForbiddenException('不能移除分组创建者');
    }

    const memberIndex = group.members.findIndex((m) => m.id === memberId);
    if (memberIndex === -1) {
      throw new NotFoundException('该用户不在分组中');
    }

    const removedMember = group.members[memberIndex];
    group.members.splice(memberIndex, 1);
    await this.groupRepository.save(group);

    await this.auditService.log({
      action: AuditAction.LEAVE,
      entityType: AuditEntityType.GROUP,
      entityId: group.id,
      userId: currentUserId,
      groupId: group.id,
      newValue: {
        removedUserId: removedMember.id,
        removedUsername: removedMember.username,
      },
    });

    return { success: true };
  }

  async getMembers(groupId: string, userId: string) {
    const group = await this.findOne(groupId, userId);
    return group.members.map((m) => ({
      id: m.id,
      username: m.username,
      displayName: m.displayName,
      email: m.email,
      isOwner: m.id === group.ownerId,
    }));
  }

  async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    const count = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoin('group.members', 'member')
      .where('group.id = :groupId', { groupId })
      .andWhere('member.id = :userId', { userId })
      .getCount();

    return count > 0;
  }
}
