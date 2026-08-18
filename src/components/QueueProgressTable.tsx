'use client';

import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  Film,
  Image as ImageIcon,
  ExternalLink,
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
  Slash,
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
  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const cancelledCount = tasks.filter((t) => t.status === 'cancelled').length;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-5">
      {/* Overall Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Tiến độ Xử lý Tuần tự
            </h3>
            {isDone ? (
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Đã hoàn tất tiến trình
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
        <div className="flex items-center gap-2">
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
              <th className="py-3 px-4 w-48">Trạng thái</th>
              <th className="py-3 px-4 w-56">Kết quả & File</th>
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
                    <div className="truncate max-w-[260px] font-mono text-slate-400" title={task.url}>
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
                          <Loader2 className="w-3 h-3 animate-spin" /> Đang tải... ({task.progress}%)
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

                  {/* Result files */}
                  <td className="py-3 px-4">
                    {task.resultFiles && task.resultFiles.length > 0 ? (
                      <div className="space-y-1">
                        {task.resultFiles.map((rf, rIdx) => (
                          <div
                            key={rIdx}
                            className="flex items-center gap-1.5 text-[11px] text-slate-300 font-mono"
                            title={rf.filePath}
                          >
                            {rf.type === 'video' ? (
                              <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[160px]">{rf.fileName}</span>
                            {rf.sizeBytes && (
                              <span className="text-slate-500 shrink-0">({formatBytes(rf.sizeBytes)})</span>
                            )}
                          </div>
                        ))}
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
