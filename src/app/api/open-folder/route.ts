import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
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
    let command = '';

    if (platform === 'win32') {
      command = `explorer.exe "${resolved}"`;
    } else if (platform === 'darwin') {
      command = `open "${resolved}"`;
    } else {
      command = `xdg-open "${resolved}"`;
    }

    exec(command, (err) => {
      if (err) {
        console.error('Error opening folder:', err);
      }
    });

    return NextResponse.json({ success: true, path: resolved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
