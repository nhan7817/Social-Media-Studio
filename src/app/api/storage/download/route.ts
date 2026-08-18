import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path') || searchParams.get('file');

    if (!filePath) {
      return NextResponse.json({ error: 'Thiếu đường dẫn tệp (path/file).' }, { status: 400 });
    }

    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: 'Tệp tin không tồn tại trên hệ thống máy chủ.' }, { status: 404 });
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: 'Đường dẫn là thư mục, không phải tệp tin.' }, { status: 400 });
    }

    const fileName = path.basename(resolved);
    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    const fileStream = fs.createReadStream(resolved);

    const headers = new Headers();
    // Use RFC 5987 / standard encoded content disposition
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', stat.size.toString());
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // @ts-ignore
    return new NextResponse(fileStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Download stream error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải xuống tệp.' }, { status: 500 });
  }
}
