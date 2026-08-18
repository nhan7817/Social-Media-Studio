import { spawn } from 'child_process';
import { ensureYtDlpBinary } from './bin-helper';
import axios from 'axios';

export interface ChannelVideoItem {
  url: string;
  title: string;
  id?: string;
  duration?: string;
  thumbnail?: string;
}

export interface ChannelExtractResult {
  channelTitle: string;
  channelUrl: string;
  totalFound: number;
  videos: ChannelVideoItem[];
}

const MOBILE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Mode': 'navigate',
};

const DESKTOP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Referer': 'https://www.tiktok.com/',
};

/**
 * Parses embedded JSON from TikTok profile HTML (Universal Data / SIGI_STATE)
 */
async function scrapeTikTokHtmlDirect(
  username: string,
  maxVideos: number = 30
): Promise<ChannelExtractResult | null> {
  const cleanUsername = username.replace('@', '').trim();
  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(cleanUsername)}`;

  try {
    const res = await axios.get(profileUrl, {
      headers: MOBILE_HEADERS,
      timeout: 15000,
    });

    const html = res.data;
    if (typeof html !== 'string') return null;

    let jsonData: any = null;

    // Pattern 1: __UNIVERSAL_DATA_FOR_REHYDRATION__
    const univMatch = html.match(/<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"\s+type="application\/json">([\s\S]*?)<\/script>/i);
    if (univMatch && univMatch[1]) {
      try {
        jsonData = JSON.parse(univMatch[1]);
      } catch {}
    }

    // Pattern 2: SIGI_STATE
    if (!jsonData) {
      const sigiMatch = html.match(/<script\s+id="SIGI_STATE"\s+type="application\/json">([\s\S]*?)<\/script>/i);
      if (sigiMatch && sigiMatch[1]) {
        try {
          jsonData = JSON.parse(sigiMatch[1]);
        } catch {}
      }
    }

    if (jsonData) {
      const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
      const userDetail = defaultScope['webapp.user-detail'] || defaultScope['user-detail'] || {};
      const userInfo = userDetail.userInfo?.user || jsonData.UserModule?.users?.[cleanUsername] || {};
      const channelTitle = userInfo.nickname || `@${cleanUsername}`;

      // Extract item list
      const itemList: string[] =
        userDetail.itemList ||
        jsonData.ItemList?.['user-post']?.list ||
        jsonData.itemList ||
        [];

      const itemModule = defaultScope['webapp.video-detail'] || jsonData.ItemModule || {};

      const videos: ChannelVideoItem[] = [];

      if (Array.isArray(itemList) && itemList.length > 0) {
        for (const vidId of itemList.slice(0, maxVideos)) {
          const item = itemModule[vidId] || {};
          const title = item.desc || `TikTok Video ${vidId}`;
          const duration = item.video?.duration ? `${item.video.duration}s` : undefined;
          const thumbnail = item.video?.cover || item.video?.originCover;

          videos.push({
            url: `https://www.tiktok.com/@${cleanUsername}/video/${vidId}`,
            title,
            id: vidId,
            duration,
            thumbnail,
          });
        }
      }

      // If itemList was empty, scan itemModule keys directly
      if (videos.length === 0 && itemModule && typeof itemModule === 'object') {
        const keys = Object.keys(itemModule);
        for (const key of keys.slice(0, maxVideos)) {
          const item = itemModule[key];
          if (item && item.id) {
            videos.push({
              url: `https://www.tiktok.com/@${cleanUsername}/video/${item.id}`,
              title: item.desc || `TikTok Video ${item.id}`,
              id: item.id,
              duration: item.video?.duration ? `${item.video.duration}s` : undefined,
              thumbnail: item.video?.cover,
            });
          }
        }
      }

      // Also regex match all video URLs in HTML as extra safety
      if (videos.length === 0) {
        const videoIdMatches = Array.from(html.matchAll(/\/video\/(\d{15,25})/g));
        const uniqueIds = Array.from(new Set(videoIdMatches.map((m) => m[1])));
        for (const vidId of uniqueIds.slice(0, maxVideos)) {
          videos.push({
            url: `https://www.tiktok.com/@${cleanUsername}/video/${vidId}`,
            title: `TikTok Video ${vidId}`,
            id: vidId,
          });
        }
      }

      if (videos.length > 0) {
        return {
          channelTitle,
          channelUrl: profileUrl,
          totalFound: videos.length,
          videos,
        };
      }
    }
  } catch (e: any) {
    console.warn('Scrape TikTok HTML error:', e.message);
  }

  return null;
}

