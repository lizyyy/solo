import { NextRequest, NextResponse } from 'next/server';
import { getEntityLogs } from '@/lib/services/log-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const logs = getEntityLogs('reservation', params.id);
    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET logs error:', error);
    return NextResponse.json(
      { error: '获取操作日志失败' },
      { status: 500 }
    );
  }
}
