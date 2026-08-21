import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isVercel) {
    return NextResponse.json({
      defaultPath: '📁 [Máy tính] Thư mục Downloads',
      suggestions: [
        '📁 [Máy tính] Thư mục Downloads',
        '📁 [Máy tính] Thư mục Videos',
      ],
      exists: true,
      isServerEnvironment: true,
    });
  }

  const projectStorage = path.join(process.cwd(), 'storage', 'downloads');
  const userDownloads = path.join(os.homedir(), 'Downloads', 'SocialMedia');

  let defaultDir = projectStorage;
  try {
    if (fs.existsSync(path.join(os.homedir(), 'Downloads'))) {
      defaultDir = userDownloads;
    }
  } catch {}

  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
  } catch {
    defaultDir = projectStorage;
  }

  const suggestions = [
    defaultDir,
    projectStorage,
    path.join(os.tmpdir(), 'social_downloads'),
  ].filter((v, i, a) => a.indexOf(v) === i);

  return NextResponse.json({
    defaultPath: defaultDir,
    suggestions,
    exists: fs.existsSync(defaultDir),
    isServerEnvironment: false,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { folderPath } = await req.json();
    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json({ error: 'Đường dẫn thư mục không hợp lệ' }, { status: 400 });
    }

    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    // On Vercel / Cloud serverless, client paths (D:\..., 📁 [Máy tính]...) are always accepted
    if (isVercel || folderPath.startsWith('📁') || folderPath.includes(':')) {
      return NextResponse.json({
        valid: true,
        resolvedPath: folderPath,
        isCloud: true,
      });
    }

    const resolved = path.resolve(folderPath);
    try {
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }
    } catch {}

    return NextResponse.json({
      valid: true,
      resolvedPath: resolved,
    });
  } catch (error: any) {
    return NextResponse.json({ valid: true, resolvedPath: 'downloads' });
  }
}
