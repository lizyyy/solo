import { NextRequest, NextResponse } from 'next/server';
import {
  createReservation,
  updateReservation,
  approveReservation,
  rejectReservation,
  cancelReservation,
  deleteReservation,
  getReservationWithDetails,
  getAllReservations,
  ReservationError,
  ConflictError,
  StateTransitionError
} from '@/lib/services/reservation-service';
import { checkReservationConflicts } from '@/lib/services/conflict-service';
import { getEntityLogs } from '@/lib/services/log-service';

const CURRENT_USER_ID = 'system-user';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: any = {};

    const status = searchParams.get('status');
    if (status) filters.status = status;

    const microscopeId = searchParams.get('microscopeId');
    if (microscopeId) filters.microscopeId = microscopeId;

    const groupId = searchParams.get('groupId');
    if (groupId) filters.groupId = groupId;

    const startDate = searchParams.get('startDate');
    if (startDate) filters.startDate = startDate;

    const endDate = searchParams.get('endDate');
    if (endDate) filters.endDate = endDate;

    const id = searchParams.get('id');

    if (id) {
      const reservation = getReservationWithDetails(id);
      if (!reservation) {
        return NextResponse.json(
          { error: '预约不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json(reservation);
    }

    const reservations = getAllReservations(filters);
    return NextResponse.json(reservations);
  } catch (error) {
    console.error('GET reservations error:', error);
    return NextResponse.json(
      { error: '获取预约列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'check-conflict') {
      const { microscopeId, accessoryIds, startTime, endTime, excludeReservationId } = data;

      if (!microscopeId || !startTime || !endTime) {
        return NextResponse.json(
          { error: '缺少必要参数' },
          { status: 400 }
        );
      }

      const result = checkReservationConflicts(
        microscopeId,
        accessoryIds || [],
        startTime,
        endTime,
        excludeReservationId
      );

      return NextResponse.json(result);
    }

    const { microscopeId, userId, groupId, startTime, endTime, purpose, accessoryIds } = data;

    if (!microscopeId || !userId || !groupId || !startTime || !endTime || !purpose) {
      return NextResponse.json(
        { error: '缺少必要字段' },
        { status: 400 }
      );
    }

    const reservation = createReservation(
      { microscopeId, userId, groupId, startTime, endTime, purpose, accessoryIds: accessoryIds || [] },
      CURRENT_USER_ID
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error('POST reservation error:', error);

    if (error instanceof ConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          errorType: 'ConflictError',
          conflicts: error.conflicts
        },
        { status: 409 }
      );
    }

    if (error instanceof StateTransitionError) {
      return NextResponse.json(
        {
          error: error.message,
          errorType: 'StateTransitionError'
        },
        { status: 400 }
      );
    }

    if (error instanceof ReservationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '创建预约失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少预约ID' },
        { status: 400 }
      );
    }

    let reservation;

    if (action === 'approve') {
      reservation = approveReservation(id, CURRENT_USER_ID, data.note);
    } else if (action === 'reject') {
      if (!data.reason) {
        return NextResponse.json(
          { error: '请填写拒绝原因' },
          { status: 400 }
        );
      }
      reservation = rejectReservation(id, CURRENT_USER_ID, data.reason);
    } else if (action === 'cancel') {
      reservation = cancelReservation(id, CURRENT_USER_ID, data.reason);
    } else {
      reservation = updateReservation(id, data, CURRENT_USER_ID);
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('PUT reservation error:', error);

    if (error instanceof ConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          errorType: 'ConflictError',
          conflicts: error.conflicts
        },
        { status: 409 }
      );
    }

    if (error instanceof StateTransitionError) {
      return NextResponse.json(
        {
          error: error.message,
          errorType: 'StateTransitionError'
        },
        { status: 400 }
      );
    }

    if (error instanceof ReservationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '更新预约失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少预约ID' },
        { status: 400 }
      );
    }

    deleteReservation(id, CURRENT_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE reservation error:', error);

    if (error instanceof StateTransitionError) {
      return NextResponse.json(
        {
          error: error.message,
          errorType: 'StateTransitionError'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '删除预约失败' },
      { status: 500 }
    );
  }
}
