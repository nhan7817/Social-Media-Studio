'use client';

import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Radio,
  Slider,
  Popconfirm,
  message,
  Typography,
  Space,
  Tag,
  List,
  Tabs,
  Tooltip,
  Divider,
} from 'antd';
import {
  CustomerServiceOutlined,
  PlayCircleOutlined,
  PlayCircleFilled,
  PauseCircleFilled,
  DownloadOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CopyOutlined,
  FileTextOutlined,
  AudioOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  UserOutlined,
  ClockCircleOutlined,
  SoundOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { FileText, Music, Copy, Sparkles, Hash, BookOpen, Download as DownloadIcon, ExternalLink } from 'lucide-react';
import { openNativeFolderDialog } from '@/lib/utils/folder-dialog';
import axios from 'axios';

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

interface Props {
  outputFolder: string;
}

interface VideoTextContent {
  title: string;
  description: string;
  uploader?: string;
  uploaderUrl?: string;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  tags?: string[];
  hashtags?: string[];
  thumbnail?: string;
  transcript?: string;
  txtFilePath?: string;
}

interface ExtractedItem {
  id: string;
  url: string;
  audioFile?: {
    fileName: string;
    filePath: string;
    format: string;
  };
  textContent?: VideoTextContent;
  extractedAt: string;
}

const formatNumber = (num?: number) => {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
};

const formatSeconds = (sec?: number) => {
  if (!sec || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Trình phát nghe thử âm thanh trực tiếp (Interactive Audio Preview Player)
 */
const AudioPlayerWidget: React.FC<{ filePath: string; fileName: string; format?: string }> = ({ filePath, fileName, format }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const audioSrc = `/api/storage/download?path=${encodeURIComponent(filePath)}&inline=true`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.error('Audio play error:', err);
            message.error('Không thể phát tệp âm thanh này trên trình duyệt.');
          });
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  return (
    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900/90 to-indigo-950/30 border border-purple-500/30 space-y-2.5 shadow-md">
      <audio
        ref={audioRef}
        src={audioSrc}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
        className="hidden"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 truncate">
          <Button
            type="primary"
            shape="circle"
            icon={isPlaying ? <PauseCircleFilled className="text-lg" /> : <PlayCircleFilled className="text-lg" />}
            onClick={togglePlay}
            className="!bg-gradient-to-tr !from-purple-600 !to-indigo-600 hover:!scale-105 !border-0 !w-10 !h-10 shrink-0 flex items-center justify-center shadow-lg shadow-purple-600/40 transition-transform cursor-pointer"
            title={isPlaying ? 'Tạm dừng' : 'Bấm để nghe thử'}
          />
          <div className="truncate">
            <span className="text-xs font-bold text-slate-100 truncate block">{fileName}</span>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
              <span className="text-purple-300 font-semibold">{formatSeconds(currentTime)} / {formatSeconds(duration)}</span>
              {format && <Tag color="purple" className="!text-[10px] !px-1.5 !m-0 !font-bold">{format}</Tag>}
            </div>
          </div>
        </div>

        <a
          href={`/api/storage/download?path=${encodeURIComponent(filePath)}`}
          download={fileName}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 shrink-0 transition-all hover:scale-105"
        >
          <DownloadOutlined /> Tải Âm Thanh Về
        </a>
      </div>

      <Slider
        min={0}
        max={duration || 100}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        tooltip={{ formatter: (val) => formatSeconds(val || 0) }}
        className="!my-0.5"
      />
    </div>
  );
};

export const AudioExtractorTab: React.FC<Props> = ({ outputFolder }) => {
  const [links, setLinks] = useState('');
  const [extractMode, setExtractMode] = useState<'both' | 'audio' | 'text'>('both');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [isExtracting, setIsExtracting] = useState(false);
  const [results, setResults] = useState<ExtractedItem[]>([]);
  const [resultTab, setResultTab] = useState<'text' | 'audio'>('text');

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`Đã sao chép ${label} vào bộ nhớ tạm!`);
  };

  const handleDeleteItem = (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
    message.success('Đã xóa mục khỏi danh sách.');
  };

  const handleExtract = async () => {
    const rawList = links
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http'));

    if (rawList.length === 0) {
      message.warning('Vui lòng nhập ít nhất 1 đường link video YouTube / TikTok / Facebook / Threads.');
      return;
    }

    let targetDirectory = outputFolder;
    if (!targetDirectory) {
      message.info('Vui lòng chọn thư mục lưu trữ trên máy tính của bạn trước khi trích xuất.');
      const picked = await openNativeFolderDialog();
      if (!picked) {
        message.warning('Bạn chưa chọn thư mục lưu trữ để trích xuất.');
        return;
      }
      targetDirectory = picked;
    }

    setIsExtracting(true);
    message.loading({ content: `Đang trích xuất dữ liệu từ ${rawList.length} video...`, key: 'extract_msg', duration: 0 });

    const newResults: ExtractedItem[] = [];

    const doAudio = extractMode === 'both' || extractMode === 'audio';
    const doText = extractMode === 'both' || extractMode === 'text';

    for (let i = 0; i < rawList.length; i++) {
      const url = rawList[i];
      try {
        const res = await axios.post('/api/audio/extract', {
          url,
          outputFormat: audioFormat,
          outputFolder: targetDirectory,
          extractAudio: doAudio,
          extractText: doText,
        });

        if (res.data?.success) {
          const item: ExtractedItem = {
            id: String(Date.now() + i),
            url,
            extractedAt: new Date().toLocaleTimeString(),
            audioFile: res.data.file ? {
              fileName: res.data.file.fileName,
              filePath: res.data.file.filePath,
              format: audioFormat.toUpperCase(),
            } : undefined,
            textContent: res.data.textContent || undefined,
          };
          newResults.push(item);
        }
      } catch (err: any) {
        message.error(`Lỗi trích xuất link ${i + 1}: ${err.response?.data?.error || err.message}`);
      }
    }

    setResults((prev) => [...newResults, ...prev]);
    setIsExtracting(false);
    message.success({ content: `Hoàn tất trích xuất ${newResults.length} video!`, key: 'extract_msg' });

    // Automatically switch to the most relevant view
    if (extractMode === 'text') setResultTab('text');
    if (extractMode === 'audio') setResultTab('audio');
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
      {/* Feature Banner */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Trích Xuất Âm Thanh MP3 & Nội Dung Text / Lời Thoại Video
                <Tag color="purple" className="!text-[10px] !font-bold">Audio & Transcript Studio</Tag>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                Tách âm thanh 320kbps chất lượng cao và trích xuất trọn bộ Tiêu đề, Mô tả, Hashtags cùng Phụ đề / Lời thoại (Transcript) từ YouTube, TikTok, Facebook, Douyin.
              </p>
            </div>
          </div>
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
        {/* Left Form: Links & Mode Setup */}
        <div className="lg:col-span-5 space-y-5">
          <Card title="1. Dán Liên Kết Video Cần Trích Xuất" className="border-slate-800">
            <TextArea
              rows={6}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="Dán mỗi đường link trên một dòng (Ví dụ: https://www.youtube.com/watch?v=... hoặc link TikTok, Facebook)"
              className="!bg-[#070b14] !border-slate-800 text-xs font-mono"
            />

            <div className="mt-4 space-y-4 border-t border-slate-800/80 pt-4">
              {/* Modern Extraction Mode Selector */}
              <div>
                <span className="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-wider">
                  Chế độ trích xuất:
                </span>
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Both Audio & Text */}
                  <div
                    onClick={() => setExtractMode('both')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      extractMode === 'both'
                        ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-950/50'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        extractMode === 'both' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <ThunderboltOutlined className="text-base" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${extractMode === 'both' ? 'text-white' : 'text-slate-200'}`}>
                            Cả Âm Thanh + Text & Lời Thoại
                          </span>
                          <Tag color="purple" className="!text-[10px] !px-1.5 !m-0 !font-bold">
                            Khuyên Dùng
                          </Tag>
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          Tách MP3 320kbps + Lấy Tiêu đề, Caption & Transcript
                        </span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      extractMode === 'both' ? 'border-purple-500 bg-purple-600' : 'border-slate-600'
                    }`}>
                      {extractMode === 'both' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>

                  {/* Option 2: Only Text */}
                  <div
                    onClick={() => setExtractMode('text')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      extractMode === 'text'
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/50'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        extractMode === 'text' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={`text-xs font-bold block ${extractMode === 'text' ? 'text-white' : 'text-slate-200'}`}>
                          Chỉ Lấy Nội Dung Text (Xử Lý Nhanh)
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Trích xuất Tiêu đề, Mô tả, Hashtags & Phụ đề rời
                        </span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      extractMode === 'text' ? 'border-indigo-500 bg-indigo-600' : 'border-slate-600'
                    }`}>
                      {extractMode === 'text' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>

                  {/* Option 3: Only Audio */}
                  <div
                    onClick={() => setExtractMode('audio')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      extractMode === 'audio'
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/50'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        extractMode === 'audio' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <CustomerServiceOutlined className="text-base" />
                      </div>
                      <div>
                        <span className={`text-xs font-bold block ${extractMode === 'audio' ? 'text-white' : 'text-slate-200'}`}>
                          Chỉ Tách Nhạc / Âm Thanh MP3
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Tách luồng âm thanh gốc độ phân giải cao 320kbps
                        </span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      extractMode === 'audio' ? 'border-emerald-500 bg-emerald-600' : 'border-slate-600'
                    }`}>
                      {extractMode === 'audio' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio format options if audio is enabled */}
              {(extractMode === 'both' || extractMode === 'audio') && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-xs text-slate-300 block font-semibold flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-purple-400" /> Định dạng âm thanh xuất bản:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'mp3', label: 'MP3', desc: '320 kbps' },
                      { key: 'm4a', label: 'M4A', desc: 'AAC HD' },
                      { key: 'wav', label: 'WAV', desc: 'Lossless' },
                    ].map((fmt) => (
                      <button
                        key={fmt.key}
                        type="button"
                        onClick={() => setAudioFormat(fmt.key)}
                        className={`py-2 px-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                          audioFormat === fmt.key
                            ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold block">{fmt.label}</span>
                        <span className="text-[10px] opacity-80 block">{fmt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button
                type="primary"
                size="large"
                icon={isExtracting ? <LoadingOutlined /> : <ThunderboltOutlined />}
                loading={isExtracting}
                onClick={handleExtract}
                block
                className="!bg-gradient-to-r !from-purple-600 via-indigo-600 !to-pink-600 !border-0 font-bold h-12 shadow-xl shadow-purple-500/25 text-sm mt-2"
              >
                {isExtracting ? 'Đang Trích Xuất Dữ Liệu...' : 'Bắt Đầu Trích Xuất'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Multi-tab Results View */}
        <div className="lg:col-span-7 space-y-5">
          <Card
            title={
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-xs font-bold text-slate-200">
                  2. Kết Quả Trích Xuất ({results.length} Video)
                </span>
                {results.length > 0 && (
                  <button
                    onClick={() => setResults([])}
                    className="text-red-400 text-xs hover:underline cursor-pointer"
                  >
                    Xóa kết quả
                  </button>
                )}
              </div>
            }
            className="border-slate-800"
          >
            {results.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                Chưa có video nào được trích xuất. Hãy dán link bên trái và bấm <strong className="text-purple-400">"Bắt Đầu Trích Xuất"</strong>.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Result Tabs switcher */}
                <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setResultTab('text')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      resultTab === 'text'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Nội Dung Text & Lời Thoại</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultTab('audio')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      resultTab === 'audio'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Tệp Âm Thanh MP3</span>
                  </button>
                </div>

                {/* List of items */}
                <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1">
                  {results.map((item, idx) => {
                    const text = item.textContent;
                    const audio = item.audioFile;

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-3.5 hover:border-purple-500/40 transition-all"
                      >
                        {/* Video Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 truncate">
                            {text?.thumbnail ? (
                              <img
                                src={text.thumbnail}
                                alt="thumb"
                                className="w-20 h-14 object-cover rounded-lg shrink-0 border border-slate-700 bg-slate-950"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-purple-300" />
                              </div>
                            )}

                            <div className="truncate space-y-1">
                              <h4 className="text-xs font-bold text-slate-100 truncate" title={text?.title || audio?.fileName}>
                                {text?.title || audio?.fileName || item.url}
                              </h4>

                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                {text?.uploader && (
                                  <span className="flex items-center gap-1 text-purple-300 font-medium">
                                    <UserOutlined /> {text.uploader}
                                  </span>
                                )}
                                {text?.duration ? (
                                  <span className="flex items-center gap-1 text-slate-500">
                                    <ClockCircleOutlined /> {formatSeconds(text.duration)}
                                  </span>
                                ) : null}
                                {text?.viewCount ? (
                                  <span className="flex items-center gap-1 text-slate-500">
                                    <EyeOutlined /> {formatNumber(text.viewCount)} lượt xem
                                  </span>
                                ) : null}
                                <span className="text-slate-600 font-mono text-[10px]">{item.extractedAt}</span>
                              </div>
                            </div>
                          </div>

                          {/* Delete Item Button */}
                          <Popconfirm
                            title="Xác nhận xóa"
                            description="Bạn có muốn xóa mục này khỏi danh sách kết quả?"
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleDeleteItem(item.id)}
                          >
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              className="!text-slate-500 hover:!text-red-400 hover:!bg-red-500/10 shrink-0 !w-8 !h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                              title="Xóa mục này"
                            />
                          </Popconfirm>
                        </div>

                        {/* VIEW 1: TEXT CONTENT & TRANSCRIPT */}
                        {resultTab === 'text' && (
                          <div className="space-y-3 pt-1 border-t border-slate-800/80">
                            {/* Audio Player embedded right inside text view if audio was extracted */}
                            {audio && (
                              <AudioPlayerWidget filePath={audio.filePath} fileName={audio.fileName} format={audio.format} />
                            )}

                            {/* Hashtags bar if exists */}
                            {text?.hashtags && text.hashtags.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                                    <Hash className="w-3 h-3 text-purple-400" /> Hashtags ({text.hashtags.length}):
                                  </span>
                                  <button
                                    onClick={() => handleCopy(text.hashtags!.join(' '), 'Hashtags')}
                                    className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" /> Sao chép tất cả
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {text.hashtags.map((h, hIdx) => (
                                    <Tag key={hIdx} color="purple" className="!m-0 !text-[10px]">
                                      {h}
                                    </Tag>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Full Description & Caption */}
                            {text?.description ? (
                              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Mô Tả & Caption Video:
                                  </span>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => handleCopy(text.description, 'Mô tả video')}
                                    className="!text-indigo-400 hover:!text-indigo-300 text-xs font-semibold"
                                  >
                                    Sao chép
                                  </Button>
                                </div>
                                <div className="text-xs text-slate-300 font-sans whitespace-pre-wrap max-h-36 overflow-y-auto pr-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[11px] leading-relaxed select-text">
                                  {text.description}
                                </div>
                              </div>
                            ) : null}

                            {/* Lời thoại / Phụ đề (Transcript) */}
                            {text?.transcript ? (
                              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-950/30 to-indigo-950/20 border border-purple-500/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Lời Thoại / Phụ Đề (Transcript Video):
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<CopyOutlined />}
                                      onClick={() => handleCopy(text.transcript!, 'Lời thoại Transcript')}
                                      className="!text-purple-300 hover:!text-purple-200 text-xs font-semibold"
                                    >
                                      Sao chép Lời thoại
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-xs text-slate-200 font-sans whitespace-pre-wrap max-h-44 overflow-y-auto pr-1 bg-slate-900/80 p-3 rounded-lg border border-purple-500/20 text-[11px] leading-relaxed select-text font-mono">
                                  {text.transcript}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-lg border border-slate-800">
                                ℹ️ Video này không đính kèm phụ đề rời (Closed Captions) từ nền tảng.
                              </div>
                            )}

                            {/* Export TXT file button */}
                            {text?.txtFilePath && (
                              <div className="flex items-center justify-between pt-1 text-xs">
                                <span className="text-[11px] text-slate-500 truncate font-mono">
                                  📄 Đã lưu file text: {text.txtFilePath}
                                </span>
                                <a
                                  href={`/api/storage/download?path=${encodeURIComponent(text.txtFilePath)}`}
                                  download
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold shrink-0"
                                >
                                  <DownloadIcon className="w-3 h-3" /> Tải File Text (.txt)
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* VIEW 2: AUDIO FILE WITH INTERACTIVE PLAYER */}
                        {resultTab === 'audio' && (
                          <div className="space-y-3 pt-1 border-t border-slate-800/80">
                            {audio ? (
                              <AudioPlayerWidget filePath={audio.filePath} fileName={audio.fileName} format={audio.format} />
                            ) : (
                              <div className="text-xs text-slate-500 py-3 text-center">
                                Bạn đã chọn chế độ "Chỉ lấy Text" nên tệp âm thanh không được trích xuất.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
