'use client';

import React, { useEffect, useState } from 'react';
import { Folder, FolderCheck, HardDrive, Download, FolderOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, message, Tag } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { openNativeFolderDialog } from '@/lib/utils/folder-dialog';

interface Props {
  folderPath: string;
  onChange: (path: string) => void;
}

export const StorageFolderPicker: React.FC<Props> = ({ folderPath, onChange }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [isOpeningDialog, setIsOpeningDialog] = useState(false);

  useEffect(() => {
    // Only load suggestions for quick click, do NOT set default path
    fetch('/api/select-folder')
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, []);

  const handlePickFolder = async () => {
    setIsOpeningDialog(true);
    const selected = await openNativeFolderDialog();
    setIsOpeningDialog(false);
    if (selected) {
      onChange(selected);
      setIsValid(true);
    }
  };

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
              Thư Mục Lưu Trữ Trên Máy Tính
            </h2>
          </div>
        </div>

        <div>
          {folderPath ? (
            <Tag color="success" className="!m-0 !px-2 !py-0.5 !text-xs !flex !items-center !gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Đã chọn thư mục
            </Tag>
          ) : (
            <Tag color="warning" className="!m-0 !px-2 !py-0.5 !text-xs !flex !items-center !gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Chưa chọn thư mục
            </Tag>
          )}
        </div>
      </div>

      {/* Action Pick Folder Button & Input Field */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => {
                onChange(e.target.value);
                setIsValid(true);
              }}
              onBlur={handleBlur}
              placeholder="Chưa chọn thư mục (Bấm nút 'Chọn Thư Mục Máy Tính' bên cạnh)"
              className={`w-full bg-slate-900/90 border rounded-xl px-4 py-2.5 text-xs font-mono transition-all focus:outline-none ${
                folderPath
                  ? 'text-emerald-300 border-emerald-500/40 focus:border-emerald-500'
                  : 'text-slate-400 border-amber-500/40 focus:border-indigo-500 placeholder-slate-500'
              }`}
            />
          </div>

          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            loading={isOpeningDialog}
            onClick={handlePickFolder}
            className="!bg-gradient-to-r !from-indigo-600 !to-purple-600 !border-0 font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-indigo-500/20 whitespace-nowrap"
          >
            Chọn Thư Mục Máy Tính
          </Button>
        </div>

        {/* Suggestions pills */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
              <HardDrive className="w-3 h-3 text-slate-500" /> Gợi ý nhanh:
            </span>
            {suggestions.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChange(p);
                  if (typeof window !== 'undefined') {
                    try {
                      localStorage.setItem('social_studio_storage_folder', p);
                    } catch {}
                  }
                }}
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
