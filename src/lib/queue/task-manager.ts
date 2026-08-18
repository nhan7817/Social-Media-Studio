import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  BatchJobConfig,
  DownloadTaskItem,
  FailedLinkRecord,
  ProgressEventPayload,
  MediaItemResult
} from '@/types';
import { downloadMedia } from '../downloaders';
import { applyWatermarkToImage } from '../watermark/image-watermark';
import { applyWatermarkToVideo } from '../watermark/video-watermark';
import { detectPlatform } from '../utils/platform-detector';

type ProgressListener = (payload: ProgressEventPayload) => void;

interface JobState {
  jobId: string;
  config: BatchJobConfig;
  tasks: DownloadTaskItem[];
  failedLinks: FailedLinkRecord[];
  currentTaskIndex: number;
  isDone: boolean;
  isCancelled: boolean;
  cancelledTaskIds: Set<string>;
  listeners: Set<ProgressListener>;
}

class QueueManager {
  private jobs = new Map<string, JobState>();

  public createJob(jobId: string, config: BatchJobConfig): JobState {
    const tasks: DownloadTaskItem[] = config.tasks.map((t) => ({
      id: t.id,
      url: t.url,
      platform: t.platform,
      detectedPlatform: t.platform === 'auto' ? detectPlatform(t.url) : t.platform,
      status: 'pending',
      progress: 0,
    }));

    const jobState: JobState = {
      jobId,
      config,
      tasks,
      failedLinks: [],
      currentTaskIndex: 0,
      isDone: false,
      isCancelled: false,
      cancelledTaskIds: new Set(),
      listeners: new Set(),
    };

    this.jobs.set(jobId, jobState);
    return jobState;
  }

  public getJob(jobId: string): JobState | undefined {
    return this.jobs.get(jobId);
  }

  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.isCancelled = true;
    job.isDone = true;

    // Mark remaining pending/downloading tasks as cancelled
    job.tasks.forEach((t) => {
      if (t.status === 'pending' || t.status === 'downloading' || t.status === 'watermarking') {
        t.status = 'cancelled';
        t.statusMessage = 'Đã hủy theo yêu cầu';
      }
    });

