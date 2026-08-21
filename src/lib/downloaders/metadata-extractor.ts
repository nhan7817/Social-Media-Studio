import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ensureYtDlpBinary } from './bin-helper';

export interface VideoTextContent {
  title: string;
  description: string;
  uploader?: string;
  uploaderUrl?: string;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  tags?: string[];
  hashtags?: string[];
  thumbnail?: string;
  transcript?: string; // Subtitle text or automatic captions
  subtitleFile?: string; // Path to saved .srt / .vtt / .txt if downloaded
  txtFilePath?: string;
}

/**
 * Extracts hashtags from description and tags
 */
export function extractHashtags(description?: string, tags?: string[]): string[] {
  const set = new Set<string>();
  if (description) {
    const matches = description.match(/#[\p{L}\p{N}_]+/gu);
    if (matches) {
      matches.forEach((tag) => set.add(tag));
    }
  }
  if (tags && Array.isArray(tags)) {
    tags.forEach((t) => {
      const clean = t.trim();
      if (clean) {
        set.add(clean.startsWith('#') ? clean : `#${clean.replace(/\s+/g, '_')}`);
      }
    });
  }
  return Array.from(set);
}

/**
 * Clean VTT / SRT subtitle formatting to plain readable text
 */
export function cleanSubtitlesToPlainText(rawSub: string): string {
  if (!rawSub) return '';
  return rawSub
    .replace(/WEBVTT[\s\S]*?\n\n/g, '') // remove WebVTT header
    .replace(/NOTE[\s\S]*?\n\n/g, '')   // remove VTT notes
    .replace(/^\d+\r?\n/gm, '')         // remove SRT sequence numbers
    .replace(/\d{2}:\d{2}:\d{2}[\.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[\.,]\d{3}.*/g, '') // remove timestamps
    .replace(/<[^>]+>/g, '')            // remove HTML / styling tags like <c>, <v>, <font>
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // Remove adjacent duplicate lines caused by rolling captions
    .filter((line, index, arr) => line !== arr[index - 1])
    .join('\n');
}

/**
 * Fetches comprehensive video metadata and transcript/subtitles via yt-dlp
 */
export async function extractVideoTextMetadata(url: string, outputFolder?: string): Promise<VideoTextContent> {
  const binaryPath = await ensureYtDlpBinary();
  const tempDir = path.join(os.tmpdir(), `vtext_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const tempSubTemplate = path.join(tempDir, '%(id)s.%(ext)s');

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--dump-json',
    '--write-subs',
    '--write-auto-subs',
    '--sub-lang', 'vi,en,zh,ja,ko,all,-live_chat',
    '--sub-format', 'vtt/srt/best',
    '--skip-download',
    '-o', tempSubTemplate,
    url.trim(),
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      try {
        let jsonInfo: any = {};
        try {
          const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
          for (const l of lines) {
            if (l.startsWith('{') && l.endsWith('}')) {
              jsonInfo = JSON.parse(l);
              break;
            }
          }
        } catch (e) {
          console.warn('Could not parse yt-dlp dump-json:', e);
        }

        const title = jsonInfo.title || 'Video không có tiêu đề';
        const description = jsonInfo.description || '';
        const uploader = jsonInfo.uploader || jsonInfo.channel || jsonInfo.creator || '';
        const uploaderUrl = jsonInfo.uploader_url || jsonInfo.channel_url || '';
        const duration = jsonInfo.duration;
        const viewCount = jsonInfo.view_count;
        const likeCount = jsonInfo.like_count;
        const tags = jsonInfo.tags || [];
        const hashtags = extractHashtags(description, tags);
        const thumbnail = jsonInfo.thumbnail || jsonInfo.thumbnails?.[0]?.url || '';

        // Check if any subtitle files were written to tempDir
        let rawTranscript = '';
        let foundSubFile: string | undefined = undefined;

        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          const subFile = files.find((f) => f.endsWith('.vtt') || f.endsWith('.srt'));
          if (subFile) {
            foundSubFile = path.join(tempDir, subFile);
            const content = fs.readFileSync(foundSubFile, 'utf8');
            rawTranscript = cleanSubtitlesToPlainText(content);
          }
        }

        // Save a clean .txt file in outputFolder if provided
        let txtFilePath: string | undefined = undefined;
        if (outputFolder && fs.existsSync(outputFolder)) {
          const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 60);
          const txtFileName = `${safeTitle}_text_${Date.now()}.txt`;
          txtFilePath = path.join(outputFolder, txtFileName);

          let fileContent = `TIÊU ĐỀ: ${title}\n`;
          fileContent += `TÁC GIẢ / KÊNH: ${uploader}\n`;
          fileContent += `ĐƯỜNG DẪN GỐC: ${url}\n`;
          fileContent += `HASHTAGS: ${hashtags.join(' ')}\n\n`;
          fileContent += `=== MÔ TẢ & CAPTION ===\n${description}\n\n`;

          if (rawTranscript) {
            fileContent += `=== LỜI THOẠI / PHỤ ĐỀ (TRANSCRIPT) ===\n${rawTranscript}\n`;
          }

          fs.writeFileSync(txtFilePath, fileContent, 'utf8');
        }

        // Cleanup tempDir
        try {
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch {}

        resolve({
          title,
          description,
          uploader,
          uploaderUrl,
          duration,
          viewCount,
          likeCount,
          tags,
          hashtags,
          thumbnail,
          transcript: rawTranscript || undefined,
          txtFilePath,
        });
      } catch (err: any) {
        reject(err);
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
