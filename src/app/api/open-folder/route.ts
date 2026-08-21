import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { folderPath } = await req.json();
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
      const child = spawn('xdg-open', [resolved], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }

    return NextResponse.json({ success: true, path: resolved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
