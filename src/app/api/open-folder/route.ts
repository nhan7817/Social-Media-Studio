import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { folderPath } = await req.json();

    // Check if running on Vercel / Cloud serverless container (no local GUI)
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return NextResponse.json({
        success: true,
        isCloud: true,
        message: 'Đang chạy trên môi trường Web Cloud (Vercel). Các tệp tin được tải trực tiếp về thư mục Downloads của bạn qua trình duyệt.',
      });
    }

    if (!folderPath) {
      return NextResponse.json({ error: 'Đường dẫn thư mục không được để trống' }, { status: 400 });
    }

    const resolved = path.resolve(folderPath);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    const platform = process.platform;

    if (platform === 'win32') {
      const child = spawn('explorer.exe', [resolved], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else if (platform === 'darwin') {
      const child = spawn('open', [resolved], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      try {
        const child = spawn('xdg-open', [resolved], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } catch {
        return NextResponse.json({
          success: true,
          isCloud: true,
          message: 'Môi trường máy chủ không có giao diện đồ họa.',
        });
      }
    }

    return NextResponse.json({ success: true, path: resolved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
