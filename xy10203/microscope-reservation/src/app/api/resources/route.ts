import { NextRequest, NextResponse } from 'next/server';
import {
  getAllMicroscopes,
  createMicroscope,
  getAccessoriesByMicroscope,
  createAccessory,
  getAllResearchGroups,
  createResearchGroup,
  getAllUsers,
  createUser
} from '@/lib/services/resource-service';

const CURRENT_USER_ID = 'system-user';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const microscopeId = searchParams.get('microscopeId');

    if (type === 'microscopes') {
      const microscopes = getAllMicroscopes(true);
      const withAccessories = microscopes.map(m => ({
        ...m,
        accessories: getAccessoriesByMicroscope(m.id, true)
      }));
      return NextResponse.json(withAccessories);
    }

    if (type === 'accessories' && microscopeId) {
      const accessories = getAccessoriesByMicroscope(microscopeId, true);
      return NextResponse.json(accessories);
    }

    if (type === 'groups') {
      const groups = getAllResearchGroups();
      return NextResponse.json(groups);
    }

    if (type === 'users') {
      const users = getAllUsers();
      return NextResponse.json(users);
    }

    const microscopes = getAllMicroscopes();
    const groups = getAllResearchGroups();
    const users = getAllUsers();

    return NextResponse.json({ microscopes, groups, users });
  } catch (error) {
    console.error('GET resources error:', error);
    return NextResponse.json(
      { error: '获取资源失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'microscope') {
      if (!data.name) {
        return NextResponse.json(
          { error: '显微镜名称不能为空' },
          { status: 400 }
        );
      }
      const microscope = createMicroscope({
        name: data.name,
        model: data.model,
        location: data.location,
        description: data.description
      }, CURRENT_USER_ID);
      return NextResponse.json(microscope, { status: 201 });
    }

    if (type === 'accessory') {
      if (!data.microscopeId || !data.name || !data.type) {
        return NextResponse.json(
          { error: '缺少必要字段' },
          { status: 400 }
        );
      }
      const accessory = createAccessory({
        microscope_id: data.microscopeId,
        name: data.name,
        type: data.type,
        description: data.description
      }, CURRENT_USER_ID);
      return NextResponse.json(accessory, { status: 201 });
    }

    if (type === 'group') {
      if (!data.name) {
        return NextResponse.json(
          { error: '课题组名称不能为空' },
          { status: 400 }
        );
      }
      const group = createResearchGroup({
        name: data.name,
        leader: data.leader
      }, CURRENT_USER_ID);
      return NextResponse.json(group, { status: 201 });
    }

    if (type === 'user') {
      if (!data.name) {
        return NextResponse.json(
          { error: '用户名称不能为空' },
          { status: 400 }
        );
      }
      const user = createUser({
        name: data.name,
        email: data.email,
        group_id: data.groupId,
        role: data.role || 'user'
      }, CURRENT_USER_ID);
      return NextResponse.json(user, { status: 201 });
    }

    return NextResponse.json(
      { error: '无效的资源类型' },
      { status: 400 }
    );
  } catch (error) {
    console.error('POST resources error:', error);
    return NextResponse.json(
      { error: '创建资源失败' },
      { status: 500 }
    );
  }
}
