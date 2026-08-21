import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { ensureYtDlpBinary } from './bin-helper';
import { detectPlatform, sanitizeFileName } from '../utils/platform-detector';

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
  transcript?: string;
  txtFilePath?: string;
}

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

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

export function cleanSubtitlesToPlainText(rawSub: string): string {
  if (!rawSub) return '';
  return rawSub
    .replace(/WEBVTT[\s\S]*?\n\n/g, '')
    .replace(/NOTE[\s\S]*?\n\n/g, '')
    .replace(/^\d+\r?\n/gm, '')
    .replace(/\d{2}:\d{2}:\d{2}[\.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[\.,]\d{3}.*/g, '')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((line, index, arr) => line !== arr[index - 1])
    .join('\n');
}

/**
 * Downloads a file from direct URL to local path
 */
export async function downloadDirectFile(url: string, destPath: string, referer?: string): Promise<number> {
  const response = await axios({
    method: 'GET',
    url: url.replace(/&amp;/g, '&'),
    responseType: 'stream',
    headers: {
      ...DEFAULT_HEADERS,
      Referer: referer || 'https://www.google.com/',
    },
    timeout: 60000,
  });

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const writer = fs.createWriteStream(destPath);
  await pipeline(response.data, writer);
  const stats = fs.statSync(destPath);
  return stats.size;
}

/**
 * Direct TikTok & Douyin Metadata and Audio extractor (Bypasses TikTok anti-bot block in yt-dlp)
 */
export async function extractTikTokDirect(url: string, outputFolder?: string): Promise<{
  text: VideoTextContent;
  audioUrl?: string;
  musicTitle?: string;
}> {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const res = await axios.get(apiUrl, { headers: DEFAULT_HEADERS, timeout: 20000 });

  if (res.data?.code !== 0 || !res.data?.data) {
    throw new Error(res.data?.msg || 'Không thể lấy thông tin TikTok từ TikWM.');
  }

  const data = res.data.data;
  const title = data.title || `TikTok Video ${data.id || Date.now()}`;
  const uploader = data.author?.nickname || data.author?.unique_id || 'TikTok Creator';
  const uploaderUrl = data.author?.unique_id ? `https://www.tiktok.com/@${data.author.unique_id}` : undefined;
  const duration = data.duration || 0;
  const viewCount = data.play_count || 0;
  const likeCount = data.digg_count || 0;
  const thumbnail = data.cover || data.origin_cover || '';
  const hashtags = extractHashtags(title);

  // Audio stream URL
  const audioUrl = data.music_info?.play || data.music;
  const musicTitle = data.music_info?.title || title;

  // Save .txt file in outputFolder if provided
  let txtFilePath: string | undefined = undefined;
  if (outputFolder && fs.existsSync(outputFolder)) {
    const safeTitle = sanitizeFileName(title.substring(0, 50));
    const txtFileName = `tiktok_${safeTitle}_${Date.now()}.txt`;
    txtFilePath = path.join(outputFolder, txtFileName);

    let fileContent = `TIÊU ĐỀ & CAPTION: ${title}\n`;
    fileContent += `TÁC GIẢ / KÊNH: ${uploader} (@${data.author?.unique_id || ''})\n`;
    fileContent += `NHẠC NỀN: ${data.music_info?.title || ''} - ${data.music_info?.author || ''}\n`;
    fileContent += `LƯỢT XEM: ${viewCount.toLocaleString()} • THÍCH: ${likeCount.toLocaleString()}\n`;
    fileContent += `ĐƯỜNG DẪN GỐC: ${url}\n`;
    fileContent += `HASHTAGS: ${hashtags.join(' ')}\n\n`;
    fileContent += `=== NỘI DUNG CHI TIẾT ===\n${title}\n`;

    fs.writeFileSync(txtFilePath, fileContent, 'utf8');
  }

  return {
    text: {
      title,
      description: title,
      uploader,
      uploaderUrl,
      duration,
      viewCount,
      likeCount,
      hashtags,
      thumbnail,
      txtFilePath,
    },
    audioUrl,
    musicTitle,
  };
}

/**
 * Universal video text & transcript extractor supporting YouTube, TikTok, Facebook, etc.
 */
export async function extractVideoTextMetadata(url: string, outputFolder?: string): Promise<VideoTextContent> {
  const platform = detectPlatform(url);

  // 1. TikTok / Douyin specialized fast scraper
  if (platform === 'tiktok' || platform === 'douyin' || url.includes('tiktok.com') || url.includes('douyin.com')) {
    try {
      const direct = await extractTikTokDirect(url, outputFolder);
      return direct.text;
    } catch (e: any) {
      console.warn('TikWM direct extraction fallback to yt-dlp:', e.message);
    }
  }

  // 2. Generic yt-dlp extraction with anti-bot arguments
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
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    '--extractor-args', 'youtube:player_client=android_creator,android,ios,web',
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
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          const subFile = files.find((f) => f.endsWith('.vtt') || f.endsWith('.srt'));
          if (subFile) {
            const foundSubFile = path.join(tempDir, subFile);
            const content = fs.readFileSync(foundSubFile, 'utf8');
            rawTranscript = cleanSubtitlesToPlainText(content);
          }
        }

        // Save .txt file in outputFolder if provided
        let txtFilePath: string | undefined = undefined;
        if (outputFolder && fs.existsSync(outputFolder)) {
          const safeTitle = sanitizeFileName(title.substring(0, 50));
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
