import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { WatermarkConfig } from '@/types';
import { applyWatermarkToVideo } from '@/lib/watermark/video-watermark';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const configStr = formData.get('config') as string | null;
    const outputFolder = (formData.get('outputFolder') as string | null) || path.join(os.homedir(), 'Downloads', 'SocialMedia');

    if (!file) {
      return NextResponse.json({ error: 'Vui lòng chọn file video để tải lên.' }, { status: 400 });
    }

    const config: WatermarkConfig = configStr ? JSON.parse(configStr) : { enabled: false, type: 'none' };

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const tempDir = path.join(os.tmpdir(), `editor_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const originalFileName = file.name || 'uploaded_video.mp4';
    const ext = path.extname(originalFileName) || '.mp4';
    const baseName = path.basename(originalFileName, ext);
    const tempInputPath = path.join(tempDir, `input_${Date.now()}${ext}`);

    // Save uploaded file to temp path
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempInputPath, buffer);

    const finalFileName = `${baseName}_edited_${Date.now()}.mp4`;
    const finalOutputPath = path.join(outputFolder, finalFileName);

    // Apply Logo Blur, Watermark, Aspect Ratio via FFmpeg
    await applyWatermarkToVideo(tempInputPath, finalOutputPath, config);

    // Clean temp input
    try {
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}

    const stats = fs.statSync(finalOutputPath);

    return NextResponse.json({
      success: true,
      fileName: finalFileName,
      filePath: finalOutputPath,
      sizeBytes: stats.size,
      downloadUrl: `/api/video/download-file?path=${encodeURIComponent(finalOutputPath)}`,
      message: 'Đã xử lý video thành công!',
    });
  } catch (error: any) {
    console.error('Video edit error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi xử lý video' }, { status: 500 });
  }
}
