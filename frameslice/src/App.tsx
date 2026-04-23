/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Play, 
  Download, 
  Trash2, 
  ChevronRight, 
  Camera, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

interface CapturedFrame {
  id: string;
  dataUrl: string;
  timestamp: number;
  frameIndex: number;
}

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const [fps, setFps] = useState(30);
  const [activeTab, setActiveTab] = useState<'monitor' | 'history'>('monitor');
  
  // Settings
  const [config, setConfig] = useState({
    imagesPerBlock: 1,
    frameBlockSize: 30,
  });

  const [totalEstimated, setTotalEstimated] = useState(0);

  useEffect(() => {
    if (videoRef.current?.duration) {
      const frames = calculateFramesToCapture(videoRef.current.duration, fps);
      setTotalEstimated(frames.length);
    }
  }, [config, fps, videoUrl]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCapturedFrames([]);
      setProgress(0);
    }
  };

  const calculateFramesToCapture = (duration: number, videoFps: number) => {
    const totalFrames = Math.floor(duration * videoFps);
    const framesToCapture: number[] = [];
    
    for (let blockStart = 0; blockStart < totalFrames; blockStart += config.frameBlockSize) {
      for (let i = 0; i < config.imagesPerBlock; i++) {
        const offset = Math.floor((i / config.imagesPerBlock) * config.frameBlockSize);
        const targetFrame = blockStart + offset;
        if (targetFrame < totalFrames) {
          framesToCapture.push(targetFrame);
        }
      }
    }
    return framesToCapture;
  };

  const processVideo = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    setProgress(0);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const duration = video.duration;
    const framesToCapture = calculateFramesToCapture(duration, fps);
    const newFrames: CapturedFrame[] = [];

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    for (let i = 0; i < framesToCapture.length; i++) {
      const frameIdx = framesToCapture[i];
      const timestamp = frameIdx / fps;
      
      // Seek
      video.currentTime = timestamp;
      
      // Wait for seek to complete
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      // Capture
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      newFrames.push({
        id: crypto.randomUUID(),
        dataUrl,
        timestamp,
        frameIndex: frameIdx
      });

      setProgress(Math.round(((i + 1) / framesToCapture.length) * 100));
    }

    setCapturedFrames(newFrames);
    setIsProcessing(false);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    capturedFrames.forEach((frame, index) => {
      const base64Data = frame.dataUrl.split(',')[1];
      zip.file(`frame_${index.toString().padStart(4, '0')}_${frame.frameIndex}.jpg`, base64Data, { base64: true });
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sliced_frames.zip';
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-zinc-300 font-sans flex overflow-hidden selection:bg-amber-200 selection:text-black">
      {/* Left Sidebar: Configuration */}
      <aside className="w-80 border-r border-zinc-800 flex flex-col p-8 bg-[#0d0d0d] shrink-0">
        <div className="mb-10">
          <h1 className="text-2xl font-serif italic text-amber-200 tracking-wide">Vignette</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">Precision Slice Engine</p>
        </div>

        <nav className="flex-1 space-y-10 overflow-y-auto no-scrollbar">
          {/* Video Info Section */}
          <section>
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-4">Active Media</h3>
            {!videoUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border border-dashed border-zinc-800 rounded-lg hover:border-amber-200/50 cursor-pointer transition-colors bg-zinc-900/30 group">
                <Upload className="w-6 h-6 mb-2 text-zinc-600 group-hover:text-amber-200 transition-colors" />
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Import Media</span>
                <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 relative group">
                <div className="text-xs text-zinc-300 truncate font-mono">{videoFile?.name}</div>
                <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-tighter">
                  {fps} FPS • {videoFile ? (videoFile.size / (1024 * 1024)).toFixed(2) : 0} MB • {videoRef.current ? formatTime(videoRef.current.duration) : '00:00'}
                </div>
                <button 
                  onClick={() => {
                    setVideoUrl('');
                    setCapturedFrames([]);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-900/20 text-red-400 rounded-md hover:bg-red-900/40"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </section>

          {/* Slicing Logic Section */}
          <section className="space-y-6">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest leading-none">Extraction Parameters</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase text-zinc-500 mb-2 tracking-widest">Images per Batch</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="1"
                    value={config.imagesPerBlock}
                    onChange={(e) => setConfig(prev => ({ ...prev, imagesPerBlock: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="bg-transparent border-b border-zinc-700 focus:border-amber-200 outline-none w-full py-1 text-xl font-serif text-amber-200"
                  />
                  <span className="text-[10px] text-zinc-600 uppercase italic">shots</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-zinc-500 mb-2 tracking-widest">Frame Interval</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="1"
                    value={config.frameBlockSize}
                    onChange={(e) => setConfig(prev => ({ ...prev, frameBlockSize: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="bg-transparent border-b border-zinc-700 focus:border-amber-200 outline-none w-full py-1 text-xl font-serif text-amber-200"
                  />
                  <span className="text-[10px] text-zinc-600 uppercase italic">frames</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-zinc-500 mb-3 tracking-widest">FPS Frequency</label>
                <div className="grid grid-cols-4 gap-1">
                  {[24, 30, 60, 120].map(val => (
                    <button 
                      key={val}
                      onClick={() => setFps(val)}
                      className={`py-1 text-[9px] font-bold border transition-colors ${fps === val ? 'bg-amber-200 text-black border-amber-200' : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800/50'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Summary Info */}
          <section className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500">
              <span>Estimated Output</span>
              <span className="text-zinc-200 font-mono">{totalEstimated || 0} Files</span>
            </div>
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 mt-2">
              <span>Payload Req.</span>
              <span className="text-zinc-200 font-mono">~{((totalEstimated || 0) * 0.15).toFixed(1)} MB</span>
            </div>
          </section>
        </nav>

        <button 
          disabled={!videoUrl || isProcessing}
          onClick={processVideo}
          className={`w-full py-4 uppercase tracking-[0.3em] text-[10px] font-bold transition-all mt-8 border ${
            !videoUrl || isProcessing 
            ? 'bg-zinc-900 text-zinc-700 border-zinc-800 cursor-not-allowed' 
            : 'bg-amber-900/10 border-amber-900/50 text-amber-200 hover:bg-amber-900/30 active:scale-[0.98]'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Settings size={12} />
              </motion.div>
              <span>Slicing ({progress}%)</span>
            </div>
          ) : (
            'Initialize Slice'
          )}
        </button>
      </aside>

      {/* Main Content: Preview and History */}
      <main className="flex-1 flex flex-col bg-[#0a0a0a]">
        {/* Header Bar */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-[#0d0d0d] shrink-0">
          <div className="flex gap-8 text-[10px] uppercase tracking-[0.2em] font-medium h-full items-center">
            <button 
              onClick={() => setActiveTab('monitor')}
              className={`h-full px-2 mt-[2px] transition-all ${activeTab === 'monitor' ? 'text-amber-200 border-b-2 border-amber-200' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Monitor
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`h-full px-2 mt-[2px] transition-all ${activeTab === 'history' ? 'text-amber-200 border-b-2 border-amber-200' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              History
            </button>
            <button className="text-zinc-600 cursor-not-allowed">Archive</button>
          </div>
          <div className="flex items-center gap-6">
            {capturedFrames.length > 0 && (
              <button 
                onClick={downloadAll}
                className="flex items-center gap-2 px-4 py-2 bg-amber-200 text-black text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-colors"
              >
                <Download size={14} />
                <span>Download All ({capturedFrames.length})</span>
              </button>
            )}
            <div className="flex items-center gap-3 border-l border-zinc-800 pl-6">
              <div className={`w-1.5 h-1.5 rounded-full ${videoUrl ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-zinc-800'}`}></div>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500">Engine: {isProcessing ? 'Busy' : 'Ready'}</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 relative">
          {activeTab === 'monitor' ? (
            <div className="h-full flex flex-col p-8 lg:p-12 gap-8 overflow-hidden">
              <div className="relative flex-1 bg-black rounded-sm border border-zinc-800 shadow-2xl flex items-center justify-center overflow-hidden group">
                {!videoUrl ? (
                  <div className="flex flex-col items-center opacity-10">
                    <Camera size={80} strokeWidth={1} />
                    <span className="text-xs uppercase tracking-[0.4em] mt-4">Awaiting Source</span>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef}
                      src={videoUrl} 
                      className="w-full h-full object-contain" 
                      crossOrigin="anonymous"
                      onLoadedMetadata={() => {
                        if (videoRef.current?.duration) {
                          const frames = calculateFramesToCapture(videoRef.current.duration, fps);
                          setTotalEstimated(frames.length);
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent z-10 pointer-events-none"></div>
                    <div className="absolute bottom-6 left-8 z-20 flex flex-col font-mono">
                      <span className="text-xs text-white opacity-90 tracking-tighter uppercase mb-0.5">
                        Frame: {Math.floor((videoRef.current?.currentTime || 0) * fps).toString().padStart(6, '0')}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-tight">
                        Time: {formatTime(videoRef.current?.currentTime || 0)}
                      </span>
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Captured Artifacts Strip */}
              <div className="h-32 flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Latest Artifacts</h3>
                    {capturedFrames.length > 0 && (
                      <button 
                        onClick={downloadAll}
                        className="text-[9px] text-amber-200 hover:text-white uppercase font-bold flex items-center gap-1.5 transition-colors bg-amber-900/20 px-2 py-0.5 rounded border border-amber-900/30"
                      >
                        <Download size={10} /> Batch Download All
                      </button>
                    )}
                  </div>
                  {capturedFrames.length > 0 && (
                    <button 
                      onClick={() => setCapturedFrames([])}
                      className="text-[9px] text-zinc-600 hover:text-red-400 uppercase font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={10} /> Flush Cache
                    </button>
                  )}
                </div>
                
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 min-h-[96px]">
                  {capturedFrames.length === 0 ? (
                    <div className="flex-1 border border-zinc-800 border-dashed rounded-lg flex items-center justify-center opacity-30">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">No active slices</span>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {[...capturedFrames].reverse().slice(0, 10).map((frame, idx) => (
                        <motion.div
                          key={frame.id}
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: '160px', opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          className="group relative h-24 aspect-video bg-zinc-900 border border-zinc-800 rounded-sm shrink-0 overflow-hidden cursor-pointer hover:border-amber-200/50 transition-colors"
                        >
                          <img src={frame.dataUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                          <div className="absolute top-2 left-2 text-[8px] font-mono text-zinc-500 bg-black/40 px-1 py-0.5 rounded backdrop-blur-sm">
                            #{frame.frameIndex}
                          </div>
                          <a 
                            href={frame.dataUrl} 
                            download={`frame_${frame.frameIndex}.jpg`}
                            className="absolute bottom-2 right-2 p-1.5 bg-black/60 text-amber-200 translate-y-8 group-hover:translate-y-0 transition-transform hover:bg-amber-200 hover:text-black"
                          >
                            <Download size={10} />
                          </a>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                  {capturedFrames.length > 0 && (
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="aspect-square h-24 border border-zinc-800 border-dashed flex items-center justify-center rounded-sm shrink-0 bg-zinc-900/10 hover:bg-zinc-800/20 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">View All</span>
                        <span className="text-[8px] text-zinc-600 uppercase tracking-tighter leading-none">{capturedFrames.length}</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* History View: Full Scrollable Gallery */
            <div className="h-full flex flex-col p-8 lg:p-12 min-h-0">
              <div className="flex justify-between items-center mb-8 border-b border-zinc-900 pb-4">
                <div>
                  <h2 className="text-xl font-serif italic text-amber-200">Captured Artifacts</h2>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Full library of extracted frames</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={downloadAll}
                    className="px-6 py-2 bg-amber-200 text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-colors"
                  >
                    Archive All (ZIP)
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pr-2 min-h-0">
                {capturedFrames.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-10">
                    <Camera size={64} strokeWidth={1} />
                    <span className="text-sm uppercase tracking-[0.4em] mt-4">Vault Empty</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    <AnimatePresence>
                      {[...capturedFrames].reverse().map((frame, idx) => (
                        <motion.div
                          key={frame.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group relative bg-[#0d0d0d] border border-zinc-800 rounded-sm overflow-hidden hover:border-amber-200/40 transition-colors"
                        >
                          <div className="aspect-video relative overflow-hidden">
                            <img src={frame.dataUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                          </div>
                          <div className="p-3 flex justify-between items-center bg-[#0d0d0d]">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-amber-200/60 uppercase">Frame #{frame.frameIndex}</span>
                              <span className="text-[8px] font-mono text-zinc-600 mt-0.5">{formatTime(frame.timestamp)}</span>
                            </div>
                            <a 
                              href={frame.dataUrl} 
                              download={`frame_${frame.frameIndex}.jpg`}
                              className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:bg-amber-200 hover:text-black hover:border-amber-200 transition-all"
                            >
                              <Download size={12} />
                            </a>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
