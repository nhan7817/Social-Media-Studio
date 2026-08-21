'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  DownloadTaskItem,
  FailedLinkRecord,
  ProgressEventPayload,
  SupportedPlatform,
  WatermarkConfig,
} from '@/types';
import { AntdAppLayout, ActiveModuleKey } from '@/components/layout/AntdAppLayout';
import { LinkInputSection } from '@/components/LinkInputSection';
import { StorageFolderPicker } from '@/components/StorageFolderPicker';
import { WatermarkSettings } from '@/components/WatermarkSettings';
import { QueueProgressTable } from '@/components/QueueProgressTable';
import { FailedLinksModal } from '@/components/FailedLinksModal';
import { AudioExtractorTab } from '@/components/modules/AudioExtractorTab';
import { AspectConverterTab } from '@/components/modules/AspectConverterTab';
import { VideoEditorTab } from '@/components/modules/VideoEditorTab';
import { VideoTrimMergeTab } from '@/components/modules/VideoTrimMergeTab';
import { HistoryManagerTab } from '@/components/modules/HistoryManagerTab';
import { SettingsTab } from '@/components/modules/SettingsTab';
import { Layers, ShieldCheck, Zap } from 'lucide-react';
import axios from 'axios';

const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: true,
  type: 'text',
  text: '@MyBrand',
  fontSize: 32,
  fontColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  imagePath: '',
  imageScale: 15,
  position: 'bottom-right',
  animation: 'none',
  animationSpeed: 1,
  opacity: 85,
  margin: 24,
  outputAspectRatio: 'original',
};

import { openNativeFolderDialog } from '@/lib/utils/folder-dialog';
import { message } from 'antd';

const VALID_MODULES: ActiveModuleKey[] = ['downloader', 'trim-merge', 'editor', 'audio', 'aspect', 'storage', 'settings'];

