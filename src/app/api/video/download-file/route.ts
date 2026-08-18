import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);
    const fileName = path.basename(filePath);

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Length', stat.size.toString());

    // @ts-ignore
    return new NextResponse(fileStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
