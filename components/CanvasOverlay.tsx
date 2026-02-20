
import React, { useRef, useEffect, useState } from 'react';

interface CanvasOverlayProps {
  onSave: (dataUrl: string) => void;
  initialData?: string;
  isVisible: boolean;
}

const CanvasOverlay: React.FC<CanvasOverlayProps> = ({ onSave, initialData, isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (context) {
      context.lineCap = 'round';
      context.lineWidth = 3;
      context.strokeStyle = '#4f46e5'; // Indigo
      setCtx(context);

      // Load initial data
      if (initialData) {
        const img = new Image();
        img.src = initialData;
        img.onload = () => context.drawImage(img, 0, 0);
      }
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        if (initialData) {
            const img = new Image();
            img.src = initialData;
            img.onload = () => context?.drawImage(img, 0, 0);
        }
      }
    };

    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [initialData]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isVisible) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isVisible) return;
    const { x, y } = getPos(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    onSave(canvasRef.current?.toDataURL() || '');
  };

  const clear = () => {
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onSave('');
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-10 touch-none">
      <div className="absolute top-2 right-2 flex gap-2">
         <button onClick={clear} className="bg-white/80 backdrop-blur p-2 rounded-full shadow-sm hover:bg-white text-xs">Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full cursor-crosshair"
      />
    </div>
  );
};

export default CanvasOverlay;