export default function Home() {
  const [activeModule, setActiveModuleState] = useState<ActiveModuleKey>('downloader');
  const [rawLinks, setRawLinks] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<SupportedPlatform>('auto');
  const [outputFolder, setOutputFolderState] = useState<string>('');
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK);

  const setOutputFolder = (folder: string) => {
    setOutputFolderState(folder);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('social_studio_storage_folder', folder);
      } catch {}
    }
  };

  // Sync module change to URL and LocalStorage
  const setActiveModule = (key: ActiveModuleKey) => {
    setActiveModuleState(key);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('social_studio_active_tab', key);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', key);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  };

  // Restore active module and saved storage folder on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // 1. Restore Tab
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab') as ActiveModuleKey | null;
        const savedTab = localStorage.getItem('social_studio_active_tab') as ActiveModuleKey | null;

        const targetTab = (tabParam && VALID_MODULES.includes(tabParam))
          ? tabParam
          : (savedTab && VALID_MODULES.includes(savedTab))
            ? savedTab
            : 'downloader';

        setActiveModuleState(targetTab);

        const url = new URL(window.location.href);
        if (url.searchParams.get('tab') !== targetTab) {
          url.searchParams.set('tab', targetTab);
          window.history.replaceState({}, '', url.toString());
        }

        // 2. Restore Output Folder from user's previous selection
        const savedFolder = localStorage.getItem('social_studio_storage_folder');
        if (savedFolder) {
          setOutputFolderState(savedFolder);
        }
      } catch {}
    }
  }, []);

  // Job Progress State
  const [jobId, setJobId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DownloadTaskItem[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [failedLinks, setFailedLinks] = useState<FailedLinkRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [isFailedModalOpen, setIsFailedModalOpen] = useState<boolean>(false);

  const isCancelledRef = useRef<boolean>(false);
  const cancelledTaskIdsRef = useRef<Set<string>>(new Set());

  const handleStartDownload = async () => {
    const urls = rawLinks
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (urls.length === 0) return;

    // Prompt user to select storage folder if not chosen yet
    let targetDirectory = outputFolder;
    if (!targetDirectory) {
      message.info('Vui lòng chọn thư mục lưu trữ trên máy tính của bạn trước khi bắt đầu.');
      const picked = await openNativeFolderDialog();
      if (!picked) {
        message.warning('Bạn chưa chọn thư mục lưu trữ để bắt đầu.');
        return;
      }
      targetDirectory = picked;
      setOutputFolder(picked);
    }

    isCancelledRef.current = false;
    cancelledTaskIdsRef.current = new Set();
    setIsProcessing(true);
    setIsDone(false);
    setFailedLinks([]);
    setOverallProgress(0);
    setCurrentTaskIndex(0);

    const initialTasks: DownloadTaskItem[] = urls.map((url, i) => ({
      id: `task_${Date.now()}_${i}`,
      url,
      platform: selectedPlatform,
      detectedPlatform: selectedPlatform,
      status: 'pending',
      progress: 0,
      statusMessage: 'Chờ chạy',
    }));
    setTasks(initialTasks);

    const failedArr: FailedLinkRecord[] = [];

    // Process tasks sequentially (Works 100% on both Vercel Serverless and Localhost)
    for (let i = 0; i < initialTasks.length; i++) {
      if (isCancelledRef.current) {
        break;
      }

      setCurrentTaskIndex(i);
      const currentTask = initialTasks[i];

      if (cancelledTaskIdsRef.current.has(currentTask.id)) {
        setTasks((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'cancelled', statusMessage: 'Đã hủy' };
          return next;
        });
        continue;
      }

      // Update status to downloading
      setTasks((prev) => {
        const next = [...prev];
        next[i] = {
          ...next[i],
          status: 'downloading',
          statusMessage: 'Đang kết nối & tải video...',
          progress: 30,
          startedAt: Date.now(),
        };
        return next;
      });

      try {
        const res = await axios.post('/api/download/process-item', {
          task: currentTask,
          outputDirectory: targetDirectory,
          watermark: watermarkConfig,
        });

        if (res.data?.success && res.data?.task) {
          const finishedTask = res.data.task;
          setTasks((prev) => {
            const next = [...prev];
            next[i] = finishedTask;
            return next;
          });
        } else {
          throw new Error(res.data?.error || 'Lỗi không xác định.');
        }
      } catch (err: any) {
        const errorMsg = err.response?.data?.error || err.message || 'Lỗi xử lý video';
        setTasks((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'failed',
            statusMessage: errorMsg,
            error: errorMsg,
          };
          return next;
        });

        const record: FailedLinkRecord = {
          id: currentTask.id,
          url: currentTask.url,
          platform: currentTask.platform,
          error: errorMsg,
          failedAt: new Date().toLocaleTimeString(),
        };
        failedArr.push(record);
        setFailedLinks([...failedArr]);
      }

      const completedCount = i + 1;
      setOverallProgress(Math.round((completedCount / initialTasks.length) * 100));
    }

    setIsProcessing(false);
    setIsDone(true);
    message.success('Đã xử lý xong danh sách video!');
  };

  const handleRetryFailed = (failedUrls: string[]) => {
    setRawLinks(failedUrls.join('\n'));
    setTimeout(() => {
      handleStartDownload();
    }, 100);
  };

  const handleCancelAll = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
    setIsDone(true);
    setTasks((prev) =>
      prev.map((t) =>
        t.status === 'pending' || t.status === 'downloading' || t.status === 'watermarking'
          ? { ...t, status: 'cancelled', statusMessage: 'Đã dừng' }
          : t
      )
    );
    message.info('Đã dừng tiến trình tải.');
  };

  const handleCancelTask = (taskId: string) => {
    cancelledTaskIdsRef.current.add(taskId);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'cancelled', statusMessage: 'Đã dừng' } : t
      )
    );
  };

  const handleOpenFolder = async () => {
    if (!outputFolder) {
      const picked = await openNativeFolderDialog();
      if (picked) {
        setOutputFolder(picked);
      }
      return;
    }
    try {
      const res = await axios.post('/api/open-folder', { folderPath: outputFolder });
      if (res.data?.success) return;
    } catch {
      setActiveModule('storage');
    }
  };

  const runningCount = tasks.filter((t) => t.status === 'downloading' || t.status === 'watermarking' || t.status === 'pending').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <AntdAppLayout
      activeKey={activeModule}
      onSelectKey={setActiveModule}
      outputFolder={outputFolder || 'Chưa chọn thư mục (Bấm để chọn)'}
      onOpenFolder={handleOpenFolder}
      runningTasksCount={isProcessing ? runningCount : 0}
      completedTasksCount={completedCount}
    >
      {/* Module 1: Core Downloader & Watermarker */}
      {activeModule === 'downloader' && (
        <div className="space-y-8 pb-12">
          {/* Top Banner Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card-subtle rounded-xl p-4 flex items-center gap-3 border border-slate-800">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Xử lý Hàng loạt Tuần tự</h4>
                <p className="text-[11px] text-slate-400">Tải tuần tự từng video tránh nghẽn mạng & rate-limit</p>
              </div>
            </div>

            <div className="glass-card-subtle rounded-xl p-4 flex items-center gap-3 border border-slate-800">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Bảo vệ Lỗi & Lưu Link Hỏng</h4>
                <p className="text-[11px] text-slate-400">Gặp link lỗi tự lưu lại và tiếp tục chạy không gián đoạn</p>
              </div>
            </div>

            <div className="glass-card-subtle rounded-xl p-4 flex items-center gap-3 border border-slate-800">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Tự động Đóng Dấu Bản Quyền</h4>
                <p className="text-[11px] text-slate-400">Gắn Text / Logo PNG vào Video & Ảnh bằng FFmpeg</p>
              </div>
            </div>
          </div>

          {/* Main Grid: Inputs and Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Link Input & Storage */}
            <div className="lg:col-span-6 space-y-6">
              <LinkInputSection
                rawLinks={rawLinks}
                selectedPlatform={selectedPlatform}
                isProcessing={isProcessing}
                onLinksChange={setRawLinks}
                onPlatformChange={setSelectedPlatform}
                onSubmit={handleStartDownload}
              />

              <StorageFolderPicker
                folderPath={outputFolder}
                onChange={setOutputFolder}
              />
            </div>

            {/* Right Column: Watermark Settings */}
            <div className="lg:col-span-6">
              <WatermarkSettings
                config={watermarkConfig}
                onChange={setWatermarkConfig}
              />
            </div>
          </div>

          {/* Bottom Section: Real-time Queue Progress Table */}
          <QueueProgressTable
            tasks={tasks}
            currentTaskIndex={currentTaskIndex}
            overallProgress={overallProgress}
            failedLinks={failedLinks}
            isDone={isDone}
            onOpenFailedModal={() => setIsFailedModalOpen(true)}
            onCancelAll={handleCancelAll}
            onCancelTask={handleCancelTask}
          />

          {/* Failed Links Detail & Retry Modal */}
          <FailedLinksModal
            isOpen={isFailedModalOpen}
            failedLinks={failedLinks}
            onClose={() => setIsFailedModalOpen(false)}
            onRetryFailed={handleRetryFailed}
          />
        </div>
      )}

      {/* Module 2: Video Trim & Merge Studio */}
      {activeModule === 'trim-merge' && (
        <VideoTrimMergeTab outputFolder={outputFolder} />
      )}

      {/* Module 3: Video Editor & Logo Blur Studio */}
      {activeModule === 'editor' && (
        <VideoEditorTab outputFolder={outputFolder} />
      )}

      {/* Module 3: Audio Extractor */}
      {activeModule === 'audio' && (
        <AudioExtractorTab outputFolder={outputFolder} />
      )}

      {/* Module 3: Aspect Ratio Converter */}
      {activeModule === 'aspect' && (
        <AspectConverterTab outputFolder={outputFolder} />
      )}

      {/* Module 4: History & Storage Manager */}
      {activeModule === 'storage' && (
        <HistoryManagerTab outputFolder={outputFolder} />
      )}

      {/* Module 5: Settings & Engine Status */}
      {activeModule === 'settings' && (
        <SettingsTab
          outputFolder={outputFolder}
          onOutputFolderChange={setOutputFolder}
        />
      )}
    </AntdAppLayout>
  );
}
