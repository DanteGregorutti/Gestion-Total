import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  Database
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductsContext';
import { Product, Procedencia, Warehouse } from '../types';
import { Button } from './ui';
import { cn } from '../utils/cn';
import { toast } from 'sonner';

interface BulkUploadProps {
  onComplete?: () => void;
}

interface LogEntry {
  row: number;
  article: string;
  error: string;
  type: 'error' | 'warning';
}

export default function BulkUpload({ onComplete }: BulkUploadProps) {
  const { t } = useSettings();
  const { products: existingProducts, refreshProducts } = useProducts();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const data = await inventoryService.getWarehouses();
        setWarehouses(data);
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);
    } else {
      toast.error(t('invalid_file_error'));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const mapProcedencia = (val: string): Procedencia => {
    const normalized = val?.trim().toUpperCase();
    if (normalized === 'LEGITIMO') return 'Legítimo';
    if (normalized === 'GENERICO') return 'Genérico';
    if (normalized === 'IMPORTADO') return 'Importado';
    return 'Legítimo'; // Default
  };

  const processFile = async () => {
    if (!file) return;
    if (!selectedWarehouseId) {
      toast.error(t('no_warehouse_error'));
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setSuccessCount(0);
    setErrorCount(0);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error('El archivo está vacío o no tiene datos.');
        setIsProcessing(false);
        return;
      }

      // Skip header row
      const rows = jsonData.slice(1);
      setTotalRows(rows.length);

      const productsToUpload: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>[] = [];
      const currentLogs: LogEntry[] = [];

      rows.forEach((row, index) => {
        const rowNum = index + 2;
        try {
          // ARTICULO, PROCEDENCIA, CANTIDAD, DESCRIPCIÓN, PRECIO, UBICACION
          const [articulo, procedencia, cantidad, descripcion, precio, ubicacion, talle, genero] = row;

          if (!articulo) {
            currentLogs.push({
              row: rowNum,
              article: 'N/A',
              error: 'Código de artículo faltante',
              type: 'error'
            });
            return;
          }

          const product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
            codigo: String(articulo).trim(),
            procedencia: mapProcedencia(String(procedencia || '')),
            estado: 'Nuevo',
            cantidad: Number(cantidad) || 0,
            descripcion: String(descripcion || '').trim(),
            precio: Number(precio) || 0,
            costo: 0, // Default cost as it's not in the Excel
            ubicacion: String(ubicacion || '').trim(),
            talle: String(talle || '').trim(),
            genero: String(genero || '').trim(),
            almacenId: selectedWarehouseId,
            minStock: 5, // Default min stock
            imagenUrl: existingProducts.find(p => p.codigo?.trim().toLowerCase() === String(articulo || '').trim().toLowerCase() && p.imagenUrl)?.imagenUrl ||
              productsToUpload.find(p => p.codigo?.trim().toLowerCase() === String(articulo || '').trim().toLowerCase() && p.imagenUrl)?.imagenUrl || ''
          };

          productsToUpload.push(product);
        } catch (err) {
          currentLogs.push({
            row: rowNum,
            article: String(row[0] || 'Unknown'),
            error: err instanceof Error ? err.message : 'Error desconocido',
            type: 'error'
          });
        }
      });

      setErrorCount(currentLogs.length);
      setLogs(currentLogs);

      if (productsToUpload.length > 0) {
        await inventoryService.bulkAddProducts(productsToUpload, (count) => {
          setProgress(count);
          setSuccessCount(count);
        });
        await refreshProducts();
        toast.success(t('upload_complete'));
        if (onComplete) onComplete();
      } else {
        toast.warning('No se encontraron productos válidos para cargar.');
      }

    } catch (error) {
      console.error('Bulk upload error:', error);
      toast.error('Error al procesar el archivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('bulk_upload')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('bulk_upload_desc')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('select_warehouse_bulk')}
          </label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            disabled={isProcessing}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">{t('select_warehouse')}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.nombre}</option>
            ))}
          </select>
        </div>

        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all",
              isDragging 
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10" 
                : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full mb-4">
              <Upload size={32} />
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {t('drag_drop_excel')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              O haz clic para buscar en tu equipo
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
              disabled={isProcessing}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {t('cancel')}
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {t('processing_rows').replace('{{count}}', progress.toString()).replace('{{total}}', totalRows.toString())}
              </span>
              <span className="font-medium text-indigo-600">
                {Math.round((progress / totalRows) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${(progress / totalRows) * 100}%` }}
              />
            </div>
          </div>
        )}

        {!isProcessing && file && (
          <Button
            onClick={processFile}
            className="w-full py-4 rounded-2xl text-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            {t('process_upload')}
          </Button>
        )}

        {(successCount > 0 || errorCount > 0) && !isProcessing && (
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white">{t('upload_summary')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={24} />
                <div>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                    {t('upload_success_count').replace('{{count}}', successCount.toString())}
                  </p>
                </div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3">
                <XCircle className="text-red-600 dark:text-red-400" size={24} />
                <div>
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                    {t('upload_error_count').replace('{{count}}', errorCount.toString())}
                  </p>
                </div>
              </div>
            </div>

            {logs.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <AlertCircle size={16} />
                  {t('view_log')}
                  <ChevronRight size={16} className={cn("transition-transform", showLogs && "rotate-90")} />
                </button>
                
                {showLogs && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
                    {logs.map((log, i) => (
                      <div key={i} className="text-xs flex items-start gap-2">
                        <span className="font-mono text-gray-400">Fila {log.row}:</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{log.article}</span>
                        <span className="text-red-500">— {log.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
