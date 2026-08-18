'use client';

import React from 'react';
import { DownloadCloud, Sparkles, Youtube, Video, MessageCircle, Instagram, Share2, Facebook } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <DownloadCloud className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold gradient-text">OmniSocial Downloader</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                Pro Watermarker
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Tải hàng loạt đa nền tảng • Xử lý tuần tự • Tự động gắn Watermark
            </p>
          </div>
        </div>

        {/* Supported Platforms badges */}
        <div className="hidden md:flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <Youtube className="w-3.5 h-3.5" /> YouTube
          </span>
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Video className="w-3.5 h-3.5" /> TikTok / Douyin
          </span>
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Instagram className="w-3.5 h-3.5" /> Instagram
          </span>
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MessageCircle className="w-3.5 h-3.5" /> Threads
          </span>
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Facebook className="w-3.5 h-3.5" /> Facebook
          </span>
        </div>
      </div>
    </header>
  );
};
