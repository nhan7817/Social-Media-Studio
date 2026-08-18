import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { WatermarkConfig, WatermarkPosition, OutputAspectRatio, BlurConfig, WatermarkAnimation } from '@/types';

// Try to set ffmpeg path from @ffmpeg-installer/ffmpeg or environment
try {
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  if (ffmpegInstaller && ffmpegInstaller.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  }
} catch (e) {
  console.warn('Could not load @ffmpeg-installer/ffmpeg, relying on system PATH', e);
}

function getTargetDimensions(ratio?: OutputAspectRatio): { width: number; height: number } | null {
  if (!ratio || ratio === 'original') return null;
  switch (ratio) {
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

function getStaticCoordinates(pos: WatermarkPosition, margin: number): { x: string; y: string } {
  switch (pos) {
    case 'top-left':
      return { x: `${margin}`, y: `${margin}` };
    case 'top-center':
      return { x: '(W-w)/2', y: `${margin}` };
    case 'top-right':
      return { x: `W-w-${margin}`, y: `${margin}` };
    case 'center-left':
      return { x: `${margin}`, y: '(H-h)/2' };
    case 'center':
      return { x: '(W-w)/2', y: '(H-h)/2' };
    case 'center-right':
      return { x: `W-w-${margin}`, y: '(H-h)/2' };
    case 'bottom-left':
      return { x: `${margin}`, y: `H-h-${margin}` };
    case 'bottom-center':
      return { x: '(W-w)/2', y: `H-h-${margin}` };
    case 'bottom-right':
    default:
      return { x: `W-w-${margin}`, y: `H-h-${margin}` };
  }
}

function getFfmpegOverlayCoordinates(
  pos: WatermarkPosition,
  margin: number,
  animation?: WatermarkAnimation,
  speed: number = 1
): string {
  const m = Math.max(0, margin || 20);
  const coords = getStaticCoordinates(pos, m);

  if (animation === 'corner-hop') {
    // Jump between 4 corners every 4s (cycle 16s)
    // Corner 0 (0-4s): Top-Left (m, m)
    // Corner 1 (4-8s): Top-Right (W-w-m, m)
    // Corner 2 (8-12s): Bottom-Right (W-w-m, H-h-m)
    // Corner 3 (12-16s): Bottom-Left (m, H-h-m)
    const xExpr = `if(between(mod(floor(t/4),4),1,2),W-w-${m},${m})`;
    const yExpr = `if(gte(mod(floor(t/4),4),2),H-h-${m},${m})`;
    return `x='${xExpr}':y='${yExpr}':eval=frame`;
  }

  if (animation === 'floating') {
    const spd = Math.max(0.5, Math.min(3, speed || 1));
    const xExpr = `(W-w)/2+((W-w)/2-${m})*sin(t*1.2*${spd})`;
    const yExpr = `(H-h)/2+((H-h)/2-${m})*cos(t*0.8*${spd})`;
    return `x='${xExpr}':y='${yExpr}':eval=frame`;
  }

  if (animation === 'marquee-left') {
    const pxPerSec = Math.round(160 * Math.max(0.5, Math.min(3, speed || 1)));
    const xExpr = `W-mod(t*${pxPerSec},W+w)`;
    const yExpr = coords.y;
    return `x='${xExpr}':y='${yExpr}':eval=frame`;
  }

  if (animation === 'fade-pulse') {
    // Watermark displays for 2.5s and hides for 1.5s in every 4s cycle
    return `x='${coords.x}':y='${coords.y}':enable='lt(mod(t,4),2.5)':eval=frame`;
  }

  return `x='${coords.x}':y='${coords.y}'`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Creates a transparent PNG watermark image on the fly
 */
async function generateWatermarkImageBuffer(config: WatermarkConfig): Promise<Buffer> {
  const opacity = Math.min(100, Math.max(0, config.opacity)) / 100;

  if (config.type === 'text') {
    const text = config.text || 'Watermark';
    const fontSize = config.fontSize || 36;
    const fontColor = config.fontColor || '#ffffff';
    const fontFamily = config.fontFamily || 'Arial, sans-serif';

    const approxWidth = Math.max(120, Math.round(text.length * fontSize * 0.75 + 40));
    const approxHeight = Math.max(50, Math.round(fontSize * 2.2));

    const svg = `
      <svg width="${approxWidth}" height="${approxHeight}" xmlns="http://www.w3.org/2000/svg">
        <text 
          x="50%" 
          y="50%" 
          dominant-baseline="central" 
          text-anchor="middle" 
          font-family="${fontFamily}" 
          font-size="${fontSize}px" 
          font-weight="bold" 
          fill="${fontColor}" 
          fill-opacity="${opacity}"
          stroke="black"
          stroke-width="1.5"
          stroke-opacity="${Math.min(1, opacity * 0.9)}"
        >
          ${escapeXml(text)}
        </text>
      </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
  } else if (config.type === 'image' && config.imagePath) {
    let imageBuffer: Buffer;
    if (config.imagePath.startsWith('data:image')) {
      const base64Data = config.imagePath.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      imageBuffer = await fs.readFile(config.imagePath);
    }

    const metadata = await sharp(imageBuffer).metadata();
    const origWidth = metadata.width || 300;
    const origHeight = metadata.height || 300;

    const targetWidth = Math.max(50, Math.round(1920 * ((config.imageScale || 15) / 100)));
    const targetHeight = Math.max(50, Math.round(targetWidth * (origHeight / origWidth)));

    const resized = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, { fit: 'inside' })
      .ensureAlpha()
      .toBuffer();

    return await sharp(resized)
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
  }

  return Buffer.from('');
}

/**
 * Applies watermark, aspect-ratio scaling, and visual ROI blur to video file via FFmpeg
 */
export async function applyWatermarkToVideo(
  inputPath: string,
  outputPath: string,
  config: WatermarkConfig,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!config.enabled && (!config.outputAspectRatio || config.outputAspectRatio === 'original') && (!config.blurConfig || !config.blurConfig.enabled)) {
    await fs.copyFile(inputPath, outputPath);
    return outputPath;
  }

  const hasWatermark = config.enabled && config.type !== 'none';
  const targetDim = getTargetDimensions(config.outputAspectRatio);
  const blurZones = (config.blurConfig?.enabled && config.blurConfig?.zones) ? config.blurConfig.zones : [];
  const hasBlur = config.blurConfig?.enabled && blurZones.length > 0;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  let tempWatermarkFile: string | null = null;
  if (hasWatermark) {
    const wmBuffer = await generateWatermarkImageBuffer(config);
    tempWatermarkFile = path.join(os.tmpdir(), `wm_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
    await fs.writeFile(tempWatermarkFile, wmBuffer);
  }

  const overlayCoords = getFfmpegOverlayCoordinates(
    config.position,
    config.margin || 20,
    config.animation,
    config.animationSpeed || 1
  );

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(inputPath);

    if (tempWatermarkFile) {
      cmd.input(tempWatermarkFile);
    }

    // Build dynamic complex filter chain
    const filterParts: string[] = [];
    let currentV = '[0:v]';

    // 1. Process visual blur zones sequentially with crop + boxblur + overlay
    if (hasBlur) {
      blurZones.forEach((zone, idx) => {
        const x = Math.max(0, Math.min(0.95, (zone.x || 0) / 100));
        const y = Math.max(0, Math.min(0.95, (zone.y || 0) / 100));
        const w = Math.max(0.02, Math.min(1 - x, (zone.width || 20) / 100));
        const h = Math.max(0.02, Math.min(1 - y, (zone.height || 10) / 100));
        const intensity = Math.min(30, Math.max(4, Math.round(zone.intensity || 16)));

        const isLastStep = (idx === blurZones.length - 1) && !targetDim && !hasWatermark;
        const outLabel = isLastStep ? '[outv]' : `[v_blur_${idx}]`;

        filterParts.push(
          `${currentV}split[base_${idx}][crop_in_${idx}]`,
          `[crop_in_${idx}]crop=iw*${w.toFixed(4)}:ih*${h.toFixed(4)}:iw*${x.toFixed(4)}:ih*${y.toFixed(4)},boxblur=${intensity}:1[blurred_${idx}]`,
          `[base_${idx}][blurred_${idx}]overlay=main_w*${x.toFixed(4)}:main_h*${y.toFixed(4)}${outLabel}`
        );

        currentV = outLabel;
      });
    }

    // 2. Aspect Ratio Conversion
    if (targetDim) {
      const isLastStep = !hasWatermark;
      const outLabel = isLastStep ? '[outv]' : '[scaledv]';
      filterParts.push(
        `${currentV}scale=${targetDim.width}:${targetDim.height}:force_original_aspect_ratio=decrease,pad=${targetDim.width}:${targetDim.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1${outLabel}`
      );
      currentV = outLabel;
    }

    // 3. Watermark Overlay with fps=30, infinite loop, and synchronized PTS
    if (hasWatermark) {
      filterParts.push(`[1:v]fps=30,loop=-1:1:0,setpts=N/30/TB[wm_loop]`);
      filterParts.push(`${currentV}[wm_loop]overlay=${overlayCoords}:shortest=1[outv]`);
      currentV = '[outv]';
    }

    cmd.complexFilter(filterParts);

    cmd
      .outputOptions([
        '-map [outv]',
        '-map 0:a?', // copy audio if exists
        '-c:v libx264',
        '-preset fast',
        '-crf 22',
        '-c:a copy',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('progress', (p) => {
        if (onProgress && p.percent) {
          onProgress(Math.min(100, Math.max(0, Math.round(p.percent))));
        }
      })
      .on('end', async () => {
        if (tempWatermarkFile) {
          try {
            await fs.unlink(tempWatermarkFile);
          } catch {}
        }
        resolve(outputPath);
      })
      .on('error', async (err) => {
        if (tempWatermarkFile) {
          try {
            await fs.unlink(tempWatermarkFile);
          } catch {}
        }
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}
