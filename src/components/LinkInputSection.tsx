'use client';

import React, { useState } from 'react';
import {
  Link2,
  Sparkles,
  Play,
  Trash2,
  FileText,
  Youtube,
  Video,
  Instagram,
  MessageCircle,
  Facebook,
  Globe,
  Radio,
  Search,
  Loader2,
  ListPlus,
  CheckSquare,
  Square,
  Film,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { SupportedPlatform } from '@/types';

interface ChannelExtractedItem {
  url: string;
  title: string;
  id?: string;
  duration?: string;
  thumbnail?: string;
}

interface Props {
  rawLinks: string;
  selectedPlatform: SupportedPlatform;
  isProcessing: boolean;
  onLinksChange: (val: string) => void;
  onPlatformChange: (platform: SupportedPlatform) => void;
  onSubmit: () => void;
}

const PLATFORM_OPTIONS: Array<{
  id: SupportedPlatform;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'auto', label: 'Tự nhận diện (Auto)', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-3.5 h-3.5 text-red-400" /> },
  { id: 'tiktok', label: 'TikTok', icon: <Video className="w-3.5 h-3.5 text-cyan-400" /> },
  { id: 'douyin', label: 'Douyin', icon: <Video className="w-3.5 h-3.5 text-teal-400" /> },
  { id: 'instagram', label: 'Instagram', icon: <Instagram className="w-3.5 h-3.5 text-pink-400" /> },
  { id: 'threads', label: 'Threads', icon: <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> },
  { id: 'facebook', label: 'Facebook', icon: <Facebook className="w-3.5 h-3.5 text-blue-400" /> },
];

export const LinkInputSection: React.FC<Props> = ({
  rawLinks,
  selectedPlatform,
  isProcessing,
  onLinksChange,
  onPlatformChange,
  onSubmit,
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'channel'>('manual');

  // Channel scanner state
  const [channelUrl, setChannelUrl] = useState('');
  const [maxVideos, setMaxVideos] = useState<number>(25);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [extractedChannel, setExtractedChannel] = useState<{
    channelTitle: string;
    channelUrl: string;
    totalFound: number;
    videos: ChannelExtractedItem[];
  } | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const linkList = rawLinks
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const fillSampleLinks = () => {
    const samples = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.tiktok.com/@tiktok/video/7106594312292453678',
      'https://www.instagram.com/p/C_123456789/',
      'https://www.threads.net/@zuck/post/Cx123456789',
    ].join('\n');
    onLinksChange(samples);
  };

  const handleScanChannel = async () => {
    if (!channelUrl.trim()) return;

    setIsScanning(true);
    setScanError(null);
    setExtractedChannel(null);

    try {
      const res = await fetch('/api/channel/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrl: channelUrl.trim(),
          maxVideos: maxVideos > 0 ? maxVideos : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể trích xuất video từ kênh này.');
      }

      setExtractedChannel(data);
      // Select all extracted by default
      const allUrls = new Set<string>((data.videos as ChannelExtractedItem[]).map((v) => v.url));
      setSelectedUrls(allUrls);
    } catch (err: any) {
      setScanError(err.message || 'Có lỗi xảy ra khi quét kênh.');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectUrl = (url: string) => {
    const next = new Set(selectedUrls);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setSelectedUrls(next);
  };

  const toggleSelectAll = () => {
    if (!extractedChannel) return;
    if (selectedUrls.size === extractedChannel.videos.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(extractedChannel.videos.map((v) => v.url)));
    }
  };

  const handleLoadSelectedToQueue = (append: boolean = false) => {
    if (!extractedChannel || selectedUrls.size === 0) return;

    const chosenList = extractedChannel.videos
      .filter((v) => selectedUrls.has(v.url))
      .map((v) => v.url);

    if (append && rawLinks.trim()) {
      const existing = rawLinks
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const combined = Array.from(new Set([...existing, ...chosenList]));
      onLinksChange(combined.join('\n'));
    } else {
      onLinksChange(chosenList.join('\n'));
    }

    setActiveTab('manual');
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex items-center rounded-xl bg-slate-900/90 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'manual'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" /> Dán danh sách link
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {linkList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('channel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'channel'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" /> Quét theo Kênh / Profile
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold ml-1">
                New
              </span>
            </button>
          </div>
        </div>

        {/* Platform Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Nền tảng:</label>
          <select
            value={selectedPlatform}
            onChange={(e) => onPlatformChange(e.target.value as SupportedPlatform)}
            disabled={isProcessing}
            className="bg-slate-900 border border-slate-700/90 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: Manual Link List Input */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              rows={7}
              value={rawLinks}
              onChange={(e) => onLinksChange(e.target.value)}
              disabled={isProcessing}
              placeholder={`Dán các đường link cần tải vào đây (mỗi link 1 dòng)...
Ví dụ:
https://www.youtube.com/watch?v=...
https://vt.tiktok.com/...
https://www.threads.net/...
https://www.instagram.com/reel/...
https://v.douyin.com/...
https://www.facebook.com/watch/...`}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono leading-relaxed resize-y transition-all"
            />
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fillSampleLinks}
                disabled={isProcessing}
                className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all"
              >
                <FileText className="w-3.5 h-3.5" /> Dán link mẫu
              </button>
              {rawLinks && (
                <button
                  type="button"
                  onClick={() => onLinksChange('')}
                  disabled={isProcessing}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
                </button>
              )}
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={onSubmit}
              disabled={isProcessing || linkList.length === 0}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs shadow-lg transition-all ${
                isProcessing || linkList.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:from-indigo-600 hover:to-pink-600 shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <Play className={`w-4 h-4 fill-current ${isProcessing ? 'animate-pulse' : ''}`} />
              {isProcessing ? 'Đang chạy tuần tự...' : `Bắt đầu Tải tuần tự (${linkList.length} link)`}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Channel & Profile Scanner */}
      {activeTab === 'channel' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Đường dẫn Kênh / Profile / Playlist:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanChannel()}
                  disabled={isScanning || isProcessing}
                  placeholder="Ví dụ: https://www.youtube.com/@ChannelName hoặc https://www.tiktok.com/@username"
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />

                {/* Video Count Limit Selector */}
                <select
                  value={maxVideos}
                  onChange={(e) => setMaxVideos(Number(e.target.value))}
                  disabled={isScanning || isProcessing}
                  className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer shrink-0"
                >
                  <option value={10}>10 video mới nhất</option>
                  <option value={25}>25 video mới nhất</option>
                  <option value={50}>50 video mới nhất</option>
                  <option value={100}>100 video mới nhất</option>
                  <option value={0}>Tất cả video (All)</option>
                </select>

                <button
                  type="button"
                  onClick={handleScanChannel}
                  disabled={isScanning || !channelUrl.trim()}
                  className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shrink-0 ${
                    isScanning || !channelUrl.trim()
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-md shadow-cyan-500/20'
                  }`}
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Đang quét kênh...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" /> Quét Video từ Kênh
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick sample channels */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center gap-1.5">
                <span>Mẫu thử nhanh:</span>
                <button
                  type="button"
                  onClick={() => setChannelUrl('https://www.tiktok.com/@tiktok')}
                  className="text-cyan-400 hover:underline bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50"
                >
                  TikTok @tiktok
                </button>
                <button
                  type="button"
                  onClick={() => setChannelUrl('https://www.youtube.com/@TED')}
                  className="text-red-400 hover:underline bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50"
                >
                  YouTube @TED
                </button>
              </div>
              <span className="text-[10px] text-slate-500 italic">
                * Hỗ trợ quét toàn bộ kênh: YouTube, TikTok, Douyin
              </span>
            </div>
          </div>

          {/* Error Message */}
          {scanError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
              <span>⚠️ {scanError}</span>
              <button
                type="button"
                onClick={() => setScanError(null)}
                className="text-rose-400 hover:text-rose-200 text-xs underline"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Extracted Video List */}
          {extractedChannel && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold">
                      {extractedChannel.channelTitle}
                    </span>
                    <span>Đã tìm thấy {extractedChannel.videos.length} video</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Đã chọn: <span className="text-cyan-400 font-bold">{selectedUrls.size}</span> / {extractedChannel.videos.length} video
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-1.5"
                  >
                    {selectedUrls.size === extractedChannel.videos.length ? (
                      <>
                        <Square className="w-3.5 h-3.5 text-slate-400" /> Bỏ chọn tất cả
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> Chọn tất cả
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSelectedToQueue(false)}
                    disabled={selectedUrls.size === 0}
                    className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 shadow-md transition-all ${
                      selectedUrls.size === 0
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:scale-105'
                    }`}
                  >
                    <ListPlus className="w-3.5 h-3.5" /> Nạp ({selectedUrls.size}) video vào danh sách tải
                  </button>
                </div>
              </div>

              {/* Video Cards Scroll Area */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {extractedChannel.videos.map((vid, idx) => {
                  const isSelected = selectedUrls.has(vid.url);
                  return (
                    <div
                      key={vid.url || idx}
                      onClick={() => toggleSelectUrl(vid.url)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-lg text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-950/40 border border-indigo-500/30'
                          : 'bg-slate-950/40 border border-transparent hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          className="shrink-0 text-slate-400 hover:text-cyan-400"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0 w-6">
                          #{idx + 1}
                        </span>
                        <Film className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-200 truncate max-w-xl" title={vid.title}>
                            {vid.title}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 truncate max-w-md">
                            {vid.url}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {vid.duration && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {vid.duration}
                          </span>
                        )}
                        <a
                          href={vid.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-500 hover:text-indigo-400 p-1"
                          title="Mở video gốc trên tab mới"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
