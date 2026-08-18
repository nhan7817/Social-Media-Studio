import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { WatermarkConfig, AspectRatio } from '@/types';
import { applyWatermarkToImage } from '@/lib/watermark/image-watermark';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: WatermarkConfig = body;
    const ratio: AspectRatio = body.aspectRatio || '16:9';

    let width = 640;
    let height = 360;
    let label = '16:9 (Ngang - YouTube)';

    if (ratio === '9:16') {
      width = 360;
      height = 640;
      label = '9:16 (Dọc - TikTok / Shorts / Reels)';
    } else if (ratio === '1:1') {
      width = 480;
      height = 480;
      label = '1:1 (Vuông - Instagram Post)';
    } else if (ratio === '4:5') {
      width = 400;
      height = 500;
      label = '4:5 (Dọc - Instagram Feed)';
    }

    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const circleRadius = Math.floor(Math.min(width, height) * 0.28);

    // Create dynamic aspect ratio mock background
    const mockSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e1b4b;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#312e81;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <circle cx="${cx}" cy="${cy}" r="${circleRadius}" fill="#4338ca" opacity="0.35" />
        <text x="50%" y="46%" text-anchor="middle" fill="#cbd5e1" font-size="${Math.max(12, Math.floor(width * 0.045))}px" font-weight="600" font-family="sans-serif">Sample Media Preview</text>
        <text x="50%" y="54%" text-anchor="middle" fill="#818cf8" font-size="${Math.max(10, Math.floor(width * 0.032))}px" font-family="sans-serif">[ ${label} ]</text>
      </svg>
    `;

    const tempMockFile = path.join(os.tmpdir(), `mock_bg_${Date.now()}.png`);
    const tempOutFile = path.join(os.tmpdir(), `mock_out_${Date.now()}.png`);

    await sharp(Buffer.from(mockSvg)).png().toFile(tempMockFile);
    await applyWatermarkToImage(tempMockFile, tempOutFile, config);

    const outBuffer = await fs.readFile(tempOutFile);
    const base64 = `data:image/png;base64,${outBuffer.toString('base64')}`;

    try {
      await fs.unlink(tempMockFile);
      await fs.unlink(tempOutFile);
    } catch {}

    return NextResponse.json({ previewUrl: base64 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
