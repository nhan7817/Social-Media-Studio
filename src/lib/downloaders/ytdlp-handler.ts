import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { MediaItemResult } from '@/types';
import { ensureYtDlpBinary } from './bin-helper';

interface YtStrategy {
  name: string;
  args: string[];
}

const YOUTUBE_STRATEGIES: YtStrategy[] = [
  // Strategy 1: Android Creator Progressive Stream (Pure download, no FFmpeg postprocessing crash)
  {
    name: 'Android Creator Stream',
    args: [
      '-f',
      'best[ext=mp4]/b[ext=mp4]/best/b',
      '--extractor-args',
      'youtube:player_client=android_creator,android;player_skip=webpage,configs',
    ],
  },
  // Strategy 2: iOS Mobile Progressive Stream
  {
    name: 'iOS Mobile Stream',
    args: [
      '-f',
      'best[ext=mp4]/b[ext=mp4]/best/b',
      '--extractor-args',
      'youtube:player_client=ios;player_skip=webpage,configs',
    ],
  },
  // Strategy 3: Android Standard Progressive Stream
  {
    name: 'Android Standard Stream',
    args: [
      '-f',
      'best[ext=mp4]/b[ext=mp4]/best/b',
      '--extractor-args',
      'youtube:player_client=android',
    ],
  },
  // Strategy 4: Edge Browser Cookies Progressive Stream
  {
    name: 'Edge Browser Cookies',
    args: [
      '-f',
      'best[ext=mp4]/b[ext=mp4]/best/b',
      '--cookies-from-browser',
      'edge',
    ],
  },
  // Strategy 5: TV Stream
  {
    name: 'TV Stream',
    args: [
      '-f',
      'best[ext=mp4]/b[ext=mp4]/best/b',
      '--extractor-args',
      'youtube:player_client=tv_embedded',
    ],
  },
];

const FACEBOOK_STRATEGIES: YtStrategy[] = [
  // Strategy 1: Mobile Browser User-Agent & Format
  {
    name: 'Mobile Browser Emulation',
    args: [
      '-f',
      'best[ext=mp4]/best/b',
      '--user-agent',
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
    ],
  },
  // Strategy 2: Edge Browser Cookies
  {
    name: 'Edge Browser Cookies',
    args: [
      '-f',
      'best[ext=mp4]/best/b',
      '--cookies-from-browser',
      'edge',
    ],
  },
  // Strategy 3: Standard Progressive
  {
    name: 'Standard Stream',
    args: [
      '-f',
      'best[ext=mp4]/best/b',
    ],
  },
];

