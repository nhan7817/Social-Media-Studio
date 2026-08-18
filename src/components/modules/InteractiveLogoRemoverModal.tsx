'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Slider,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  StepBackwardOutlined,
  StepForwardOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  DragOutlined,
  EyeOutlined,
  UndoOutlined,
  LeftOutlined,
  BorderOutlined,
} from '@ant-design/icons';
import { Eraser, Scissors, ZoomIn, Sparkles, Layers } from 'lucide-react';
import { BlurZone } from '@/types';

const { Text } = Typography;

interface Props {
  visible: boolean;
  videoSrc: string;
  initialZones?: BlurZone[];
  onApply: (zones: BlurZone[]) => void;
  onCancel: () => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DragState {
  type: 'drawing' | 'moving' | 'resizing';
  zoneId?: string;
  handle?: ResizeHandle;
  startX: number;
  startY: number;
  initialZone?: BlurZone;
}

export const InteractiveLogoRemoverModal: React.FC<Props> = ({
  visible,
  videoSrc,
  initialZones = [],
  onApply,
  onCancel,
}) => {
  const [zones, setZones] = useState<BlurZone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  // Temporary drawing zone state during mouse drag
  const [drawingBox, setDrawingBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Initialize zones on open
  useEffect(() => {
    if (visible) {
      if (initialZones && initialZones.length > 0) {
        setZones(JSON.parse(JSON.stringify(initialZones)));
        setActiveZoneId(initialZones[0].id);
      } else {
        // Default initial zone at top-right
        const defaultZone: BlurZone = {
          id: `zone_${Date.now()}`,
          x: 72,
          y: 4,
          width: 24,
          height: 12,
          intensity: 16,
        };
        setZones([defaultZone]);
        setActiveZoneId(defaultZone.id);
      }
    }
  }, [visible, initialZones]);

  // Video time formatting
  const formatTime = (timeInSeconds: number) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    const ms = Math.floor((timeInSeconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  // Coordinates helper (from mouse event to percentage relative to overlay rect)
  const getRelativeCoords = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!overlayRef.current) return { xPct: 0, yPct: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    return {
      xPct: (x / rect.width) * 100,
      yPct: (y / rect.height) * 100,
    };
  }, []);

  // Mouse Down handler
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    // If clicked directly on overlay background
    if ((e.target as HTMLElement).classList.contains('canvas-background-overlay')) {
      const { xPct, yPct } = getRelativeCoords(e);
      dragStateRef.current = {
        type: 'drawing',
        startX: xPct,
        startY: yPct,
      };
      setDrawingBox({ x: xPct, y: yPct, width: 0, height: 0 });
    }
  };

  // Start moving zone
  const handleZoneMouseDown = (e: React.MouseEvent, zone: BlurZone) => {
    e.stopPropagation();
    setActiveZoneId(zone.id);
    const { xPct, yPct } = getRelativeCoords(e);
    dragStateRef.current = {
      type: 'moving',
      zoneId: zone.id,
      startX: xPct,
      startY: yPct,
      initialZone: { ...zone },
    };
  };

  // Start resizing zone
  const handleResizeMouseDown = (e: React.MouseEvent, zone: BlurZone, handle: ResizeHandle) => {
    e.stopPropagation();
    setActiveZoneId(zone.id);
    const { xPct, yPct } = getRelativeCoords(e);
    dragStateRef.current = {
      type: 'resizing',
      zoneId: zone.id,
      handle,
      startX: xPct,
      startY: yPct,
      initialZone: { ...zone },
    };
  };

  // Global mouse move & up listeners while dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const { xPct, yPct } = getRelativeCoords(e);

      if (state.type === 'drawing') {
        const x = Math.min(state.startX, xPct);
        const y = Math.min(state.startY, yPct);
        const width = Math.abs(xPct - state.startX);
        const height = Math.abs(yPct - state.startY);
        setDrawingBox({ x, y, width, height });
      } else if (state.type === 'moving' && state.zoneId && state.initialZone) {
        const dx = xPct - state.startX;
        const dy = yPct - state.startY;

        const newX = Math.max(0, Math.min(100 - state.initialZone.width, state.initialZone.x + dx));
        const newY = Math.max(0, Math.min(100 - state.initialZone.height, state.initialZone.y + dy));

        setZones((prev) =>
          prev.map((z) => (z.id === state.zoneId ? { ...z, x: newX, y: newY } : z))
        );
      } else if (state.type === 'resizing' && state.zoneId && state.initialZone && state.handle) {
        const dx = xPct - state.startX;
        const dy = yPct - state.startY;
        const init = state.initialZone;

        let newX = init.x;
        let newY = init.y;
        let newW = init.width;
        let newH = init.height;

        if (state.handle.includes('e')) {
          newW = Math.max(5, Math.min(100 - init.x, init.width + dx));
        }
        if (state.handle.includes('s')) {
          newH = Math.max(5, Math.min(100 - init.y, init.height + dy));
        }
        if (state.handle.includes('w')) {
          const maxLeft = init.x + init.width - 5;
          newX = Math.max(0, Math.min(maxLeft, init.x + dx));
          newW = init.width + (init.x - newX);
        }
        if (state.handle.includes('n')) {
          const maxTop = init.y + init.height - 5;
          newY = Math.max(0, Math.min(maxTop, init.y + dy));
          newH = init.height + (init.y - newY);
        }

        setZones((prev) =>
          prev.map((z) =>
            z.id === state.zoneId
              ? { ...z, x: newX, y: newY, width: newW, height: newH }
              : z
          )
        );
      }
    };

    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (state && state.type === 'drawing') {
        if (drawingBox && drawingBox.width > 3 && drawingBox.height > 3) {
          const newZone: BlurZone = {
            id: `zone_${Date.now()}`,
            x: drawingBox.x,
            y: drawingBox.y,
            width: drawingBox.width,
            height: drawingBox.height,
            intensity: 16,
          };
          setZones((prev) => [...prev, newZone]);
          setActiveZoneId(newZone.id);
          message.success('Đã thêm vùng xóa logo mới!');
        }
        setDrawingBox(null);
      }
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drawingBox, getRelativeCoords]);

  // Zone Operations
  const handleAddNewZone = () => {
    const newZone: BlurZone = {
      id: `zone_${Date.now()}`,
      x: 35,
      y: 35,
      width: 30,
      height: 15,
      intensity: 16,
    };
    setZones((prev) => [...prev, newZone]);
    setActiveZoneId(newZone.id);
  };

  const handleDeleteZone = (zoneId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = zones.filter((z) => z.id !== zoneId);
    setZones(updated);
    if (activeZoneId === zoneId) {
      setActiveZoneId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleClearAllZones = () => {
    setZones([]);
    setActiveZoneId(null);
  };

  const handleSaveAndApply = () => {
    if (zones.length === 0) {
      message.warning('Chưa có vùng xóa logo nào được chọn.');
    }
    onApply(zones);
  };

  const activeZone = zones.find((z) => z.id === activeZoneId);

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      footer={null}
      width="100vw"
      style={{ top: 0, padding: 0, maxWidth: '100vw' }}
      className="full-screen-editor-modal"
      wrapClassName="!p-0 !overflow-hidden"
      destroyOnClose
      closeIcon={null}
    >
      <div className="h-screen w-screen bg-[#070b13] flex flex-col select-none text-slate-100 overflow-hidden font-sans">
        {/* TOP BAR */}
        <div className="h-14 px-6 bg-[#0c1222]/90 border-b border-slate-800/80 flex items-center justify-between z-20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-800"
            >
              <LeftOutlined className="text-xs" />
              <span>Xóa logo</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-700" />
            <div className="flex items-center gap-2">
              <Eraser className="w-4 h-4 text-pink-400" />
              <span className="text-xs text-slate-400 font-medium">
                Studio Tương Tác Xóa Vùng Logo / Watermark
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="default"
              onClick={onCancel}
              className="!bg-slate-800/80 !border-slate-700 !text-slate-300 hover:!text-white rounded-xl text-xs px-4"
            >
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleSaveAndApply}
              className="!bg-yellow-400 hover:!bg-yellow-300 !text-slate-950 font-bold border-0 shadow-lg shadow-yellow-400/20 rounded-xl text-xs px-5"
            >
              Áp dụng
            </Button>
          </div>
        </div>

        {/* MAIN BODY: SIDEBAR + CENTER CANVAS */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* LEFT SIDEBAR CONTROLS */}
          <div className="w-80 bg-[#090d16]/95 border-r border-slate-800/80 flex flex-col justify-between p-4 z-20 overflow-y-auto">
            <div className="space-y-4">
              {/* Tool Selector Card (matching screenshot) */}
              <div
                onClick={handleAddNewZone}
                className="bg-[#121927] hover:bg-[#182236] border border-yellow-500/30 hover:border-yellow-400/80 rounded-2xl p-5 cursor-pointer transition-all flex flex-col items-center text-center group shadow-md"
              >
                <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <div className="relative">
                    <BorderOutlined className="text-2xl text-yellow-400 font-bold" />
                    <PlusOutlined className="text-xs text-yellow-300 absolute inset-0 m-auto" />
                  </div>
                </div>
                <h4 className="text-xs font-bold text-slate-200 mb-1">
                  Chọn vùng cần loại bỏ
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Bấm để thêm hoặc dùng chuột kéo vẽ một/nhiều vùng bạn muốn xóa khỏi video.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="default"
                  onClick={onCancel}
                  className="!bg-slate-900 !border-slate-800 !text-slate-300 rounded-xl text-xs h-9"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleSaveAndApply}
                  className="!bg-yellow-400 hover:!bg-yellow-300 !text-slate-950 font-bold rounded-xl text-xs h-9 border-0"
                >
                  Áp dụng
                </Button>
              </div>

              {/* Zones List */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Danh Sách Vùng Xóa ({zones.length})
                    </span>
                  </div>
                  {zones.length > 0 && (
                    <button
                      onClick={handleClearAllZones}
                      className="text-[11px] text-red-400 hover:text-red-300 hover:underline"
                    >
                      Xóa hết
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {zones.map((zone, idx) => {
                    const isSelected = zone.id === activeZoneId;
                    return (
                      <div
                        key={zone.id}
                        onClick={() => setActiveZoneId(zone.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-yellow-400/10 border-yellow-400 text-yellow-300'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-semibold block">Vùng Xóa #{idx + 1}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              X: {Math.round(zone.x)}% | Y: {Math.round(zone.y)}% | {Math.round(zone.width)}x{Math.round(zone.height)}%
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteZone(zone.id, e)}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <DeleteOutlined className="text-xs" />
                        </button>
                      </div>
                    );
                  })}

                  {zones.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                      <p className="text-xs text-slate-500">Chưa có vùng xóa nào.</p>
                      <button
                        onClick={handleAddNewZone}
                        className="mt-2 text-xs text-pink-400 font-semibold hover:underline"
                      >
                        + Thêm vùng ngay
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Zone Settings */}
              {activeZone && (
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Tùy chỉnh vùng đang chọn
                    </span>
                    <Tag color="gold" className="!text-[10px] m-0 font-mono font-bold">
                      {Math.round(activeZone.width)}% x {Math.round(activeZone.height)}%
                    </Tag>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Độ mờ (Blur Intensity)</span>
                      <span className="text-yellow-400 font-mono font-bold">{activeZone.intensity || 16}px</span>
                    </div>
                    <Slider
                      min={5}
                      max={40}
                      value={activeZone.intensity || 16}
                      onChange={(val) => {
                        setZones((prev) =>
                          prev.map((z) => (z.id === activeZone.id ? { ...z, intensity: val } : z))
                        );
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hint at bottom of sidebar */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">💡 Hướng dẫn thao tác:</p>
              <p>• Kéo thả chuột trực tiếp trên khung video để vẽ vùng mới.</p>
              <p>• Kéo 8 điểm nút màu vàng ở viền để đổi kích thước.</p>
              <p>• Kéo giữa khung để di chuyển vị trí.</p>
            </div>
          </div>

          {/* CENTER CANVAS & VIDEO PLAYER */}
          <div className="flex-1 bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Video + Interactive Overlay Box */}
            <div className="relative inline-flex max-w-full max-h-[75vh] items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-slate-800/50">
              <video
                ref={videoRef}
                src={videoSrc}
                playsInline
                className="max-h-[75vh] max-w-full object-contain pointer-events-none"
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) setDuration(videoRef.current.duration);
                }}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Interactive Bounding Box Overlay (Matches exact video size) */}
              <div
                ref={overlayRef}
                onMouseDown={handleOverlayMouseDown}
                className="canvas-background-overlay absolute inset-0 cursor-crosshair z-10 select-none"
              >
                {/* Render All Existing Zones */}
                {zones.map((zone, idx) => {
                  const isSelected = zone.id === activeZoneId;
                  return (
                    <div
                      key={zone.id}
                      onMouseDown={(e) => handleZoneMouseDown(e, zone)}
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                      }}
                      className={`absolute rounded cursor-move transition-shadow ${
                        isSelected
                          ? 'border-2 border-dashed border-yellow-400 bg-yellow-400/5 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20'
                          : 'border-2 border-dashed border-yellow-500/70 bg-black/20 hover:border-yellow-400 z-10'
                      }`}
                    >
                      {/* Real-time Backdrop Blur inside the box */}
                      <div
                        className="w-full h-full rounded pointer-events-none"
                        style={{
                          backdropFilter: `blur(${zone.intensity || 16}px)`,
                          WebkitBackdropFilter: `blur(${zone.intensity || 16}px)`,
                        }}
                      />

                      {/* Badge / Index label */}
                      <div className="absolute top-1 left-1 bg-yellow-400 text-slate-950 font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow flex items-center gap-1 pointer-events-none">
                        <span>#{idx + 1}</span>
                      </div>

                      {/* Delete Quick Button on Active Box */}
                      {isSelected && (
                        <button
                          onClick={(e) => handleDeleteZone(zone.id, e)}
                          className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg border border-white text-xs cursor-pointer z-30"
                          title="Xóa vùng này"
                        >
                          ✕
                        </button>
                      )}

                      {/* Resize Handles (Only for selected box) */}
                      {isSelected && (
                        <>
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 'nw')}
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-nw-resize z-30"
                          />
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 'ne')}
                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-ne-resize z-30"
                          />
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 'sw')}
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-sw-resize z-30"
                          />
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 'se')}
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-se-resize z-30"
                          />
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 'n')}
                            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-n-resize z-30"
                          />
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 's')}
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-s-resize z-30"
                          />
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 'w')}
                            className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-w-resize z-30"
                          />
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, zone, 'e')}
                            className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-yellow-400 border border-black rounded-sm cursor-e-resize z-30"
                          />
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Drawing Box Preview during mouse drag */}
                {drawingBox && (
                  <div
                    style={{
                      left: `${drawingBox.x}%`,
                      top: `${drawingBox.y}%`,
                      width: `${drawingBox.width}%`,
                      height: `${drawingBox.height}%`,
                    }}
                    className="absolute border-2 border-dashed border-yellow-300 bg-yellow-400/20 rounded pointer-events-none z-30"
                  >
                    <div
                      className="w-full h-full"
                      style={{
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM VIDEO TIMELINE CONTROLS */}
        <div className="h-16 bg-[#0c1222]/95 border-t border-slate-800/80 px-8 flex items-center justify-between z-20 backdrop-blur-md">
          {/* Left Buttons: Scissors / Reset */}
          <div className="flex items-center gap-3">
            <Tooltip title="Tua về đầu">
              <button
                onClick={() => handleSeek(0)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <StepBackwardOutlined className="text-base" />
              </button>
            </Tooltip>
          </div>

          {/* Center Playback Controls & Timeline */}
          <div className="flex items-center gap-6 flex-1 max-w-3xl px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSkip(-5)}
                className="text-xs text-slate-400 hover:text-white p-1 font-mono font-semibold"
                title="Tua lùi 5 giây"
              >
                -5s
              </button>
              <button
                onClick={handleTogglePlay}
                className="w-10 h-10 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 flex items-center justify-center transition-transform hover:scale-105 shadow-md shadow-yellow-400/20"
              >
                {isPlaying ? (
                  <PauseCircleFilled className="text-2xl" />
                ) : (
                  <PlayCircleFilled className="text-2xl" />
                )}
              </button>
              <button
                onClick={() => handleSkip(5)}
                className="text-xs text-slate-400 hover:text-white p-1 font-mono font-semibold"
                title="Tua tới 5 giây"
              >
                +5s
              </button>
            </div>

            {/* Timestamp */}
            <div className="font-mono text-xs text-slate-300 whitespace-nowrap">
              <span className="text-yellow-400 font-bold">{formatTime(currentTime)}</span>
              <span className="text-slate-600 mx-1">/</span>
              <span className="text-slate-400">{formatTime(duration)}</span>
            </div>

            {/* Seek Bar */}
            <div className="flex-1">
              <Slider
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(val) => handleSeek(val as number)}
                tooltip={{ formatter: (v) => formatTime(v as number) }}
                className="m-0"
              />
            </div>
          </div>

          {/* Right Info */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Tag color="gold" className="m-0 font-bold text-slate-950">
              {zones.length} Vùng Xóa
            </Tag>
          </div>
        </div>
      </div>
    </Modal>
  );
};
