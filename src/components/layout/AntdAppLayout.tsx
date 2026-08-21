'use client';

import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Button,
  Badge,
  Tooltip,
  Typography,
  Space,
  Tag,
} from 'antd';
import {
  DownloadOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ThunderboltFilled,
  GithubOutlined,
  FolderFilled,
  SyncOutlined,
  ScissorOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Layers, ShieldCheck, Zap } from 'lucide-react';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export type ActiveModuleKey = 'downloader' | 'trim-merge' | 'editor' | 'audio' | 'aspect' | 'storage' | 'settings';

interface AntdAppLayoutProps {
  activeKey: ActiveModuleKey;
  onSelectKey: (key: ActiveModuleKey) => void;
  outputFolder: string;
  onOpenFolder: () => void;
  runningTasksCount?: number;
  completedTasksCount?: number;
  children: React.ReactNode;
}

export const AntdAppLayout: React.FC<AntdAppLayoutProps> = ({
  activeKey,
  onSelectKey,
  outputFolder,
  onOpenFolder,
  runningTasksCount = 0,
  completedTasksCount = 0,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Restore saved sidebar width
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('social_studio_sidebar_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (parsed >= 180 && parsed <= 500) {
            setSidebarWidth(parsed);
          }
        }
      } catch {}
    }
  }, []);

  // Handle Dragging Resize
  const handleMouseDown = (e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, moveEvent.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      try {
        const finalWidth = Math.max(180, Math.min(500, upEvent.clientX));
        localStorage.setItem('social_studio_sidebar_width', String(finalWidth));
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetWidth = () => {
    setSidebarWidth(260);
    try {
      localStorage.setItem('social_studio_sidebar_width', '260');
    } catch {}
  };

  const menuItems = [
    {
      key: 'downloader',
      icon: (
        <Badge count={runningTasksCount > 0 ? runningTasksCount : 0} size="small" offset={[5, 0]}>
          <DownloadOutlined style={{ fontSize: 17 }} />
        </Badge>
      ),
      label: 'Tải & Đóng Watermark',
    },
    {
      key: 'trim-merge',
      icon: <ScissorOutlined style={{ fontSize: 17 }} />,
      label: 'Cắt & Ghép Nối Video',
    },
    {
      key: 'editor',
      icon: <EditOutlined style={{ fontSize: 17 }} />,
      label: 'Chỉnh Sửa & Xóa Logo Video',
    },
    {
      key: 'audio',
      icon: <AudioOutlined style={{ fontSize: 17 }} />,
      label: 'Trích xuất Âm thanh MP3',
    },
    {
      key: 'aspect',
      icon: <VideoCameraOutlined style={{ fontSize: 17 }} />,
      label: 'Chuyển đổi Tỉ lệ & Format',
    },
    {
      key: 'storage',
      icon: (
        <Badge count={completedTasksCount > 0 ? completedTasksCount : 0} size="small" overflowCount={999} offset={[5, 0]} color="#10b981">
          <FolderOpenOutlined style={{ fontSize: 17 }} />
        </Badge>
      ),
      label: 'Quản lý Tệp & Lịch sử',
    },
    {
      key: 'settings',
      icon: <SettingOutlined style={{ fontSize: 17 }} />,
      label: 'Cài đặt & Engine',
    },
  ];

  return (
    <Layout hasSider className={`min-h-screen bg-[#070b14] text-slate-100 ${isResizing ? 'select-none' : ''}`}>
      {/* Ant Design Modern Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={sidebarWidth}
        collapsedWidth={80}
        theme="dark"
        className={`!bg-[#0c1222]/95 !border-r !border-slate-800/80 backdrop-blur-xl relative ${
          isResizing ? '!transition-none' : 'transition-all duration-200'
        }`}
        style={{
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.4)',
          zIndex: 100,
        }}
      >
        {/* Drag-to-Resize Right Handle */}
        {!collapsed && (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={handleResetWidth}
            title="Kéo sang trái/phải để chỉnh độ rộng Menu (Nhấp đúp để đặt lại mặc định)"
            className={`absolute top-0 right-0 w-2 h-full cursor-col-resize z-50 group flex items-center justify-center transition-colors ${
              isResizing ? 'bg-indigo-500/80 shadow-lg shadow-indigo-500/50' : 'hover:bg-indigo-500/40'
            }`}
          >
            <div className={`w-0.5 h-10 rounded-full transition-opacity ${
              isResizing ? 'bg-white opacity-100' : 'bg-slate-500 opacity-0 group-hover:opacity-100'
            }`} />
          </div>
        )}

        <div className="flex flex-col h-full justify-between overflow-hidden">
          <div>
            {/* Brand Logo Header */}
            <div className="h-16 flex items-center px-4 gap-3 border-b border-slate-800/80 overflow-hidden shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                <ThunderboltFilled className="text-white text-lg" />
              </div>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="font-bold text-sm bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent tracking-wide">
                    Social Media Studio
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    v2.5 Modular Suite
                  </span>
                </div>
              )}
            </div>

            {/* Navigation Menu */}
            <div className="p-3">
              {!collapsed && (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2">
                  Các tính năng
                </div>
              )}
              <Menu
                theme="dark"
                mode="inline"
                selectedKeys={[activeKey]}
                onClick={({ key }) => onSelectKey(key as ActiveModuleKey)}
                items={menuItems}
                className="!bg-transparent !border-0 font-medium space-y-1"
              />
            </div>
          </div>

          {/* Bottom Sidebar Info */}
          {!collapsed && (
            <div className="p-3 pb-4 shrink-0">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Engine Status</span>
                  <Tag color="success" className="!m-0 !px-1.5 !py-0 !text-[10px] !border-emerald-500/30">
                    Active
                  </Tag>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>FFmpeg 4.x + yt-dlp 2024</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Sider>

      <Layout className="!bg-transparent">
        {/* Top Header Bar */}
        <Header className="!bg-[#0c1222]/80 !border-b !border-slate-800/80 !h-16 !px-6 flex items-center justify-between backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="!text-slate-300 hover:!text-indigo-400 !w-9 !h-9"
            />

            {/* Current Active Module Title */}
            <div className="hidden sm:flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500"></span>
              <h2 className="text-sm font-semibold text-slate-200">
                {activeKey === 'downloader' && 'Tải Video & Đóng Dấu Bản Quyền Tự Động'}
                {activeKey === 'trim-merge' && 'Studio Cắt & Ghép Nối Video Chuyên Nghiệp'}
                {activeKey === 'editor' && 'Studio Chỉnh Sửa & Xóa / Làm Mờ Logo Video Trực Tiếp'}
                {activeKey === 'audio' && 'Trích Xuất Âm Thanh MP3 / M4A Chất Lượng Cao'}
                {activeKey === 'aspect' && 'Bộ Chuyển Đổi Tỉ Lệ Khung Hình Video (9:16, 16:9, 1:1)'}
                {activeKey === 'storage' && 'Quản Lý Tệp Tải Về & Lịch Sử Tác Vụ'}
                {activeKey === 'settings' && 'Cài Đặt Hệ Thống & Kiểm Tra Engine'}
              </h2>
            </div>
          </div>

          {/* Quick Storage & Action Toolbar */}
          <div className="flex items-center gap-3">
            <Tooltip title={`Thư mục lưu trữ: ${outputFolder}`}>
              <Button
                type="default"
                icon={<FolderFilled className="text-amber-400" />}
                onClick={onOpenFolder}
                className="!bg-slate-900/90 !border-slate-700/80 !text-slate-200 hover:!border-indigo-500 hover:!text-indigo-300 text-xs flex items-center shadow-sm"
              >
                <span className="hidden md:inline truncate max-w-[200px]">{outputFolder}</span>
                <span className="md:hidden">Mở Folder</span>
              </Button>
            </Tooltip>

            {runningTasksCount > 0 && (
              <Tag color="processing" className="!flex !items-center !gap-1.5 !py-1 !px-2.5 !rounded-lg !text-xs !bg-indigo-500/10 !border-indigo-500/30 !text-indigo-300">
                <SyncOutlined spin />
                <span>Đang tải {runningTasksCount} clip</span>
              </Tag>
            )}
          </div>
        </Header>

        {/* Main Content Area */}
        <Content className="p-6 md:p-8 max-w-[1800px] w-full mx-auto">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
