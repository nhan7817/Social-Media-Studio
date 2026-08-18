'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Type,
  Image as ImageIcon,
  Sliders,
  Grid3X3,
  Eye,
  RefreshCw,
  Upload,
  CheckCircle2,
  Smartphone,
  Monitor,
  Square,
  RectangleVertical,
  Scaling,
  Film,
  Activity,
  Wind,
  Layers,
} from 'lucide-react';
import { WatermarkConfig, WatermarkPosition, AspectRatio, OutputAspectRatio, WatermarkAnimation } from '@/types';

interface Props {
  config: WatermarkConfig;
  onChange: (config: WatermarkConfig) => void;
}

const POSITIONS: Array<{ id: WatermarkPosition; label: string }> = [
  { id: 'top-left', label: 'Trên - Trái' },
  { id: 'top-center', label: 'Trên - Giữa' },
  { id: 'top-right', label: 'Trên - Phải' },
  { id: 'center-left', label: 'Giữa - Trái' },
  { id: 'center', label: 'Chính Giữa' },
  { id: 'center-right', label: 'Giữa - Phải' },
  { id: 'bottom-left', label: 'Dưới - Trái' },
  { id: 'bottom-center', label: 'Dưới - Giữa' },
  { id: 'bottom-right', label: 'Dưới - Phải' },
];

