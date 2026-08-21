import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

// Configure FFmpeg path
try {
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  if (ffmpegInstaller && ffmpegInstaller.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  }
} catch (e) {
  console.warn('Could not load @ffmpeg-installer/ffmpeg, relying on system PATH', e);
}

export interface TrimSegment {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  speed?: number; // 0.5 to 2.0
}

export interface TrimOptions {
  inputPath: string;
  outputPath: string;
  segments: TrimSegment[];
  mode: 'merge_segments' | 'separate_files'; // merge all cut segments or export individually
  qualityMode: 'fast_copy' | 'accurate';     // stream copy vs re-encode
  muteAudio?: boolean;
  onProgress?: (percent: number) => void;
}

export interface MergeOptions {
  inputPaths: string[];
  outputPath: string;
  aspectRatio: 'original' | '9:16' | '16:9' | '1:1' | '4:5';
  targetFps?: number;
  muteAudio?: boolean;
  backgroundMusicPath?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Format seconds into HH:MM:SS.mmm
 */
export function formatTimeSeconds(seconds: number): string {
  const pad = (num: number, size = 2) => String(num).padStart(size, '0');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/**
 * Cuts a single segment from a video file
 */
export async function cutSingleSegment(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number,
  qualityMode: 'fast_copy' | 'accurate' = 'accurate',
  muteAudio = false,
  speed = 1
): Promise<string> {
  const duration = Math.max(0.1, end - start);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // In fast_copy mode with speed=1 and not muted, we can use direct stream copy
    if (qualityMode === 'fast_copy' && speed === 1 && !muteAudio) {
      cmd
        .input(inputPath)
        .setStartTime(start)
        .setDuration(duration)
        .outputOptions([
          '-c copy',
          '-avoid_negative_ts make_zero',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(new Error(`Lỗi cắt video (Fast): ${err.message}`)))
        .run();
      return;
    }

    // In accurate mode or when speed/mute is applied, re-encode with high quality
    cmd
      .input(inputPath)
      .setStartTime(start)
      .setDuration(duration);

    // Apply speed or mute filter if needed
    const videoFilters: string[] = [];
    const audioFilters: string[] = [];

    if (speed !== 1) {
      const setptsSpeed = (1 / speed).toFixed(4);
      videoFilters.push(`setpts=${setptsSpeed}*PTS`);
      
      // atempo supports 0.5 to 2.0
      const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
      audioFilters.push(`atempo=${clampedSpeed}`);
    }

    if (videoFilters.length > 0) {
      cmd.videoFilters(videoFilters);
    }

    const outputOpts: string[] = [
      '-c:v libx264',
      '-preset fast',
      '-crf 20',
      '-pix_fmt yuv420p',
      '-movflags +faststart'
    ];

    if (muteAudio) {
      outputOpts.push('-an');
    } else {
      if (audioFilters.length > 0) {
        cmd.audioFilters(audioFilters);
      }
      outputOpts.push('-c:a aac', '-b:a 192k');
    }

    cmd
      .outputOptions(outputOpts)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`Lỗi cắt video (Accurate): ${err.message}`)))
      .run();
  });
}

/**
 * Cuts multiple segments and concatenates them into one seamless video,
 * or returns paths to separate segment files.
 */
