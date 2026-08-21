import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

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
  '.txt': 'text/plain; charset=utf-8',
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
    const isInline = searchParams.get('inline') === 'true';

    const range = req.headers.get('range');

    if (range) {
      // Handle HTTP Range request (essential for browser audio / video playback)
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      if (start >= stat.size || end >= stat.size) {
        return new NextResponse('Requested range not satisfiable', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${stat.size}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(resolved, { start, end });
      const webStream = Readable.toWeb(nodeStream);

      const headers = new Headers();
      headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', chunkSize.toString());
      headers.set('Content-Type', contentType);
      headers.set('Cache-Control', 'public, max-age=3600');

      if (isInline) {
        headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      } else {
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      }

      return new NextResponse(webStream as any, {
        status: 206,
        headers,
      });
    }

    // Full file streaming
    const nodeStream = fs.createReadStream(resolved);
    const webStream = Readable.toWeb(nodeStream);

    const headers = new Headers();
    headers.set('Content-Length', stat.size.toString());
    headers.set('Content-Type', contentType);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');

    if (isInline) {
      headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    } else {
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    }

    return new NextResponse(webStream as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Download/Stream error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải xuống tệp.' }, { status: 500 });
  }
}
