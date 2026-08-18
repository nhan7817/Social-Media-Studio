'use client';

import React, { useState } from 'react';
import {
  Card,
  Button,
  Radio,
  Select,
  Typography,
  Tag,
  message,
  Space,
} from 'antd';
import {
  VideoCameraOutlined,
  SwapOutlined,
  FolderOpenOutlined,
  CheckCircleFilled,
  FormatPainterOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Paragraph } = Typography;

interface Props {
  outputFolder: string;
}

export const AspectConverterTab: React.FC<Props> = ({ outputFolder }) => {
  const [selectedRatio, setSelectedRatio] = useState('9:16');
  const [paddingMode, setPaddingMode] = useState('black');
  const [outputCodec, setOutputCodec] = useState('h264');

  const handleOpenFolder = async () => {
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
            <VideoCameraOutlined className="text-2xl text-cyan-400" />
            <h3 className="text-lg font-bold text-slate-100">
              Bộ Chuyển Đổi Tỉ Lệ Khung Hình & Định Dạng Video
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tự động chuyển đổi kích thước khung hình video sang định dạng chuẩn 9:16 (Shorts / TikTok / Reels), 16:9 (YouTube Desktop), 1:1 (Square) hoặc 4:5 (Instagram Feed).
          </p>
        </div>

        <Button
          type="default"
          icon={<FolderOpenOutlined />}
          onClick={handleOpenFolder}
          className="!bg-slate-900 !border-slate-700 !text-slate-300 text-xs"
        >
          Mở Thư Mục Video
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Aspect Ratio Presets */}
        <div className="lg:col-span-8 space-y-6">
          <Card title="1. Chọn Tỉ Lệ Khung Hình Đích" className="border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* 9:16 */}
              <div
                onClick={() => setSelectedRatio('9:16')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedRatio === '9:16'
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-12 h-20 mx-auto rounded-md bg-indigo-500/20 border-2 border-indigo-400 flex items-center justify-center text-xs font-bold text-indigo-300 mb-3">
                  9:16
                </div>
                <div className="text-center">
                  <h4 className="text-xs font-semibold text-slate-200">9:16 Dọc</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">TikTok, Shorts, Reels</p>
                  <span className="text-[10px] text-indigo-400 font-mono">1080 × 1920</span>
                </div>
              </div>

              {/* 16:9 */}
              <div
                onClick={() => setSelectedRatio('16:9')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedRatio === '16:9'
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-20 h-12 mx-auto rounded-md bg-purple-500/20 border-2 border-purple-400 flex items-center justify-center text-xs font-bold text-purple-300 mb-3 mt-4">
                  16:9
                </div>
                <div className="text-center">
                  <h4 className="text-xs font-semibold text-slate-200">16:9 Ngang</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">YouTube, Facebook TV</p>
                  <span className="text-[10px] text-purple-400 font-mono">1920 × 1080</span>
                </div>
              </div>

              {/* 1:1 */}
              <div
                onClick={() => setSelectedRatio('1:1')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedRatio === '1:1'
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-14 h-14 mx-auto rounded-md bg-pink-500/20 border-2 border-pink-400 flex items-center justify-center text-xs font-bold text-pink-300 mb-3 mt-3">
                  1:1
                </div>
                <div className="text-center">
                  <h4 className="text-xs font-semibold text-slate-200">1:1 Vuông</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Instagram Post, Ads</p>
                  <span className="text-[10px] text-pink-400 font-mono">1080 × 1080</span>
                </div>
              </div>

              {/* 4:5 */}
              <div
                onClick={() => setSelectedRatio('4:5')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedRatio === '4:5'
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-12 h-16 mx-auto rounded-md bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-xs font-bold text-emerald-300 mb-3 mt-2">
                  4:5
                </div>
                <div className="text-center">
                  <h4 className="text-xs font-semibold text-slate-200">4:5 Dọc Nhẹ</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Instagram Feed</p>
                  <span className="text-[10px] text-emerald-400 font-mono">1080 × 1350</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Options */}
          <Card title="2. Tùy chọn Xử lý Viền & Codec" className="border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Chế độ đệm viền (Pillarbox/Letterbox):
                </span>
                <Radio.Group
                  value={paddingMode}
                  onChange={(e) => setPaddingMode(e.target.value)}
                  size="small"
                >
                  <Radio value="black">Viền Đen Chuẩn (Black Bars)</Radio>
                  <Radio value="pad">Fit Co Giãn (Contain)</Radio>
                </Radio.Group>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Bộ giải mã Video (Codec):
                </span>
                <Select
                  value={outputCodec}
                  onChange={setOutputCodec}
                  size="small"
                  className="w-full"
                  options={[
                    { label: 'H.264 / AVC (Tương thích mọi thiết bị)', value: 'h264' },
                    { label: 'HEVC / H.265 (Dung lượng nhỏ hơn)', value: 'hevc' },
                  ]}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Info Box */}
        <div className="lg:col-span-4">
          <Card title="Cơ chế Hoạt động" className="border-slate-800">
            <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="font-semibold text-indigo-400 block mb-1">
                  ⚡ Đã tích hợp sẵn vào Module Tải Video:
                </span>
                Bạn có thể cài đặt trực tiếp mục **"Định dạng Tỉ lệ Khung hình Tải về"** ngay trong tab **"Tải & Đóng Watermark"**. Toàn bộ video tải về sẽ tự động được chuyển đổi sang tỉ lệ mong muốn trước khi lưu.
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="font-semibold text-emerald-400 block mb-1">
                  🎯 Không vỡ hình:
                </span>
                Bộ lọc FFmpeg áp dụng tỉ lệ `force_original_aspect_ratio=decrease` giúp video giữ nguyên độ nét gốc và bù viền đối xứng.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
