import React from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Scissors } from 'lucide-react';
import { Button } from './ui';
import getCroppedImg from '../utils/cropImage';

interface ImageCropperModalProps {
  image: string;
  onClose: () => void;
  onComplete: (croppedImage: string) => void;
}

export default function ImageCropperModal({ image, onClose, onComplete }: ImageCropperModalProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<any>(null);

  const onCropComplete = React.useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      if (croppedImage) {
        onComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl text-indigo-600">
              <Scissors size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Recortar Imagen</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ajusta la imagen para tu catálogo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative h-[400px] bg-gray-100 dark:bg-gray-950">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Zoom</label>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 rounded-2xl h-12 font-black uppercase tracking-widest text-[11px]"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 shadow-lg shadow-indigo-100 font-black uppercase tracking-widest text-[11px]"
              onClick={handleCrop}
            >
              <Check className="w-4 h-4 mr-2" />
              Finalizar Recorte
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
