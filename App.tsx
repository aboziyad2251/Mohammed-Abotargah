import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, ViewMode, APPOINTMENT_COLORS } from './types';
import { AppointmentForm } from './components/AppointmentForm';
import { NextWidget } from './components/NextWidget';
import { CountdownTimer } from './components/CountdownTimer';
import { parseNaturalLanguageAppointment } from './services/geminiService';
import { 
  ChevronLeft, ChevronRight, Plus, Download, Upload, 
  LayoutList, Calendar as CalendarIcon, Sparkles, Trash2, Clock, 
  Menu, Search, ExternalLink
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isSameDay, addMonths, subMonths, 
  startOfWeek, endOfWeek, addWeeks, subWeeks, 
  isToday, addDays, subDays 
} from 'date-fns';

export default function App() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [naturalInput, setNaturalInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Check if we are in "Widget Mode" (small popup window)
  const isWidgetMode = useMemo(() => {
    return new URLSearchParams(window.location.search).get('mode') === 'widget';
  }, []);

  // --- Persistence & Sync ---
  const loadAppointments = () => {
    const saved = localStorage.getItem('chronos_appointments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hydrated = parsed.map((a: any) => ({
          ...a,
          start: new Date(a.start),
          end: new Date(a.end)
        }));
        setAppointments(hydrated);
      } catch (e) {
        console.error("Failed to load appointments", e);
      }
    }
  };

  useEffect(() => {
    loadAppointments();

    // Listen for storage events to sync across windows (Main Window <-> Widget Window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chronos_appointments') {
        loadAppointments();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    // Save to local storage on ANY change.
    // We only write if we have state, to prevent overwriting with empty state on initial load
    // But since we load in mount, we need to be careful.
    // Simple check: if we are in widget mode, we generally treat it as read-only for state 
    // to avoid race conditions, unless we implement full syncing.
    // For this simple app: Main window writes, Widget reads. 
    // However, the prompt asked for the app to function. 
    // We will let the widget write if needed (e.g. if we added buttons there), but currently it's read-only.
    if (!isWidgetMode) {
        localStorage.setItem('chronos_appointments', JSON.stringify(appointments));
    }
  }, [appointments, isWidgetMode]);

  // --- Notification Logic (Simple Poll) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      appointments.forEach(appt => {
        if (appt.alertMinutesBefore && appt.alertMinutesBefore.length > 0) {
           const timeToStart = (appt.start.getTime() - now.getTime()) / 60000;
           appt.alertMinutesBefore.forEach(min => {
             if (Math.abs(timeToStart - min) < 1) {
               console.log(`Notification for ${appt.title} in ${min} mins`);
             }
           });
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [appointments]);

  // --- Handlers ---
  const handleSaveAppointment = (apptData: Omit<Appointment, 'id'>) => {
    if (selectedAppointment) {
      setAppointments(prev => prev.map(a => a.id === selectedAppointment.id ? { ...apptData, id: a.id } : a));
    } else {
      setAppointments(prev => [...prev, { ...apptData, id: crypto.randomUUID() }]);
    }
    setIsFormOpen(false);
    setSelectedAppointment(null);
  };

  const handleDeleteAppointment = (id: string) => {
    if (confirm('Are you sure you want to delete this appointment?')) {
      setAppointments(prev => prev.filter(a => a.id !== id));
      if (selectedAppointment?.id === id) {
        setIsFormOpen(false);
        setSelectedAppointment(null);
      }
    }
  };

  const handleAiSmartAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalInput.trim()) return;
    setIsAiLoading(true);
    const result = await parseNaturalLanguageAppointment(naturalInput, new Date());
    setIsAiLoading(false);

    if (result) {
      setAppointments(prev => [...prev, {
        id: crypto.randomUUID(),
        title: result.title,
        description: result.description || '',
        start: result.start,
        end: result.end,
        color: result.color || APPOINTMENT_COLORS[0],
        alertMinutesBefore: [15]
      }]);
      setNaturalInput('');
      setCurrentDate(result.start);
    } else {
      alert("Could not understand the appointment details. Please try again.");
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appointments));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "chronos_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const hydrated = parsed.map((a: any) => ({
          ...a,
          start: new Date(a.start),
          end: new Date(a.end)
        }));
        setAppointments(prev => {
           const existingIds = new Set(prev.map(p => p.id));
           const newItems = hydrated.filter((h: Appointment) => !existingIds.has(h.id));
           return [...prev, ...newItems];
        });
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const openWidgetMode = () => {
    window.open(
      `${window.location.pathname}?mode=widget`, 
      'ChronosWidget', 
      'width=400,height=320,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no'
    );
  };

  const navigate = (direction: 'prev' | 'next') => {
    const amount = direction === 'next' ? 1 : -1;
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, amount));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, amount));
    else setCurrentDate(addDays(currentDate, amount));
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => 
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [appointments, searchTerm]);

  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
    } else if (viewMode === 'week') {
      return eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });
    } else {
      return [currentDate];
    }
  }, [currentDate, viewMode]);

  const getDayAppointments = (day: Date) => {
    return filteredAppointments.filter(a => isSameDay(a.start, day))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  };

  // --- WIDGET MODE RENDER ---
  if (isWidgetMode) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col p-4 items-center justify-center">
         {/* We use a slight hack to make the body background handle transparency better if the OS supports it, 
             otherwise we give it a slate background */}
         <div className="w-full max-w-sm">
            <NextWidget appointments={appointments} />
            <div className="mt-2 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Chronos Desktop</p>
            </div>
         </div>
         <style>{`
           body { background-color: #0f172a; overflow: hidden; }
         `}</style>
      </div>
    );
  }

  // --- STANDARD MODE RENDER ---

  const renderHeader = () => (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
             <div className="bg-indigo-600 p-2 rounded-lg">
               <CalendarIcon className="w-5 h-5 text-white" />
             </div>
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 hidden sm:block">
               Chronos
             </h1>
          </div>

          <div className="hidden md:flex items-center space-x-4">
             <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
               {(['month', 'week', 'day', 'list'] as ViewMode[]).map(mode => (
                 <button
                   key={mode}
                   onClick={() => setViewMode(mode)}
                   className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                     viewMode === mode 
                       ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                       : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                   }`}
                 >
                   {mode.charAt(0).toUpperCase() + mode.slice(1)}
                 </button>
               ))}
             </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
               onClick={() => { setSelectedAppointment(null); setIsFormOpen(true); }}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
             >
               <Plus className="w-4 h-4" />
               <span className="hidden sm:inline">Add Event</span>
             </button>
             <button 
               className="md:hidden p-2 text-slate-500"
               onClick={() => setShowMobileMenu(!showMobileMenu)}
             >
               <Menu className="w-6 h-6" />
             </button>
          </div>
        </div>
      </div>
      
      {showMobileMenu && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
            <div className="flex flex-col gap-2">
               {(['month', 'week', 'day', 'list'] as ViewMode[]).map(mode => (
                 <button
                   key={mode}
                   onClick={() => { setViewMode(mode); setShowMobileMenu(false); }}
                   className={`px-4 py-2 text-left text-sm font-medium rounded-md ${
                     viewMode === mode 
                       ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                       : 'text-slate-500'
                   }`}
                 >
                   {mode.charAt(0).toUpperCase() + mode.slice(1)} View
                 </button>
               ))}
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
               <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 bg-slate-50 rounded-lg">
                 <Download className="w-4 h-4" /> Export
               </button>
               <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 bg-slate-50 rounded-lg cursor-pointer">
                 <Upload className="w-4 h-4" /> Import
                 <input type="file" onChange={handleImport} className="hidden" accept=".json" />
               </label>
            </div>
        </div>
      )}
    </header>
  );

  const renderToolbar = () => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-1">
          <button onClick={() => navigate('prev')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
          <span className="px-4 font-semibold text-slate-700 dark:text-slate-200 min-w-[140px] text-center">
            {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy')}
          </span>
          <button onClick={() => navigate('next')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
        </div>
        <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Today
        </button>
      </div>

      <div className="w-full md:w-auto flex gap-3">
         <div className="relative flex-1 md:w-64">
           <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
           <input 
             type="text" 
             placeholder="Search events..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
           />
         </div>
      </div>
    </div>
  );

  const renderSmartAdd = () => (
    <form onSubmit={handleAiSmartAdd} className="mb-8 relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        {isAiLoading ? (
           <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
        ) : (
           <Sparkles className="h-5 w-5 text-indigo-500 group-focus-within:text-indigo-600" />
        )}
      </div>
      <input
        type="text"
        value={naturalInput}
        onChange={(e) => setNaturalInput(e.target.value)}
        placeholder="Ask AI to schedule: 'Lunch with Sarah tomorrow at 12pm'..."
        className="block w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-xl shadow-lg shadow-indigo-500/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 transition-all text-base"
        disabled={isAiLoading}
      />
      <div className="absolute right-2 top-2">
         <button 
          type="submit"
          disabled={!naturalInput || isAiLoading}
          className="bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
         >
           Smart Add
         </button>
      </div>
    </form>
  );

  const renderCalendar = () => {
    if (viewMode === 'list') {
      const sorted = filteredAppointments.sort((a, b) => a.start.getTime() - b.start.getTime());
      
      return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
           {sorted.length === 0 ? (
             <div className="p-8 text-center text-slate-500">No appointments found.</div>
           ) : (
             <div className="divide-y divide-slate-100 dark:divide-slate-700">
               {sorted.map(appt => (
                 <div key={appt.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                    <div className="flex gap-4 items-center">
                       <div className={`w-3 h-12 rounded-full ${appt.color}`}></div>
                       <div>
                         <h3 className="font-semibold text-slate-800 dark:text-white text-lg">{appt.title}</h3>
                         <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                           <span className="flex items-center gap-1">
                             <CalendarIcon className="w-3 h-3" />
                             {format(appt.start, 'MMM d, yyyy')}
                           </span>
                           <span className="flex items-center gap-1">
                             <Clock className="w-3 h-3" />
                             {format(appt.start, 'h:mm a')} - {format(appt.end, 'h:mm a')}
                           </span>
                         </div>
                         {appt.description && <p className="text-sm text-slate-400 mt-1">{appt.description}</p>}
                       </div>
                    </div>
                    <div className="flex items-center gap-4 self-end sm:self-center">
                       <CountdownTimer targetDate={appt.start} compact />
                       <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button 
                            onClick={() => { setSelectedAppointment(appt); setIsFormOpen(true); }}
                            className="p-2 text-slate-400 hover:text-indigo-500"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteAppointment(appt.id)}
                            className="p-2 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      );
    }

    return (
      <div className={`grid ${viewMode === 'month' ? 'grid-cols-7' : viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700`}>
        {viewMode !== 'day' && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-slate-50 dark:bg-slate-800 p-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
        {calendarDays.map((day) => {
          const dayAppts = getDayAppointments(day);
          const isSelectedMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);
          return (
            <div 
              key={day.toISOString()} 
              className={`
                min-h-[120px] bg-white dark:bg-slate-900 p-2 transition-colors relative group
                ${!isSelectedMonth && viewMode === 'month' ? 'bg-slate-50/50 dark:bg-slate-900/50 text-slate-400' : ''}
                ${isTodayDate ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}
              `}
              onClick={() => {
                if (viewMode === 'month') {
                   // Optional: Click empty space logic
                }
              }}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`
                  text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                  ${isTodayDate ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700 dark:text-slate-300'}
                `}>
                  {format(day, 'd')}
                </span>
                {viewMode === 'week' && <span className="text-xs text-slate-400">{format(day, 'EEE')}</span>}
              </div>
              <div className="space-y-1.5 mt-1">
                {dayAppts.map(appt => (
                  <button
                    key={appt.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedAppointment(appt); setIsFormOpen(true); }}
                    className={`
                      w-full text-left px-2 py-1 rounded text-xs font-medium truncate flex items-center gap-1.5 transition-all hover:scale-[1.02]
                      ${appt.color} text-white shadow-sm
                    `}
                  >
                    <span className="w-1 h-1 bg-white rounded-full opacity-75 flex-shrink-0"></span>
                    <span className="truncate flex-1">{appt.title}</span>
                  </button>
                ))}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsFormOpen(true); }}
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-indigo-600 transition-opacity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900">
      {renderHeader()}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 space-y-8">
             {renderSmartAdd()}
             {renderToolbar()}
             {renderCalendar()}
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
               <NextWidget appointments={appointments} />
               <button 
                 onClick={openWidgetMode}
                 className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm"
               >
                 <ExternalLink className="w-4 h-4" />
                 Open Desktop Widget
               </button>
            </div>
            
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 hidden lg:block">
               <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                 <LayoutList className="w-4 h-4 text-indigo-500" />
                 Today's Agenda
               </h3>
               <div className="space-y-3">
                 {appointments
                   .filter(a => isSameDay(a.start, new Date()))
                   .sort((a,b) => a.start.getTime() - b.start.getTime())
                   .map(appt => (
                     <div key={appt.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => { setSelectedAppointment(appt); setIsFormOpen(true); }}>
                       <div className={`w-1.5 h-1.5 mt-2 rounded-full ${appt.color}`}></div>
                       <div>
                         <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{appt.title}</p>
                         <p className="text-xs text-slate-500">{format(appt.start, 'h:mm a')}</p>
                       </div>
                     </div>
                   ))}
                  {appointments.filter(a => isSameDay(a.start, new Date())).length === 0 && (
                    <p className="text-sm text-slate-400 italic">No events today.</p>
                  )}
               </div>
            </div>
          </div>
        </div>
      </main>

      <AppointmentForm 
        isOpen={isFormOpen}
        existingAppointment={selectedAppointment}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        onCancel={() => { setIsFormOpen(false); setSelectedAppointment(null); }}
      />
    </div>
  );
}