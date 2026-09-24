import { useState, useEffect } from 'react';
import { RecordForm } from './components/RecordForm';
import { RecordList } from './components/RecordList';
import { ActivityLogList } from './components/ActivityLogList';
import { OffenderSummaryTab } from './components/OffenderSummaryTab';
import { PenaltyRecord, ActivityLog } from './types';
import { exportToExcel } from './exportExcel';
import { Download, ShieldAlert, TrendingDown, Users, List, Activity, Pencil, UserCheck, CheckCircle2, Clock } from 'lucide-react';

export default function App() {
  const [records, setRecords] = useState<PenaltyRecord[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [editingRecord, setEditingRecord] = useState<PenaltyRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'records' | 'summary' | 'logs'>('records');
  const [isConfigured, setIsConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Date Filtering Logic
  const filteredRecords = records.filter(record => {
    let matchDate = true;
    if (filterStartDate || filterEndDate) {
      const recordDate = new Date(record.createdAt);
      recordDate.setHours(0, 0, 0, 0);

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) matchDate = false;
      }
      
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(0, 0, 0, 0);
        if (recordDate > end) matchDate = false;
      }
    }
    return matchDate;
  });

  const filteredLogs = logs.filter(log => {
    let matchDate = true;
    if (filterStartDate || filterEndDate) {
      const logDate = new Date(log.timestamp);
      logDate.setHours(0, 0, 0, 0);

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (logDate < start) matchDate = false;
      }
      
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(0, 0, 0, 0);
        if (logDate > end) matchDate = false;
      }
    }
    return matchDate;
  });

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        setIsConfigured(data.configured);
        if (data.configured) {
          Promise.all([
            fetch('/api/records').then(r => r.json()),
            fetch('/api/logs').then(r => r.json())
          ]).then(([recordsData, logsData]) => {
            setRecords(Array.isArray(recordsData) ? recordsData : []);
            setLogs(Array.isArray(logsData) ? logsData : []);
          }).catch(console.error);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const addLog = async (action: ActivityLog['action'], details: string) => {
    const newLog: ActivityLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    setLogs((prev) => [newLog, ...prev]);
    if (isConfigured) {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      }).catch(console.error);
    }
  };

  const handleAddRecord = async (newRecordData: Omit<PenaltyRecord, 'id'>) => {
    const newRecord: PenaltyRecord = {
      ...newRecordData,
      id: crypto.randomUUID(),
      createdAt: newRecordData.createdAt || new Date().toISOString(),
    };
    
    if (isConfigured) {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (!res.ok) {
        alert('Gagal menyimpan ke Spreadsheet');
        return;
      }
    }
    
    setRecords([newRecord, ...records]);
    addLog('CREATE', `Menambahkan denda baru untuk ${newRecord.name} (Cabang: ${newRecord.branch})`);
    setIsFormOpen(false);
  };

  const handleAddBatchRecords = async (newRecordsData: Omit<PenaltyRecord, 'id'>[]) => {
    if (!newRecordsData.length) return;

    const newRecords: PenaltyRecord[] = newRecordsData.map((d) => ({
      ...d,
      id: crypto.randomUUID(),
      createdAt: d.createdAt || new Date().toISOString(),
      status: d.status || 'UNPAID',
    }));

    if (isConfigured) {
      try {
        await fetch('/api/records/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecords),
        });
      } catch (e) {
        console.error('Batch save error:', e);
      }
    }

    setRecords([...newRecords, ...records]);
    addLog('CREATE', `Menambahkan ${newRecords.length} catatan klaim/denda secara massal dari screenshot`);
    setIsFormOpen(false);
  };

  const handleUpdateRecord = async (updatedRecord: PenaltyRecord) => {
    if (isConfigured) {
      const res = await fetch(`/api/records/${updatedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord)
      });
      if (!res.ok) {
        alert('Gagal memperbarui di Spreadsheet');
        return;
      }
    }
    
    setRecords(records.map(r => r.id === updatedRecord.id ? updatedRecord : r));
    setEditingRecord(null);
    setIsFormOpen(false);
    addLog('UPDATE', `Memperbarui data denda atas nama ${updatedRecord.name}`);
  };

  const handleEditRecord = (record: PenaltyRecord) => {
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const handleBulkPay = async (
    ids: string[],
    paymentDate?: string,
    destinationAccount?: 'TACIK' | 'KOORDINATOR'
  ) => {
    const toPay = records.filter(r => ids.includes(r.id) && r.status !== 'PAID');
    if (!toPay.length) return;

    const totalAmount = toPay.reduce((sum, r) => sum + r.amount, 0);
    const dateUsed = paymentDate || new Date().toISOString().split('T')[0];
    const accountUsed = destinationAccount || 'TACIK';
    
    // Optimistic Update
    const updatedRecords = records.map(r => 
      ids.includes(r.id)
        ? {
            ...r,
            status: 'PAID' as const,
            paidAt: dateUsed,
            destinationAccount: accountUsed,
          }
        : r
    );
    setRecords(updatedRecords);
    
    addLog(
      'UPDATE',
      `Melunasi ${ids.length} denda (Total: Rp ${totalAmount.toLocaleString('id-ID')}) pada ${dateUsed} [Uang Masuk: ${accountUsed}]`
    );

    if (isConfigured) {
      try {
        await Promise.all(toPay.map(r => 
          fetch(`/api/records/${r.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...r,
              status: 'PAID',
              paidAt: dateUsed,
              destinationAccount: accountUsed,
            })
          })
        ));
      } catch (error) {
        alert('Beberapa pembaruan mungkin gagal tersimpan ke Spreadsheet.');
      }
    }
  };

  const handleDeleteRecord = async (id: string) => {
    const recordToDelete = records.find(r => r.id === id);
    if (!recordToDelete) return;

    if (isConfigured) {
      const res = await fetch(`/api/records/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        alert('Gagal menghapus dari Spreadsheet');
        return;
      }
    }
    
    setRecords(records.filter(record => record.id !== id));
    addLog('DELETE', `Menghapus data denda atas nama ${recordToDelete.name}`);
    if (editingRecord?.id === id) {
      setEditingRecord(null);
      setIsFormOpen(false);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!ids.length) return;

    if (isConfigured) {
      try {
        await fetch('/api/records/delete-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      } catch (error) {
        console.error('Batch delete error:', error);
      }
    }

    setRecords(records.filter(record => !ids.includes(record.id)));
    addLog('DELETE', `Menghapus massal ${ids.length} data denda`);
  };

  const totalAmount = filteredRecords.reduce((sum, record) => sum + record.amount, 0);
  const paidRecords = filteredRecords.filter(r => r.status === 'PAID');
  const unpaidRecords = filteredRecords.filter(r => r.status !== 'PAID');
  const paidAmount = paidRecords.reduce((sum, r) => sum + r.amount, 0);
  const unpaidAmount = unpaidRecords.reduce((sum, r) => sum + r.amount, 0);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Sistem Pencatatan Denda</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {!isConfigured && !isLoading && (
          <div className="bg-amber-50 border border-amber-200/60 p-5 rounded-2xl mb-8 shadow-sm">
            <h3 className="text-amber-900 font-semibold mb-2">Konfigurasi Google Sheets Belum Selesai</h3>
            <p className="text-amber-800 text-sm mb-3">
              Untuk mengaktifkan sinkronisasi tanpa login, Anda harus menambahkan kredensial <i className="font-medium">Google Service Account</i> Anda.
            </p>
            <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1.5 mb-3">
              <li>Buka menu <b className="font-semibold">Settings &gt; Environment Variables</b>.</li>
              <li>Tambahkan <code className="bg-white/60 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs">GOOGLE_CLIENT_EMAIL</code></li>
              <li>Tambahkan <code className="bg-white/60 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs">GOOGLE_PRIVATE_KEY</code></li>
              <li>Tambahkan <code className="bg-white/60 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs">SPREADSHEET_ID</code></li>
              <li>Bagikan akses editor Spreadsheet ke alamat email Service Account.</li>
            </ul>
            <p className="text-amber-900 text-sm font-medium">
              * Data saat ini hanya akan tersimpan di sesi sementara browser Anda.
            </p>
          </div>
        )}

        {/* Dashboard Stats */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Ringkasan</h2>
          
          {/* Period Filter */}
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-zinc-200 shadow-sm w-full sm:w-auto">
            <span className="text-sm font-medium text-zinc-500 pl-2">Periode:</span>
            <input 
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
            <span className="text-zinc-400">-</span>
            <input 
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
            <button
              onClick={() => exportToExcel(filteredRecords, filteredLogs, { start: filterStartDate, end: filterEndDate })}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </button>
            {(filterStartDate || filterEndDate) && (
              <button 
                onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                className="text-xs text-rose-600 font-medium px-2 py-1.5 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          {/* Total Denda */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-700 shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Denda</p>
                <p className="text-xs text-zinc-500 font-medium">Akumulasi keseluruhan</p>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">{formatRupiah(totalAmount)}</p>
          </div>
          
          {/* Total Pelanggaran / Kasus */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-700 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Kasus</p>
                <p className="text-xs text-zinc-500 font-medium">Catatan pelanggaran</p>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
              {filteredRecords.length} <span className="text-sm text-zinc-400 font-normal">Kasus</span>
            </p>
          </div>

          {/* Kolom Lunas */}
          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Sudah Lunas</p>
                  <p className="text-xs text-emerald-600 font-medium">{paidRecords.length} denda terselesaikan</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800">
                LUNAS
              </span>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tracking-tight">{formatRupiah(paidAmount)}</p>
            </div>
          </div>

          {/* Kolom Belum Lunas */}
          <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-900 uppercase tracking-wider">Belum Lunas</p>
                  <p className="text-xs text-amber-700 font-medium">{unpaidRecords.length} denda tertunggak</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-900">
                KONTROL
              </span>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-rose-600 tracking-tight">{formatRupiah(unpaidAmount)}</p>
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="mb-6 flex flex-wrap gap-2 bg-zinc-100/80 p-1.5 rounded-xl w-fit border border-zinc-200/50">
            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'records'
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <List className="w-4 h-4" />
              Daftar Denda (Detail)
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'summary'
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Rekap per Pelanggar (Kumulatif)
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'logs'
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              Log Aktivitas
            </button>
          </div>

          {activeTab === 'records' && (
            <RecordList 
              records={filteredRecords} 
              onDelete={handleDeleteRecord} 
              onBulkDelete={handleBulkDelete}
              onEdit={handleEditRecord}
              onBulkPay={handleBulkPay}
            />
          )}

          {activeTab === 'summary' && (
            <OffenderSummaryTab
              records={filteredRecords}
              onBulkPay={handleBulkPay}
              onEditRecord={handleEditRecord}
            />
          )}

          {activeTab === 'logs' && (
            <ActivityLogList logs={filteredLogs} />
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setEditingRecord(null);
          setIsFormOpen(true);
        }}
        className="fixed bottom-8 right-8 z-40 bg-zinc-900 text-white p-4 rounded-full shadow-lg hover:bg-zinc-800 transition-all hover:scale-110 active:scale-95 flex items-center justify-center group"
        title="Tambah Denda"
      >
        <Pencil className="w-6 h-6" />
      </button>

      {/* Form Modal Overlay */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg my-auto relative">
            <RecordForm 
              onAdd={handleAddRecord} 
              onAddBatch={handleAddBatchRecords}
              onUpdate={handleUpdateRecord}
              onDelete={handleDeleteRecord}
              editingRecord={editingRecord}
              onCancelEdit={() => {
                setEditingRecord(null);
                setIsFormOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
