'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Tabs,
  InputNumber,
  Tooltip,
} from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  ScissorOutlined,
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SoundOutlined,
  ThunderboltFilled,
  FastForwardOutlined,
  FileDoneOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Scissors, Film, SplitSquareVertical, Sparkles, Music, Layers, Eye } from 'lucide-react';
import axios from 'axios';

const { Title, Paragraph, Text } = Typography;

interface Props {
  outputFolder: string;
}

interface SegmentItem {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  speed: number;
}

interface MergeClipItem {
  id: string;
  file: File;
  name: string;
  size: number;
  objectUrl: string;
  duration?: number;
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatSecondsToTime = (totalSeconds: number) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 10);
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}.${ms}`;
  }
  return `${pad(m)}:${pad(s)}.${ms}`;
};

export const VideoTrimMergeTab: React.FC<Props> = ({ outputFolder }) => {
  const [activeTab, setActiveTab] = useState<'trim' | 'merge'>('trim');

  // ==========================================
  // STATE: 1. CẮT VIDEO (TRIM / SPLIT)
  // ==========================================
  const [trimFile, setTrimFile] = useState<File | null>(null);
  const [trimVideoSrc, setTrimVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Current active slider selection
  const [sliderRange, setSliderRange] = useState<[number, number]>([0, 10]);

  // Multiple segments
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);

  // Trim Options
  const [trimExportMode, setTrimExportMode] = useState<'merge_segments' | 'separate_files'>('merge_segments');
  const [trimQualityMode, setTrimQualityMode] = useState<'fast_copy' | 'accurate'>('accurate');
  const [trimMuteAudio, setTrimMuteAudio] = useState<boolean>(false);
  const [trimIsProcessing, setTrimIsProcessing] = useState<boolean>(false);

  // Trim Results
  const [trimResults, setTrimResults] = useState<Array<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
    downloadUrl: string;
  }> | null>(null);

  const trimVideoRef = useRef<HTMLVideoElement | null>(null);
  const trimFileInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================
  // STATE: 2. GHÉP VIDEO (MERGE / JOIN)
  // ==========================================
  const [mergeClips, setMergeClips] = useState<MergeClipItem[]>([]);
  const [mergeAspectRatio, setMergeAspectRatio] = useState<'original' | '9:16' | '16:9' | '1:1' | '4:5'>('original');
  const [mergeFps, setMergeFps] = useState<number>(30);
  const [mergeMuteAudio, setMergeMuteAudio] = useState<boolean>(false);
  const [bgMusicFile, setBgMusicFile] = useState<File | null>(null);
  const [mergeIsProcessing, setMergeIsProcessing] = useState<boolean>(false);

  // Merge Results
  const [mergeResult, setMergeResult] = useState<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
    downloadUrl: string;
    totalClips: number;
  } | null>(null);

  const mergeFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgMusicInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================
  // TRIM HANDLERS
  // ==========================================
  const handleTrimFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTrimFile(file);
    setTrimResults(null);
    const objectUrl = URL.createObjectURL(file);
    setTrimVideoSrc(objectUrl);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleLoadedMetadata = () => {
    if (trimVideoRef.current) {
      const dur = trimVideoRef.current.duration || 0;
      setVideoDuration(dur);
      const initialEnd = Math.min(dur, Math.max(5, dur * 0.5));
      setSliderRange([0, initialEnd]);
      setSegments([
        {
          id: `seg_${Date.now()}`,
          start: 0,
          end: initialEnd,
          speed: 1,
        },
      ]);
      setActiveSegmentIndex(0);
    }
  };

  const handleTimeUpdate = () => {
    if (trimVideoRef.current) {
      setCurrentTime(trimVideoRef.current.currentTime);
    }
  };

  const togglePlayPause = () => {
    if (!trimVideoRef.current) return;
    if (isPlaying) {
      trimVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      trimVideoRef.current.play();
      setIsPlaying(true);
    }
  };

  const seekBy = (seconds: number) => {
    if (!trimVideoRef.current) return;
    const newTime = Math.max(0, Math.min(videoDuration, trimVideoRef.current.currentTime + seconds));
    trimVideoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const setStartToCurrentTime = () => {
    const current = Math.round(currentTime * 10) / 10;
    const newStart = Math.min(current, sliderRange[1] - 0.1);
    const newRange: [number, number] = [Math.max(0, newStart), sliderRange[1]];
    setSliderRange(newRange);
    updateCurrentSegment(newRange[0], newRange[1]);
    message.info(`Đã gán điểm Bắt đầu: ${formatSecondsToTime(newRange[0])}`);
  };

  const setEndToCurrentTime = () => {
    const current = Math.round(currentTime * 10) / 10;
    const newEnd = Math.max(current, sliderRange[0] + 0.1);
    const newRange: [number, number] = [sliderRange[0], Math.min(videoDuration, newEnd)];
    setSliderRange(newRange);
    updateCurrentSegment(newRange[0], newRange[1]);
    message.info(`Đã gán điểm Kết thúc: ${formatSecondsToTime(newRange[1])}`);
  };

  const playCurrentSelection = () => {
    if (!trimVideoRef.current) return;
    trimVideoRef.current.currentTime = sliderRange[0];
    trimVideoRef.current.play();
    setIsPlaying(true);
  };

  const updateCurrentSegment = (start: number, end: number, speed?: number) => {
    setSegments((prev) => {
      if (prev.length === 0) {
        return [{ id: `seg_${Date.now()}`, start, end, speed: speed || 1 }];
      }
      const next = [...prev];
      if (next[activeSegmentIndex]) {
        next[activeSegmentIndex] = {
          ...next[activeSegmentIndex],
          start,
          end,
          speed: speed !== undefined ? speed : next[activeSegmentIndex].speed,
        };
      }
      return next;
    });
  };

  const handleSliderChange = (vals: number[]) => {
    const start = vals[0];
    const end = vals[1];
    setSliderRange([start, end]);
    updateCurrentSegment(start, end);
    if (trimVideoRef.current && Math.abs(trimVideoRef.current.currentTime - start) > 0.5) {
      trimVideoRef.current.currentTime = start;
    }
  };

  const handleAddSegment = () => {
    const lastSeg = segments[segments.length - 1];
    let newStart = lastSeg ? Math.min(videoDuration - 1, lastSeg.end + 0.5) : 0;
    let newEnd = Math.min(videoDuration, newStart + 5);

    if (newStart >= videoDuration) {
      newStart = 0;
      newEnd = Math.min(videoDuration, 5);
    }

    const newSeg: SegmentItem = {
      id: `seg_${Date.now()}_${segments.length}`,
      start: Math.round(newStart * 10) / 10,
      end: Math.round(newEnd * 10) / 10,
      speed: 1,
    };

    setSegments((prev) => [...prev, newSeg]);
    setActiveSegmentIndex(segments.length);
    setSliderRange([newSeg.start, newSeg.end]);
    if (trimVideoRef.current) {
      trimVideoRef.current.currentTime = newSeg.start;
    }
    message.success(`Đã thêm phân đoạn #${segments.length + 1}`);
  };

  const handleSelectSegment = (index: number) => {
    setActiveSegmentIndex(index);
    const seg = segments[index];
    if (seg) {
      setSliderRange([seg.start, seg.end]);
      if (trimVideoRef.current) {
        trimVideoRef.current.currentTime = seg.start;
      }
    }
  };

  const handleRemoveSegment = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (segments.length <= 1) {
      message.warning('Cần giữ lại ít nhất 1 phân đoạn.');
      return;
    }
    const next = segments.filter((_, i) => i !== index);
    setSegments(next);
    const newIdx = Math.max(0, index - 1);
    setActiveSegmentIndex(newIdx);
    if (next[newIdx]) {
      setSliderRange([next[newIdx].start, next[newIdx].end]);
    }
  };

  const handleExecuteTrim = async () => {
    if (!trimFile) {
      message.warning('Vui lòng chọn tệp video cần cắt.');
      return;
    }

    if (segments.length === 0) {
      message.warning('Chưa có phân đoạn nào được thiết lập.');
      return;
    }

    setTrimIsProcessing(true);
    message.loading({ content: 'Đang thực hiện cắt và xuất phân đoạn video...', key: 'trim_msg', duration: 0 });

    const formData = new FormData();
    formData.append('file', trimFile);
    formData.append('segments', JSON.stringify(segments));
    formData.append('mode', trimExportMode);
    formData.append('qualityMode', trimQualityMode);
    formData.append('muteAudio', String(trimMuteAudio));
    formData.append('outputFolder', outputFolder);

    try {
      const res = await axios.post('/api/video/trim', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 240000,
      });

      if (res.data?.success && res.data?.files) {
        setTrimResults(res.data.files);
        message.success({ content: `Cắt thành công! Đã xuất ${res.data.files.length} video.`, key: 'trim_msg' });
      } else {
        throw new Error(res.data?.error || 'Không thể cắt video.');
      }
    } catch (err: any) {
      message.error({ content: `Lỗi cắt video: ${err.response?.data?.error || err.message}`, key: 'trim_msg' });
    } finally {
      setTrimIsProcessing(false);
    }
  };

  // ==========================================
  // MERGE HANDLERS
  // ==========================================
  const handleMergeFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newClips: MergeClipItem[] = files.map((file, i) => ({
      id: `clip_${Date.now()}_${i}`,
      file,
      name: file.name,
      size: file.size,
      objectUrl: URL.createObjectURL(file),
    }));

    setMergeClips((prev) => [...prev, ...newClips]);
    setMergeResult(null);
    e.target.value = '';
  };

  const handleMoveClip = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= mergeClips.length) return;

    const next = [...mergeClips];
    const temp = next[index];
    next[index] = next[newIdx];
    next[newIdx] = temp;
    setMergeClips(next);
  };

  const handleRemoveClip = (index: number) => {
    setMergeClips((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExecuteMerge = async () => {
    if (mergeClips.length < 2) {
      message.warning('Vui lòng thêm ít nhất 2 video để ghép nối.');
      return;
    }

    setMergeIsProcessing(true);
    message.loading({ content: `Đang chuẩn hóa và ghép nối ${mergeClips.length} video...`, key: 'merge_msg', duration: 0 });

    const formData = new FormData();
    mergeClips.forEach((clip) => {
      formData.append('files', clip.file);
    });
    formData.append('aspectRatio', mergeAspectRatio);
    formData.append('targetFps', String(mergeFps));
    formData.append('muteAudio', String(mergeMuteAudio));
    if (bgMusicFile) {
      formData.append('bgMusic', bgMusicFile);
    }
    formData.append('outputFolder', outputFolder);

    try {
      const res = await axios.post('/api/video/merge', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 360000,
      });

      if (res.data?.success) {
        setMergeResult(res.data);
        message.success({ content: `Ghép thành công ${res.data.totalClips} video thành 1 clip hoàn chỉnh!`, key: 'merge_msg' });
      } else {
        throw new Error(res.data?.error || 'Không thể ghép video.');
      }
    } catch (err: any) {
      message.error({ content: `Lỗi ghép video: ${err.response?.data?.error || err.message}`, key: 'merge_msg' });
    } finally {
      setMergeIsProcessing(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await axios.post('/api/open-folder', { folderPath: outputFolder });
    } catch {
      message.error('Không thể mở thư mục trên hệ thống.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Studio Cắt & Ghép Nối Video Chuyên Nghiệp
                <Tag color="magenta" className="!text-[10px] !font-bold">FFmpeg Engine</Tag>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                Cắt trích đoạn video chính xác theo từng mili-giây, cắt bỏ đoạn thừa / quảng cáo và ghép nối nhiều video với chuẩn hóa tỉ lệ tự động.
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

      {/* Tabs Selector */}
      <div className="flex items-center gap-3 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('trim')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'trim'
              ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>1. Cắt & Tách Đoạn Video</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('merge')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'merge'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>2. Ghép Nhiều Video</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODULE 1: CẮT & TÁCH ĐOẠN VIDEO (TRIM / SPLIT) */}
      {/* ========================================================================= */}
      {activeTab === 'trim' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Video Player & Visual Timeline */}
          <div className="lg:col-span-7 space-y-5">
            {/* Upload Area */}
            <Card title="1. Chọn Video Cần Cắt" className="border-slate-800">
              <div
                onClick={() => trimFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-pink-500/80 rounded-2xl p-5 text-center cursor-pointer bg-slate-950/60 hover:bg-pink-950/10 transition-all group"
              >
                <input
                  ref={trimFileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                  onChange={handleTrimFileChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <UploadOutlined className="text-lg text-pink-400" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  {trimFile ? trimFile.name : 'Bấm hoặc Kéo thả video vào đây để mở'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Hỗ trợ MP4, MOV, MKV, WebM (Mọi dung lượng)
                </p>
              </div>

              {trimFile && (
                <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <span className="text-slate-200 font-medium truncate block">{trimFile.name}</span>
                    <span className="text-slate-500 text-[11px]">
                      {formatBytes(trimFile.size)} • Thời lượng: {formatSecondsToTime(videoDuration)}
                    </span>
                  </div>
                  <Tag color="magenta" className="!text-[11px]">Sẵn sàng</Tag>
                </div>
              )}
            </Card>

            {/* Video Player & Interactive Timeline Bar */}
            {trimVideoSrc && (
              <Card title="Xem Trước & Chọn Mốc Thời Gian" className="border-slate-800">
                <div className="space-y-4">
                  {/* Player Canvas */}
                  <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center relative border border-slate-800">
                    <video
                      ref={trimVideoRef}
                      src={trimVideoSrc}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      className="w-full h-full object-contain max-h-[340px]"
                    />

                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-pink-300 font-bold border border-pink-500/30">
                      ⏱ {formatSecondsToTime(currentTime)} / {formatSecondsToTime(videoDuration)}
                    </div>
                  </div>

                  {/* Playback Controls & Frame Steppers */}
                  <div className="flex items-center justify-between gap-2 p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="default"
                        size="small"
                        onClick={() => seekBy(-1)}
                        className="!bg-slate-800 !border-slate-700 !text-slate-300 text-xs"
                        title="Lùi 1 giây"
                      >
                        -1s
                      </Button>
                      <Button
                        type="default"
                        size="small"
                        onClick={() => seekBy(-0.1)}
                        className="!bg-slate-800 !border-slate-700 !text-slate-300 text-xs font-mono"
                        title="Lùi 1 khung hình (0.1s)"
                      >
                        -0.1s
                      </Button>
                      <Button
                        type="primary"
                        shape="circle"
                        icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={togglePlayPause}
                        className="!bg-pink-600 hover:!bg-pink-500 !border-0 !w-8 !h-8"
                      />
                      <Button
                        type="default"
                        size="small"
                        onClick={() => seekBy(0.1)}
                        className="!bg-slate-800 !border-slate-700 !text-slate-300 text-xs font-mono"
                        title="Tiến 1 khung hình (0.1s)"
                      >
                        +0.1s
                      </Button>
                      <Button
                        type="default"
                        size="small"
                        onClick={() => seekBy(1)}
                        className="!bg-slate-800 !border-slate-700 !text-slate-300 text-xs"
                        title="Tiến 1 giây"
                      >
                        +1s
                      </Button>
                    </div>

                    <Button
                      type="default"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={playCurrentSelection}
                      className="!bg-pink-950/40 !border-pink-500/40 !text-pink-300 font-semibold text-xs"
                    >
                      Xem Thử Đoạn Chọn
                    </Button>
                  </div>

                  {/* Dual-Point Range Slider */}
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Đang chọn đoạn #{activeSegmentIndex + 1}:
                      </span>
                      <span className="text-pink-400 font-bold font-mono">
                        {formatSecondsToTime(sliderRange[0])} ➔ {formatSecondsToTime(sliderRange[1])}
                        {' '}({(sliderRange[1] - sliderRange[0]).toFixed(1)}s)
                      </span>
                    </div>

                    <Slider
                      range
                      min={0}
                      max={videoDuration || 100}
                      step={0.1}
                      value={sliderRange}
                      onChange={handleSliderChange}
                      tooltip={{
                        formatter: (val) => formatSecondsToTime(val || 0),
                      }}
                      className="!my-2"
                    />

                    {/* Fast Quick Marker Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="default"
                        size="small"
                        onClick={setStartToCurrentTime}
                        className="!bg-slate-800 !border-slate-700 !text-pink-300 font-bold text-xs"
                      >
                        [ Gán Điểm Đầu (IN)
                      </Button>

                      <Button
                        type="default"
                        size="small"
                        onClick={setEndToCurrentTime}
                        className="!bg-slate-800 !border-slate-700 !text-pink-300 font-bold text-xs"
                      >
                        ] Gán Điểm Cuối (OUT)
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Results Rendered */}
            {trimResults && trimResults.length > 0 && (
              <Card title="Kết Quả Xuất Bản Phân Đoạn Video" className="border-emerald-500/40 bg-emerald-950/15">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <CheckCircleFilled className="text-base" />
                    <span>Đã xử lý và tạo thành công {trimResults.length} tệp video!</span>
                  </div>

                  {trimResults.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="truncate">
                        <p className="text-xs font-medium text-slate-200 truncate">{item.fileName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">Dung lượng: {formatBytes(item.sizeBytes)}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={item.downloadUrl}
                          download={item.fileName}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/30"
                        >
                          <DownloadOutlined />
                          <span>Tải về</span>
                        </a>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="default"
                    icon={<FolderOpenOutlined />}
                    onClick={handleOpenFolder}
                    block
                    className="!bg-slate-900 !border-slate-700 !text-slate-300 text-xs"
                  >
                    Mở Thư Mục Chứa Video Đã Cắt
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Multi-segment List & Output Settings */}
          <div className="lg:col-span-5 space-y-5">
            {/* Multi-Segment Manager */}
            <Card
              title={
                <div className="flex items-center justify-between w-full pr-2">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Scissors className="w-4 h-4 text-pink-400" />
                    <span>Danh Sách Phân Đoạn Cắt ({segments.length})</span>
                  </span>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    disabled={!trimVideoSrc}
                    onClick={handleAddSegment}
                    className="!bg-pink-600 hover:!bg-pink-500 !border-0 font-bold text-xs"
                  >
                    Thêm Đoạn
                  </Button>
                </div>
              }
              className="border-slate-800"
            >
              {segments.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Vui lòng tải video để bắt đầu đánh dấu phân đoạn.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {segments.map((seg, idx) => {
                    const isSelected = idx === activeSegmentIndex;
                    const duration = Math.max(0, seg.end - seg.start);

                    return (
                      <div
                        key={seg.id}
                        onClick={() => handleSelectSegment(idx)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-pink-950/30 border-pink-500/80 shadow-md shadow-pink-500/10'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Tag color={isSelected ? 'magenta' : 'default'} className="!m-0 font-bold font-mono">
                            #{idx + 1}
                          </Tag>
                          <div>
                            <div className="text-xs font-mono font-semibold text-slate-200">
                              {formatSecondsToTime(seg.start)} ➔ {formatSecondsToTime(seg.end)}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Thời lượng: <strong className="text-pink-300">{duration.toFixed(1)}s</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {seg.speed !== 1 && (
                            <Tag color="purple" className="!text-[10px]">{seg.speed}x</Tag>
                          )}
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => handleRemoveSegment(idx, e)}
                            className="text-slate-500 hover:text-red-400"
                            title="Xóa phân đoạn này"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Export Settings */}
            <Card title="2. Tùy Chọn Xuất Bản Phân Đoạn" className="border-slate-800">
              <div className="space-y-4 text-xs">
                {/* Export Mode */}
                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">Chế độ xuất bản:</label>
                  <Radio.Group
                    value={trimExportMode}
                    onChange={(e) => setTrimExportMode(e.target.value)}
                    className="w-full flex flex-col gap-2"
                  >
                    <Radio value="merge_segments" className="!text-slate-200">
                      <span className="font-semibold">Gộp các đoạn cắt lại thành 1 video duy nhất</span>
                      <span className="block text-[11px] text-slate-500">Loại bỏ các đoạn thừa / quảng cáo và nối liền mạch</span>
                    </Radio>
                    <Radio value="separate_files" className="!text-slate-200">
                      <span className="font-semibold">Xuất từng phân đoạn thành file riêng lẻ</span>
                      <span className="block text-[11px] text-slate-500">Tách thành nhiều clip ngắn độc lập để làm Shorts / Reels</span>
                    </Radio>
                  </Radio.Group>
                </div>

                <Divider className="!my-2 !border-slate-800" />

                {/* Quality / Engine Mode */}
                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">Tốc độ & Chất lượng:</label>
                  <Radio.Group
                    value={trimQualityMode}
                    onChange={(e) => setTrimQualityMode(e.target.value)}
                    buttonStyle="solid"
                    size="small"
                    className="w-full grid grid-cols-2 gap-2"
                  >
                    <Radio.Button value="fast_copy" className="text-center">
                      ⚡ Cắt Siêu Tốc (1s)
                    </Radio.Button>
                    <Radio.Button value="accurate" className="text-center">
                      🎯 Chuẩn Từng Frame
                    </Radio.Button>
                  </Radio.Group>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {trimQualityMode === 'fast_copy'
                      ? 'Lossless Stream Copy: Giữ nguyên 100% chất lượng gốc, hoàn thành tức thì.'
                      : 'Frame-Accurate: Nén lại độ nét cao H.264 giúp khớp chính xác từng mili-giây.'}
                  </p>
                </div>

                <Divider className="!my-2 !border-slate-800" />

                {/* Mute audio switch */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Tắt tiếng (Mute Audio)</span>
                  <Switch
                    checked={trimMuteAudio}
                    onChange={setTrimMuteAudio}
                    className="bg-slate-700"
                  />
                </div>
              </div>
            </Card>

            {/* Action Cut Button */}
            <Button
              type="primary"
              size="large"
              icon={trimIsProcessing ? <LoadingOutlined /> : <ScissorOutlined />}
              loading={trimIsProcessing}
              disabled={!trimFile || segments.length === 0}
              onClick={handleExecuteTrim}
              block
              className="!bg-gradient-to-r !from-pink-600 via-rose-600 !to-red-600 !border-0 font-bold h-12 shadow-xl shadow-pink-500/25 text-sm"
            >
              {trimIsProcessing ? 'Đang Thực Hiện Cắt Video...' : `Bắt Đầu Cắt & Xuất ${segments.length} Phân Đoạn`}
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 2: GHÉP NHIỀU VIDEO (MERGE / JOIN) */}
      {/* ========================================================================= */}
      {activeTab === 'merge' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload Multi-clips & Ordered List */}
          <div className="lg:col-span-7 space-y-5">
            {/* Upload Area */}
            <Card
              title={
                <div className="flex items-center justify-between w-full pr-2">
                  <span>1. Thêm Các Video Cần Ghép ({mergeClips.length})</span>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => mergeFileInputRef.current?.click()}
                    className="!bg-indigo-600 hover:!bg-indigo-500 !border-0 font-bold text-xs"
                  >
                    Thêm Video
                  </Button>
                </div>
              }
              className="border-slate-800"
            >
              <input
                ref={mergeFileInputRef}
                type="file"
                multiple
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                onChange={handleMergeFilesChange}
                className="hidden"
              />

              {mergeClips.length === 0 ? (
                <div
                  onClick={() => mergeFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-2xl p-8 text-center cursor-pointer bg-slate-950/60 hover:bg-indigo-950/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Film className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    Bấm để chọn nhiều video cùng lúc (Tối thiểu 2 clip)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tự động đồng bộ chuẩn hóa độ phân giải và tỉ lệ khung hình
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Thứ tự ghép (Video #1 ➔ Video #{mergeClips.length}):</span>
                    <button
                      onClick={() => setMergeClips([])}
                      className="text-red-400 hover:underline cursor-pointer"
                    >
                      Xóa tất cả
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {mergeClips.map((clip, idx) => (
                      <div
                        key={clip.id}
                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 hover:border-indigo-500/50 transition-all"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">
                            #{idx + 1}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-medium text-slate-200 truncate" title={clip.name}>
                              {clip.name}
                            </p>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {formatBytes(clip.size)}
                            </span>
                          </div>
                        </div>

                        {/* Actions: Move Up / Move Down / Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="text"
                            size="small"
                            disabled={idx === 0}
                            icon={<ArrowUpOutlined />}
                            onClick={() => handleMoveClip(idx, 'up')}
                            className="!text-slate-400 hover:!text-indigo-400 disabled:opacity-30"
                            title="Di chuyển lên trên"
                          />
                          <Button
                            type="text"
                            size="small"
                            disabled={idx === mergeClips.length - 1}
                            icon={<ArrowDownOutlined />}
                            onClick={() => handleMoveClip(idx, 'down')}
                            className="!text-slate-400 hover:!text-indigo-400 disabled:opacity-30"
                            title="Di chuyển xuống dưới"
                          />
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveClip(idx)}
                            className="!text-slate-500 hover:!text-red-400"
                            title="Xóa clip này"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => mergeFileInputRef.current?.click()}
                    className="!border-slate-700 !text-slate-300 text-xs"
                  >
                    + Thêm Clip Khác Vào Danh Sách
                  </Button>
                </div>
              )}
            </Card>

            {/* Merge Result Card */}
            {mergeResult && (
              <Card title="Kết Quả Ghép Nối Video" className="border-emerald-500/40 bg-emerald-950/15">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <CheckCircleFilled className="text-base" />
                    <span>Đã ghép hoàn tất {mergeResult.totalClips} clip thành 1 video duy nhất!</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <p className="text-xs font-medium text-slate-200 truncate">{mergeResult.fileName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">Dung lượng: {formatBytes(mergeResult.sizeBytes)}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={mergeResult.downloadUrl}
                      download={mergeResult.fileName}
                      className="flex-1"
                    >
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        block
                        className="!bg-emerald-600 !border-0 font-semibold shadow-md shadow-emerald-600/30"
                      >
                        Tải Video Đã Ghép Về Máy
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

          {/* Right Column: Aspect Ratio & Normalization Settings */}
          <div className="lg:col-span-5 space-y-5">
            <Card title="2. Tỉ Lệ Khung Hình & Đồng Bộ" className="border-slate-800">
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">
                    Tỉ lệ khung hình đầu ra (Aspect Ratio):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'original', label: 'Chuẩn theo Clip #1', desc: 'Giữ tỉ lệ video đầu tiên' },
                      { id: '9:16', label: '9:16 Dọc', desc: 'TikTok, Shorts, Reels' },
                      { id: '16:9', label: '16:9 Ngang', desc: 'YouTube Full HD' },
                      { id: '1:1', label: '1:1 Vuông', desc: 'Instagram Feed' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMergeAspectRatio(opt.id as any)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          mergeAspectRatio === opt.id
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 font-semibold shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="block font-bold">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Divider className="!my-2 !border-slate-800" />

                {/* Target FPS */}
                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">Tốc độ khung hình (FPS):</label>
                  <Radio.Group
                    value={mergeFps}
                    onChange={(e) => setMergeFps(e.target.value)}
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value={30}>30 FPS (Chuẩn mượt)</Radio.Button>
                    <Radio.Button value={60}>60 FPS (Siêu nét)</Radio.Button>
                  </Radio.Group>
                </div>

                <Divider className="!my-2 !border-slate-800" />

                {/* Audio options & Background music */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Tắt toàn bộ âm thanh gốc</span>
                    <Switch
                      checked={mergeMuteAudio}
                      onChange={setMergeMuteAudio}
                      className="bg-slate-700"
                    />
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">
                      Chèn thêm nhạc nền MP3 (Tùy chọn):
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        ref={bgMusicInputRef}
                        type="file"
                        accept="audio/mp3,audio/m4a,audio/wav"
                        onChange={(e) => setBgMusicFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <Button
                        type="default"
                        size="small"
                        icon={<Music className="w-3.5 h-3.5 inline mr-1 text-purple-400" />}
                        onClick={() => bgMusicInputRef.current?.click()}
                        className="!bg-slate-900 !border-slate-700 !text-slate-300 text-xs"
                      >
                        {bgMusicFile ? bgMusicFile.name : 'Chọn File MP3...'}
                      </Button>
                      {bgMusicFile && (
                        <button
                          onClick={() => setBgMusicFile(null)}
                          className="text-red-400 text-xs hover:underline"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Action Merge Button */}
            <Button
              type="primary"
              size="large"
              icon={mergeIsProcessing ? <LoadingOutlined /> : <Film className="w-4 h-4 mr-1 inline" />}
              loading={mergeIsProcessing}
              disabled={mergeClips.length < 2}
              onClick={handleExecuteMerge}
              block
              className="!bg-gradient-to-r !from-indigo-600 via-purple-600 !to-pink-600 !border-0 font-bold h-12 shadow-xl shadow-indigo-500/25 text-sm"
            >
              {mergeIsProcessing ? 'Đang Chuẩn Hóa & Ghép Video...' : `Bắt Đầu Ghép Nối ${mergeClips.length} Video`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
