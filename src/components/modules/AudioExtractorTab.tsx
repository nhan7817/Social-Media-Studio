'use client';

import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Radio,
  message,
  Typography,
  Space,
  Tag,
  List,
} from 'antd';
import {
  CustomerServiceOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import axios from 'axios';

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

interface Props {
  outputFolder: string;
}

interface ExtractedAudioItem {
  id: string;
  url: string;
  fileName: string;
  filePath: string;
  format: string;
  extractedAt: string;
}

export const AudioExtractorTab: React.FC<Props> = ({ outputFolder }) => {
  const [links, setLinks] = useState('');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [isExtracting, setIsExtracting] = useState(false);
  const [results, setResults] = useState<ExtractedAudioItem[]>([]);

  const handleExtract = async () => {
    const rawList = links
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http'));

    if (rawList.length === 0) {
      message.warning('Vui lòng nhập ít nhất 1 đường link video YouTube / TikTok / Facebook / Threads.');
      return;
    }

    setIsExtracting(true);
    message.loading({ content: `Đang trích xuất ${rawList.length} âm thanh...`, key: 'extract_msg' });

    const newResults: ExtractedAudioItem[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const url = rawList[i];
      try {
        const res = await axios.post('/api/audio/extract', {
          url,
          outputFormat: audioFormat,
          outputFolder,
        });

        if (res.data?.success && res.data?.file) {
          newResults.push({
            id: String(Date.now() + i),
            url,
            fileName: res.data.file.fileName,
            filePath: res.data.file.filePath,
            format: audioFormat.toUpperCase(),
            extractedAt: new Date().toLocaleTimeString(),
          });
        }
      } catch (err: any) {
        message.error(`Lỗi trích xuất link ${i + 1}: ${err.response?.data?.error || err.message}`);
      }
    }

    setResults((prev) => [...newResults, ...prev]);
    setIsExtracting(false);
    message.success({ content: `Hoàn tất trích xuất ${newResults.length} tệp âm thanh!`, key: 'extract_msg' });
  };

  const handleOpenFolder = async () => {
    try {
      await axios.post('/api/open-folder', { folderPath: outputFolder });
    } catch {
      message.error('Không thể mở thư mục trên hệ thống.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Feature Banner */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CustomerServiceOutlined className="text-2xl text-purple-400" />
            <h3 className="text-lg font-bold text-slate-100">
              Bộ Trích Xuất Âm Thanh MP3 / M4A Chất Lượng Cao
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tách âm thanh, nhạc nền, podcast từ YouTube, TikTok, Facebook, Threads thành tệp MP3 (320kbps) hoặc M4A nguyên bản không bị suy giảm chất lượng.
          </p>
        </div>

        <Button
          type="default"
          icon={<FolderOpenOutlined />}
          onClick={handleOpenFolder}
          className="!bg-slate-900 !border-slate-700 !text-slate-300 text-xs"
        >
          Mở Thư Mục Âm Thanh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form */}
        <div className="lg:col-span-7 space-y-5">
          <Card title="1. Dán liên kết Video cần tách nhạc" className="border-slate-800">
            <TextArea
              rows={6}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="Dán mỗi đường link trên một dòng (Ví dụ: https://www.youtube.com/watch?v=... hoặc link TikTok, Facebook)"
              className="!bg-[#070b14] !border-slate-800 text-xs font-mono"
            />

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800/80 pt-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1 font-medium">
                  Định dạng âm thanh đầu ra:
                </span>
                <Radio.Group
                  value={audioFormat}
                  onChange={(e) => setAudioFormat(e.target.value)}
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="mp3">MP3 (320 kbps)</Radio.Button>
                  <Radio.Button value="m4a">M4A (AAC)</Radio.Button>
                  <Radio.Button value="wav">WAV (Lossless)</Radio.Button>
                </Radio.Group>
              </div>

              <Button
                type="primary"
                icon={isExtracting ? <LoadingOutlined /> : <DownloadOutlined />}
                loading={isExtracting}
                onClick={handleExtract}
                className="!bg-gradient-to-r !from-purple-600 !to-indigo-600 !border-0 font-semibold px-6 shadow-lg shadow-purple-500/25"
              >
                Trích Xuất Âm Thanh
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Output & History */}
        <div className="lg:col-span-5">
          <Card
            title={`2. Danh sách tệp âm thanh đã trích xuất (${results.length})`}
            className="border-slate-800 h-full"
          >
            {results.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Chưa có tệp âm thanh nào được trích xuất trong phiên này.
              </div>
            ) : (
              <List
                dataSource={results}
                renderItem={(item) => (
                  <List.Item className="!border-b !border-slate-800/60 !py-3">
                    <div className="w-full flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 truncate">
                        <CustomerServiceOutlined className="text-purple-400 text-base shrink-0" />
                        <div className="truncate">
                          <p className="text-xs text-slate-200 font-medium truncate" title={item.fileName}>
                            {item.fileName}
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.extractedAt} • <Tag color="purple" className="!text-[10px] !px-1">{item.format}</Tag>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`/api/storage/download?path=${encodeURIComponent(item.filePath)}`}
                          download={item.fileName}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all hover:scale-105"
                          title="Tải tệp âm thanh này về máy"
                        >
                          <DownloadOutlined />
                          <span>Tải về</span>
                        </a>

                        <Button
                          type="text"
                          size="small"
                          icon={<FolderOpenOutlined />}
                          onClick={handleOpenFolder}
                          className="!text-slate-500 hover:!text-purple-400 text-xs"
                          title="Vị trí file trên Server"
                        />
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
