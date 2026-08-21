import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DownloadTaskItem, MediaItemResult, WatermarkConfig } from '@/types';
import { downloadMedia } from '@/lib/downloaders';
import { applyWatermarkToImage } from '@/lib/watermark/image-watermark';
import { applyWatermarkToVideo } from '@/lib/watermark/video-watermark';
import { detectPlatform } from '@/lib/utils/platform-detector';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s max execution for Vercel

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { task, outputDirectory, watermark } = body as {
      task: DownloadTaskItem;
      outputDirectory?: string;
      watermark?: WatermarkConfig;
    };

    if (!task || !task.url) {
      return NextResponse.json({ error: 'Thông tin tác vụ không hợp lệ.' }, { status: 400 });
    }

    // Determine safe output directory
    let destFolder = outputDirectory;
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    if (!destFolder || isVercel) {
      destFolder = path.join(os.tmpdir(), 'social_media_studio');
    }

    if (!fs.existsSync(destFolder)) {
      try {
        fs.mkdirSync(destFolder, { recursive: true });
      } catch {
        destFolder = path.join(os.tmpdir(), 'social_media_studio');
        fs.mkdirSync(destFolder, { recursive: true });
      }
    }

    const tempDir = path.join(os.tmpdir(), `sm_task_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const detectedPlatform = task.platform === 'auto' ? detectPlatform(task.url) : task.platform;

    // Step 1: Download Media
    const { results: downloadedResults, platform } = await downloadMedia({
      url: task.url,
      selectedPlatform: detectedPlatform,
      outputDir: tempDir,
    });

    if (!downloadedResults || downloadedResults.length === 0) {
      throw new Error('Không tìm thấy video/ảnh để tải về từ liên kết này.');
    }

    // Step 2: Apply Watermark if enabled & Move to Destination
    const finalResults: MediaItemResult[] = [];

    for (const item of downloadedResults) {
      let finalPath = item.filePath;
      let finalName = item.fileName;

      if (watermark && watermark.enabled) {
        if (item.type === 'video') {
          const wmVideoName = `wm_${item.fileName}`;
          const wmVideoPath = path.join(tempDir, wmVideoName);
          try {
            await applyWatermarkToVideo(item.filePath, wmVideoPath, watermark);
            finalPath = wmVideoPath;
            finalName = wmVideoName;
          } catch (wmErr: any) {
            console.warn('Watermark video warning (using raw video):', wmErr.message);
          }
        } else if (item.type === 'image') {
          const wmImgName = `wm_${item.fileName}`;
          const wmImgPath = path.join(tempDir, wmImgName);
          try {
            await applyWatermarkToImage(item.filePath, wmImgPath, watermark);
            finalPath = wmImgPath;
            finalName = wmImgName;
          } catch (wmErr: any) {
            console.warn('Watermark image warning:', wmErr.message);
          }
        }
      }

      // Move file to destination folder
      const targetFilePath = path.join(destFolder, finalName);
      try {
        if (finalPath !== targetFilePath) {
          fs.copyFileSync(finalPath, targetFilePath);
        }
      } catch {
        // Fallback: use finalPath in tempDir
      }

      const sizeBytes = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : item.sizeBytes;

      finalResults.push({
        fileName: finalName,
        filePath: fs.existsSync(targetFilePath) ? targetFilePath : finalPath,
        type: item.type,
        sizeBytes,
      });
    }

    // Cleanup tempDir
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}

    const completedTask: DownloadTaskItem = {
      ...task,
      detectedPlatform: platform,
      status: 'completed',
      progress: 100,
      statusMessage: `Đã hoàn thành (${finalResults.length} tệp)`,
      resultFiles: finalResults,
    };

    return NextResponse.json({
      success: true,
      task: completedTask,
    });
  } catch (error: any) {
    console.error('Process item error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi xử lý tải video.',
    }, { status: 500 });
  }
}
