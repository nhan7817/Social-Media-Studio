'use client';

import React, { useEffect, useState } from 'react';
import { Folder, FolderCheck, HardDrive, Download, Globe, Info } from 'lucide-react';

interface Props {
  folderPath: string;
  onChange: (path: string) => void;
}

export const StorageFolderPicker: React.FC<Props> = ({ folderPath, onChange }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    // Fetch default paths
    fetch('/api/select-folder')
      .then((res) => res.json())
      .then((data) => {
        if (data.defaultPath && !folderPath) {
          onChange(data.defaultPath);
        }
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, []);

  const handleBlur = async () => {
    if (!folderPath) return;
    setIsValidating(true);
    try {
      const res = await fetch('/api/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });
      const data = await res.json();
      setIsValid(data.valid === true);
    } catch {
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Thư mục Xử lý Tạm trên Server
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
            <Download className="w-3 h-3 text-indigo-400" /> Tải về máy qua Web
          </span>
          {isValid && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <FolderCheck className="w-3.5 h-3.5" /> Sẵn sàng
            </span>
          )}
        </div>
      </div>

      {/* Domain / Web Storage Info banner */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-200">Cơ chế Web Online:</strong> Video sẽ được xử lý trên máy chủ và xuất hiện nút <span className="text-emerald-400 font-semibold">"Tải về máy"</span> ngay khi hoàn tất để bạn lưu trực tiếp về máy tính/điện thoại qua trình duyệt.
        </p>
      </div>

      <div className="space-y-2.5">
        <div className="relative">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => {
              onChange(e.target.value);
              setIsValid(true);
            }}
            onBlur={handleBlur}
            placeholder="Mặc định: Thư mục lưu trữ nội bộ của hệ thống"
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono transition-all"
          />
        </div>

        {/* Suggestions pills */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
              <HardDrive className="w-3 h-3 text-slate-500" /> Vị trí server:
            </span>
            {suggestions.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(p)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all truncate max-w-[320px] ${
                  folderPath === p
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 font-medium'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={p}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
