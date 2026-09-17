/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeItemProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export function BarcodeItem({
  value,
  format = 'CODE128',
  width = 1.6,
  height = 36,
  displayValue = true,
  fontSize = 11,
  className = ''
}: BarcodeItemProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: format as any,
          width,
          height,
          displayValue,
          fontSize,
          margin: 4,
          background: 'transparent',
          lineColor: '#000000',
          font: 'monospace'
        });
      } catch (err) {
        console.warn('Barcode generation failed for value:', value, err);
      }
    }
  }, [value, format, width, height, displayValue, fontSize]);

  if (!value) return null;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg ref={svgRef} className="max-w-full h-auto" />
    </div>
  );
}
