'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  Tag,
  Typography,
  Divider,
  message,
  Space,
} from 'antd';
import {
  SettingOutlined,
  CheckCircleFilled,
  SyncOutlined,
  FolderOpenOutlined,
  CloudDownloadOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { openNativeFolderDialog } from '@/lib/utils/folder-dialog';
import axios from 'axios';

const { Title, Paragraph, Text } = Typography;

interface Props {
  outputFolder: string;
  onOutputFolderChange: (folder: string) => void;
}

export const SettingsTab: React.FC<Props> = ({
  outputFolder,
  onOutputFolderChange,
}) => {
  const [folderInput, setFolderInput] = useState(outputFolder);
  const [isUpdatingBinary, setIsUpdatingBinary] = useState(false);

  useEffect(() => {
    setFolderInput(outputFolder);
  }, [outputFolder]);

  const handlePickFolder = async () => {
    const picked = await openNativeFolderDialog();
    if (picked) {
      setFolderInput(picked);
      onOutputFolderChange(picked);
    }
  };

  const handleSaveOutputFolder = () => {
    if (!folderInput.trim()) {
      message.error('Vui lòng nhập đường dẫn thư mục.');
      return;
    }
    onOutputFolderChange(folderInput.trim());
    message.success('Đã lưu cấu hình thư mục lưu trữ.');
  };

  const handleOpenFolder = async () => {
    if (!outputFolder) {
      await handlePickFolder();
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
      {/* Banner */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SettingOutlined className="text-2xl text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">
              Cài Đặt Hệ Thống & Kiểm Tra Engine Xử Lý
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Quản lý đường dẫn lưu trữ tệp, kiểm tra trạng thái engine yt-dlp & FFmpeg và cấu hình hệ thống.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Storage settings */}
        <div className="lg:col-span-7 space-y-6">
          <Card title="1. Thư mục lưu trữ trên máy tính" className="border-slate-800">
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Đường dẫn thư mục lưu video & ảnh xuất bản:
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={folderInput}
                    placeholder="Chưa chọn thư mục (Bấm 'Chọn Thư Mục' để duyệt)"
                    onChange={(e) => setFolderInput(e.target.value)}
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    type="primary"
                    icon={<FolderOpenOutlined />}
                    onClick={handlePickFolder}
                    className="!bg-gradient-to-r !from-indigo-600 !to-purple-600 !border-0 font-semibold text-xs"
                  >
                    Chọn Thư Mục
                  </Button>
                  <Button
                    type="default"
                    onClick={handleSaveOutputFolder}
                    className="!bg-slate-900 !border-slate-700 !text-slate-300 font-medium text-xs"
                  >
                    Lưu
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="default"
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenFolder}
                  className="!bg-slate-900 !border-slate-700 !text-slate-300 text-xs"
                >
                  Mở Thư Mục Hiện Tại
                </Button>
              </div>
            </div>
          </Card>

          <Card title="2. Cơ chế Bảo vệ & Phòng chống Lỗi" className="border-slate-800">
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <CheckCircleFilled className="text-emerald-400 text-base shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Xử Lý Tuần Tự (Sequential Queue)</span>
                  <span className="text-slate-400 text-[11px]">
                    Tải từng video theo hàng đợi để chống rate-limit IP từ YouTube/TikTok/Facebook.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <CheckCircleFilled className="text-emerald-400 text-base shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Tự Động Ghi Nhận Link Hỏng</span>
                  <span className="text-slate-400 text-[11px]">
                    Khi gặp link lỗi, hệ thống tự lưu vào danh sách báo cáo và chuyển sang link tiếp theo mà không làm ngắt hàng đợi.
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Engine Info */}
        <div className="lg:col-span-5 space-y-6">
          <Card title="Trạng Thái Engine Tải & Xử Lý" className="border-slate-800">
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div>
                  <h4 className="font-semibold text-slate-200">yt-dlp Core Engine</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Tự động tải & cập nhật trong /bin</p>
                </div>
                <Tag color="success" className="!text-xs">Sẵn sàng</Tag>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div>
                  <h4 className="font-semibold text-slate-200">FFmpeg & Sharp Module</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Đóng dấu Watermark & Re-encode</p>
                </div>
                <Tag color="success" className="!text-xs">Hoạt động</Tag>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div>
                  <h4 className="font-semibold text-slate-200">TikWM Direct Scraper</h4>
                  <p className="text-[11px] text-slate-500 font-mono">Tải TikTok HD không logo gốc</p>
                </div>
                <Tag color="processing" className="!text-xs">Online</Tag>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
