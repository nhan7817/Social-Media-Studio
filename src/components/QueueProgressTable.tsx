'use client';

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  Image as ImageIcon,
  Youtube,
  Video,
  Instagram,
  MessageCircle,
  Facebook,
  Globe,
  AlertTriangle,
  XCircle,
  Square,
  Ban,
  Download,
  DownloadCloud,
  Check,
} from 'lucide-react';
import { DownloadTaskItem, FailedLinkRecord, SupportedPlatform } from '@/types';

interface Props {
  tasks: DownloadTaskItem[];
  currentTaskIndex: number;
  overallProgress: number;
  failedLinks: FailedLinkRecord[];
  isDone: boolean;
  onOpenFailedModal: () => void;
  onCancelAll?: () => void;
  onCancelTask?: (taskId: string) => void;
}

const renderPlatformIcon = (platform: SupportedPlatform) => {
  switch (platform) {
    case 'youtube':
      return <Youtube className="w-4 h-4 text-red-400" />;
    case 'tiktok':
    case 'douyin':
      return <Video className="w-4 h-4 text-cyan-400" />;
    case 'instagram':
      return <Instagram className="w-4 h-4 text-pink-400" />;
    case 'threads':
      return <MessageCircle className="w-4 h-4 text-emerald-400" />;
    case 'facebook':
      return <Facebook className="w-4 h-4 text-blue-400" />;
    default:
      return <Globe className="w-4 h-4 text-slate-400" />;
  }
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const QueueProgressTable: React.FC<Props> = ({
  tasks,
  currentTaskIndex,
  overallProgress,
  failedLinks,
  isDone,
  onOpenFailedModal,
  onCancelAll,
  onCancelTask,
}) => {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadedAllSuccess, setDownloadedAllSuccess] = useState(false);

  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const cancelledCount = tasks.filter((t) => t.status === 'cancelled').length;

  // Extract all completed result files
  const allCompletedFiles = tasks
    .filter((t) => t.status === 'completed' && t.resultFiles && t.resultFiles.length > 0)
    .flatMap((t) => t.resultFiles || []);

  const handleDownloadAll = async () => {
    if (allCompletedFiles.length === 0 || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadedAllSuccess(false);

    try {
      // Trigger download for each file with small stagger delay so browser doesn't block
      for (let i = 0; i < allCompletedFiles.length; i++) {
        const file = allCompletedFiles[i];
        const downloadUrl = `/api/storage/download?path=${encodeURIComponent(file.filePath)}`;
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (i < allCompletedFiles.length - 1) {
          await new Promise((res) => setTimeout(res, 350));
        }
      }
      setDownloadedAllSuccess(true);
      setTimeout(() => setDownloadedAllSuccess(false), 4000);
    } catch (err) {
      console.error('Error downloading all files:', err);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-5">
      {/* Overall Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Tiến độ Xử lý & Tải về Trình duyệt
            </h3>
            {isDone ? (
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn tất tiến trình
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang chạy (Clip {currentTaskIndex + 1}/{tasks.length})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Đã hoàn thành: <span className="text-emerald-400 font-semibold">{completedCount}</span> / {tasks.length}
            {failedCount > 0 && (
              <> • Lỗi: <span className="text-rose-400 font-semibold">{failedCount}</span></>
            )}
            {cancelledCount > 0 && (
              <> • Đã dừng: <span className="text-amber-400 font-semibold">{cancelledCount}</span></>
            )}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download All Completed Files to Device */}
          {allCompletedFiles.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
                downloadedAllSuccess
                  ? 'bg-emerald-600 text-white border border-emerald-500 shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-500/40 shadow-emerald-500/20'
              }`}
              title="Tải tất cả các tệp đã hoàn thành về máy tính/điện thoại"
            >
              {downloadingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tải {allCompletedFiles.length} tệp...</span>
                </>
              ) : downloadedAllSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã gửi {allCompletedFiles.length} tệp xuống máy!</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4 text-white" />
                  <span>Tải tất cả về máy ({allCompletedFiles.length} tệp)</span>
                </>
              )}
            </button>
          )}

          {/* Stop All Remaining Clips Button */}
          {!isDone && onCancelAll && (
            <button
              type="button"
              onClick={onCancelAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-all"
              title="Dừng tất cả các clip còn lại trong hàng đợi"
            >
              <Square className="w-3.5 h-3.5 text-amber-400 fill-current" />
              <span>Dừng các clip còn lại</span>
            </button>
          )}

          {/* Failed Links Warning Button */}
          {failedCount > 0 && (
            <button
              type="button"
              onClick={onOpenFailedModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Xem {failedCount} link lỗi</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Tiến độ tổng thể</span>
          <span className="font-mono font-medium text-slate-200">{overallProgress}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 rounded-full"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Task List Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 w-12">#</th>
              <th className="py-3 px-4 w-28">Nền tảng</th>
              <th className="py-3 px-4">Đường link URL</th>
              <th className="py-3 px-4 w-44">Trạng thái</th>
              <th className="py-3 px-4">Kết quả & Tải về máy</th>
              <th className="py-3 px-4 w-24 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {tasks.map((task, idx) => {
              const isCurrent = idx === currentTaskIndex && !isDone;
              const canCancel = task.status === 'pending' || task.status === 'downloading' || task.status === 'watermarking';

              return (
                <tr
                  key={task.id || idx}
                  className={`transition-colors ${
                    isCurrent
                      ? 'bg-indigo-950/30 border-l-2 border-indigo-500'
                      : 'hover:bg-slate-900/40'
                  }`}
                >
                  <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>

                  {/* Platform */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 font-medium capitalize">
                      {renderPlatformIcon(task.detectedPlatform || task.platform)}
                      <span>{task.detectedPlatform || task.platform}</span>
                    </div>
                  </td>

                  {/* URL */}
                  <td className="py-3 px-4">
                    <div className="truncate max-w-[240px] font-mono text-slate-400" title={task.url}>
                      {task.url}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    {task.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành
                      </span>
                    )}
                    {task.status === 'failed' && (
                      <span
                        className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-medium cursor-pointer"
                        title={task.error}
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> Lỗi (Đã lưu)
                      </span>
                    )}
                    {task.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1 text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                        <Ban className="w-3.5 h-3.5" /> Đã dừng
                      </span>
                    )}
                    {task.status === 'downloading' && (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-indigo-400 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" /> Đang tải ({task.progress}%)
                        </span>
                        <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 transition-all duration-200"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {task.status === 'watermarking' && (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-purple-400 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" /> Đóng watermark...
                        </span>
                        <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all duration-200"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {task.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5" /> Chờ chạy
                      </span>
                    )}
                  </td>

                  {/* Result files & Direct Browser Download */}
                  <td className="py-3 px-4">
                    {task.resultFiles && task.resultFiles.length > 0 ? (
                      <div className="space-y-1.5">
                        {task.resultFiles.map((rf, rIdx) => {
                          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(rf.filePath)}`;
                          return (
                            <div
                              key={rIdx}
                              className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 max-w-[340px]"
                            >
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-mono truncate">
                                {rf.type === 'video' ? (
                                  <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                ) : (
                                  <ImageIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                                )}
                                <span className="truncate max-w-[150px]" title={rf.fileName}>
                                  {rf.fileName}
                                </span>
                                {rf.sizeBytes && (
                                  <span className="text-slate-500 shrink-0 text-[10px]">
                                    ({formatBytes(rf.sizeBytes)})
                                  </span>
                                )}
                              </div>

                              {/* Direct Browser Download Button */}
                              <a
                                href={downloadUrl}
                                download={rf.fileName}
                                title="Tải tệp này về máy tính / điện thoại"
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-all shrink-0 hover:scale-105"
                              >
                                <Download className="w-3 h-3 text-emerald-400" />
                                <span>Tải về</span>
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    ) : task.error ? (
                      <span className="text-rose-400/80 text-[11px] truncate block max-w-[180px]" title={task.error}>
                        {task.error}
                      </span>
                    ) : task.status === 'cancelled' ? (
                      <span className="text-slate-500 text-[11px] italic">Bỏ qua</span>
                    ) : (
                      <span className="text-slate-600 text-[11px]">-</span>
                    )}
                  </td>

                  {/* Action Column (Stop Individual Clip) */}
                  <td className="py-3 px-4 text-center">
                    {canCancel && onCancelTask ? (
                      <button
                        type="button"
                        onClick={() => onCancelTask(task.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all"
                        title="Dừng tải clip này"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-slate-700 text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