export async function trimAndProcessSegments(options: TrimOptions): Promise<string[]> {
  const { inputPath, outputPath, segments, mode, qualityMode, muteAudio } = options;

  if (segments.length === 0) {
    throw new Error('Cần ít nhất một phân đoạn để cắt.');
  }

  // Case 1: Only 1 segment, directly cut to output path
  if (segments.length === 1 && mode === 'merge_segments') {
    const seg = segments[0];
    await cutSingleSegment(inputPath, outputPath, seg.start, seg.end, qualityMode, muteAudio, seg.speed || 1);
    return [outputPath];
  }

  const tempDir = path.join(os.tmpdir(), `trim_seg_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  await fs.mkdir(tempDir, { recursive: true });

  const tempSegmentFiles: string[] = [];

  try {
    // Cut each segment sequentially
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segFileName = `seg_${i + 1}_${Date.now()}.mp4`;
      const segPath = path.join(tempDir, segFileName);

      await cutSingleSegment(inputPath, segPath, seg.start, seg.end, qualityMode, muteAudio, seg.speed || 1);
      tempSegmentFiles.push(segPath);
    }

    // Case 2: User wants separate files
    if (mode === 'separate_files') {
      const outDir = path.dirname(outputPath);
      const ext = path.extname(outputPath) || '.mp4';
      const base = path.basename(outputPath, ext);

      const exportedFiles: string[] = [];
      for (let i = 0; i < tempSegmentFiles.length; i++) {
        const destFile = path.join(outDir, `${base}_part${i + 1}${ext}`);
        await fs.copyFile(tempSegmentFiles[i], destFile);
        exportedFiles.push(destFile);
      }
      return exportedFiles;
    }

    // Case 3: Merge all cut segments into one single video
    await mergeVideosDirectOrComplex({
      inputPaths: tempSegmentFiles,
      outputPath,
      aspectRatio: 'original',
      muteAudio: false,
    });

    return [outputPath];
  } finally {
    // Clean up temp directory
    try {
      if (fsSync.existsSync(tempDir)) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

function getDimensionsForAspect(aspect: 'original' | '9:16' | '16:9' | '1:1' | '4:5'): { width: number; height: number } | null {
  switch (aspect) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    default:
      return null;
  }
}

/**
 * Standardizes multiple video clips and merges them into one single seamless video
 */
export async function mergeVideosDirectOrComplex(options: MergeOptions): Promise<string> {
  const { inputPaths, outputPath, aspectRatio, targetFps = 30, muteAudio, backgroundMusicPath, onProgress } = options;

  if (inputPaths.length < 2) {
    if (inputPaths.length === 1) {
      await fs.copyFile(inputPaths[0], outputPath);
      return outputPath;
    }
    throw new Error('Cần ít nhất 2 video để thực hiện ghép.');
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const targetDim = getDimensionsForAspect(aspectRatio) || { width: 1920, height: 1080 };

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // Add all video inputs
    inputPaths.forEach((p) => {
      cmd.input(p);
    });

    // Optional background music
    let hasBgMusic = false;
    if (backgroundMusicPath && fsSync.existsSync(backgroundMusicPath)) {
      cmd.input(backgroundMusicPath);
      hasBgMusic = true;
    }

    const n = inputPaths.length;
    const filterParts: string[] = [];

    // Standardize each video stream to the target dimensions, fps, SAR, and timebase
    for (let i = 0; i < n; i++) {
      filterParts.push(
        `[${i}:v]scale=${targetDim.width}:${targetDim.height}:force_original_aspect_ratio=decrease,pad=${targetDim.width}:${targetDim.height}:(ow-iw)/2:(oh-ih)/2:black,fps=${targetFps},setsar=1,format=yuv420p[v${i}]`
      );

      if (!muteAudio) {
        // Resample audio to stereo 44.1kHz 16-bit to avoid concat audio desync
        filterParts.push(
          `[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`
        );
      }
    }

    // Build the concat filter inputs
    let concatInputs = '';
    for (let i = 0; i < n; i++) {
      concatInputs += `[v${i}]`;
      if (!muteAudio) {
        concatInputs += `[a${i}]`;
      }
    }

    const vOut = !hasBgMusic ? '[outv]' : '[mergedv]';
    const aOut = !hasBgMusic ? '[outa]' : '[mergeda]';

    if (!muteAudio) {
      filterParts.push(`${concatInputs}concat=n=${n}:v=1:a=1${vOut}${aOut}`);
    } else {
      filterParts.push(`${concatInputs}concat=n=${n}:v=1:a=0${vOut}`);
    }

    // Mix in background music if supplied
    if (hasBgMusic) {
      if (!muteAudio) {
        // Mix merged video audio with background music
        filterParts.push(
          `[${n}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=0.4[bgm]`,
          `[mergeda][bgm]amix=inputs=2:duration=first:dropout_transition=2[outa]`
        );
      } else {
        // Use background music as the sole audio track
        filterParts.push(
          `[${n}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[outa]`
        );
      }
    }

    cmd.complexFilter(filterParts);

    const outputOpts: string[] = [
      '-map [outv]',
      '-c:v libx264',
      '-preset fast',
      '-crf 22',
      '-pix_fmt yuv420p',
      '-movflags +faststart'
    ];

    if (!muteAudio || hasBgMusic) {
      outputOpts.push('-map [outa]', '-c:a aac', '-b:a 192k');
    } else {
      outputOpts.push('-an');
    }

    cmd
      .outputOptions(outputOpts)
      .output(outputPath)
      .on('progress', (p) => {
        if (onProgress && p.percent) {
          onProgress(Math.min(100, Math.max(0, Math.round(p.percent))));
        }
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error('Merge FFmpeg error:', err);
        reject(new Error(`Lỗi ghép video: ${err.message}`));
      })
      .run();
  });
}
