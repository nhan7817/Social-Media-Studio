import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { WatermarkConfig, WatermarkPosition, OutputAspectRatio } from '@/types';

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

function calculatePosition(
  pos: WatermarkPosition,
  mainWidth: number,
  mainHeight: number,
  overlayWidth: number,
  overlayHeight: number,
  margin: number
): { left: number; top: number } {
  let left = margin;
  let top = margin;

  // Horizontal calculation
  if (pos.includes('center') && !pos.includes('left') && !pos.includes('right')) {
    left = Math.floor((mainWidth - overlayWidth) / 2);
  } else if (pos.includes('right')) {
    left = Math.max(0, mainWidth - overlayWidth - margin);
  } else {
    // left
    left = margin;
  }

  // Vertical calculation
  if (pos.startsWith('center') || pos === 'center') {
    top = Math.floor((mainHeight - overlayHeight) / 2);
  } else if (pos.startsWith('bottom')) {
    top = Math.max(0, mainHeight - overlayHeight - margin);
  } else {
    // top
    top = margin;
  }

  return { left, top };
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

export async function applyWatermarkToImage(
  inputPath: string,
  outputPath: string,
  config: WatermarkConfig
): Promise<string> {
  const hasWatermark = config.enabled && config.type !== 'none';
  const targetDim = getTargetDimensions(config.outputAspectRatio);

  if (!hasWatermark && !targetDim) {
    if (inputPath !== outputPath) {
      await fs.copyFile(inputPath, outputPath);
    }
    return outputPath;
  }

  // Make sure target directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // Load and optionally pad/scale image
  let baseImageBuffer: Buffer;
  let width = 1080;
  let height = 1080;

  if (targetDim) {
    width = targetDim.width;
    height = targetDim.height;
    baseImageBuffer = await sharp(inputPath)
      .resize({
        width: targetDim.width,
        height: targetDim.height,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .toBuffer();
  } else {
    const meta = await sharp(inputPath).metadata();
    width = meta.width || 1080;
    height = meta.height || 1080;
    baseImageBuffer = await fs.readFile(inputPath);
  }

  if (!hasWatermark) {
    await sharp(baseImageBuffer).toFile(outputPath);
    return outputPath;
  }

  const opacity = Math.min(100, Math.max(0, config.opacity)) / 100;
  const margin = Math.max(0, config.margin || 20);

  let overlayBuffer: Buffer;
  let overlayWidth = 100;
  let overlayHeight = 50;

  if (config.type === 'text') {
    const text = config.text || 'Watermark';
    const fontSize = config.fontSize || 32;
    const fontColor = config.fontColor || '#ffffff';
    const fontFamily = config.fontFamily || 'Arial, sans-serif';

    const estimatedWidth = Math.ceil(text.length * fontSize * 0.65) + 30;
    const estimatedHeight = Math.ceil(fontSize * 1.5) + 20;

    const svg = `
      <svg width="${estimatedWidth}" height="${estimatedHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .wm-text {
            font-family: ${fontFamily};
            font-size: ${fontSize}px;
            font-weight: bold;
            fill: ${fontColor};
            opacity: ${opacity};
            filter: drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.7));
          }
        </style>
        <text x="50%" y="60%" text-anchor="middle" dominant-baseline="middle" class="wm-text">${escapeXml(text)}</text>
      </svg>
    `;

    overlayBuffer = Buffer.from(svg);
    overlayWidth = estimatedWidth;
    overlayHeight = estimatedHeight;
  } else if (config.type === 'image' && config.imagePath) {
    let logoBuffer: Buffer;
    if (config.imagePath.startsWith('data:')) {
      const base64Data = config.imagePath.split(',')[1];
      logoBuffer = Buffer.from(base64Data, 'base64');
    } else {
      logoBuffer = await fs.readFile(config.imagePath);
    }

    const targetWidth = Math.floor(width * ((config.imageScale || 15) / 100));
    const processedLogo = await sharp(logoBuffer)
      .resize({ width: Math.max(40, targetWidth), withoutEnlargement: false })
      .composite([{
        input: Buffer.from([255, 255, 255, Math.floor(255 * opacity)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in'
      }])
      .toBuffer();

    const logoMeta = await sharp(processedLogo).metadata();
    overlayBuffer = processedLogo;
    overlayWidth = logoMeta.width || targetWidth;
    overlayHeight = logoMeta.height || 50;
  } else {
    await sharp(baseImageBuffer).toFile(outputPath);
    return outputPath;
  }

  const { left, top } = calculatePosition(config.position, width, height, overlayWidth, overlayHeight, margin);

  await sharp(baseImageBuffer)
    .composite([
      {
        input: overlayBuffer,
        left: Math.max(0, left),
        top: Math.max(0, top),
      }
    ])
    .toFile(outputPath);

  return outputPath;
}
