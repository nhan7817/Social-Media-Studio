import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ensureYtDlpBinary } from '@/lib/downloaders/bin-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { url, outputFormat = 'mp3', outputFolder } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 });
    }

    const destFolder = outputFolder || path.join(os.homedir(), 'Downloads', 'SocialMedia');
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    const binaryPath = await ensureYtDlpBinary();
    const outputTemplate = path.join(destFolder, '%(extractor)s_%(title).50s_%(id)s.%(ext)s');

    const args = [
      '--no-playlist',
      '--no-warnings',
      '--newline',
      '-x', // Extract audio
      '--audio-format', outputFormat,
      '--audio-quality', '0', // Best quality (320k for mp3)
      '-o', outputTemplate,
      '--print', 'after_move:filepath',
      url.trim(),
    ];

    const result = await new Promise<{ filePath: string; fileName: string }>((resolve, reject) => {
      const proc = spawn(binaryPath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
        const createdFile = lines.find((l) => fs.existsSync(l) && (l.endsWith('.mp3') || l.endsWith('.m4a') || l.endsWith('.wav')));

        if (createdFile) {
          resolve({ filePath: createdFile, fileName: path.basename(createdFile) });
        } else if (code === 0) {
          // Scan folder for recently modified audio file
          const files = fs.readdirSync(destFolder).map((f) => path.join(destFolder, f));
          const recentAudio = files.find((f) => {
            const ext = path.extname(f).toLowerCase();
            return ['.mp3', '.m4a', '.wav'].includes(ext) && (Date.now() - fs.statSync(f).mtimeMs < 60000);
          });

          if (recentAudio) {
            resolve({ filePath: recentAudio, fileName: path.basename(recentAudio) });
          } else {
            reject(new Error('Không tìm thấy tệp âm thanh trích xuất sau khi xử lý.'));
          }
        } else {
          reject(new Error(stderr || `Lỗi trích xuất âm thanh (Mã lỗi ${code})`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    return NextResponse.json({
      success: true,
      file: result,
      message: `Đã trích xuất thành công: ${result.fileName}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
