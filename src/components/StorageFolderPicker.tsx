'use client';

import React, { useEffect, useState } from 'react';
import { Folder, FolderCheck, Check, Sparkles, HardDrive } from 'lucide-react';

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
    <div className="glass-card rounded-2xl p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Thư mục Lưu trữ (Save Location)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <FolderCheck className="w-3.5 h-3.5" /> Sẵn sàng
            </span>
          ) : (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              Chưa xác nhận
            </span>
          )}
          {folderPath && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/open-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderPath }),
                  });
                } catch (e) {
                  console.error('Error opening folder:', e);
                }
              }}
              title="Mở thư mục này trong File Explorer"
              className="text-xs px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1"
            >
              <Folder className="w-3.5 h-3.5" /> Mở thư mục
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => {
              onChange(e.target.value);
              setIsValid(true);
            }}
            onBlur={handleBlur}
            placeholder="Ví dụ: N:\Tools\downloads hoặc C:\Users\YourName\Downloads"
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono transition-all"
          />
        </div>

        {/* Suggestions pills */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
              <HardDrive className="w-3 h-3 text-slate-500" /> Gợi ý nhanh:
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