/**
 * Extracts TikTok user videos using TikWM user API
 */
async function extractTikTokFromTikWM(
  username: string,
  maxVideos: number = 30
): Promise<ChannelExtractResult | null> {
  const cleanUsername = username.replace('@', '').trim();

  // Try TikWM User Info to get secUid
  let secUid = '';
  let channelTitle = `@${cleanUsername}`;

  try {
    const infoRes = await axios.get(
      `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanUsername)}`,
      { headers: DESKTOP_HEADERS, timeout: 10000 }
    );
    if (infoRes.data?.code === 0 && infoRes.data?.data?.user) {
      secUid = infoRes.data.data.user.secUid || '';
      channelTitle = infoRes.data.data.user.nickname || `@${cleanUsername}`;
    }
  } catch {}

  const endpoints = [];
  if (secUid) {
    endpoints.push(
      `https://www.tikwm.com/api/user/posts?sec_uid=${encodeURIComponent(secUid)}&count=${Math.min(maxVideos, 50)}&cursor=0`
    );
  }
  endpoints.push(
    `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(cleanUsername)}&count=${Math.min(maxVideos, 50)}&cursor=0`
  );

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: DESKTOP_HEADERS, timeout: 15000 });
      if (res.data?.code === 0 && res.data?.data?.videos && Array.isArray(res.data.data.videos) && res.data.data.videos.length > 0) {
        const vids = res.data.data.videos;
        const videos: ChannelVideoItem[] = vids.slice(0, maxVideos).map((v: any) => ({
          url: `https://www.tiktok.com/@${cleanUsername}/video/${v.video_id}`,
          title: v.title || `TikTok Video ${v.video_id}`,
          id: v.video_id,
          duration: v.duration ? `${v.duration}s` : undefined,
          thumbnail: v.cover || v.origin_cover,
        }));

        return {
          channelTitle,
          channelUrl: `https://www.tiktok.com/@${cleanUsername}`,
          totalFound: videos.length,
          videos,
        };
      }
    } catch {}
  }

  return null;
}

/**
 * Universal channel / playlist / user profile extractor
 */
