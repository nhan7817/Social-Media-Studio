'use client';

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Copy,
  Download,
  RotateCcw,
  Check,
  ExternalLink,
} from 'lucide-react';
import { FailedLinkRecord } from '@/types';

interface Props {
  isOpen: boolean;
  failedLinks: FailedLinkRecord[];
  onClose: () => void;
  onRetryFailed: (links: string[]) => void;
}

export const FailedLinksModal: React.FC<Props> = ({
  isOpen,
  failedLinks,
  onClose,
  onRetryFailed,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = failedLinks.map((f) => f.url).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTxt = () => {
    const text = failedLinks
      .map((f) => `URL: ${f.url}\nPlatform: ${f.platform}\nError: ${f.error}\nTime: ${f.failedAt}\n-------------------`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed_links_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRetry = () => {
    const urls = failedLinks.map((f) => f.url);
    onRetryFailed(urls);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-slate-100">
              Danh sách {failedLinks.length} Link Gặp Lỗi
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <p className="text-xs text-slate-400">
            Các đường link này đã bị lỗi trong quá trình tải. Hệ thống đã tự động bỏ qua để tiếp tục các link khác và ghi nhận lại dưới đây:
          </p>

          <div className="space-y-2.5">
            {failedLinks.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3 rounded-xl bg-slate-950/80 border border-rose-900/30 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-400 uppercase">
                    {item.platform}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {item.failedAt}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-200 truncate" title={item.url}>
                  {item.url}
                </div>
                <div className="text-[11px] text-rose-400/90 bg-rose-950/30 px-2.5 py-1 rounded-md border border-rose-900/40">
                  <span className="font-semibold">Lý do: </span>
                  {item.error}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Đã sao chép' : 'Sao chép link'}
            </button>
            <button
              type="button"
              onClick={handleExportTxt}
              className="text-xs text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Xuất file .txt
            </button>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            className="text-xs text-white font-medium px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Tải lại các link lỗi này
          </button>
        </div>
      </div>
    </div>
  );
};
