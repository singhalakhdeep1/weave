import React, { useState, useRef, useEffect } from 'react';

interface ShapeRecognizerProps {
  onShapeRecognized: (shape: string, points: number[][]) => void;
}

export function ShapeRecognizer({ onShapeRecognized }: ShapeRecognizerProps) {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleMouseDown = (e: MouseEvent) => {
      isDrawingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentPoints([[x, y]]);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setCurrentPoints(prev => [...prev, [x, y]]);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(currentPoints[0]?.[0] || x, currentPoints[0]?.[1] || y);
      for (const point of currentPoints) {
        ctx.lineTo(point[0], point[1]);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleMouseUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      
      if (currentPoints.length > 10) {
        const shape = recognizeShape(currentPoints);
        onShapeRecognized(shape, currentPoints);
      }
      
      setCurrentPoints([]);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [currentPoints]);

  const recognizeShape = (points: number[][]): string => {
    const start = points[0];
    const end = points[points.length - 1];
    
    const distance = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
    );
    
    const pathLength = calculatePathLength(points);
    const boundingBox = getBoundingBox(points);
    const aspectRatio = boundingBox.width / boundingBox.height;
    
    // Check if closed shape
    const isClosed = distance < pathLength * 0.15;
    
    if (!isClosed) {
      // Check for line
      const straightness = calculateStraightness(points);
      if (straightness > 0.9) return 'line';
      
      // Check for arrow
      if (detectArrow(points)) return 'arrow';
      
      return 'freehand';
    }
    
    // Closed shapes
    const circularity = calculateCircularity(points, boundingBox);
    const corners = detectCorners(points);
    
    if (circularity > 0.85) return 'circle';
    if (circularity > 0.7 && corners === 4) return 'square';
    if (circularity > 0.7 && corners === 3) return 'triangle';
    if (corners === 4 && Math.abs(aspectRatio - 1) > 0.3) return 'rectangle';
    
    return 'polygon';
  };

  const calculatePathLength = (points: number[][]): number => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.sqrt(
        Math.pow(points[i][0] - points[i-1][0], 2) +
        Math.pow(points[i][1] - points[i-1][1], 2)
      );
    }
    return length;
  };

  const getBoundingBox = (points: number[][]) => {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const calculateCircularity = (points: number[][], bbox: any): number => {
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    const radius = Math.min(bbox.width, bbox.height) / 2;
    
    let variance = 0;
    for (const point of points) {
      const dist = Math.sqrt(
        Math.pow(point[0] - centerX, 2) + Math.pow(point[1] - centerY, 2)
      );
      variance += Math.abs(dist - radius);
    }
    
    const avgVariance = variance / points.length;
    return 1 - (avgVariance / radius);
  };

  const calculateStraightness = (points: number[][]): number => {
    const start = points[0];
    const end = points[points.length - 1];
    
    let maxDeviation = 0;
    for (const point of points) {
      const deviation = pointToLineDistance(point, start, end);
      maxDeviation = Math.max(maxDeviation, deviation);
    }
    
    const lineLength = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
    );
    
    return 1 - (maxDeviation / lineLength);
  };

  const pointToLineDistance = (point: number[], lineStart: number[], lineEnd: number[]): number => {
    const A = point[0] - lineStart[0];
    const B = point[1] - lineStart[1];
    const C = lineEnd[0] - lineStart[0];
    const D = lineEnd[1] - lineStart[1];
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = lineStart[0];
      yy = lineStart[1];
    } else if (param > 1) {
      xx = lineEnd[0];
      yy = lineEnd[1];
    } else {
      xx = lineStart[0] + param * C;
      yy = lineStart[1] + param * D;
    }
    
    const dx = point[0] - xx;
    const dy = point[1] - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  };

  const detectCorners = (points: number[][]): number => {
    const corners: number[][] = [];
    const threshold = 0.5;
    
    for (let i = 5; i < points.length - 5; i++) {
      const prev = points[i - 5];
      const curr = points[i];
      const next = points[i + 5];
      
      const angle = calculateAngle(prev, curr, next);
      
      if (Math.abs(angle - 90) < threshold || Math.abs(angle - 45) < threshold) {
        corners.push(curr);
      }
    }
    
    return corners.length;
  };

  const calculateAngle = (p1: number[], p2: number[], p3: number[]): number => {
    const v1 = { x: p1[0] - p2[0], y: p1[1] - p2[1] };
    const v2 = { x: p3[0] - p2[0], y: p3[1] - p2[1] };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    return (angle * 180) / Math.PI;
  };

  const detectArrow = (points: number[][]): boolean => {
    if (points.length < 10) return false;
    
    const lastPoints = points.slice(-10);
    const angleChanges: number[] = [];
    
    for (let i = 1; i < lastPoints.length - 1; i++) {
      const angle = calculateAngle(lastPoints[i-1], lastPoints[i], lastPoints[i+1]);
      angleChanges.push(angle);
    }
    
    const sharpAngles = angleChanges.filter(a => a < 120).length;
    return sharpAngles >= 2;
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-gray-300 rounded cursor-crosshair"
      />
      <div className="absolute top-2 right-2 text-sm text-gray-500">
        Draw a shape to recognize it
      </div>
    </div>
  );
}
