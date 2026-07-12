import React from 'react';

interface CanvasExporterProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  elements: any[];
}

export function CanvasExporter({ canvasRef, elements }: CanvasExporterProps) {
  const exportAsPNG = async () => {
    if (!canvasRef.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `whiteboard-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const exportAsPDF = async () => {
    if (!canvasRef.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const jspdf = (await import('jspdf')).jsPDF;

      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jspdf({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`whiteboard-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const exportAsSVG = () => {
    const svgContent = generateSVG(elements);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.svg`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const generateSVG = (elements: any[]): string => {
    const width = 800;
    const height = 600;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svgContent += '<rect width="100%" height="100%" fill="white"/>';

    for (const element of elements) {
      switch (element.type) {
        case 'rectangle':
          svgContent += `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${element.fill || '#ccc'}" stroke="#000" stroke-width="2"/>`;
          break;
        case 'circle':
          svgContent += `<circle cx="${element.x}" cy="${element.y}" r="${element.radius}" fill="${element.fill || '#ccc'}" stroke="#000" stroke-width="2"/>`;
          break;
        case 'line':
          svgContent += `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="#000" stroke-width="2"/>`;
          break;
        case 'text':
          svgContent += `<text x="${element.x}" y="${element.y}" font-size="16" fill="#000">${element.content}</text>`;
          break;
      }
    }

    svgContent += '</svg>';
    return svgContent;
  };

  const exportAsJSON = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      elements,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.json`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={exportAsPNG}
        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm"
      >
        Export PNG
      </button>
      <button
        onClick={exportAsPDF}
        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm"
      >
        Export PDF
      </button>
      <button
        onClick={exportAsSVG}
        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm"
      >
        Export SVG
      </button>
      <button
        onClick={exportAsJSON}
        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm"
      >
        Export JSON
      </button>
    </div>
  );
}
