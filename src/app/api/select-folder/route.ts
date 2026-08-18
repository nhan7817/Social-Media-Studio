import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';

export async function GET() {
  // Safe project-relative default storage for server / domain environments
  const projectStorage = path.join(process.cwd(), 'storage', 'downloads');
  const userDownloads = path.join(os.homedir(), 'Downloads', 'SocialMedia');

  // If local user Downloads directory is accessible, suggest it, otherwise default to project storage
  let defaultDir = projectStorage;
  try {
    if (fs.existsSync(path.join(os.homedir(), 'Downloads'))) {
      defaultDir = userDownloads;
    }
  } catch {}

  // Ensure default storage exists
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
  } catch {
    defaultDir = projectStorage;
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
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
    isServerEnvironment: process.env.NODE_ENV === 'production' || !process.platform.startsWith('win'),
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
