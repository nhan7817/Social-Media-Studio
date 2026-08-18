import { NextRequest, NextResponse } from 'next/server';
import { BatchJobConfig } from '@/types';
import { queueManager } from '@/lib/queue/task-manager';

export async function POST(req: NextRequest) {
  try {
    const body: BatchJobConfig = await req.json();

    if (!body.tasks || body.tasks.length === 0) {
      return NextResponse.json(
        { error: 'Danh sách link tải không được để trống.' },
        { status: 400 }
      );
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    queueManager.createJob(jobId, body);

    // Launch background execution
    queueManager.runJob(jobId).catch((err) => {
      console.error(`Error running job ${jobId}:`, err);
    });

    return NextResponse.json({
      success: true,
      jobId,
      totalTasks: body.tasks.length,
    });
  } catch (error: any) {
    console.error('Error starting download job:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi xử lý yêu cầu.' },
      { status: 500 }
    );
  }
}
