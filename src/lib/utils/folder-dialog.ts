import axios from 'axios';
import { message } from 'antd';

/**
 * Triggers the native OS Folder Picker Dialog via the backend API.
 * Returns the selected folder path, or null if cancelled.
 */
export async function openNativeFolderDialog(): Promise<string | null> {
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
      throw new Error(res.data?.error || 'Không thể chọn thư mục.');
    }
  } catch (err: any) {
    message.error({ content: `Lỗi: ${err.response?.data?.error || err.message}`, key: 'folder_dialog' });
    return null;
  }
}
