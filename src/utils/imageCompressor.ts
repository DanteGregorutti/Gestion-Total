/**
 * Utility to resize and compress images (logos, avatars, stamps)
 * before storing them in state, LocalStorage, or Firestore.
 * Prevents QuotaExceededError and improves load/print performance.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

export function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.85,
    mimeType = 'image/webp'
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo de imagen'));
    };

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        reject(new Error('Formato de imagen no soportado o archivo corrupto'));
      };

      img.onload = () => {
        try {
          let { width, height } = img;

          // Calculate aspect ratio preserving bounds
          if (width > maxWidth || height > maxHeight) {
            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;
            const bestRatio = Math.min(widthRatio, heightRatio);

            width = Math.round(width * bestRatio);
            height = Math.round(height * bestRatio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback to raw result if canvas context unavailable
            resolve(e.target?.result as string);
            return;
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, width, height);

          // Try exporting to desired format (webp or jpeg/png)
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL(mimeType, quality);
          } catch {
            dataUrl = canvas.toDataURL('image/png');
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
