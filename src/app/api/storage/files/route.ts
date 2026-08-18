import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || path.join(os.homedir(), 'Downloads', 'SocialMedia');

    if (!fs.existsSync(folder)) {
      return NextResponse.json({ files: [], totalCount: 0, folder });
    }

    const items = fs.readdirSync(folder);
    const files = items
      .map((fileName) => {
        const fullPath = path.join(folder, fileName);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) return null;

          const ext = path.extname(fileName).toLowerCase();
          const isVideo = ['.mp4', '.mkv', '.webm', '.mov', '.avi'].includes(ext);
          const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
          const isAudio = ['.mp3', '.m4a', '.wav', '.aac', '.ogg'].includes(ext);

          return {
            name: fileName,
            path: fullPath,
            sizeBytes: stats.size,
            mtime: stats.mtime.toISOString(),
            type: isVideo ? 'video' : isImage ? 'image' : isAudio ? 'audio' : 'other',
            ext,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

    return NextResponse.json({
      files,
      totalCount: files.length,
      folder,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { filePath } = await req.json();
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File does not exist' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true, message: 'Đã xóa tệp thành công.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
