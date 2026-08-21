import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { mergeVideosDirectOrComplex } from '@/lib/video/video-trim-merge';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const existingFilePathsStr = formData.get('existingFilePaths') as string | null;
    const aspectRatio = (formData.get('aspectRatio') as 'original' | '9:16' | '16:9' | '1:1' | '4:5') || 'original';
    const targetFps = parseInt((formData.get('targetFps') as string) || '30', 10);
    const muteAudio = formData.get('muteAudio') === 'true';
    const bgmFile = formData.get('bgMusic') as File | null;
    const outputFolder = (formData.get('outputFolder') as string | null) || path.join(os.homedir(), 'Downloads', 'SocialMedia');

    const existingFilePaths: string[] = existingFilePathsStr ? JSON.parse(existingFilePathsStr) : [];

    if (files.length === 0 && existingFilePaths.length === 0) {
      return NextResponse.json({ error: 'Vui lòng cung cấp ít nhất 2 video để thực hiện ghép.' }, { status: 400 });
    }

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const tempDir = path.join(os.tmpdir(), `merge_req_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const inputPaths: string[] = [];

    // Save uploaded files to temp
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name || 'clip.mp4') || '.mp4';
      const tempPath = path.join(tempDir, `clip_${i + 1}_${Date.now()}${ext}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(tempPath, buffer);
      inputPaths.push(tempPath);
    }

    // Add valid existing file paths
    for (const p of existingFilePaths) {
      if (fs.existsSync(p)) {
        inputPaths.push(p);
      }
    }

    if (inputPaths.length < 2) {
      return NextResponse.json({ error: 'Cần ít nhất 2 video hợp lệ để thực hiện ghép.' }, { status: 400 });
    }

    // Save optional background music
    let bgmPath: string | undefined = undefined;
    if (bgmFile) {
      const bgmExt = path.extname(bgmFile.name || 'music.mp3') || '.mp3';
      bgmPath = path.join(tempDir, `bgm_${Date.now()}${bgmExt}`);
      const bgmBuffer = Buffer.from(await bgmFile.arrayBuffer());
      fs.writeFileSync(bgmPath, bgmBuffer);
    }

    const finalFileName = `merged_video_${Date.now()}.mp4`;
    const finalOutputPath = path.join(outputFolder, finalFileName);

    // Merge videos with standardizations
    await mergeVideosDirectOrComplex({
      inputPaths,
      outputPath: finalOutputPath,
      aspectRatio,
      targetFps,
      muteAudio,
      backgroundMusicPath: bgmPath,
    });

    // Cleanup temp directory
    try {
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
      totalClips: inputPaths.length,
      downloadUrl: `/api/video/download-file?path=${encodeURIComponent(finalOutputPath)}`,
      message: `Đã ghép thành công ${inputPaths.length} video!`,
    });
  } catch (error: any) {
    console.error('Merge video API error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi thực hiện ghép video.' }, { status: 500 });
  }
}