    const currentTask = job.tasks[job.currentTaskIndex] || job.tasks[job.tasks.length - 1];
    if (currentTask) {
      this.notify(job, currentTask);
    }
    return true;
  }

  public cancelTask(jobId: string, taskId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.cancelledTaskIds.add(taskId);
    const task = job.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = 'cancelled';
      task.statusMessage = 'Đã dừng clip này';
      this.notify(job, task);
      return true;
    }
    return false;
  }

  public addListener(jobId: string, listener: ProgressListener): () => void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.listeners.add(listener);
      // Immediately send current state
      const currentTask = job.tasks[job.currentTaskIndex] || job.tasks[job.tasks.length - 1];
      if (currentTask) {
        listener(this.createPayload(job, currentTask));
      }
    }
    return () => {
      const j = this.jobs.get(jobId);
      if (j) j.listeners.delete(listener);
    };
  }

  private notify(job: JobState, currentTask: DownloadTaskItem) {
    const payload = this.createPayload(job, currentTask);
    job.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (e) {
        console.error('Error notifying listener:', e);
      }
    });
  }

  private createPayload(job: JobState, currentTask: DownloadTaskItem): ProgressEventPayload {
    const total = job.tasks.length;
    const completedCount = job.tasks.filter(
      (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
    ).length;
    const overallProgress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      jobId: job.jobId,
      currentTaskIndex: job.currentTaskIndex,
      totalTasks: total,
      task: currentTask,
      overallProgress,
      failedLinks: job.failedLinks,
      isDone: job.isDone,
    };
  }

  public async runJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const { config, tasks } = job;
    const outputDir = config.outputDirectory || path.join(os.homedir(), 'Downloads', 'SocialMedia');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const tempDir = path.join(os.tmpdir(), `sm_dl_${jobId}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (let i = 0; i < tasks.length; i++) {
      if (job.isCancelled) {
        break;
      }

      job.currentTaskIndex = i;
      const currentTask = tasks[i];

      // Check if this specific task was cancelled before starting
      if (currentTask.status === 'cancelled' || job.cancelledTaskIds.has(currentTask.id)) {
        currentTask.status = 'cancelled';
        currentTask.statusMessage = 'Đã bỏ qua';
        this.notify(job, currentTask);
        continue;
      }

      currentTask.status = 'downloading';
      currentTask.progress = 10;
      currentTask.startedAt = Date.now();
      currentTask.statusMessage = 'Đang bắt đầu tải...';
      this.notify(job, currentTask);

      try {
        if (job.isCancelled || job.cancelledTaskIds.has(currentTask.id)) {
          currentTask.status = 'cancelled';
          currentTask.statusMessage = 'Đã hủy tải';
          this.notify(job, currentTask);
          continue;
        }

        // Step 1: Download Media to temp location
        const { results, platform } = await downloadMedia({
          url: currentTask.url,
          selectedPlatform: currentTask.platform,
          outputDir: tempDir,
          onProgress: (percent, msg) => {
            if (!job.isCancelled && !job.cancelledTaskIds.has(currentTask.id)) {
              currentTask.progress = Math.round(percent * 0.6); // 0-60% for download
              currentTask.statusMessage = msg;
              this.notify(job, currentTask);
            }
          },
        });

        currentTask.detectedPlatform = platform;

        if (job.isCancelled || job.cancelledTaskIds.has(currentTask.id)) {
          currentTask.status = 'cancelled';
          currentTask.statusMessage = 'Đã hủy tải';
          this.notify(job, currentTask);
          continue;
        }

        if (!results || results.length === 0) {
          throw new Error('Không tìm thấy file tải về từ link này.');
        }

        // Step 2: Watermarking & Move to Final Directory
        currentTask.status = 'watermarking';
        currentTask.progress = 65;
        currentTask.statusMessage = 'Đang xử lý watermark và lưu file...';
        this.notify(job, currentTask);

        const finalResults: MediaItemResult[] = [];

        for (let rIdx = 0; rIdx < results.length; rIdx++) {
          if (job.isCancelled || job.cancelledTaskIds.has(currentTask.id)) {
            break;
          }

          const media = results[rIdx];
          const ext = path.extname(media.fileName) || (media.type === 'video' ? '.mp4' : '.jpg');
          const baseName = path.basename(media.fileName, ext);
          const finalFileName = `${baseName}_wm${ext}`;
          const finalFilePath = path.join(outputDir, finalFileName);

          if (media.type === 'video') {
            await applyWatermarkToVideo(
              media.filePath,
              finalFilePath,
              config.watermark,
              (vPercent) => {
                if (!job.isCancelled && !job.cancelledTaskIds.has(currentTask.id)) {
                  currentTask.progress = 65 + Math.round(vPercent * 0.3); // 65-95%
                  currentTask.statusMessage = `Đang gắn watermark video (${vPercent}%)...`;
                  this.notify(job, currentTask);
                }
              }
            );
          } else {
            await applyWatermarkToImage(media.filePath, finalFilePath, config.watermark);
          }

          // Clean up temp file
          try {
            if (fs.existsSync(media.filePath)) {
              fs.unlinkSync(media.filePath);
            }
          } catch {}

          if (fs.existsSync(finalFilePath)) {
            const stat = fs.statSync(finalFilePath);
            finalResults.push({
              filePath: finalFilePath,
              fileName: finalFileName,
              type: media.type,
              sizeBytes: stat.size,
            });
          }
        }

        if (job.isCancelled || job.cancelledTaskIds.has(currentTask.id)) {
          currentTask.status = 'cancelled';
          currentTask.statusMessage = 'Đã dừng clip này';
          this.notify(job, currentTask);
          continue;
        }

        // Step 3: Complete Task
        currentTask.status = 'completed';
        currentTask.progress = 100;
        currentTask.completedAt = Date.now();
        currentTask.resultFiles = finalResults;
        currentTask.statusMessage = `Hoàn thành (${finalResults.length} file).`;
        this.notify(job, currentTask);
      } catch (err: any) {
        if (job.isCancelled || job.cancelledTaskIds.has(currentTask.id)) {
          currentTask.status = 'cancelled';
          currentTask.statusMessage = 'Đã dừng';
          this.notify(job, currentTask);
          continue;
        }

        // Step 4: Handle Failure & Continue Sequentially
        const errorMsg = err.message || 'Lỗi không xác định khi tải hoặc xử lý file.';
        currentTask.status = 'failed';
        currentTask.error = errorMsg;
        currentTask.statusMessage = `Lỗi: ${errorMsg}`;
        currentTask.completedAt = Date.now();

        job.failedLinks.push({
          id: currentTask.id,
          url: currentTask.url,
          platform: currentTask.platform,
          error: errorMsg,
          failedAt: new Date().toLocaleTimeString(),
        });

        this.notify(job, currentTask);
      }
    }

    // Mark job done
    job.isDone = true;
    const lastTask = tasks[tasks.length - 1];
    if (lastTask) {
      this.notify(job, lastTask);
    }

    // Clean temp folder
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

// Global Singleton for Next.js hot-reload persistence
const globalForQueue = globalThis as unknown as { queueManager?: QueueManager };
export const queueManager = globalForQueue.queueManager ?? new QueueManager();
if (process.env.NODE_ENV !== 'production') globalForQueue.queueManager = queueManager;