export async function extractChannelVideos(
  channelUrl: string,
  maxVideos?: number
): Promise<ChannelExtractResult> {
  const trimmedUrl = channelUrl.trim();
  const limit = maxVideos && maxVideos > 0 ? maxVideos : 30;

  // Special Check: Instagram User Profile
  const isInstagramUser =
    (trimmedUrl.includes('instagram.com/') || trimmedUrl.includes('instagr.am/')) &&
    !trimmedUrl.includes('/p/') &&
    !trimmedUrl.includes('/reel/') &&
    !trimmedUrl.includes('/tv/');

  if (isInstagramUser) {
    throw new Error(
      'Instagram chặn việc quét toàn bộ trang cá nhân ẩn danh (Yêu cầu đăng nhập tài khoản Meta). Để tải video Instagram, bạn vui lòng copy link bài viết/Reel cụ thể (ví dụ: https://www.instagram.com/reel/...) và dán vào tab "Dán danh sách link" để tải hàng loạt.'
    );
  }

  // TikTok User Handler
  const tikTokMatch = trimmedUrl.match(/tiktok\.com\/@([a-zA-Z0-9_\.\-]+)/i);
  if (tikTokMatch && !trimmedUrl.includes('/video/')) {
    const username = tikTokMatch[1];

    // Priority 1: Scrape directly from TikTok mobile HTML rehydration data
    const directHtmlResult = await scrapeTikTokHtmlDirect(username, limit);
    if (directHtmlResult && directHtmlResult.videos.length > 0) {
      return directHtmlResult;
    }

    // Priority 2: TikWM user posts API
    const tikWmResult = await extractTikTokFromTikWM(username, limit);
    if (tikWmResult && tikWmResult.videos.length > 0) {
      return tikWmResult;
    }
  }

  // Universal Fallback: yt-dlp flat-playlist
  const binaryPath = await ensureYtDlpBinary();

  const args: string[] = [
    '--flat-playlist',
    '--no-warnings',
    '--dump-single-json',
    '--force-ipv4',
    '--no-check-certificates',
  ];

  if (maxVideos && maxVideos > 0) {
    args.push('--playlist-end', String(maxVideos));
  }

  args.push(trimmedUrl);

  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath, args);
    let stdoutBuffer = '';
    let stderrBuffer = '';

    proc.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdoutBuffer) {
        try {
          const json = JSON.parse(stdoutBuffer);
          const channelTitle = json.title || json.uploader || json.channel || 'Kênh / Playlist';
          const entries = json.entries || (json._type === 'url' ? [json] : []);

          const videos: ChannelVideoItem[] = entries
            .filter((entry: any) => entry && (entry.url || entry.id || entry.webpage_url))
            .map((entry: any) => {
              let url = entry.webpage_url || entry.url;
              if (!url || !url.startsWith('http')) {
                if (json.extractor_key === 'Youtube' || trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be')) {
                  url = `https://www.youtube.com/watch?v=${entry.id || entry.url}`;
                } else if (trimmedUrl.includes('tiktok.com') && entry.id) {
                  url = `https://www.tiktok.com/@${tikTokMatch ? tikTokMatch[1] : 'user'}/video/${entry.id}`;
                } else {
                  url = entry.url || trimmedUrl;
                }
              }

              return {
                url,
                title: entry.title || `Video ${entry.id || ''}`,
                id: entry.id,
                duration: entry.duration ? `${Math.round(entry.duration)}s` : undefined,
                thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail,
              };
            });

          resolve({
            channelTitle,
            channelUrl: trimmedUrl,
            totalFound: videos.length,
            videos: maxVideos && maxVideos > 0 ? videos.slice(0, maxVideos) : videos,
          });
        } catch (parseErr: any) {
          reject(new Error(`Lỗi giải mã thông tin kênh: ${parseErr.message}`));
        }
      } else {
        const errorText = stderrBuffer.trim();
        if (errorText.includes('[instagram:user]') || errorText.includes('instagram.com')) {
          reject(
            new Error(
              'Instagram yêu cầu đăng nhập để quét danh sách trang cá nhân. Vui lòng dán trực tiếp link bài viết / Reel Instagram vào tab "Dán danh sách link" để tải.'
            )
          );
        } else if (errorText.includes('Unable to extract secondary user ID') || errorText.includes('[tiktok:user]')) {
          const username = tikTokMatch ? `@${tikTokMatch[1]}` : 'này';
          reject(
            new Error(
              `TikTok đang chặn việc quét toàn bộ trang cá nhân ẩn danh của ${username} (Kênh riêng tư hoặc bật bảo vệ bot). Bạn vui lòng copy các link video TikTok cụ thể và dán vào tab "Dán danh sách link" để tải hàng loạt nhé!`
            )
          );
        } else if (errorText.includes('Private video') || errorText.includes('Sign in')) {
          reject(new Error('Kênh hoặc danh sách phát này đang ở chế độ Riêng tư / Yêu cầu đăng nhập.'));
        } else {
          reject(new Error(errorText || `Không thể trích xuất video từ kênh (Mã lỗi ${code})`));
        }
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Lỗi khởi chạy engine trích xuất: ${err.message}`));
    });
  });
}
