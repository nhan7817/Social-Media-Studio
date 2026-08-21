import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ensureYtDlpBinary } from '@/lib/downloaders/bin-helper';
import { extractVideoTextMetadata, extractTikTokDirect, downloadDirectFile, VideoTextContent } from '@/lib/downloaders/metadata-extractor';
import { detectPlatform, sanitizeFileName } from '@/lib/utils/platform-detector';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const {
      url,
      outputFormat = 'mp3',
      outputFolder,
      extractAudio = true,
      extractText = true,
    } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 });
    }

    const destFolder = outputFolder || path.join(os.homedir(), 'Downloads', 'SocialMedia');
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    const platform = detectPlatform(url);
    let audioResult: { filePath: string; fileName: string } | null = null;
    let textResult: VideoTextContent | null = null;

    // ==========================================
    // 1. TIKTOK & DOUYIN SPECIALIZED HANDLER
    // ==========================================
    if (platform === 'tiktok' || platform === 'douyin' || url.includes('tiktok.com') || url.includes('douyin.com')) {
      try {
        const tikData = await extractTikTokDirect(url, destFolder);
        textResult = tikData.text;

        if (extractAudio && tikData.audioUrl) {
          const safeName = sanitizeFileName((tikData.musicTitle || tikData.text.title).substring(0, 50));
          const fileName = `tiktok_${safeName}_${Date.now()}.${outputFormat}`;
          const filePath = path.join(destFolder, fileName);
          await downloadDirectFile(tikData.audioUrl, filePath, 'https://www.tiktok.com/');
          audioResult = { filePath, fileName };
        }

        if (audioResult || textResult) {
          return NextResponse.json({
            success: true,
            file: audioResult,
            textContent: textResult,
            message: 'Trích xuất TikTok thành công!',
          });
        }
      } catch (tikErr: any) {
        console.warn('TikWM primary extraction warning, trying yt-dlp fallback:', tikErr.message);
      }
    }

    // ==========================================
    // 2. UNIVERSAL TEXT METADATA EXTRACTION
    // ==========================================
    if (extractText && !textResult) {
      try {
        textResult = await extractVideoTextMetadata(url, destFolder);
      } catch (err: any) {
        console.warn('Text metadata extraction warning:', err.message);
      }
    }

    // ==========================================
    // 3. UNIVERSAL AUDIO EXTRACTION (YT-DLP)
    // ==========================================
    if (extractAudio && !audioResult) {
      const binaryPath = await ensureYtDlpBinary();
      const outputTemplate = path.join(destFolder, '%(extractor)s_%(title).50s_%(id)s.%(ext)s');

      const args = [
        '--no-playlist',
        '--no-warnings',
        '--newline',
        '-x',
        '--audio-format', outputFormat,
        '--audio-quality', '0',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        '--extractor-args', 'youtube:player_client=android_creator,android,ios,web',
        '-o', outputTemplate,
        '--print', 'after_move:filepath',
        url.trim(),
      ];

      audioResult = await new Promise<{ filePath: string; fileName: string }>((resolve, reject) => {
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
    }

    return NextResponse.json({
      success: true,
      file: audioResult,
      textContent: textResult,
      message: 'Trích xuất thành công!',
    });
  } catch (error: any) {
    console.error('Extraction API error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi trích xuất dữ liệu.' }, { status: 500 });
  }
}
