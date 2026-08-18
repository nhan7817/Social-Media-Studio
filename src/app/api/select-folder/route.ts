import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';

export async function GET() {
  const defaultDir = path.join(os.homedir(), 'Downloads', 'SocialMediaDownloader');
  
  // Also provide common local drive shortcuts
  const suggestions = [
    defaultDir,
    path.join('N:', 'Tools', 'downloads'),
    path.join(os.homedir(), 'Videos'),
    path.join(os.homedir(), 'Pictures'),
  ];

  return NextResponse.json({
    defaultPath: defaultDir,
    suggestions,
    exists: fs.existsSync(defaultDir),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { folderPath } = await req.json();
    if (!folderPath) {
      return NextResponse.json({ error: 'Đường dẫn thư mục không hợp lệ' }, { status: 400 });
    }

    const resolved = path.resolve(folderPath);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    return NextResponse.json({
      valid: true,
      resolvedPath: resolved,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
