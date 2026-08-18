import fs from 'fs';
import path from 'path';
import axios from 'axios';

const BIN_DIR = path.join(process.cwd(), 'bin');
const YTDLP_PATH = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

export async function ensureYtDlpBinary(forceUpdate = false, onProgress?: (msg: string) => void): Promise<string> {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  if (fs.existsSync(YTDLP_PATH) && !forceUpdate) {
    return YTDLP_PATH;
  }

  if (onProgress) onProgress('Đang tải bản cập nhật yt-dlp binary mới nhất...');

  const downloadUrl =
    process.platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : process.platform === 'darwin'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  try {
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      timeout: 60000,
    });

    fs.writeFileSync(YTDLP_PATH, Buffer.from(response.data), { mode: 0o755 });
    if (onProgress) onProgress('Đã cài đặt yt-dlp binary thành công.');
    return YTDLP_PATH;
  } catch (error: any) {
    if (fs.existsSync(YTDLP_PATH)) {
      return YTDLP_PATH;
    }
    console.error('Failed to download yt-dlp binary:', error.message);
    throw new Error(`Không thể tải yt-dlp: ${error.message}`);
  }
}

export function getYtDlpPath(): string {
  if (fs.existsSync(YTDLP_PATH)) {
    return YTDLP_PATH;
  }
  return 'yt-dlp';
}
