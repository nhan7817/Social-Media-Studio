import { NextRequest, NextResponse } from 'next/server';
import { queueManager } from '@/lib/queue/task-manager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { jobId, action, taskId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    if (action === 'cancel_all') {
      const success = queueManager.cancelJob(jobId);
      return NextResponse.json({ success, message: 'Đã dừng toàn bộ các clip còn lại trong hàng đợi.' });
    }

    if (action === 'cancel_task') {
      if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      }
      const success = queueManager.cancelTask(jobId, taskId);
      return NextResponse.json({ success, message: `Đã dừng clip ${taskId}.` });
    }

    return NextResponse.json({ error: 'Invalid action. Use cancel_all or cancel_task.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
