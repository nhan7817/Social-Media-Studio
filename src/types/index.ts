export type SupportedPlatform =
  | 'auto'
  | 'youtube'
  | 'tiktok'
  | 'douyin'
  | 'instagram'
  | 'threads'
  | 'facebook'
  | 'other';

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type BlurPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'tiktok-bounce';

export type LogoRemovalMethod = 'delogo' | 'blur' | 'pixelate';

export interface BlurZone {
  id: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
  intensity?: number;
  method?: LogoRemovalMethod;
  band?: number; // Delogo edge blending band thickness
}

export interface BlurConfig {
  enabled: boolean;
  position?: BlurPosition;
  widthPercent?: number;
  heightPercent?: number;
  blurIntensity?: number;
  defaultMethod?: LogoRemovalMethod;
  zones?: BlurZone[];
}

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';
export type OutputAspectRatio = 'original' | '9:16' | '16:9' | '1:1' | '4:5';

export type WatermarkType = 'text' | 'image' | 'none';

export type WatermarkAnimation =
  | 'none'          // Cố định tĩnh
  | 'corner-hop'    // Nhảy 4 góc theo chu kỳ (mỗi 4s đổi góc)
  | 'floating'      // Trôi dạt / Lơ lửng nảy nhẹ (Sine wave)
  | 'marquee-left'  // Chạy chữ ngang từ phải sang trái
  | 'fade-pulse';   // Nhấp nháy / Ẩn hiện theo nhịp

export interface WatermarkConfig {
  enabled: boolean;
  type: WatermarkType;
  // Text options
  text: string;
  fontSize: number; // in px
  fontColor: string; // hex
  fontFamily: string;
  // Image/Logo options
  imagePath?: string; // base64 or temp file path
  imageScale: number; // percentage of main media (e.g. 15 for 15%)
  // General options
  position: WatermarkPosition;
  opacity: number; // 0 to 100
  margin: number; // in px
  outputAspectRatio?: OutputAspectRatio; // 'original' | '9:16' | '16:9' | '1:1' | '4:5'
  // Dynamic Animation options
  animation?: WatermarkAnimation;
  animationSpeed?: number; // Speed multiplier (default 1)
  // Blur options
  blurConfig?: BlurConfig;
}

export type TaskStatus =
  | 'pending'
  | 'downloading'
  | 'watermarking'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface MediaItemResult {
  filePath: string;
  fileName: string;
  type: 'video' | 'image';
  sizeBytes?: number;
}

export interface DownloadTaskItem {
  id: string;
  url: string;
  platform: SupportedPlatform;
  detectedPlatform: SupportedPlatform;
  status: TaskStatus;
  progress: number; // 0 to 100
  statusMessage?: string;
  error?: string;
  resultFiles?: MediaItemResult[];
  startedAt?: number;
  completedAt?: number;
}

export interface BatchJobConfig {
  tasks: Array<{
    id: string;
    url: string;
    platform: SupportedPlatform;
  }>;
  outputDirectory: string;
  watermark: WatermarkConfig;
}

export interface FailedLinkRecord {
  id: string;
  url: string;
  platform: SupportedPlatform;
  error: string;
  failedAt: string;
}

export interface ProgressEventPayload {
  jobId: string;
  currentTaskIndex: number;
  totalTasks: number;
  task: DownloadTaskItem;
  overallProgress: number;
  failedLinks: FailedLinkRecord[];
  isDone: boolean;
}
