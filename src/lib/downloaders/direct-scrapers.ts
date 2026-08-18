import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { MediaItemResult } from '@/types';
import { sanitizeFileName } from '../utils/platform-detector';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
};

async function downloadFileFromUrl(url: string, destPath: string, referer?: string): Promise<number> {
  const cleanUrl = url.replace(/&amp;/g, '&');
  const response = await axios({
    method: 'GET',
    url: cleanUrl,
    responseType: 'stream',
    headers: {
      ...DEFAULT_HEADERS,
      Referer: referer || 'https://www.threads.net/',
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
 * TikTok direct scraper using TikWM API (HD no watermark)
 */
export async function scrapeTikTok(
  url: string,
  outputDir: string,
  prefix: string = 'tiktok'
): Promise<MediaItemResult[]> {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const res = await axios.get(apiUrl, { headers: DEFAULT_HEADERS, timeout: 20000 });

  if (res.data?.code !== 0 || !res.data?.data) {
    throw new Error(res.data?.msg || 'Không thể lấy dữ liệu TikTok từ link cung cấp.');
  }

  const data = res.data.data;
  const results: MediaItemResult[] = [];
  const title = sanitizeFileName(data.title || `tiktok_${data.id || Date.now()}`);

  // Check if image slides/photo album
  if (data.images && Array.isArray(data.images) && data.images.length > 0) {
    for (let i = 0; i < data.images.length; i++) {
      const imgUrl = data.images[i];
      const fileName = `${prefix}_${title}_img_${i + 1}_${Date.now()}.jpg`;
      const filePath = path.join(outputDir, fileName);
      const sizeBytes = await downloadFileFromUrl(imgUrl, filePath);
      results.push({ filePath, fileName, type: 'image', sizeBytes });
    }
  } else {
    // Single Video (HD or standard)
    const videoUrl = data.hdplay || data.play;
    if (!videoUrl) {
      throw new Error('Không tìm thấy link video TikTok tải về.');
    }
    const fullVideoUrl = videoUrl.startsWith('http') ? videoUrl : `https://www.tikwm.com${videoUrl}`;
    const fileName = `${prefix}_${title}_${Date.now()}.mp4`;
    const filePath = path.join(outputDir, fileName);
    const sizeBytes = await downloadFileFromUrl(fullVideoUrl, filePath);
    results.push({ filePath, fileName, type: 'video', sizeBytes });
  }

  return results;
}

/**
 * Douyin direct scraper
 */
export async function scrapeDouyin(
  url: string,
  outputDir: string
): Promise<MediaItemResult[]> {
  return await scrapeTikTok(url, outputDir, 'douyin');
}

/**
 * Threads parser via HTML metadata or direct CDN extraction
 */
export async function scrapeThreads(
  url: string,
  outputDir: string
): Promise<MediaItemResult[]> {
  // Normalize threads.com -> threads.net and strip /media or trailing params
  let cleanUrl = url.replace('threads.com', 'threads.net').split('?')[0].trim();
  if (cleanUrl.endsWith('/media')) {
    cleanUrl = cleanUrl.slice(0, -6);
  }
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }

  const response = await axios.get(cleanUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
    },
    timeout: 20000,
  });

  const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const $ = cheerio.load(html);
  const results: MediaItemResult[] = [];

  // 1. Check meta tags
  let ogVideo =
    $('meta[property="og:video"]').attr('content') ||
    $('meta[property="og:video:secure_url"]').attr('content') ||
    $('meta[name="twitter:player:stream"]').attr('content');

  let ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content');

  const rawDesc =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('title').text() ||
    `threads_${Date.now()}`;

  const title = sanitizeFileName(rawDesc.substring(0, 40));

  if (ogVideo) {
    ogVideo = ogVideo.replace(/&amp;/g, '&');
    const fileName = `threads_${title}_${Date.now()}.mp4`;
    const filePath = path.join(outputDir, fileName);
    const sizeBytes = await downloadFileFromUrl(ogVideo, filePath, 'https://www.threads.net/');
    results.push({ filePath, fileName, type: 'video', sizeBytes });
    return results;
  }

  // 2. Check embedded video JSON in HTML (e.g. data-sjs or require modules)
  const videoUrlMatch = html.match(/https:\/\/[^"'\\]+cdninstagram\.com[^"'\\]+\.mp4[^"'\\]*/);
  if (videoUrlMatch) {
    const directVideoUrl = videoUrlMatch[0].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
    const fileName = `threads_${title}_${Date.now()}.mp4`;
    const filePath = path.join(outputDir, fileName);
    const sizeBytes = await downloadFileFromUrl(directVideoUrl, filePath, 'https://www.threads.net/');
    results.push({ filePath, fileName, type: 'video', sizeBytes });
    return results;
  }

  if (ogImage) {
    ogImage = ogImage.replace(/&amp;/g, '&');
    const fileName = `threads_${title}_${Date.now()}.jpg`;
    const filePath = path.join(outputDir, fileName);
    const sizeBytes = await downloadFileFromUrl(ogImage, filePath, 'https://www.threads.net/');
    results.push({ filePath, fileName, type: 'image', sizeBytes });
    return results;
  }

  throw new Error('Không tìm thấy video hoặc ảnh từ liên kết Threads này.');
}

/**
 * Facebook direct scraper for Reels and Videos
 */
export async function scrapeFacebook(
  url: string,
  outputDir: string
): Promise<MediaItemResult[]> {
  let targetUrl = url.trim();

  // 1. Follow redirects for short links (fb.watch or share links)
  try {
    const headRes = await axios.get(targetUrl, {
      headers: DEFAULT_HEADERS,
      maxRedirects: 5,
      timeout: 10000,
    });
    if (headRes.request?.res?.responseUrl) {
      targetUrl = headRes.request.res.responseUrl;
    }
  } catch {}

  const results: MediaItemResult[] = [];
  let videoUrl: string | null = null;
  let title = `facebook_${Date.now()}`;

  // 2. Try extracting from HTML using Mobile User Agent
  const mobileHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
  };

  try {
    const mobileUrl = targetUrl.replace('www.facebook.com', 'm.facebook.com');
    const res = await axios.get(mobileUrl, { headers: mobileHeaders, timeout: 15000 });
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    // Extract HD or SD video URL patterns
    const hdMatch =
      html.match(/"browser_native_hd_url":"([^"]+)"/) ||
      html.match(/"playable_url_quality_hd":"([^"]+)"/) ||
      html.match(/hd_src:"([^"]+)"/) ||
      html.match(/"hd_src_no_ratelimit":"([^"]+)"/);

    const sdMatch =
      html.match(/"browser_native_sd_url":"([^"]+)"/) ||
      html.match(/"playable_url":"([^"]+)"/) ||
      html.match(/sd_src:"([^"]+)"/) ||
      html.match(/"sd_src_no_ratelimit":"([^"]+)"/);

    const rawMatch = hdMatch || sdMatch;
    if (rawMatch && rawMatch[1]) {
      videoUrl = rawMatch[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&').replace(/\\/g, '');
    }

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      title = sanitizeFileName(titleMatch[1].replace(/Facebook/i, '').trim().substring(0, 40));
    }
  } catch (e: any) {
    console.warn('Facebook mobile HTML scraping error:', e.message);
  }

  // 3. Fallback: Query public resolver API
  if (!videoUrl) {
    try {
      const apiRes = await axios.post(
        'https://fdownloader.net/api/ajaxSearch',
        new URLSearchParams({ k_exp: '', k_token: '', q: targetUrl }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': DEFAULT_HEADERS['User-Agent'],
            'Referer': 'https://fdownloader.net/',
            'Origin': 'https://fdownloader.net',
          },
          timeout: 15000,
        }
      );
      if (apiRes.data?.data) {
        const $ = cheerio.load(apiRes.data.data);
        const downloadLink =
          $('a.download-link-fb, a[href*="fbcdn.net"], a[href*="googlevideo"]').first().attr('href') ||
          $('a.btn.btn-primary').first().attr('href');
        if (downloadLink && downloadLink.startsWith('http')) {
          videoUrl = downloadLink;
        }
      }
    } catch {}
  }

  if (videoUrl) {
    const fileName = `facebook_${title}_${Date.now()}.mp4`;
    const filePath = path.join(outputDir, fileName);
    const sizeBytes = await downloadFileFromUrl(videoUrl, filePath, 'https://www.facebook.com/');
    results.push({ filePath, fileName, type: 'video', sizeBytes });
    return results;
  }

  throw new Error('Không thể bóc tách video Facebook qua direct scraper.');
}
