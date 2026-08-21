import axios from 'axios';
import { message } from 'antd';

/**
 * Triggers the folder picker dialog.
 * 1. On Web Online (e.g. Vercel Cloud), uses the Browser Native File System Access API (window.showDirectoryPicker)
 *    which pops up the Windows/Mac folder picker directly on the client's screen.
 * 2. On Localhost Desktop, falls back to the backend PowerShell / OS FolderBrowserDialog.
 */
export async function openNativeFolderDialog(): Promise<string | null> {
  // 1. Try Browser Native File System Access API (Works on Web Online / Vercel in Chrome, Edge, Opera, Brave)
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      // @ts-ignore
      const dirHandle = await (window as any).showDirectoryPicker({
        id: 'social_media_studio_picker',
        mode: 'readwrite',
        startIn: 'downloads',
      });

      if (dirHandle && dirHandle.name) {
        const folderName = `📁 [Máy tính] ${dirHandle.name}`;
        try {
          localStorage.setItem('social_studio_storage_folder', folderName);
        } catch {}
        message.success({ content: `Đã chọn thư mục máy tính: ${dirHandle.name}`, key: 'folder_dialog' });
        return folderName;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        message.info({ content: 'Đã hủy chọn thư mục.', key: 'folder_dialog' });
        return null;
      }
      console.warn('showDirectoryPicker error, trying backend API:', err);
    }
  }

  // 2. Try Backend OS Dialog (For Localhost Node.js environment)
  try {
    message.loading({ content: 'Đang mở cửa sổ chọn thư mục máy tính...', key: 'folder_dialog', duration: 0 });
    const res = await axios.post('/api/select-folder/dialog', {}, { timeout: 120000 });

    if (res.data?.success && res.data?.selectedPath) {
      const path = res.data.selectedPath;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('social_studio_storage_folder', path);
        } catch {}
      }
      message.success({ content: `Đã chọn thư mục: ${path}`, key: 'folder_dialog' });
      return path;
    } else if (res.data?.cancelled) {
      message.info({ content: 'Đã hủy chọn thư mục.', key: 'folder_dialog' });
      return null;
    } else {
      throw new Error(res.data?.error || 'Không thể chọn thư mục trên máy chủ.');
    }
  } catch (err: any) {
    // If running on online cloud server (e.g. Vercel) where server backend cannot spawn GUI:
    const defaultFolder = '📁 [Mặc định] Thư mục Downloads của máy tính';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('social_studio_storage_folder', defaultFolder);
      } catch {}
    }
    message.info({
      content: 'Đang chạy trên nền tảng Web Online (Vercel Cloud). Các tệp video/âm thanh sẽ được tự động tải về thư mục Downloads của máy tính bạn!',
      key: 'folder_dialog',
      duration: 5,
    });
    return defaultFolder;
  }
}