function getPreviewPosStyle(pos: WatermarkPosition, margin: number): React.CSSProperties {
  switch (pos) {
    case 'top-left':
      return { top: margin, left: margin };
    case 'top-center':
      return { top: margin, left: '50%', transform: 'translateX(-50%)' };
    case 'top-right':
      return { top: margin, right: margin };
    case 'center-left':
      return { top: '50%', left: margin, transform: 'translateY(-50%)' };
    case 'center':
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'center-right':
      return { top: '50%', right: margin, transform: 'translateY(-50%)' };
    case 'bottom-left':
      return { bottom: margin, left: margin };
    case 'bottom-center':
      return { bottom: margin, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right':
    default:
      return { bottom: margin, right: margin };
  }
}

const ANIMATION_OPTIONS: Array<{
  id: WatermarkAnimation;
  label: string;
  desc: string;
  badge: string;
  badgeColor: string;
}> = [
  { id: 'none', label: 'Cố định (Tĩnh)', desc: 'Giữ nguyên 1 vị trí cố định', badge: 'Tĩnh', badgeColor: 'bg-slate-800 text-slate-400' },
  { id: 'corner-hop', label: '🔄 Nhảy 4 góc', desc: 'Mỗi 4s tự động đổi góc', badge: 'Chống reup', badgeColor: 'bg-pink-500/20 text-pink-300 border border-pink-500/30' },
  { id: 'floating', label: '🌊 Lơ lửng / Nảy', desc: 'Trôi dạt lượn sóng khắp khung hình', badge: 'Mượt mà', badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
  { id: 'marquee-left', label: '📜 Chạy chữ ngang', desc: 'Chạy chữ liên tục từ phải sang trái', badge: 'Trending', badgeColor: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  { id: 'fade-pulse', label: '💡 Ẩn hiện theo nhịp', desc: 'Hiện 3.5s rồi mờ biến mất lặp lại', badge: 'Tinh tế', badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
];

const PREVIEW_ASPECT_RATIOS: Array<{
  id: AspectRatio;
  label: string;
  sub: string;
  icon: React.ReactNode;
}> = [
  { id: '9:16', label: '9:16', sub: 'Dọc (TikTok/Reels/Shorts)', icon: <Smartphone className="w-3.5 h-3.5" /> },
  { id: '16:9', label: '16:9', sub: 'Ngang (YouTube/FB)', icon: <Monitor className="w-3.5 h-3.5" /> },
  { id: '1:1', label: '1:1', sub: 'Vuông (Post)', icon: <Square className="w-3.5 h-3.5" /> },
  { id: '4:5', label: '4:5', sub: 'Dọc Feed', icon: <RectangleVertical className="w-3.5 h-3.5" /> },
];

const OUTPUT_RATIO_OPTIONS: Array<{
  id: OutputAspectRatio;
  label: string;
  desc: string;
  resolution: string;
}> = [
  { id: 'original', label: 'Gốc (Mặc định)', desc: 'Giữ nguyên tỉ lệ & độ phân giải gốc của video', resolution: 'Tự động' },
  { id: '9:16', label: 'Dọc 9:16', desc: 'Chuẩn TikTok, Shorts, Reels (Có viền đệm đen nếu cần)', resolution: '1080x1920' },
  { id: '16:9', label: 'Ngang 16:9', desc: 'Chuẩn YouTube, Facebook ngang', resolution: '1920x1080' },
  { id: '1:1', label: 'Vuông 1:1', desc: 'Chuẩn bài đăng Instagram vuông', resolution: '1080x1080' },
  { id: '4:5', label: 'Dọc 4:5', desc: 'Chuẩn bài đăng dọc Instagram Feed', resolution: '1080x1350' },
];

export const WatermarkSettings: React.FC<Props> = ({ config, onChange }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    config.outputAspectRatio && config.outputAspectRatio !== 'original'
      ? config.outputAspectRatio
      : '9:16'
  );

  const update = (partial: Partial<WatermarkConfig>) => {
    onChange({ ...config, ...partial });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        update({ imagePath: event.target.result as string, type: 'image' });
      }
    };
    reader.readAsDataURL(file);
  };

  // Generate live preview
  const fetchPreview = async (targetRatio: AspectRatio = aspectRatio) => {
    if (!config.enabled) return;
    setIsLoadingPreview(true);
    try {
      const res = await fetch('/api/watermark/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, aspectRatio: targetRatio }),
      });
      const data = await res.json();
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
    } catch (e) {
      console.error('Preview error:', e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview(aspectRatio);
    }, 350);
    return () => clearTimeout(timer);
  }, [
    config.enabled,
    config.type,
    config.text,
    config.fontSize,
    config.fontColor,
    config.imagePath,
    config.imageScale,
    config.position,
    config.opacity,
    config.margin,
    config.outputAspectRatio,
    aspectRatio,
  ]);

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-5">
      {/* Header with Enable Switch */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Cấu hình Đóng dấu (Watermark) & Định dạng Tỉ lệ
          </h2>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500"></div>
          <span className="ml-2 text-xs font-medium text-slate-300">
            {config.enabled ? 'Đang bật' : 'Tắt'}
          </span>
        </label>
      </div>

      {config.enabled && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-4">
            {/* Watermark Type Selector */}
            <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => update({ type: 'text' })}
                className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  config.type === 'text'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Type className="w-3.5 h-3.5" /> Chữ (Text)
              </button>
              <button
                type="button"
                onClick={() => update({ type: 'image' })}
                className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  config.type === 'image'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Logo Ảnh (PNG)
              </button>
            </div>

            {/* Text Configuration */}
            {config.type === 'text' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nội dung Watermark:
                  </label>
                  <input
                    type="text"
                    value={config.text}
                    onChange={(e) => update({ text: e.target.value })}
                    placeholder="@yourchannel hoặc Tên bản quyền"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Cỡ chữ ({config.fontSize}px):
                    </label>
                    <input
                      type="range"
                      min="16"
                      max="72"
                      value={config.fontSize}
                      onChange={(e) => update({ fontSize: Number(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Màu chữ:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.fontColor}
                        onChange={(e) => update({ fontColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-xs font-mono text-slate-300">
                        {config.fontColor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image/Logo Configuration */}
            {config.type === 'image' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tải lên file Logo (PNG trong suốt):
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/50 hover:bg-indigo-950/20 text-xs text-slate-300 cursor-pointer transition-all"
                    >
                      <Upload className="w-4 h-4 text-indigo-400" />
                      <span>
                        {config.imagePath ? 'Đã chọn logo (Nhấn để đổi)' : 'Chọn file ảnh Logo (PNG / JPG / WEBP)'}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Kích thước Logo:</span>
                    <span>{config.imageScale}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={config.imageScale}
                    onChange={(e) => update({ imageScale: Number(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Output Aspect Ratio Converter Section */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Scaling className="w-4 h-4 text-indigo-400" />
                  Định dạng Tỉ lệ Khung hình Tải về (Output Format):
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                  {OUTPUT_RATIO_OPTIONS.find((o) => o.id === (config.outputAspectRatio || 'original'))?.resolution}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OUTPUT_RATIO_OPTIONS.map((opt) => {
                  const isSelected = (config.outputAspectRatio || 'original') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        update({ outputAspectRatio: opt.id });
                        if (opt.id !== 'original') {
                          setAspectRatio(opt.id);
                          fetchPreview(opt.id);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-slate-100 shadow-sm shadow-indigo-500/10'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-300' : ''}`}>
                          {opt.label}
                        </span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 9-Grid Position Selector */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Grid3X3 className="w-3.5 h-3.5 text-indigo-400" />
                  Vị trí Watermark (Vị trí gốc):
                </label>
                {(config.animation && config.animation !== 'none') && (
                  <span className="text-[10px] text-pink-400 font-semibold flex items-center gap-1">
                    <Activity className="w-3 h-3 animate-pulse" />
                    Đang bật chuyển động
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5 w-full">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => update({ position: pos.id })}
                    className={`py-2 px-1 text-[11px] rounded-lg border transition-all text-center ${
                      config.position === pos.id
                        ? 'bg-indigo-600 text-white border-indigo-400 font-semibold shadow-sm'
                        : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Watermark Animation Selector */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-gradient-to-r from-purple-950/20 via-slate-900/60 to-indigo-950/20 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-purple-400" />
                  Hiệu ứng Chuyển động Động (Animation):
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  FFmpeg Dynamic
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ANIMATION_OPTIONS.map((anim) => {
                  const isSelected = (config.animation || 'none') === anim.id;
                  return (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => update({ animation: anim.id })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-purple-600/25 border-purple-400 text-slate-100 shadow-sm shadow-purple-500/20'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-purple-200' : ''}`}>
                          {anim.label}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${anim.badgeColor}`}>
                          {anim.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                        {anim.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {(config.animation && config.animation !== 'none') && (
                <div className="pt-2 border-t border-purple-500/20">
                  <div className="flex justify-between text-[11px] text-purple-300 mb-1">
                    <span>Tốc độ chuyển động:</span>
                    <span className="font-semibold">{config.animationSpeed || 1}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.25"
                    value={config.animationSpeed || 1}
                    onChange={(e) => update({ animationSpeed: Number(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>
              )}
            </div>

            {/* Opacity & Margin Sliders */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Độ mờ (Opacity):</span>
                  <span>{config.opacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={config.opacity}
                  onChange={(e) => update({ opacity: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Lề (Margin):</span>
                  <span>{config.margin}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={config.margin}
                  onChange={(e) => update({ margin: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 flex flex-col items-center justify-between p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            {/* Header & Refresh */}
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-400" /> Xem trước (Live Preview)
              </span>
              <button
                type="button"
                onClick={() => fetchPreview(aspectRatio)}
                className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>

            {/* Aspect Ratio Selector Pills */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Xem mẫu theo tỉ lệ:</span>
                <span className="font-semibold text-indigo-300">
                  {PREVIEW_ASPECT_RATIOS.find((r) => r.id === aspectRatio)?.sub}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 w-full bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                {PREVIEW_ASPECT_RATIOS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAspectRatio(item.id);
                      fetchPreview(item.id);
                    }}
                    className={`py-1.5 px-1 rounded-lg text-xs font-medium flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                      aspectRatio === item.id
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                    title={item.sub}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Aspect Ratio Preview Box with Realtime Animation */}
            <div className="w-full flex items-center justify-center min-h-[260px] py-1">
              <style>{`
                @keyframes wmCornerHop {
                  0%, 20% { top: 12px; left: 12px; transform: translate(0, 0); }
                  25%, 45% { top: 12px; left: calc(100% - 12px); transform: translate(-100%, 0); }
                  50%, 70% { top: calc(100% - 12px); left: calc(100% - 12px); transform: translate(-100%, -100%); }
                  75%, 95% { top: calc(100% - 12px); left: 12px; transform: translate(0, -100%); }
                  100% { top: 12px; left: 12px; transform: translate(0, 0); }
                }
                @keyframes wmFloating {
                  0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                  25% { transform: translate(-50%, -50%) translate(35px, -30px) scale(1.03); }
                  50% { transform: translate(-50%, -50%) translate(-30px, 35px) scale(0.97); }
                  75% { transform: translate(-50%, -50%) translate(30px, 25px) scale(1.02); }
                  100% { transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                }
                @keyframes wmMarquee {
                  0% { transform: translateX(110%); }
                  100% { transform: translateX(-110%); }
                }
                @keyframes wmPulse {
                  0%, 100% { opacity: 0.15; }
                  50% { opacity: 0.95; }
                }
                .anim-corner-hop {
                  animation: wmCornerHop 8s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
                }
                .anim-floating {
                  animation: wmFloating 5s ease-in-out infinite !important;
                }
                .anim-marquee {
                  animation: wmMarquee 5s linear infinite !important;
                }
                .anim-pulse {
                  animation: wmPulse 3s ease-in-out infinite !important;
                }
              `}</style>

              <div
                className={`rounded-xl overflow-hidden border border-slate-800 bg-gradient-to-br from-indigo-950/90 via-slate-950 to-slate-900 flex items-center justify-center relative shadow-lg shadow-black/40 transition-all duration-300 select-none ${
                  aspectRatio === '9:16'
                    ? 'aspect-[9/16] h-[340px] max-w-[200px]'
                    : aspectRatio === '16:9'
                    ? 'aspect-video w-full max-h-[220px]'
                    : aspectRatio === '1:1'
                    ? 'aspect-square h-[260px]'
                    : 'aspect-[4/5] h-[300px]'
                }`}
              >
                {/* Mock Background Graphics */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 opacity-40">
                  <div className="w-20 h-20 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-2">
                    <Film className="w-8 h-8 text-indigo-400/80" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300 text-center">Sample Video</span>
                  <span className="text-[9px] text-slate-500 font-mono">[{aspectRatio}]</span>
                </div>

                {/* Real-time Dynamic Watermark Layer */}
                {config.enabled && config.type !== 'none' && (
                  (() => {
                    const opacity = (config.opacity || 85) / 100;
                    const fontSize = Math.max(11, Math.min(24, Math.round((config.fontSize || 32) * 0.42)));
                    const color = config.fontColor || '#ffffff';
                    const text = config.text || '@MyBrand';
                    const anim = config.animation || 'none';
                    const m = Math.max(6, Math.min(20, Math.round((config.margin || 24) * 0.35)));

                    let posStyle: React.CSSProperties = {};
                    let animClass = '';

                    if (anim === 'corner-hop') {
                      animClass = 'anim-corner-hop';
                    } else if (anim === 'floating') {
                      animClass = 'anim-floating';
                      posStyle = { top: '50%', left: '50%' };
                    } else if (anim === 'marquee-left') {
                      animClass = 'anim-marquee';
                      posStyle = { bottom: m, left: 0, width: '100%', textAlign: 'center' };
                    } else if (anim === 'fade-pulse') {
                      animClass = 'anim-pulse';
                      posStyle = getPreviewPosStyle(config.position, m);
                    } else {
                      posStyle = getPreviewPosStyle(config.position, m);
                    }

                    return (
                      <div
                        style={{
                          position: 'absolute',
                          ...posStyle,
                          opacity: anim === 'fade-pulse' ? undefined : opacity,
                          zIndex: 20,
                          pointerEvents: 'none',
                          maxWidth: '90%',
                        }}
                        className={animClass}
                      >
                        {config.type === 'text' ? (
                          <span
                            style={{
                              fontFamily: config.fontFamily || 'Arial, sans-serif',
                              fontSize: `${fontSize}px`,
                              color: color,
                              fontWeight: 'bold',
                              textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                          >
                            {text}
                          </span>
                        ) : config.imagePath ? (
                          <img
                            src={config.imagePath}
                            alt="logo"
                            style={{
                              width: `${Math.max(26, Math.round((config.imageScale || 15) * 2.2))}px`,
                              objectFit: 'contain',
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))',
                              display: 'inline-block',
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })()
                )}

                {/* Active Animation Mode Pill Badge */}
                {(config.animation && config.animation !== 'none') && (
                  <div className="absolute top-2 left-2 bg-purple-950/90 backdrop-blur-md border border-purple-500/50 text-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1.5 z-30 animate-pulse">
                    <Wind className="w-3 h-3 text-purple-300" />
                    <span>{ANIMATION_OPTIONS.find((a) => a.id === config.animation)?.label}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              Tùy chọn tỉ lệ sẽ được FFmpeg tự động căn chỉnh & thêm viền đệm chuẩn khi xuất file.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
