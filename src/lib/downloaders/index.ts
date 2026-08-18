import { MediaItemResult, SupportedPlatform } from '@/types';
import { detectPlatform } from '../utils/platform-detector';
import { scrapeTikTok, scrapeDouyin, scrapeThreads, scrapeFacebook } from './direct-scrapers';
import { downloadWithYtDlp } from './ytdlp-handler';

export interface DownloadOptions {
  url: string;
  selectedPlatform: SupportedPlatform;
  outputDir: string;
  onProgress?: (percent: number, msg: string) => void;
}

export async function downloadMedia({
  url,
  selectedPlatform,
  outputDir,
  onProgress,
}: DownloadOptions): Promise<{ results: MediaItemResult[]; platform: SupportedPlatform }> {
  const actualPlatform =
    selectedPlatform === 'auto' ? detectPlatform(url) : selectedPlatform;

  if (onProgress) onProgress(15, `Đang phân tích link (${actualPlatform.toUpperCase()})...`);

  // Direct scrapers for specific platforms
  if (actualPlatform === 'threads') {
    const res = await scrapeThreads(url, outputDir);
    if (res && res.length > 0) {
      return { results: res, platform: actualPlatform };
    }
    throw new Error('Không thể tải bài viết Threads này (bài viết riêng tư hoặc link không hợp lệ).');
  }

  if (actualPlatform === 'facebook') {
    try {
      if (onProgress) onProgress(25, 'Đang giải mã video Facebook / Reel...');
      const res = await scrapeFacebook(url, outputDir);
      if (res && res.length > 0) {
        return { results: res, platform: actualPlatform };
      }
    } catch (e: any) {
      console.warn(`Direct Facebook scraper failed for ${url}, trying yt-dlp fallback:`, e.message);
    }
  }

  if (actualPlatform === 'tiktok') {
    try {
      const res = await scrapeTikTok(url, outputDir);
      if (res && res.length > 0) {
        return { results: res, platform: actualPlatform };
      }
    } catch (e: any) {
      console.warn(`Direct TikTok scraper failed for ${url}, trying yt-dlp fallback:`, e.message);
    }
  } else if (actualPlatform === 'douyin') {
    try {
      const res = await scrapeDouyin(url, outputDir);
      if (res && res.length > 0) {
        return { results: res, platform: actualPlatform };
      }
    } catch (e: any) {
      console.warn(`Direct Douyin scraper failed for ${url}, trying yt-dlp fallback:`, e.message);
    }
  }

  // Universal Fallback via yt-dlp
  if (onProgress) onProgress(30, 'Đang trích xuất stream qua yt-dlp engine...');
  const res = await downloadWithYtDlp(url, outputDir, onProgress);

  if (!res || res.length === 0) {
    throw new Error('Không thể tìm thấy hoặc tải xuống nội dung đa phương tiện từ đường link này.');
  }

  return { results: res, platform: actualPlatform };
}
