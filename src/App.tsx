import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Calculator, 
  Users, 
  Utensils, 
  UtensilsCrossed,
  TrendingUp, 
  Edit2, 
  Trash2, 
  X,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Menu as MenuIcon,
  RefreshCw,
  Settings as SettingsIcon,
  Save,
  Globe,
  Loader2,
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { DailyEntry, MenuItem, AppSettings } from './types';
import { DEFAULT_MENU, DEFAULT_SETTINGS } from './constants';
import { cn, formatNumber, formatDate, parseDateSafe } from './lib/utils';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbw5JBTUtItdweegeWHibudrwmb27c8J3joDmF-4YzDnkXBa_-KGtVCqjS5Fmb62wKRK/exec'; // Replace with your actual GAS Web App URL

export default function App() {
  // Persistence using localStorage
  const [entries, setEntries] = useState<DailyEntry[]>(() => {
    const saved = localStorage.getItem('mdm_entries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map((e: any, idx: number) => ({
          ...e,
          id: e.id || `legacy-${idx}-${Date.now()}`
        })) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('mdm_menu');
    return saved ? JSON.parse(saved) : DEFAULT_MENU;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mdm_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // GAS Integration State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isYearlyReportOpen, setIsYearlyReportOpen] = useState(false);
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };
  
  // Default to current month
  const [filterStartDate, setFilterStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filterEndDate, setFilterEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Persist data locally
  useEffect(() => {
    localStorage.setItem('mdm_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('mdm_menu', JSON.stringify(menu));
  }, [menu]);

  useEffect(() => {
    localStorage.setItem('mdm_settings', JSON.stringify(settings));
  }, [settings]);

  // Sync Logic
  const syncWithSheet = useCallback(async () => {
    if (!GAS_URL) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${GAS_URL}?action=get_data`);
      const data = await response.json();
      if (data.entries) {
        setEntries(data.entries.map((e: any) => {
          let normalizedDate = e.date;
          try {
            // Check if it's already YYYY-MM-DD
            if (typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
              normalizedDate = e.date;
            } else {
              const d = new Date(e.date);
              if (!isNaN(d.getTime())) {
                // If it came from a Date object or ISO string, extract local parts instead of toISOString
                // to maintain what the user likely intended
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                normalizedDate = `${y}-${m}-${day}`;
              }
            }
          } catch (err) {
            console.error("Date normalization error:", err);
          }
          
          return {
            ...e,
            date: normalizedDate,
            id: String(e.id || '')
          };
        }));
      }
      if (data.menuItems && data.menuItems.length > 0) setMenu(data.menuItems);
    } catch (err) {
      console.error(err);
      setError('Google Sheet से सिंक करने में विफल।');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial Sync
  useEffect(() => {
    if (GAS_URL) {
      syncWithSheet();
    }
  }, [syncWithSheet]);

  const filteredEntries = useMemo(() => {
    return (entries || [])
      .filter(entry => {
        const entryDate = parseDateSafe(entry.date);
        const matchesStart = filterStartDate ? entryDate >= parseDateSafe(filterStartDate) : true;
        const matchesEnd = filterEndDate ? entryDate <= parseDateSafe(filterEndDate) : true;
        return matchesStart && matchesEnd;
      })
      .sort((a, b) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime());
  }, [entries, filterStartDate, filterEndDate]);

  const stats = useMemo(() => {
    return {
      totalStudentsFeeding: filteredEntries.reduce((acc, curr) => acc + (Number(curr.eatingStudents) || 0), 0),
      currentMonthCost: filteredEntries.reduce((acc, curr) => acc + (Number(curr.foodCost) || 0), 0),
      totalFruitCost: filteredEntries.reduce((acc, curr) => acc + (Number(curr.fruitCost) || 0), 0),
      totalMilkCost: filteredEntries.reduce((acc, curr) => acc + (Number(curr.milkCost) || 0), 0),
      totalWheat: filteredEntries.reduce((acc, curr) => acc + (Number(curr.wheatQty) || 0), 0),
      totalRice: filteredEntries.reduce((acc, curr) => acc + (Number(curr.riceQty) || 0), 0),
      totalMilk: filteredEntries.reduce((acc, curr) => acc + (Number(curr.milkQty) || 0), 0),
      totalEntries: filteredEntries.length
    };
  }, [filteredEntries]);

  const downloadRangePDF = () => {
    const doc = new jsPDF('landscape');
    const start = filterStartDate || 'Start';
    const end = filterEndDate || 'End';
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text("MDM Duration Report", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Duration: ${start} to ${end}`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 34);

    let cumulativeCost = 0;
    const tableData = [...filteredEntries]
      .sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime())
      .map(e => {
        const dailyTotal = (Number(e.foodCost) || 0) + (Number(e.fruitCost) || 0) + (Number(e.milkCost) || 0);
        cumulativeCost += dailyTotal;
        return [
          formatDate(e.date),
          e.mealType === 'lunch' ? 'Lunch' : 'Morning',
          formatNumber(e.presentStudents, 0),
          formatNumber(e.eatingStudents, 0),
          formatNumber(e.foodCost, 2),
          formatNumber(e.fruitCost, 2),
          formatNumber(e.milkCost, 2),
          formatNumber(dailyTotal, 2),
          formatNumber(cumulativeCost, 2),
          formatNumber(e.wheatQty, 3),
          formatNumber(e.riceQty, 3),
          formatNumber(e.milkQty, 3)
        ];
      });

    // Summary Row
    tableData.push([
      'TOTAL',
      '',
      '',
      formatNumber(stats.totalStudentsFeeding, 0),
      formatNumber(stats.currentMonthCost, 2),
      formatNumber(stats.totalFruitCost, 2),
      formatNumber(stats.totalMilkCost, 2),
      formatNumber(stats.currentMonthCost + stats.totalFruitCost + stats.totalMilkCost, 2),
      formatNumber(cumulativeCost, 2),
      formatNumber(stats.totalWheat, 3),
      formatNumber(stats.totalRice, 3),
      formatNumber(stats.totalMilk, 3)
    ]);

    autoTable(doc, {
      head: [['Date', 'Meal', 'Total', 'Eating', 'Conv.', 'Fruit', 'Milk', 'Total Cost', 'Cumul. Cost', 'Wheat', 'Rice', 'Milk(L)']],
      body: tableData,
      startY: 40,
      styles: { 
        fontSize: 7.5,
        cellPadding: 1.5,
        valign: 'middle',
        font: 'helvetica'
      },
      headStyles: { 
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
        doc.text("Generated by MDM Management App", 14, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`MDM_Report_${start}_to_${end}.pdf`);
  };

  // Handlers
  const handleSaveEntry = async (entry: DailyEntry) => {
    // Ensure all numeric fields are actually numbers before saving
    const normalizedEntry = {
      ...entry,
      presentStudents: Number(entry.presentStudents) || 0,
      eatingStudents: Number(entry.eatingStudents) || 0,
      wheatQty: Number(entry.wheatQty) || 0,
      riceQty: Number(entry.riceQty) || 0,
      milkQty: Number(entry.milkQty) || 0,
      foodCost: Number(entry.foodCost) || 0,
      fruitCost: Number(entry.fruitCost) || 0,
      milkCost: Number(entry.milkCost) || 0,
      totalFoodFruitCost: Number(entry.totalFoodFruitCost) || 0,
    };

    const entryWithId = {
      ...normalizedEntry,
      id: entry.id || Date.now().toString(),
    };

    if (GAS_URL) {
      setIsLoading(true);
      setError(null);
      try {
        await fetch(GAS_URL, {
          method: 'POST',
          mode: 'no-cors', 
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'save_entry', entry: entryWithId })
        });
        
        if (editingEntry) {
          setEntries(prev => prev.map(e => e.id === entryWithId.id ? entryWithId : e));
          showToast('एंट्री सफलतापूर्वक अपडेट की गई।');
        } else {
          setEntries(prev => [entryWithId, ...prev]);
          showToast('नई एंट्री सफलतापूर्वक सहेजी गई।');
        }
        setIsFormOpen(false);
        setEditingEntry(null);
        setTimeout(() => syncWithSheet(), 2000);
      } catch (err) {
        setError('एंट्री सहेजने में विफल।');
        showToast('सहेजने में त्रुटि हुई', 'error');
      } finally {
        setIsLoading(false);
      }
    } else {
      if (editingEntry) {
        setEntries(prev => prev.map(e => e.id === entryWithId.id ? entryWithId : e));
        showToast('लोकल में अपडेट किया गया');
      } else {
        setEntries(prev => [entryWithId, ...prev]);
        showToast('लोकल में सहेजा गया');
      }
      setIsFormOpen(false);
      setEditingEntry(null);
    }
  };

  const handleDeleteEntry = (id: string) => {
    if (!id) {
      console.warn('Cannot delete entry: Missing ID');
      return;
    }
    
    setConfirmState({
      isOpen: true,
      title: 'एंट्री हटाएं?',
      message: 'क्या आप वाकई इस दैनिक एंट्री को स्थायी रूप से हटाना चाहते हैं?',
      onConfirm: async () => {
        // Optimistic update
        const originalEntries = [...entries];
        setEntries(prev => prev.filter(e => String(e.id) !== String(id)));
        setConfirmState(prev => ({ ...prev, isOpen: false }));

        if (GAS_URL) {
          setIsLoading(true);
          try {
            await fetch(GAS_URL, {
              method: 'POST',
              mode: 'no-cors',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ action: 'delete_entry', id: String(id) })
            });
            
            setTimeout(() => syncWithSheet(), 1000);
          } catch (err) {
            console.error('Delete error:', err);
            setError('हटाने में विफल। क्लाउड डेटा सिंक नहीं हो सका।');
            setEntries(originalEntries);
          } finally {
            setIsLoading(false);
          }
        }
      }
    });
  };

  const handleEditEntry = (entry: DailyEntry) => {
    setEditingEntry(entry);
    setIsFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">दैनिक मध्यान्ह भोजन</h1>
              <p className="hidden text-xs text-slate-500 sm:block">स्कूल MDM मैनेजमेंट</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!GAS_URL && (
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="hidden sm:flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                क्लाउड सिंक सेट करें
              </button>
            )}
            {GAS_URL && (
              <button 
                onClick={syncWithSheet}
                disabled={isLoading}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-all",
                  isLoading && "animate-spin"
                )}
                title="डेटा रिफ्रेश करें"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            )}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
              title="सेटिंग्स"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
              title="मीनू प्रबंधन"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <button 
              onClick={() => {
                setEditingEntry(null);
                setIsFormOpen(true);
              }}
              disabled={isLoading}
              className={cn(
                "group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition-all active:scale-95",
                "bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-indigo-100 hover:from-indigo-700 hover:to-indigo-800",
                isLoading && "opacity-50 cursor-not-allowed grayscale"
              )}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />}
              <span className="hidden sm:inline">नई एंट्री</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-600 border border-rose-100 italic">
            {error}
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard 
            title="कुल छात्र भोजन" 
            value={formatNumber(stats.totalStudentsFeeding, 0)} 
            icon={Users} 
            color="indigo" 
          />
          <StatCard 
            title="व्यय परिवर्तन लागत भोजन" 
            value={`₹${formatNumber(stats.currentMonthCost, 2)}`} 
            icon={IndianRupee} 
            color="emerald" 
          />
          <StatCard 
            title="फल परिवर्तन लागत (रु० में )" 
            value={`₹${formatNumber(stats.totalFruitCost, 2)}`} 
            icon={IndianRupee} 
            color="orange" 
          />
          <StatCard 
            title="गेहूँ की कुल मात्रा (किग्रा)" 
            value={`${formatNumber(stats.totalWheat, 3)} किग्रा`} 
            icon={UtensilsCrossed} 
            color="amber" 
          />
          <StatCard 
            title="चावल की कुल मात्रा (किग्रा)" 
            value={`${formatNumber(stats.totalRice, 3)} किग्रा`} 
            icon={Utensils} 
            color="cyan" 
          />
          <StatCard 
            title="कुल कार्यदिवसों की संख्या" 
            value={stats.totalEntries.toString()} 
            icon={Calendar} 
            color="blue" 
          />
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsYearlyReportOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-all active:scale-95"
              >
                <BarChart3 className="h-4 w-4" />
                वार्षिक रिपोर्ट
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">दिनांक सीमा:</span>
              </div>
              <input 
                type="date" 
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-indigo-300 focus:bg-white"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
              <span className="text-slate-300 text-xs text-center min-w-[10px]">से</span>
              <input 
                type="date" 
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-indigo-300 focus:bg-white"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
              <button 
                onClick={() => {
                  setFilterStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setFilterEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
                className="ml-2 px-2 py-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
              >
                इस माह
              </button>

              <button 
                onClick={downloadRangePDF}
                className="ml-4 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-900 transition-all active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>PDF डाउनलोड</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-xs font-semibold text-slate-500">अपडेट हो रहा है...</p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-4">दिनाँक</th>
                  <th className="px-3 py-4">उपस्थित छात्र</th>
                  <th className="px-3 py-4">आज भोजन छात्र</th>
                  <th className="px-3 py-4">गेहूँ (किग्रा)</th>
                  <th className="px-3 py-4">चावल (किग्रा)</th>
                  <th className="px-3 py-4">दूध (लीटर)</th>
                  <th className="px-3 py-4">फल का प्रकार</th>
                  <th className="px-3 py-4">भोजन लागत (₹)</th>
                  <th className="px-3 py-4">फल लागत (₹)</th>
                  <th className="px-3 py-4">भोजन+फल (₹)</th>
                  <th className="px-3 py-4">दूध लागत (₹)</th>
                  <th className="px-3 py-4">भोजन प्रकार</th>
                  <th className="px-3 py-4 text-right">कार्य</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(filteredEntries as DailyEntry[]).map((entry) => (
                  <motion.tr 
                    key={entry.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="whitespace-nowrap px-3 py-4 font-medium text-slate-700">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-3 py-4 text-slate-600">{entry.presentStudents}</td>
                    <td className="px-3 py-4 text-slate-600 font-bold">{entry.eatingStudents}</td>
                    <td className="px-3 py-4 text-slate-500 font-mono text-xs">
                      {Number(entry.wheatQty) > 0 ? Number(entry.wheatQty).toFixed(3) : '0.000'}
                    </td>
                    <td className="px-3 py-4 text-slate-500 font-mono text-xs">
                      {Number(entry.riceQty) > 0 ? Number(entry.riceQty).toFixed(3) : '0.000'}
                    </td>
                    <td className="px-3 py-4 text-slate-500 font-mono text-xs">
                      {Number(entry.milkQty) > 0 ? Number(entry.milkQty).toFixed(3) : '0.000'}
                    </td>
                    <td className="px-3 py-4 text-slate-600 text-xs">
                      {entry.fruitType || '-'}
                    </td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">
                      ₹{formatNumber(entry.foodCost, 2)}
                    </td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs text-orange-600">
                      ₹{formatNumber(entry.fruitCost, 2)}
                    </td>
                    <td className="px-3 py-4 font-bold text-slate-700 font-mono text-xs">
                      ₹{formatNumber(entry.totalFoodFruitCost, 2)}
                    </td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">
                      ₹{formatNumber(entry.milkCost, 2)}
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                        {entry.mealType}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex justify-end gap-1 sm:group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEntry(entry);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 active:bg-indigo-50 transition-all cursor-pointer"
                          title="एडिट करें"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(entry.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 active:bg-rose-50 transition-all cursor-pointer"
                          title="डिलीट करें"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {filteredEntries.length > 0 && (
                  <tr className="bg-slate-50/50 font-bold border-t-2 border-slate-200">
                    <td className="px-3 py-4 text-slate-900">कुल योग</td>
                    <td className="px-3 py-4 text-slate-700">-</td>
                    <td className="px-3 py-4 text-indigo-600 font-mono font-bold">{stats.totalStudentsFeeding}</td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">{stats.totalWheat.toFixed(3)}</td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">{stats.totalRice.toFixed(3)}</td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">{stats.totalMilk.toFixed(3)}</td>
                    <td className="px-3 py-4 text-slate-700">-</td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">₹{formatNumber(stats.currentMonthCost, 2)}</td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">₹{formatNumber(stats.totalFruitCost, 2)}</td>
                    <td className="px-3 py-4 text-emerald-600 font-mono text-xs">₹{formatNumber(stats.currentMonthCost + stats.totalFruitCost, 2)}</td>
                    <td className="px-3 py-4 text-slate-700 font-mono text-xs">₹{formatNumber(stats.totalMilkCost, 2)}</td>
                    <td className="px-3 py-4 text-slate-700">-</td>
                    <td className="px-3 py-4 text-right">-</td>
                  </tr>
                )}

                {filteredEntries.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-400 font-medium">
                      कोई डेटा नहीं मिला
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Entry Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <EntryFormModal 
            onClose={() => setIsFormOpen(false)} 
            onSave={handleSaveEntry}
            initialData={editingEntry}
            entries={entries}
            menu={menu}
            settings={settings}
            isSaving={isLoading}
          />
        )}
      </AnimatePresence>

      {/* Menu Settings Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <MenuSettingsDrawer 
            onClose={() => setIsMenuOpen(false)} 
            menu={menu}
            setMenu={setMenu}
            setConfirmState={setConfirmState}
          />
        )}
      </AnimatePresence>

      {/* General Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal 
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            setSettings={setSettings}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isYearlyReportOpen && (
          <YearlyReportModal 
            isOpen={isYearlyReportOpen}
            onClose={() => setIsYearlyReportOpen(false)}
            entries={entries}
          />
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmState.isOpen && (
          <ConfirmationModal 
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            message={confirmState.message}
            onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            onConfirm={confirmState.onConfirm}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(prev => ({ ...prev, show: false }))} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: 'indigo' | 'emerald' | 'blue' | 'purple' | 'orange' | 'amber' | 'cyan' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-hover hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SettingsModal({ onClose, settings, setSettings }: any) {
  const [tempSettings, setTempSettings] = useState(settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">सेटिंग्स</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Rates */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-slate-700">
               <Calculator className="h-4 w-4" />
               <h3 className="text-sm font-bold uppercase tracking-wider">दर सेटिंग्स (प्रति छात्र)</h3>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">गेहूं दर (किग्रा)</label>
                 <input type="number" step="0.001" className="w-full rounded-lg border p-2 text-sm" value={tempSettings.wheatRatePerStudent} onChange={(e) => setTempSettings({...tempSettings, wheatRatePerStudent: parseFloat(e.target.value)})}/>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">चावल दर (किग्रा)</label>
                 <input type="number" step="0.001" className="w-full rounded-lg border p-2 text-sm" value={tempSettings.riceRatePerStudent} onChange={(e) => setTempSettings({...tempSettings, riceRatePerStudent: parseFloat(e.target.value)})}/>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">दूध दर (लीटर)</label>
                 <input type="number" step="0.001" className="w-full rounded-lg border p-2 text-sm" value={tempSettings.milkRatePerStudent} onChange={(e) => setTempSettings({...tempSettings, milkRatePerStudent: parseFloat(e.target.value)})}/>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">भोजन लागत (₹)</label>
                 <input type="number" step="0.01" className="w-full rounded-lg border p-2 text-sm" value={tempSettings.foodCostRate} onChange={(e) => setTempSettings({...tempSettings, foodCostRate: parseFloat(e.target.value)})}/>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">दूध लागत (₹)</label>
                 <input type="number" step="0.01" className="w-full rounded-lg border p-2 text-sm" value={tempSettings.milkCostRate} onChange={(e) => setTempSettings({...tempSettings, milkCostRate: parseFloat(e.target.value)})}/>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">फल लागत (₹)</label>
                 <input type="number" step="0.01" className="w-full rounded-lg border p-2 text-sm" value={tempSettings.fruitCostRate} onChange={(e) => setTempSettings({...tempSettings, fruitCostRate: parseFloat(e.target.value)})}/>
               </div>
             </div>
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t flex gap-3">
           <button 
             onClick={onClose}
             className="flex-1 py-3 text-sm font-bold text-slate-500"
           >रद्द करें</button>
           <button 
             onClick={() => {
               setSettings(tempSettings);
               onClose();
             }}
             className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100"
           >सहेजें</button>
        </div>
      </motion.div>
    </div>
  );
}

// Constants for Meal Scheduling
const MEAL_SCHEDULE: Record<number, string> = {
  1: 'सब्जी रोटी फल',
  2: 'दाल चावल',
  3: 'तहरी दूध',
  4: 'दाल रोटी',
  5: 'तहरी',
  6: 'सब्जी चावल'
};

const DAY_NAME_EN: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

function getMealForDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  const dayOfWeek = dateObj.getDay(); 
  if (dayOfWeek === 0) return ''; // Sunday
  return MEAL_SCHEDULE[dayOfWeek] || '';
}

function EntryFormModal({ onClose, onSave, initialData, entries, menu, settings, isSaving }: { 
  onClose: () => void, 
  onSave: (entry: DailyEntry) => void,
  initialData: DailyEntry | null,
  entries: DailyEntry[],
  menu: MenuItem[],
  settings: AppSettings,
  isSaving: boolean
}) {
  const [formData, setFormData] = useState<Partial<DailyEntry>>(() => {
    if (initialData) return initialData;
    const today = format(new Date(), 'yyyy-MM-dd');
    const initialMeal = getMealForDate(today);

    return {
      date: today,
      presentStudents: 0,
      eatingStudents: 0,
      mealType: initialMeal,
      fruitType: '',
    };
  });

  const selectedMeal = useMemo(() => {
    if (!formData.mealType && !formData.date) return null;
    
    // 1. Try search by the current mealType string (Hindi)
    const normalize = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '').trim();
    const target = normalize(formData.mealType || '');
    
    let found = menu.find(m => {
      const mName = normalize(m.name);
      return mName !== '' && (mName === target || mName.includes(target) || target.includes(mName));
    });

    // 2. Try search by English Day Name if menu is English-based
    if (!found && formData.date) {
      const parts = formData.date.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      const day = d.getDay();
      const engDay = DAY_NAME_EN[day];
      if (engDay) {
        found = menu.find(m => {
          const mName = normalize(m.name);
          const tEn = normalize(engDay);
          return mName !== '' && (mName === tEn || mName.includes(tEn) || tEn.includes(mName));
        });
      }
    }

    return found || menu[0] || null;
  }, [formData.mealType, formData.date, menu]);

  const isDuplicateDate = useMemo(() => {
    if (!formData.date) return false;
    const targetDate = formData.date; // already YYYY-MM-DD from input
    return entries.some(e => {
      if (e.id === initialData?.id) return false;
      
      // Try exact string match first
      if (e.date === targetDate) return true;
      
      // Try parsing both to be sure
      try {
        const d1 = parseDateSafe(e.date);
        const y = d1.getFullYear();
        const m = String(d1.getMonth() + 1).padStart(2, '0');
        const day = String(d1.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}` === targetDate;
      } catch {
        return false;
      }
    });
  }, [formData.date, entries, initialData]);

  // Auto-select meal based on day of week for NEW entries or when date changes
  useEffect(() => {
    if (!formData.date || initialData) return;
    
    const autoMeal = getMealForDate(formData.date);
    if (autoMeal && autoMeal !== formData.mealType) {
      setFormData(prev => ({ ...prev, mealType: autoMeal }));
    }
  }, [formData.date, menu, initialData]);

  // Recalculate fields based on attendance and meal type
  useEffect(() => {
    const students = Number(formData.eatingStudents) || 0;
    
    // Determine day of week
    let dayOfWeek = -1;
    let calcDate: Date | null = null;
    if (formData.date) {
      const parts = formData.date.split('-');
      calcDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      dayOfWeek = calcDate.getDay();
    }

    // Grain Calculation based on Day
    // Monday (1) and Thursday (4) = Wheat (0.100 kg)
    // Others (Tuesday, Wednesday, Friday, Saturday) = Rice (0.100 kg)
    let wheatQty = 0;
    let riceQty = 0;

    if (dayOfWeek === 1 || dayOfWeek === 4) {
      wheatQty = students * settings.wheatRatePerStudent;
    } else if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 5 || dayOfWeek === 6) {
      riceQty = students * settings.riceRatePerStudent;
    } else {
      // Fallback if date not selected yet or Sunday
      const grainType = selectedMeal?.primaryGrain || 'wheat';
      if (grainType === 'wheat') {
        wheatQty = students * settings.wheatRatePerStudent;
      } else if (grainType === 'rice') {
        riceQty = students * settings.riceRatePerStudent;
      } else if (grainType === 'both') {
        wheatQty = (students * settings.wheatRatePerStudent) / 2;
        riceQty = (students * settings.riceRatePerStudent) / 2;
      }
    }
    
    // Auto-calculate costs
    const foodCost = students * settings.foodCostRate;
    
    // FRUIT & MILK COST LOGIC:
    // 1. If explicitly Monday -> hasFruit = true
    // 2. If NOT Monday, check if this is the first entry of the week (no previous entries for this week)
    let hasFruitOverride = selectedMeal?.hasFruit || false;
    let hasMilkOverride = selectedMeal?.hasMilk || false;
    
    if (calcDate && !initialData) {
      // Fruit Logic (Monday)
      if (dayOfWeek === 1) {
        hasFruitOverride = true;
      } else if (dayOfWeek > 1 && dayOfWeek <= 6) {
        // Check if any entry in this same week (Monday to Saturday) has fruit cost
        const weekStart = new Date(calcDate);
        weekStart.setDate(calcDate.getDate() - (dayOfWeek - 1));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5); // Saturday
        weekEnd.setHours(23, 59, 59, 999);

        const hasFruitInWeek = entries.some(e => {
          const eDate = new Date(e.date);
          return eDate >= weekStart && eDate <= weekEnd && (Number(e.fruitCost) > 0);
        });

        if (!hasFruitInWeek) {
          hasFruitOverride = true;
        }
      }

      // Milk Logic (Wednesday)
      if (dayOfWeek === 3) {
        hasMilkOverride = true;
      } else if (dayOfWeek > 3 && dayOfWeek <= 6) {
        const weekStart = new Date(calcDate);
        weekStart.setDate(calcDate.getDate() - (dayOfWeek - 1));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5); // Saturday
        weekEnd.setHours(23, 59, 59, 999);

        const hasMilkInWeek = entries.some(e => {
          const eDate = new Date(e.date);
          return eDate >= weekStart && eDate <= weekEnd && (Number(e.milkCost) > 0);
        });

        if (!hasMilkInWeek) {
          hasMilkOverride = true;
        }
      }
    }

    const fruitCost = hasFruitOverride ? settings.fruitCostRate * students : 0;
    const milkQty = hasMilkOverride ? students * settings.milkRatePerStudent : 0;
    const milkCost = hasMilkOverride ? students * settings.milkCostRate : 0;

    setFormData(prev => {
      let updatedMealType = prev.mealType || '';

      if (hasFruitOverride) {
        if (!updatedMealType.includes('फल')) {
          updatedMealType = `${updatedMealType} फल`.trim();
        }
      } else if (dayOfWeek !== 1 && updatedMealType.includes(' फल')) {
        updatedMealType = updatedMealType.replace(' फल', '').trim();
      }

      if (hasMilkOverride) {
        if (!updatedMealType.includes('दूध')) {
          updatedMealType = `${updatedMealType} दूध`.trim();
        }
      } else if (dayOfWeek !== 3 && updatedMealType.includes(' दूध')) {
        updatedMealType = updatedMealType.replace(' दूध', '').trim();
      }

      if (
        prev.wheatQty === wheatQty &&
        prev.riceQty === riceQty &&
        prev.milkQty === milkQty &&
        prev.foodCost === foodCost &&
        prev.milkCost === milkCost &&
        prev.fruitCost === fruitCost &&
        prev.mealType === updatedMealType
      ) return prev;

      return {
        ...prev,
        wheatQty,
        riceQty,
        milkQty,
        foodCost,
        milkCost,
        fruitCost,
        totalFoodFruitCost: foodCost + fruitCost,
        fruitType: hasFruitOverride ? (prev.fruitType || 'केले') : '',
        mealType: updatedMealType
      };
    });
  }, [formData.eatingStudents, formData.mealType, formData.date, entries, settings, selectedMeal, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: DailyEntry = {
      ...(formData as DailyEntry),
      id: initialData?.id || `new_${Date.now()}`,
      cumulativeTotal: 0, 
    };
    onSave(entry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">
            {initialData ? 'एंट्री संपादित करें' : 'नई एंट्री जोड़ें'}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 overflow-y-auto max-h-[80vh]">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">दिनाँक</label>
              <input 
                type="date" 
                required
                className={cn(
                  "w-full rounded-xl border px-4 py-2.5 outline-none focus:ring-4 transition-all font-medium",
                  isDuplicateDate 
                    ? "border-rose-300 bg-rose-50 focus:border-rose-500 focus:ring-rose-500/10" 
                    : "border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/10"
                )}
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
              {isDuplicateDate && (
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
                  <AlertCircle className="h-3 w-3" />
                  इस तारीख की एंट्री पहले से मौजूद है!
                </p>
              )}
            </div>

            {/* Attendance */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">उपस्थित छात्र</label>
              <input 
                type="number" 
                required
                min="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all"
                value={formData.presentStudents}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setFormData(prev => ({ 
                    ...prev, 
                    presentStudents: val,
                    eatingStudents: val // Strictly automated as per user request for simplicity in new entry
                  }));
                }}
              />
            </div>

            {/* Eating Students */}
            <div className="space-y-1.5 opacity-75">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">भोजन करने वाले छात्र (ऑटो)</label>
              <input 
                type="number" 
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 outline-none font-medium cursor-not-allowed"
                value={formData.eatingStudents}
              />
            </div>

            {/* Meal Type */}
            <div className="space-y-1.5 opacity-75">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">भोजन का प्रकार (ऑटो)</label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 font-medium text-slate-700 cursor-not-allowed">
                {formData.mealType || '---'}
              </div>
            </div>

            {/* Calculations Preview (ReadOnly) */}
            <div className="sm:col-span-2 rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100/50 grid grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-indigo-400">गेहूँ</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-indigo-700">{formatNumber(Number(formData.wheatQty) || 0, 3)}</span>
                  <span className="text-[10px] text-indigo-500 font-medium">किग्रा</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-indigo-400">चावल</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-indigo-700">{formatNumber(Number(formData.riceQty) || 0, 3)}</span>
                  <span className="text-[10px] text-indigo-500 font-medium">किग्रा</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-indigo-400">दूध</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-indigo-700">{formatNumber(Number(formData.milkQty) || 0, 3)}</span>
                  <span className="text-[10px] text-indigo-500 font-medium">लीटर</span>
                </div>
              </div>
              <div className="space-y-1 border-t border-indigo-100/50 pt-3">
                <p className="text-[10px] font-bold uppercase text-indigo-400">परिवर्तन लागत</p>
                <div className="flex items-baseline gap-1 text-indigo-700">
                  <span className="text-xs font-bold">₹</span>
                  <span className="text-lg font-bold">{formatNumber(Number(formData.foodCost) || 0, 2)}</span>
                </div>
              </div>
              <div className="space-y-1 border-t border-indigo-100/50 pt-3">
                <p className="text-[10px] font-bold uppercase text-indigo-400">फल लागत</p>
                <div className="flex items-baseline gap-1 text-emerald-600">
                  <span className="text-xs font-bold">₹</span>
                  <span className="text-lg font-bold">{formatNumber(Number(formData.fruitCost) || 0, 2)}</span>
                </div>
              </div>
              <div className="space-y-1 border-t border-indigo-100/50 pt-3">
                <p className="text-[10px] font-bold uppercase text-indigo-400">दूध लागत</p>
                <div className="flex items-baseline gap-1 text-blue-600">
                  <span className="text-xs font-bold">₹</span>
                  <span className="text-lg font-bold">{formatNumber(Number(formData.milkCost) || 0, 2)}</span>
                </div>
              </div>
              <div className="sm:col-span-3 space-y-1 border-t border-indigo-100/50 pt-3">
                <p className="text-[10px] font-bold uppercase text-indigo-400">कुल अनुमानित लागत</p>
                <div className="flex items-baseline gap-1 text-indigo-700">
                  <span className="text-xs font-bold">₹</span>
                  <span className="text-xl font-black">{formatNumber((Number(formData.foodCost) || 0) + (Number(formData.fruitCost) || 0) + (Number(formData.milkCost) || 0), 2)}</span>
                </div>
              </div>
            </div>

            {/* Fruit Type (if applicable) */}
            {selectedMeal?.hasFruit && (
              <div className="sm:col-span-2 space-y-1.5 opacity-75">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">फल का प्रकार</label>
                <input 
                  type="text" 
                  readOnly
                  placeholder="ऑटो-जेनरेटेड"
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 outline-none cursor-not-allowed"
                  value={formData.fruitType}
                />
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50"
            >
              रद्द करें
            </button>
            <button 
              type="submit"
              disabled={isSaving || isDuplicateDate}
              className={cn(
                "flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-[0.98] flex items-center justify-center gap-2",
                (isSaving || isDuplicateDate) && "bg-indigo-400 cursor-not-allowed"
              )}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {initialData ? 'अपडेट करें' : 'सहेजें'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MenuSettingsDrawer({ onClose, menu, setMenu, setConfirmState }: { 
  onClose: () => void, 
  menu: MenuItem[], 
  setMenu: React.Dispatch<React.SetStateAction<MenuItem[]>>,
  setConfirmState: React.Dispatch<React.SetStateAction<any>>
}) {
  const [newMenuItem, setNewMenuItem] = useState<Partial<MenuItem>>({
    name: '',
    primaryGrain: 'rice',
    hasMilk: false,
    hasFruit: false,
  });

  const handleAddMenuItem = () => {
    if (!newMenuItem.name) return;
    const item: MenuItem = {
      ...(newMenuItem as MenuItem),
      id: `menu_${Date.now()}`,
      description: '',
    };
    setMenu([...menu, item]);
    setNewMenuItem({ name: '', primaryGrain: 'rice', hasMilk: false, hasFruit: false });
  };

  const handleDeleteMenuItem = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'मीनू आइटम हटाएं?',
      message: 'क्या आप वाकई इस मीनू आइटम को हटाना चाहते हैं?',
      onConfirm: () => {
        setMenu(menu.filter(m => m.id !== id));
        setConfirmState((prev: any) => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-[2px]">
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="h-full w-full max-w-md bg-white shadow-2xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">मीनू प्रबंधन</h2>
              <p className="text-xs text-slate-500 mt-0.5">भोजन के प्रकार सेट करें</p>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">वर्तमान मीनू</h3>
              <div className="space-y-2">
                {menu.map(item => (
                  <div key={item.id} className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-white hover:shadow-sm transition-all">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">{item.primaryGrain}</span>
                        {item.hasMilk && <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded uppercase font-bold">दूध</span>}
                        {item.hasFruit && <span className="text-[10px] bg-emerald-50 text-emerald-500 px-1.5 py-0.5 rounded uppercase font-bold">फल</span>}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteMenuItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">नया आइटम जोड़ें</h3>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="आइटम का नाम"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-all font-medium"
                  value={newMenuItem.name}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                />
                
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">मुख्य अनाज</p>
                  <div className="flex gap-2">
                    {['wheat', 'rice', 'both'].map((grain) => (
                      <button
                        key={grain}
                        type="button"
                        onClick={() => setNewMenuItem({ ...newMenuItem, primaryGrain: grain as any })}
                        className={cn(
                          "flex-1 py-2 px-2 rounded-lg text-[10px] font-bold uppercase transition-all border",
                          newMenuItem.primaryGrain === grain 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                        )}
                      >
                        {grain === 'wheat' ? 'गेहूं' : grain === 'rice' ? 'चावल' : 'दोनों'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2">
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newMenuItem.hasMilk} 
                        onChange={(e) => setNewMenuItem({ ...newMenuItem, hasMilk: e.target.checked })}
                      />
                      <span className="text-xs font-medium text-slate-600">दूध</span>
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newMenuItem.hasFruit} 
                        onChange={(e) => setNewMenuItem({ ...newMenuItem, hasFruit: e.target.checked })}
                      />
                      <span className="text-xs font-medium text-slate-600">फल</span>
                   </label>
                </div>

                <button 
                  type="button"
                  onClick={handleAddMenuItem}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                >
                  आइटम जोड़ें
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={cn(
        "fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl border",
        type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
      )}
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        type === 'success' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
      )}>
        {type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <X className="h-5 w-5" />}
      </div>
      <span className="text-sm font-bold">{message}</span>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function YearlyReportModal({ onClose, entries }: any) {
  // selectedYear represents the START year of the financial year (e.g., 2025 for 2025-26)
  const getCurrentFinancialYear = () => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  };

  const [selectedFY, setSelectedFY] = useState(getCurrentFinancialYear());
  
  const financialYears = useMemo(() => {
    const fySet = new Set<number>();
    entries.forEach((e: any) => {
      const d = parseDateSafe(e.date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = d.getMonth();
        // If month is Apr-Dec, FY is year. If Jan-Mar, FY is year-1.
        const fy = month >= 3 ? year : year - 1;
        fySet.add(fy);
      }
    });
    
    if (fySet.size === 0) return [getCurrentFinancialYear()];
    return Array.from(fySet).sort((a, b) => b - a);
  }, [entries]);

  const monthlyStats = useMemo(() => {
    // Financial year months index: Apr(3), May(4)...Dec(11), Jan(0), Feb(1), Mar(2)
    const fyIndices = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
    
    return fyIndices.map((monthIndex) => {
      // If month is Jan, Feb, Mar, the calendar year is the next year of the FY start
      const calendarYear = monthIndex < 3 ? selectedFY + 1 : selectedFY;
      
      const monthEntries = entries.filter((e: any) => {
        const d = parseDateSafe(e.date);
        return d.getFullYear() === calendarYear && d.getMonth() === monthIndex;
      });

      return {
        month: monthIndex + 1,
        monthName: new Date(2000, monthIndex).toLocaleString('hi-IN', { month: 'long' }),
        count: monthEntries.length,
        present: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.presentStudents) || 0), 0),
        eating: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.eatingStudents) || 0), 0),
        foodCost: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.foodCost) || 0), 0),
        fruitCost: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.fruitCost) || 0), 0),
        milkCost: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.milkCost) || 0), 0),
        totalCost: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.foodCost || 0) + Number(e.fruitCost || 0) + Number(e.milkCost || 0)), 0),
        wheat: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.wheatQty) || 0), 0),
        rice: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.riceQty) || 0), 0),
        milkQty: monthEntries.reduce((acc: number, e: any) => acc + (Number(e.milkQty) || 0), 0),
      };
    });
  }, [entries, selectedFY]);

  const yearlyTotals = useMemo(() => {
    return monthlyStats.reduce((acc, m) => ({
      present: acc.present + m.present,
      eating: acc.eating + m.eating,
      foodCost: acc.foodCost + m.foodCost,
      fruitCost: acc.fruitCost + m.fruitCost,
      milkCost: acc.milkCost + m.milkCost,
      totalCost: acc.totalCost + m.totalCost,
      wheat: acc.wheat + m.wheat,
      rice: acc.rice + m.rice,
      milkQty: acc.milkQty + m.milkQty,
      days: acc.days + m.count,
    }), { present: 0, eating: 0, foodCost: 0, fruitCost: 0, milkCost: 0, totalCost: 0, wheat: 0, rice: 0, milkQty: 0, days: 0 });
  }, [monthlyStats]);

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    const fyText = `FY ${selectedFY}-${String(selectedFY + 1).slice(-2)}`;
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text("MDM Yearly Report", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Financial Year: ${fyText}`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 34);
    
    const tableData = monthlyStats.map((m, i) => [
      new Date(2000, [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2][i]).toLocaleString('en-US', { month: 'long' }),
      m.count,
      formatNumber(m.present, 0),
      formatNumber(m.eating, 0),
      formatNumber(m.foodCost, 2),
      formatNumber(m.fruitCost, 2),
      formatNumber(m.milkCost, 2),
      formatNumber(m.totalCost, 2),
      formatNumber(m.wheat, 3),
      formatNumber(m.rice, 3),
      formatNumber(m.milkQty, 3),
    ]);

    tableData.push([
      'GRAND TOTAL',
      yearlyTotals.days,
      formatNumber(yearlyTotals.present, 0),
      formatNumber(yearlyTotals.eating, 0),
      formatNumber(yearlyTotals.foodCost, 2),
      formatNumber(yearlyTotals.fruitCost, 2),
      formatNumber(yearlyTotals.milkCost, 2),
      formatNumber(yearlyTotals.totalCost, 2),
      formatNumber(yearlyTotals.wheat, 3),
      formatNumber(yearlyTotals.rice, 3),
      formatNumber(yearlyTotals.milkQty, 3),
    ]);

    autoTable(doc, {
      head: [['Month', 'Days', 'Total Students', 'Eating', 'Conversion Cost', 'Fruit Cost', 'Milk Cost', 'Total Cost', 'Wheat (kg)', 'Rice (kg)', 'Milk (L)']],
      body: tableData,
      startY: 40,
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle',
        font: 'helvetica'
      },
      headStyles: { 
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right', fontStyle: 'bold' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249]; // Slate-100
          data.cell.styles.fontStyle = 'bold';
        }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Slate-50
      },
      margin: { top: 40 }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
        doc.text("Generated by MDM Management App", 14, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`MDM_Yearly_Report_${fyText.replace(' ', '_')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">वार्षिक रिपोर्ट (वित्तीय वर्ष)</h3>
              <p className="text-xs text-slate-500">अप्रैल से मार्च विवरण • FY {selectedFY}-{String(selectedFY + 1).slice(-2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={downloadPDF}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Download className="h-4 w-4" />
              PDF डाउनलोड
            </button>
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
              {financialYears.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedFY(y)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                    selectedFY === y ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {y}-{String(y + 1).slice(-2)}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto p-4 flex-1">
          <div className="min-w-[1000px]">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">माह</th>
                  <th className="px-4 py-3">कार्यदिवस</th>
                  <th className="px-4 py-3">कुल छात्र</th>
                  <th className="px-4 py-3">भोजन छात्र</th>
                  <th className="px-4 py-3">परिवर्तन लागत (₹)</th>
                  <th className="px-4 py-3">फल लागत (₹)</th>
                  <th className="px-4 py-3">दूध लागत (₹)</th>
                  <th className="px-4 py-3">कुल लागत (₹)</th>
                  <th className="px-4 py-3">गेहूँ (किग्रा)</th>
                  <th className="px-4 py-3">चावल (किग्रा)</th>
                  <th className="px-4 py-3">दूध (लीटर)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((m) => (
                  <tr key={m.month} className={cn(
                    "group bg-white border border-slate-100 rounded-xl transition-all hover:bg-slate-50",
                    m.count === 0 ? "opacity-40 grayscale" : "shadow-sm"
                  )}>
                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-slate-800 capitalize">{m.monthName}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        {m.count} दिन
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-slate-600">{formatNumber(m.present, 0)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-indigo-600">{formatNumber(m.eating, 0)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-emerald-600">₹{formatNumber(m.foodCost, 2)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-emerald-600">₹{formatNumber(m.fruitCost, 2)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-emerald-600">₹{formatNumber(m.milkCost, 2)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-emerald-700">₹{formatNumber(m.totalCost, 2)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-amber-600">{formatNumber(m.wheat, 3)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-cyan-600">{formatNumber(m.rice, 3)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-blue-600">{formatNumber(m.milkQty, 3)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                  <td className="px-4 py-4 rounded-l-2xl">
                    <span className="text-sm font-bold uppercase tracking-widest">कुल योग</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold">{yearlyTotals.days}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold">{formatNumber(yearlyTotals.present, 0)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold">{formatNumber(yearlyTotals.eating, 0)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold whitespace-nowrap">₹{formatNumber(yearlyTotals.foodCost, 2)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold whitespace-nowrap">₹{formatNumber(yearlyTotals.fruitCost, 2)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold whitespace-nowrap">₹{formatNumber(yearlyTotals.milkCost, 2)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold whitespace-nowrap">₹{formatNumber(yearlyTotals.totalCost, 2)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold">{formatNumber(yearlyTotals.wheat, 3)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold">{formatNumber(yearlyTotals.rice, 3)}</span>
                  </td>
                  <td className="px-4 py-4 rounded-r-2xl">
                    <span className="text-sm font-bold">{formatNumber(yearlyTotals.milkQty, 3)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="bg-slate-50 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-slate-500">औसत भोजन: <span className="font-bold text-slate-700">{formatNumber(yearlyTotals.days > 0 ? yearlyTotals.eating / yearlyTotals.days : 0, 1)} छात्र/दिन</span></span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 italic">
            * वित्तीय वर्ष अप्रैल से मार्च तक गणना की जाती है
          </div>
          <button 
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-8 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-900 active:scale-95"
          >
            बंद करें
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
            <Trash2 className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
        </div>
        <div className="border-t border-slate-100 p-4 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            रद्द करें
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all"
          >
            मिटाएं
          </button>
        </div>
      </motion.div>
    </div>
  );
}