async function executeYtDlp(
  binaryPath: string,
  url: string,
  outputDir: string,
  extraArgs: string[] = [],
  onProgress?: (percent: number, msg: string) => void
): Promise<MediaItemResult[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const existingFiles = new Set(fs.readdirSync(outputDir));
  const outputTemplate = path.join(outputDir, '%(extractor)s_%(title).50s_%(id)s.%(ext)s');

  const args: string[] = [
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--force-ipv4',
    '--geo-bypass',
    '--no-check-certificates',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    '--print',
    'after_move:filepath',
    '-o',
    outputTemplate,
    ...extraArgs,
    url,
  ];

  return new Promise((resolve, reject) => {
    const process = spawn(binaryPath, args);
    const downloadedFiles: string[] = [];
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmed = line.trim().replace(/^['"]|['"]$/g, '');
        if (!trimmed) continue;

        // Progress matching: [download]  45.0% of ...
        const percentMatch = trimmed.match(/\[download\]\s+([\d\.]+)%/);
        if (percentMatch && onProgress) {
          const p = parseFloat(percentMatch[1]);
          onProgress(Math.min(95, Math.max(5, Math.round(p))), `Đang tải: ${trimmed}`);
        }

        // File path matching
        const isValidExt =
          trimmed.endsWith('.mp4') ||
          trimmed.endsWith('.mkv') ||
          trimmed.endsWith('.webm') ||
          trimmed.endsWith('.jpg') ||
          trimmed.endsWith('.png') ||
          trimmed.endsWith('.webp');

        if (isValidExt && fs.existsSync(trimmed)) {
          downloadedFiles.push(trimmed);
        }
      }
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      // Check 1: Explicitly tracked stdout file paths
      if (downloadedFiles.length > 0) {
        const results: MediaItemResult[] = downloadedFiles.map((fp) => {
          const stats = fs.statSync(fp);
          const isVideo = fp.endsWith('.mp4') || fp.endsWith('.mkv') || fp.endsWith('.webm');
          return {
            filePath: fp,
            fileName: path.basename(fp),
            type: isVideo ? 'video' : 'image',
            sizeBytes: stats.size,
          };
        });
        return resolve(results);
      }

      // Check 2: Newly created files in outputDir since spawn
      const currentFiles = fs.readdirSync(outputDir);
      const newFiles = currentFiles
        .filter((f) => !existingFiles.has(f))
        .map((f) => path.join(outputDir, f))
        .filter((fp) => {
          try {
            const stat = fs.statSync(fp);
            const isValid =
              fp.endsWith('.mp4') ||
              fp.endsWith('.mkv') ||
              fp.endsWith('.webm') ||
              fp.endsWith('.jpg') ||
              fp.endsWith('.png') ||
              fp.endsWith('.webp');
            return isValid && stat.size > 1000;
          } catch {
            return false;
          }
        });

      if (newFiles.length > 0) {
        const results: MediaItemResult[] = newFiles.map((fp) => {
          const stats = fs.statSync(fp);
          const isVideo = fp.endsWith('.mp4') || fp.endsWith('.mkv') || fp.endsWith('.webm');
          return {
            filePath: fp,
            fileName: path.basename(fp),
            type: isVideo ? 'video' : 'image',
            sizeBytes: stats.size,
          };
        });
        return resolve(results);
      }

      // If no file was created and code is 0
      if (code === 0) {
        return resolve([]);
      }

      // Extract real ERROR line from stderr if available
      const realErrors = errorOutput
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('ERROR:') && !l.includes('Stream #'));

      const finalMsg = realErrors.length > 0 ? realErrors.join(' | ') : `Lỗi tải file (Exit code ${code})`;
      reject(new Error(finalMsg));
    });

    process.on('error', (err) => {
      reject(new Error(`Không thể khởi chạy yt-dlp: ${err.message}`));
    });
  });
}

export async function downloadWithYtDlp(
  url: string,
  outputDir: string,
  onProgress?: (percent: number, msg: string) => void
): Promise<MediaItemResult[]> {
  const binaryPath = await ensureYtDlpBinary(false, (msg) => {
    if (onProgress) onProgress(10, msg);
  });

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isFacebook = url.includes('facebook.com') || url.includes('fb.watch');

  if (isYouTube) {
    let lastError: any;
    for (let i = 0; i < YOUTUBE_STRATEGIES.length; i++) {
      const strat = YOUTUBE_STRATEGIES[i];
      try {
        if (onProgress) {
          onProgress(15, `Đang tải video YouTube (${strat.name})...`);
        }
        const res = await executeYtDlp(binaryPath, url, outputDir, strat.args, onProgress);
        if (res && res.length > 0) {
          return res;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`YouTube strategy ${strat.name} failed:`, err.message);
      }
    }
    throw new Error(lastError?.message || 'Không thể tải video YouTube.');
  }

  if (isFacebook) {
    let lastError: any;
    // Try both original URL and mobile m.facebook.com URL
    const targetUrls = [
      url,
      url.replace('www.facebook.com', 'm.facebook.com'),
      url.replace('facebook.com', 'm.facebook.com'),
    ];

    for (const targetUrl of targetUrls) {
      for (let i = 0; i < FACEBOOK_STRATEGIES.length; i++) {
        const strat = FACEBOOK_STRATEGIES[i];
        try {
          if (onProgress) {
            onProgress(20, `Đang tải video Facebook (${strat.name})...`);
          }
          const res = await executeYtDlp(binaryPath, targetUrl, outputDir, strat.args, onProgress);
          if (res && res.length > 0) {
            return res;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Facebook strategy ${strat.name} failed:`, err.message);
        }
      }
    }
    throw new Error(lastError?.message || 'Không thể tải video/Reel Facebook này.');
  }

  // Other platforms (Instagram, etc.)
  const defaultArgs = [
    '-f',
    'best[ext=mp4]/b[ext=mp4]/best/b',
  ];
  return await executeYtDlp(binaryPath, url, outputDir, defaultArgs, onProgress);
}
