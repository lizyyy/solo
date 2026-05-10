import { NextResponse } from 'next/server';
import ensureSeedData from '@/lib/seed';

export async function GET() {
  try {
    const seeded = ensureSeedData();
    
    return NextResponse.json({
      success: true,
      message: seeded ? '数据库初始化成功，已插入示例数据' : '数据库已存在，跳过初始化',
      seeded
    });
  } catch (error) {
    console.error('初始化失败:', error);
    return NextResponse.json(
      { success: false, error: '数据库初始化失败' },
      { status: 500 }
    );
  }
}
