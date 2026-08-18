'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Popconfirm,
  message,
  Input,
  Space,
  Tooltip,
} from 'antd';
import {
  FolderOpenOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CopyOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import axios from 'axios';

interface StorageFile {
  name: string;
  path: string;
  sizeBytes: number;
  mtime: string;
  type: 'video' | 'image' | 'audio' | 'other';
  ext: string;
}

interface Props {
  outputFolder: string;
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const HistoryManagerTab: React.FC<Props> = ({ outputFolder }) => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/storage/files?folder=${encodeURIComponent(outputFolder)}`);
      setFiles(res.data?.files || []);
    } catch {
      message.error('Không thể đọc danh sách file từ thư mục lưu trữ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [outputFolder]);

  const handleDelete = async (filePath: string) => {
    try {
      await axios.delete('/api/storage/files', { data: { filePath } });
      message.success('Đã xóa tệp thành công.');
      setFiles((prev) => prev.filter((f) => f.path !== filePath));
    } catch {
      message.error('Không thể xóa tệp.');
    }
  };

  const handleCopyPath = (filePath: string) => {
    navigator.clipboard.writeText(filePath);
    message.success('Đã sao chép đường dẫn tệp vào bộ nhớ tạm.');
  };

  const handleOpenFolder = async () => {
    try {
      await axios.post('/api/open-folder', { folderPath: outputFolder });
    } catch {
      message.error('Không thể mở thư mục trên hệ thống.');
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_: any, __: any, index: number) => (
        <span className="font-mono text-slate-500 text-xs">{index + 1}</span>
      ),
    },
    {
      title: 'Tên Tệp Tin',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: StorageFile) => (
        <div className="flex items-center gap-2 max-w-[400px]">
          {record.type === 'video' ? (
            <span className="text-indigo-400 font-bold">🎬</span>
          ) : record.type === 'image' ? (
            <span className="text-pink-400 font-bold">🖼️</span>
          ) : record.type === 'audio' ? (
            <span className="text-purple-400 font-bold">🎵</span>
          ) : (
            <span className="text-slate-400">📄</span>
          )}
          <span className="truncate font-mono text-xs text-slate-200" title={name}>
            {name}
          </span>
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: string, record: StorageFile) => (
        <Tag
          color={type === 'video' ? 'indigo' : type === 'image' ? 'magenta' : type === 'audio' ? 'purple' : 'default'}
          className="!text-[11px] !uppercase !font-mono"
        >
          {record.ext.replace('.', '')}
        </Tag>
      ),
    },
    {
      title: 'Kích Thước',
      dataIndex: 'sizeBytes',
      key: 'sizeBytes',
      width: 120,
      render: (bytes: number) => (
        <span className="font-mono text-xs text-slate-400">{formatBytes(bytes)}</span>
      ),
    },
    {
      title: 'Thời Gian Tạo',
      dataIndex: 'mtime',
      key: 'mtime',
      width: 180,
      render: (mtime: string) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(mtime).toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      width: 140,
      render: (_: any, record: StorageFile) => (
        <Space size="small">
          <Tooltip title="Sao chép đường dẫn">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyPath(record.path)}
              className="!text-slate-400 hover:!text-indigo-400"
            />
          </Tooltip>

          <Tooltip title="Mở thư mục chứa file">
            <Button
              type="text"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={handleOpenFolder}
              className="!text-slate-400 hover:!text-amber-400"
            />
          </Tooltip>

          <Popconfirm
            title="Xóa tệp này?"
            description="Tệp sẽ bị xóa vĩnh viễn khỏi ổ cứng của bạn."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.path)}
          >
            <Tooltip title="Xóa tệp">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                className="!text-slate-500 hover:!text-rose-400"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Banner Header */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>📁 Quản Lý Tệp Tải Về & Lịch Sử Tác Vụ</span>
            <Tag color="cyan" className="!text-xs">{files.length} tệp</Tag>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Đường dẫn thư mục: <span className="font-mono text-slate-300 font-medium">{outputFolder}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="default"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={fetchFiles}
            className="!bg-slate-900 !border-slate-700 !text-slate-300 text-xs"
          >
            Làm Mới
          </Button>

          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            onClick={handleOpenFolder}
            className="!bg-indigo-600 !border-indigo-600 text-xs font-semibold"
          >
            Mở Trong File Explorer
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card className="border-slate-800">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Input
            prefix={<SearchOutlined className="text-slate-500" />}
            placeholder="Tìm kiếm tệp theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md text-xs"
            allowClear
          />
        </div>

        <Table
          dataSource={filteredFiles}
          columns={columns}
          rowKey="path"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true }}
          className="ant-table-dark"
        />
      </Card>
    </div>
  );
};
