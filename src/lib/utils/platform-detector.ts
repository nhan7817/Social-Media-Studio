import { SupportedPlatform } from '@/types';

export function detectPlatform(url: string): SupportedPlatform {
  try {
    const trimmed = url.trim().toLowerCase();
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return 'youtube';
    }
    if (host.includes('tiktok.com') || host.includes('vt.tiktok.com')) {
      return 'tiktok';
    }
    if (host.includes('douyin.com') || host.includes('iesdouyin.com')) {
      return 'douyin';
    }
    if (host.includes('threads.net') || host.includes('threads.com')) {
      return 'threads';
    }
    if (host.includes('instagram.com') || host.includes('instagr.am')) {
      return 'instagram';
    }
    if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.com')) {
      return 'facebook';
    }

    return 'other';
  } catch {
    return 'other';
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
}
