import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { SharedSyncService } from '../services/sharedSyncService';

interface MultiDeviceConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetUrl?: string;
  onSaveSpreadsheetUrl?: (url: string) => void;
  totalRecords: number;
}

export const MultiDeviceConnectModal: React.FC<MultiDeviceConnectModalProps> = ({
  isOpen,
  onClose,
  totalRecords,
}) => {
  const [appUrl, setAppUrl] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      SharedSyncService.getNetworkInfo().then((info) => {
        const liveUrl = info.appUrl || window.location.href;
        setAppUrl(liveUrl);
        QRCode.toDataURL(liveUrl, {
          width: 240,
          margin: 1.5,
          color: { dark: '#0f172a', light: '#ffffff' },
        })
          .then((url) => setQrCodeDataUrl(url))
          .catch((err) => console.error('QR code error', err));
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">Buka di HP / Perangkat Lain</h2>
              <p className="text-[11px] text-slate-300">Tinggal scan atau buka link, langsung terhubung!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center text-center space-y-4">
          {/* QR Code */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="Scan QR Code" className="w-48 h-48 rounded" />
            ) : (
              <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                Memuat QR...
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600">
            Arahkan kamera HP ke QR Code di atas. Aplikasi &amp; semua data ({totalRecords} baris) langsung terbuka otomatis.
          </p>

          {/* Copy URL Button */}
          <div className="w-full space-y-2">
            <button
              type="button"
              onClick={handleCopy}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Link Berhasil Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Link Aplikasi</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400">
              Kirim ke WhatsApp atau buka di browser HP Anda.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
