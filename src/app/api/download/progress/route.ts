import { NextRequest, NextResponse } from 'next/server';
import { queueManager } from '@/lib/queue/task-manager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const mode = searchParams.get('mode'); // 'poll' or SSE default

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = queueManager.getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Polling mode for simple fallback
  if (mode === 'poll') {
    const total = job.tasks.length;
    const completedCount = job.tasks.filter((t) => t.status === 'completed' || t.status === 'failed').length;
    const overallProgress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return NextResponse.json({
      jobId: job.jobId,
      tasks: job.tasks,
      failedLinks: job.failedLinks,
      currentTaskIndex: job.currentTaskIndex,
      overallProgress,
      isDone: job.isDone,
    });
  }

  // Server-Sent Events (SSE) mode
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      cleanup = queueManager.addListener(jobId, (payload) => {
        try {
          const data = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(data));

          if (payload.isDone) {
            setTimeout(() => {
              try {
                controller.close();
              } catch {}
            }, 1000);
          }
        } catch (e) {
          console.error('SSE enqueue error:', e);
        }
      });
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
