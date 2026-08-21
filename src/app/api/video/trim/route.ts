import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { trimAndProcessSegments, TrimSegment } from '@/lib/video/video-trim-merge';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const existingFilePath = formData.get('existingFilePath') as string | null;
    const segmentsStr = formData.get('segments') as string | null;
    const mode = (formData.get('mode') as 'merge_segments' | 'separate_files') || 'merge_segments';
    const qualityMode = (formData.get('qualityMode') as 'fast_copy' | 'accurate') || 'accurate';
    const muteAudio = formData.get('muteAudio') === 'true';
    const outputFolder = (formData.get('outputFolder') as string | null) || path.join(os.homedir(), 'Downloads', 'SocialMedia');

    if (!file && !existingFilePath) {
      return NextResponse.json({ error: 'Vui lòng cung cấp file video để thực hiện cắt.' }, { status: 400 });
    }

    const segments: TrimSegment[] = segmentsStr ? JSON.parse(segmentsStr) : [];
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn ít nhất một đoạn thời gian cần cắt.' }, { status: 400 });
    }

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const tempDir = path.join(os.tmpdir(), `trim_req_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    let sourceVideoPath = '';
    let baseFileName = 'trimmed_video';

    if (file) {
      const originalFileName = file.name || 'uploaded_video.mp4';
      const ext = path.extname(originalFileName) || '.mp4';
      baseFileName = path.basename(originalFileName, ext);
      sourceVideoPath = path.join(tempDir, `input_${Date.now()}${ext}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(sourceVideoPath, buffer);
    } else if (existingFilePath && fs.existsSync(existingFilePath)) {
      sourceVideoPath = existingFilePath;
      const ext = path.extname(existingFilePath) || '.mp4';
      baseFileName = path.basename(existingFilePath, ext);
    } else {
      return NextResponse.json({ error: 'File video nguồn không tồn tại trên hệ thống.' }, { status: 400 });
    }

    const finalOutputBaseName = `${baseFileName}_cut_${Date.now()}.mp4`;
    const finalOutputPath = path.join(outputFolder, finalOutputBaseName);

    // Execute trimming / multi-segment processing
    const generatedFiles = await trimAndProcessSegments({
      inputPath: sourceVideoPath,
      outputPath: finalOutputPath,
      segments,
      mode,
      qualityMode,
      muteAudio,
    });

    // Cleanup temp input if uploaded
    if (file && fs.existsSync(sourceVideoPath)) {
      try {
        fs.unlinkSync(sourceVideoPath);
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }

    const results = generatedFiles.map((fPath) => {
      const stats = fs.statSync(fPath);
      const fName = path.basename(fPath);
      return {
        fileName: fName,
        filePath: fPath,
        sizeBytes: stats.size,
        downloadUrl: `/api/video/download-file?path=${encodeURIComponent(fPath)}`,
      };
    });

    return NextResponse.json({
      success: true,
      files: results,
      primaryFile: results[0],
      totalSegments: segments.length,
      mode,
      message: `Đã cắt ${segments.length} đoạn video thành công!`,
    });
  } catch (error: any) {
    console.error('Trim video API error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi thực hiện cắt video.' }, { status: 500 });
  }
}
