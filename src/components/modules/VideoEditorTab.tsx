'use client';

import React, { useState, useRef } from 'react';
import {
  Card,
  Button,
  Radio,
  Slider,
  Switch,
  Typography,
  Tag,
  message,
  Space,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  FormatPainterOutlined,
  VideoCameraOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { Sparkles, Eraser, Film, Grid3X3, Eye, Type, Image as ImageIcon, Scan, Scissors, Wind } from 'lucide-react';
import { WatermarkConfig, WatermarkPosition, AspectRatio, OutputAspectRatio, BlurPosition, BlurZone, WatermarkAnimation } from '@/types';
import { InteractiveLogoRemoverModal } from './InteractiveLogoRemoverModal';
import { openNativeFolderDialog } from '@/lib/utils/folder-dialog';
import axios from 'axios';

const { Title, Paragraph, Text } = Typography;

interface Props {
  outputFolder: string;
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

const ANIMATION_OPTIONS: Array<{
  id: WatermarkAnimation;
  label: string;
  desc: string;
}> = [
  { id: 'none', label: 'Cố định (Tĩnh)', desc: '1 vị trí cố định' },
  { id: 'corner-hop', label: '🔄 Nhảy 4 góc', desc: 'Đổi góc mỗi 4 giây (Chống reup)' },
  { id: 'floating', label: '🌊 Lơ lửng / Nảy', desc: 'Trôi dạt lượn sóng' },
  { id: 'marquee-left', label: '📜 Chạy chữ ngang', desc: 'Chạy chữ từ phải sang trái' },
  { id: 'fade-pulse', label: '💡 Ẩn hiện nhịp', desc: 'Mờ dần rồi hiện lặp lại' },
];

const OUTPUT_RATIO_OPTIONS: Array<{
  id: OutputAspectRatio;
  label: string;
  desc: string;
}> = [
  { id: 'original', label: 'Gốc', desc: 'Giữ nguyên tỉ lệ video' },
  { id: '9:16', label: '9:16 Dọc', desc: 'TikTok, Shorts, Reels' },
  { id: '16:9', label: '16:9 Ngang', desc: 'YouTube ngang' },
  { id: '1:1', label: '1:1 Vuông', desc: 'Instagram Square' },
  { id: '4:5', label: '4:5 Feed', desc: 'Instagram Feed dọc' },
];

const formatBytes = (bytes?: number) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const VideoEditorTab: React.FC<Props> = ({ outputFolder }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewSrc, setVideoPreviewSrc] = useState<string | null>(null);

  // Visual Interactive Logo Remover State
  const [isInteractiveModalOpen, setIsInteractiveModalOpen] = useState(false);
  const [blurZones, setBlurZones] = useState<BlurZone[]>([]);
  const [blurEnabled, setBlurEnabled] = useState(true);

  const [wmEnabled, setWmEnabled] = useState(false);
  const [wmType, setWmType] = useState<'text' | 'image'>('text');
  const [wmText, setWmText] = useState('@MyBrand');
  const [wmFontSize, setWmFontSize] = useState(32);
  const [wmFontColor, setWmFontColor] = useState('#ffffff');
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>('bottom-right');
  const [wmAnimation, setWmAnimation] = useState<WatermarkAnimation>('none');
  const [wmOpacity, setWmOpacity] = useState(85);
  const [wmMargin, setWmMargin] = useState(24);
  const [wmImage, setWmImage] = useState<string>('');
  const [wmImageScale, setWmImageScale] = useState(15);

  const [outputRatio, setOutputRatio] = useState<OutputAspectRatio>('original');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
    downloadUrl: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setProcessedResult(null);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewSrc(objectUrl);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setWmImage(event.target.result as string);
        setWmType('image');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProcessVideo = async () => {
    if (!selectedFile) {
      message.warning('Vui lòng chọn hoặc tải lên một tệp video.');
      return;
    }

    let targetDirectory = outputFolder;
    if (!targetDirectory) {
      message.info('Vui lòng chọn thư mục lưu trữ trên máy tính của bạn trước khi render video.');
      const picked = await openNativeFolderDialog();
      if (!picked) {
        message.warning('Bạn chưa chọn thư mục lưu trữ để xuất video.');
        return;
      }
      targetDirectory = picked;
    }

    setIsProcessing(true);
    message.loading({ content: 'Đang xử lý làm mờ logo và render video...', key: 'render_msg', duration: 0 });

    const config: WatermarkConfig = {
      enabled: wmEnabled,
      type: wmType,
      text: wmText,
      fontSize: wmFontSize,
      fontColor: wmFontColor,
      fontFamily: 'Arial, sans-serif',
      imagePath: wmImage,
      imageScale: wmImageScale,
      position: wmPosition,
      animation: wmAnimation,
      animationSpeed: 1,
      opacity: wmOpacity,
      margin: wmMargin,
      outputAspectRatio: outputRatio,
      blurConfig: {
        enabled: blurEnabled && blurZones.length > 0,
        zones: blurZones,
      },
    };

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('config', JSON.stringify(config));
    formData.append('outputFolder', targetDirectory);

    try {
      const res = await axios.post('/api/video/edit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });

      if (res.data?.success) {
        setProcessedResult(res.data);
        message.success({ content: 'Xử lý video hoàn tất thành công!', key: 'render_msg' });
      } else {
        throw new Error(res.data?.error || 'Không thể render video.');
      }
    } catch (err: any) {
      message.error({ content: `Lỗi xử lý: ${err.response?.data?.error || err.message}`, key: 'render_msg' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!outputFolder) {
      await openNativeFolderDialog();
      return;
    }
    try {
      await axios.post('/api/open-folder', { folderPath: outputFolder });
    } catch {
      message.error('Không thể mở thư mục trên hệ thống.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <VideoCameraOutlined className="text-2xl text-pink-400" />
            <h3 className="text-lg font-bold text-slate-100">
              Studio Chỉnh Sửa & Xóa / Làm Mờ Logo Video Trực Tiếp
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tải lên video từ máy tính của bạn, dùng chuột kéo-thả để che / xóa logo bất kỳ góc nào, chèn Watermark mới và render chất lượng cao với FFmpeg.
          </p>
        </div>

        <Button
          type="default"
          icon={<FolderOpenOutlined />}
          onClick={handleOpenFolder}
          className="!bg-slate-900 !border-slate-700 !text-slate-300 text-xs"
        >
          Mở Thư Mục Xuất Bản
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Video Player Preview */}
        <div className="lg:col-span-5 space-y-5">
          {/* Upload Card */}
          <Card title="1. Tải Lên Video Từ Máy Tính" className="border-slate-800">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-pink-500/80 rounded-2xl p-6 text-center cursor-pointer bg-slate-950/60 hover:bg-pink-950/10 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <UploadOutlined className="text-xl text-pink-400" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {selectedFile ? selectedFile.name : 'Bấm hoặc Kéo thả video vào đây'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Hỗ trợ MP4, MOV, MKV, WebM (Dung lượng lên đến 500MB)
              </p>
            </div>

            {selectedFile && (
              <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div className="truncate pr-2">
                  <span className="text-slate-200 font-medium truncate block">{selectedFile.name}</span>
                  <span className="text-slate-500 text-[11px]">{formatBytes(selectedFile.size)}</span>
                </div>
                <Tag color="cyan" className="!text-[11px]">Đã chọn</Tag>
              </div>
            )}
          </Card>

          {/* Original Video Preview */}
          {videoPreviewSrc && (
            <Card title="Xem Trước Video & Vùng Xóa" className="border-slate-800">
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center relative border border-slate-800 select-none">
                  <style>{`
                    @keyframes wmCornerHopTab {
                      0%, 20% { top: 10px; left: 10px; transform: translate(0, 0); }
                      25%, 45% { top: 10px; left: calc(100% - 10px); transform: translate(-100%, 0); }
                      50%, 70% { top: calc(100% - 10px); left: calc(100% - 10px); transform: translate(-100%, -100%); }
                      75%, 95% { top: calc(100% - 10px); left: 10px; transform: translate(0, -100%); }
                      100% { top: 10px; left: 10px; transform: translate(0, 0); }
                    }
                    @keyframes wmFloatingTab {
                      0% { transform: translate(-50%, -50%) translate(0, 0); }
                      25% { transform: translate(-50%, -50%) translate(30px, -25px); }
                      50% { transform: translate(-50%, -50%) translate(-25px, 30px); }
                      75% { transform: translate(-50%, -50%) translate(25px, 20px); }
                      100% { transform: translate(-50%, -50%) translate(0, 0); }
                    }
                    @keyframes wmMarqueeTab {
                      0% { transform: translateX(100%); }
                      100% { transform: translateX(-100%); }
                    }
                    @keyframes wmPulseTab {
                      0%, 100% { opacity: 0.15; }
                      50% { opacity: 0.95; }
                    }
                    .anim-tab-corner-hop { animation: wmCornerHopTab 8s cubic-bezier(0.4, 0, 0.2, 1) infinite !important; }
                    .anim-tab-floating { animation: wmFloatingTab 5s ease-in-out infinite !important; }
                    .anim-tab-marquee { animation: wmMarqueeTab 5s linear infinite !important; }
                    .anim-tab-pulse { animation: wmPulseTab 3s ease-in-out infinite !important; }
                  `}</style>

                  <video
                    src={videoPreviewSrc}
                    controls
                    className="w-full h-full object-contain max-h-[260px]"
                  />

                  {/* Realtime Animated Watermark Preview Over Video */}
                  {wmEnabled && (
                    (() => {
                      const opacity = wmOpacity / 100;
                      const fontSize = Math.max(10, Math.min(22, Math.round(wmFontSize * 0.42)));
                      const m = Math.max(6, Math.min(18, Math.round(wmMargin * 0.35)));
                      let posStyle: React.CSSProperties = {};
                      let animClass = '';

                      if (wmAnimation === 'corner-hop') {
                        animClass = 'anim-tab-corner-hop';
                      } else if (wmAnimation === 'floating') {
                        animClass = 'anim-tab-floating';
                        posStyle = { top: '50%', left: '50%' };
                      } else if (wmAnimation === 'marquee-left') {
                        animClass = 'anim-tab-marquee';
                        posStyle = { bottom: m, left: 0, width: '100%', textAlign: 'center' };
                      } else if (wmAnimation === 'fade-pulse') {
                        animClass = 'anim-tab-pulse';
                        posStyle = { bottom: m, right: m };
                      } else {
                        posStyle = { bottom: m, right: m };
                      }

                      return (
                        <div
                          style={{
                            position: 'absolute',
                            ...posStyle,
                            opacity: wmAnimation === 'fade-pulse' ? undefined : opacity,
                            zIndex: 20,
                            pointerEvents: 'none',
                            maxWidth: '90%',
                          }}
                          className={animClass}
                        >
                          {wmType === 'text' ? (
                            <span
                              style={{
                                fontSize: `${fontSize}px`,
                                color: wmFontColor,
                                fontWeight: 'bold',
                                textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {wmText}
                            </span>
                          ) : wmImage ? (
                            <img
                              src={wmImage}
                              alt="logo"
                              style={{
                                width: `${Math.max(24, Math.round(wmImageScale * 2))}px`,
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))',
                              }}
                            />
                          ) : null}
                        </div>
                      );
                    })()
                  )}

                  {blurZones.length > 0 && (
                    <div className="absolute top-2 right-2 bg-yellow-400 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                      Đã đặt {blurZones.length} vùng xóa
                    </div>
                  )}
                </div>

                <Button
                  type="primary"
                  icon={<Scan className="w-4 h-4 mr-1 inline text-slate-950" />}
                  onClick={() => setIsInteractiveModalOpen(true)}
                  className="!bg-yellow-400 hover:!bg-yellow-300 !text-slate-950 font-bold w-full rounded-xl h-10 border-0 shadow-lg shadow-yellow-400/20 text-xs"
                >
                  Mở Trình Xóa Logo Kéo Thả Trực Quan
                </Button>
              </div>
            </Card>
          )}

          {/* Render Result Card if completed */}
          {processedResult && (
            <Card title="Kết Quả Xử Lý Video" className="border-emerald-500/40 bg-emerald-950/15">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <CheckCircleFilled className="text-base" />
                  <span>Video đã được render và đóng dấu thành công!</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <p className="text-xs font-medium text-slate-200 truncate">{processedResult.fileName}</p>
                  <p className="text-[11px] text-slate-400 font-mono">Dung lượng: {formatBytes(processedResult.sizeBytes)}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={processedResult.downloadUrl}
                    download={processedResult.fileName}
                    className="flex-1"
                  >
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      block
                      className="!bg-emerald-600 !border-0 font-semibold shadow-md shadow-emerald-600/30"
                    >
                      Tải Video Về Máy
                    </Button>
                  </a>

                  <Button
                    type="default"
                    icon={<FolderOpenOutlined />}
                    onClick={handleOpenFolder}
                    className="!bg-slate-900 !border-slate-700 !text-slate-300"
                  >
                    Vị Trí File
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Editing Controls */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Logo Blur Settings */}
          <Card
            title={
              <div className="flex items-center justify-between w-full pr-2">
                <span className="flex items-center gap-2">
                  <Eraser className="w-4 h-4 text-pink-400" />
                  <span>1. Làm Mờ / Che Logo Cũ (Logo Blur)</span>
                </span>
                <Switch
                  checked={blurEnabled}
                  onChange={setBlurEnabled}
                  className="bg-slate-700"
                />
              </div>
            }
            className="border-slate-800"
          >
            {blurEnabled ? (
              <div className="space-y-4">
                {/* Visual Remover Promotion & Launcher */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      <h4 className="text-xs font-bold text-yellow-300">
                        Trình Vẽ & Kéo Thả Vùng Xóa Logo Trực Quan
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {blurZones.length > 0
                        ? `Đang áp dụng ${blurZones.length} vùng xóa logo được vẽ trực tiếp trên video.`
                        : 'Kéo thả chuột trực tiếp trên khung hình video để chọn vùng logo chính xác nhất.'}
                    </p>
                  </div>

                  <Button
                    type="primary"
                    disabled={!videoPreviewSrc}
                    onClick={() => setIsInteractiveModalOpen(true)}
                    className="!bg-yellow-400 hover:!bg-yellow-300 !text-slate-950 font-bold border-0 rounded-xl text-xs whitespace-nowrap shadow-md shadow-yellow-400/20"
                  >
                    {blurZones.length > 0 ? '✏️ Chỉnh Sửa Vùng Xóa' : '🎨 Mở Trình Xóa Trực Quan'}
                  </Button>
                </div>

                {/* Display custom active zones if any */}
                {blurZones.length > 0 ? (
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        Các Vùng Đã Chọn ({blurZones.length}):
                      </span>
                      <button
                        onClick={() => setBlurZones([])}
                        className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                      >
                        Xóa tất cả vùng
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {blurZones.map((z, i) => (
                        <Tag key={z.id} color={z.method === 'pixelate' ? 'cyan' : z.method === 'blur' ? 'blue' : 'gold'} className="font-mono font-semibold text-[10px] py-0.5">
                          #{i + 1} [{(z.method || 'delogo').toUpperCase()}]: {Math.round(z.width)}x{Math.round(z.height)}% (X:{Math.round(z.x)}%, Y:{Math.round(z.y)}%)
                        </Tag>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-center space-y-1">
                    <p className="text-xs text-slate-400">Chưa có vùng xóa logo nào được thiết lập.</p>
                    <button
                      type="button"
                      disabled={!videoPreviewSrc}
                      onClick={() => setIsInteractiveModalOpen(true)}
                      className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold hover:underline cursor-pointer disabled:opacity-50"
                    >
                      + Bấm vào đây để mở Studio kéo thả chọn vùng
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Đã tắt tính năng làm mờ logo.</p>
            )}
          </Card>

          {/* 2. Aspect Ratio Conversion */}
          <Card title="2. Tỉ Lệ Khung Hình Đầu Ra (Aspect Ratio)" className="border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {OUTPUT_RATIO_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOutputRatio(opt.id)}
                  className={`p-2.5 rounded-xl text-center border transition-all ${
                    outputRatio === opt.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* 3. New Watermark Overlay */}
          <Card
            title={
              <div className="flex items-center justify-between w-full pr-2">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>3. Gắn Thêm Watermark Mới (Tùy chọn)</span>
                </span>
                <Switch
                  checked={wmEnabled}
                  onChange={setWmEnabled}
                  className="bg-slate-700"
                />
              </div>
            }
            className="border-slate-800"
          >
            {wmEnabled ? (
              <div className="space-y-4">
                <Radio.Group
                  value={wmType}
                  onChange={(e) => setWmType(e.target.value)}
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="text">Văn bản (Text)</Radio.Button>
                  <Radio.Button value="image">Logo PNG</Radio.Button>
                </Radio.Group>

                {wmType === 'text' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      placeholder="@TênThươngHiệu"
                      className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Cỡ chữ:</span>
                      <Slider min={16} max={64} value={wmFontSize} onChange={setWmFontSize} className="flex-1" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium">
                      Tải Logo PNG
                      <input type="file" accept="image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {wmImage && <span className="text-xs text-emerald-400">Đã nạp logo</span>}
                  </div>
                )}

                {/* 9-Point Grid Position */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Vị trí watermark mới:</label>
                  <div className="grid grid-cols-3 gap-1.5 max-w-xs bg-slate-900 p-2 rounded-xl border border-slate-800">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setWmPosition(pos.id)}
                        className={`py-1 text-[10px] rounded font-medium text-center ${
                          wmPosition === pos.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Animation Mode Selector */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <label className="text-xs text-purple-300 font-semibold flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-purple-400" />
                    Hiệu ứng chuyển động (Animation):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {ANIMATION_OPTIONS.map((anim) => (
                      <button
                        key={anim.id}
                        type="button"
                        onClick={() => setWmAnimation(anim.id)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          wmAnimation === anim.id
                            ? 'bg-purple-600/25 border-purple-400 text-purple-200 font-semibold shadow-sm'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="block text-xs font-semibold">{anim.label}</span>
                        <span className="block text-[10px] text-slate-500 line-clamp-1">{anim.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Không gắn thêm watermark mới.</p>
            )}
          </Card>

          {/* Action Render Button */}
          <div className="pt-2">
            <Button
              type="primary"
              size="large"
              icon={isProcessing ? <LoadingOutlined /> : <PlayCircleOutlined />}
              loading={isProcessing}
              disabled={!selectedFile}
              onClick={handleProcessVideo}
              block
              className="!bg-gradient-to-r !from-pink-600 via-purple-600 !to-indigo-600 !border-0 font-bold h-12 shadow-xl shadow-pink-500/20 text-sm"
            >
              {isProcessing ? 'Đang Xử Lý & Render Video...' : 'Bắt Đầu Xử Lý & Xuất Video'}
            </Button>
          </div>
        </div>
      </div>

      {/* Visual Interactive Logo Remover Modal */}
      {videoPreviewSrc && (
        <InteractiveLogoRemoverModal
          visible={isInteractiveModalOpen}
          videoSrc={videoPreviewSrc}
          initialZones={blurZones}
          onApply={(updatedZones) => {
            setBlurZones(updatedZones);
            setIsInteractiveModalOpen(false);
            if (updatedZones.length > 0) {
              setBlurEnabled(true);
              message.success(`Đã áp dụng ${updatedZones.length} vùng xóa logo!`);
            }
          }}
          onCancel={() => setIsInteractiveModalOpen(false)}
        />
      )}
    </div>
  );
};
