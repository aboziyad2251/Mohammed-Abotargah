
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Appointment, ViewMode, APPOINTMENT_COLORS, SyncSettings, DragState, UrgencyLevel, Theme, EventStatus } from './types';
import { AppointmentForm } from './components/AppointmentForm';
import { NextWidget } from './components/NextWidget';
import { CountdownTimer } from './components/CountdownTimer';
import { SyncSettingsModal } from './components/SyncSettingsModal';
import { SmartPlanDrawer } from './components/SmartPlanDrawer';
import { AiRequestModal } from './components/AiRequestModal';
import { parseNaturalLanguageAppointment } from './services/geminiService';
import { initGoogleApi, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from './services/googleCalendarApi';
import { parseICSContent, generateICSContent, downloadICSFile } from './services/calendarIntegration';
import { saveAppointmentsToStorage, loadAppointmentsFromStorage } from './services/storage';
import { 
  ChevronLeft, ChevronRight, Plus, Download, Upload, 
  LayoutList, Calendar as CalendarIcon, Sparkles, Trash2, Clock, 
  Menu, Search, ExternalLink, RefreshCw, GripVertical, Check, Cloud, Zap, AlertTriangle, ArrowRight, FileText,
  Sun, Moon, Sunset, Flag, CheckCircle, XCircle, AlertCircle, Eye, PlayCircle, MessageSquare, MapPin, Navigation
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
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, appointmentId: null });
  const [isProcessingSync, setIsProcessingSync] = useState(false);
  
  // Geolocation State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const notifiedEventsRef = useRef<Set<string>>(new Set());
  
  // Theme State
  const [theme, setTheme] = useState<Theme>('light');

  // Smart Plan State
  const [isSmartPlanOpen, setIsSmartPlanOpen] = useState(false);
  const [smartPlanAppointment, setSmartPlanAppointment] = useState<Appointment | null>(null);

  // AI Request State
  const [isAiRequestOpen, setIsAiRequestOpen] = useState(false);
  const [aiRequestAppointment, setAiRequestAppointment] = useState<Appointment | null>(null);

  // Auto Save State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Sync Settings State
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({ defaultProvider: 'none', autoSync: false });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  
  // AI Draft State (Found result pending confirmation)
  const [aiDraft, setAiDraft] = useState<Omit<Appointment, 'id'> | null>(null);

  // Check if we are in "Widget Mode" (small popup window)
  const isWidgetMode = useMemo(() => {
    return new URLSearchParams(window.location.search).get('mode') === 'widget';
  }, []);

  // --- Persistence & Sync ---
  const loadAppointments = async () => {
    try {
      // 1. Try migration from localStorage (legacy)
      const localData = localStorage.getItem('chronos_appointments');
      if (localData) {
        try {
           console.log("Migrating data from LocalStorage to IndexedDB...");
           const parsed = JSON.parse(localData);
           const hydrated = parsed.map((a: any) => ({
             ...a,
             start: new Date(a.start),
             end: new Date(a.end),
             urgency: a.urgency || 'medium', 
             status: a.status || 'pending'
           }));
           setAppointments(hydrated);
           
           // Save immediately to DB to complete migration
           await saveAppointmentsToStorage(hydrated);
           
           // Clear legacy storage
           localStorage.removeItem('chronos_appointments');
           setIsDataLoaded(true);
           return;
        } catch (e) {
           console.error("Migration failed, falling back to DB", e);
        }
      }

      // 2. Load from IndexedDB
      const dbData = await loadAppointmentsFromStorage();
      if (dbData) {
        setAppointments(dbData);
      }
    } catch (e) {
      console.error("Failed to load appointments from storage", e);
    } finally {
      setIsDataLoaded(true);
    }
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('chronos_sync_settings');
    if (saved) {
      try {
        setSyncSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load sync settings", e);
      }
    }
    
    // Load Theme
    const savedTheme = localStorage.getItem('chronos_theme') as Theme;
    if (savedTheme) setTheme(savedTheme);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
  };

  useEffect(() => {
    loadAppointments();
    loadSettings();

    // Request notification permission
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    // Start Geolocation Tracking
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    // Listen for storage events to sync across windows (Main Window <-> Widget Window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chronos_sync_settings') {
        loadSettings();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Apply Theme Classes
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'semi');

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'semi') {
      root.classList.add('dark', 'semi'); 
    }

    if (!isWidgetMode) {
      localStorage.setItem('chronos_theme', theme);
    }
  }, [theme, isWidgetMode]);

  // Attempt to Initialize Google API
  useEffect(() => {
    if (syncSettings.googleClientId) {
      initGoogleApi(syncSettings.googleClientId).catch(e => console.log("Google API pre-init deferred or failed", e));
    }
  }, [syncSettings.googleClientId]);

  // AUTO SAVE EFFECT
  useEffect(() => {
    if (!isWidgetMode && isDataLoaded) {
        setSaveStatus('saving');
        const timeout = setTimeout(async () => {
           try {
             await saveAppointmentsToStorage(appointments);
             setSaveStatus('saved');
           } catch (e) {
             console.error("Storage Error", e);
             setSaveStatus('error');
           }
        }, 1000); 
        return () => clearTimeout(timeout);
    }
  }, [appointments, isWidgetMode, isDataLoaded]);

  // MANUAL SAVE SHORTCUT (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        
        if (!isWidgetMode && isDataLoaded) {
          setSaveStatus('saving');
          try {
            await saveAppointmentsToStorage(appointments);
            setTimeout(() => setSaveStatus('saved'), 500); 
          } catch (e) {
            console.error("Manual Save Error", e);
            setSaveStatus('error');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appointments, isWidgetMode, isDataLoaded]);

  useEffect(() => {
    if (!isWidgetMode) {
      localStorage.setItem('chronos_sync_settings', JSON.stringify(syncSettings));
    }
  }, [syncSettings, isWidgetMode]);

  // --- Distance Calculation & Notification Logic ---
  // Haversine formula to calculate distance between two points in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    const d = R * c; // Distance in km
    return d;
  };

  useEffect(() => {
    if (!isDataLoaded || !userLocation) return;

    const checkStatusAndNotify = () => {
      const now = new Date();
      let hasUpdates = false;
      
      const nextAppointments = appointments.map(appt => {
        // 1. Time-based Notification Check
        if (appt.alertMinutesBefore && appt.alertMinutesBefore.length > 0) {
           const timeToStart = (appt.start.getTime() - now.getTime()) / 60000;
           appt.alertMinutesBefore.forEach(min => {
             if (Math.abs(timeToStart - min) < 1) {
               if ("Notification" in window && Notification.permission === "granted") {
                 new Notification(appt.title, { body: `Starting in ${min} minutes` });
               }
             }
           });
        }

        // 2. Location-based Notification Check
        if (appt.coordinates && !notifiedEventsRef.current.has(appt.id)) {
           const dist = calculateDistance(userLocation.lat, userLocation.lng, appt.coordinates.lat, appt.coordinates.lng);
           // Notify if within 1km and event is today
           if (dist < 1.0 && isSameDay(appt.start, now)) {
             if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`Nearby: ${appt.title}`, { 
                  body: `You are ${(dist * 1000).toFixed(0)}m away from the location.` 
                });
                notifiedEventsRef.current.add(appt.id);
             }
           }
        }

        // 3. Auto-Status Update Logic
        if (appt.end < now && (appt.status === 'pending' || appt.status === 'in-progress')) {
          hasUpdates = true;
          return { ...appt, status: 'success' as EventStatus };
        }
        return appt;
      });

      if (hasUpdates) {
        setAppointments(nextAppointments);
      }
    };

    checkStatusAndNotify();
    const interval = setInterval(checkStatusAndNotify, 10000);
    return () => clearInterval(interval);
  }, [appointments, isDataLoaded, userLocation]);

  // --- Handlers ---
  const handleSaveAppointment = async (apptData: Omit<Appointment, 'id'>) => {
    setIsProcessingSync(true);
    let finalAppt: Appointment;
    let isUpdate = false;

    if (selectedAppointment) {
      // Update existing
      isUpdate = true;
      finalAppt = { 
        ...apptData, 
        id: selectedAppointment.id, 
        googleEventId: selectedAppointment.googleEventId,
        aiStrategy: selectedAppointment.aiStrategy
      };
    } else {
      // Create new
      finalAppt = { ...apptData, id: crypto.randomUUID() };
    }

    // Google Sync Logic
    if (syncSettings.autoSync && syncSettings.isGoogleSignedIn) {
      try {
        if (syncSettings.googleClientId) await initGoogleApi(syncSettings.googleClientId);

        if (isUpdate && finalAppt.googleEventId) {
          await updateGoogleEvent(finalAppt);
        } else {
          const googleId = await createGoogleEvent(finalAppt);
          if (googleId) {
            finalAppt.googleEventId = googleId;
          }
        }
      } catch (e) {
        console.error("Sync failed", e);
      }
    }

    if (isUpdate) {
       setAppointments(prev => prev.map(a => a.id === finalAppt.id ? finalAppt : a));
    } else {
       setAppointments(prev => [...prev, finalAppt]);
    }

    setIsProcessingSync(false);
    setIsFormOpen(false);
    setSelectedAppointment(null);
    setAiDraft(null); 
  };

  const handleQuickStatusChange = (id: string, status: EventStatus) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const handleDeleteAppointment = async (id: string) => {
    if (confirm('Are you sure you want to delete this appointment?')) {
      setIsProcessingSync(true);
      const apptToDelete = appointments.find(a => a.id === id);
      
      if (syncSettings.autoSync && syncSettings.isGoogleSignedIn && apptToDelete?.googleEventId) {
        try {
          if (syncSettings.googleClientId) await initGoogleApi(syncSettings.googleClientId);
          await deleteGoogleEvent(apptToDelete.googleEventId);
        } catch (e) {
          console.error("Google delete failed", e);
        }
      }

      setAppointments(prev => prev.filter(a => a.id !== id));
      if (selectedAppointment?.id === id) {
        setIsFormOpen(false);
        setSelectedAppointment(null);
      }
      setIsProcessingSync(false);
    }
  };

  const handleUpdateStrategy = (id: string, strategy: string) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, aiStrategy: strategy } : a));
  };

  const handleImportAppointments = (newAppts: Appointment[]) => {
    setAppointments(prev => [...prev, ...newAppts]);
  };

  const handleExport = () => {
    const content = generateICSContent(appointments);
    downloadICSFile(content, 'chronos_calendar_export.ics');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const newAppts = parseICSContent(text);
      if (newAppts.length > 0) {
        handleImportAppointments(newAppts);
        alert(`Successfully imported ${newAppts.length} events.`);
      } else {
        alert('No events found in file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('appointmentId', id);
    setDragState({ isDragging: true, appointmentId: id });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('appointmentId');
    setDragState({ isDragging: false, appointmentId: null });

    const appt = appointments.find(a => a.id === id);
    if (!appt) return;

    const duration = appt.end.getTime() - appt.start.getTime();
    const newStart = new Date(date);
    newStart.setHours(appt.start.getHours(), appt.start.getMinutes());
    const newEnd = new Date(newStart.getTime() + duration);

    handleSaveAppointment({
      ...appt,
      start: newStart,
      end: newEnd
    });
  };

  // --- AI Parsing ---
  const handleAiParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalInput.trim()) return;

    setIsAiLoading(true);
    const result = await parseNaturalLanguageAppointment(naturalInput, new Date());
    setIsAiLoading(false);

    if (result) {
      setAiDraft({
        ...result,
        alertMinutesBefore: [15],
        googleEventId: undefined, 
        aiStrategy: undefined,
        attachments: []
      });
      setIsFormOpen(true);
      setNaturalInput('');
    } else {
      alert("AI couldn't find a matching event or understand the request. Try being more specific.");
    }
  };

  // --- Render Helpers ---
  const filteredAppointments = appointments.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAppointmentsForDate = (date: Date) => {
    return filteredAppointments.filter(a => isSameDay(a.start, date));
  };

  const openForm = (date?: Date, appt?: Appointment) => {
    setSelectedAppointment(appt || null);
    setIsFormOpen(true);
  };

  const openSmartPlan = (appt: Appointment) => {
    setSmartPlanAppointment(appt);
    setIsSmartPlanOpen(true);
  };
  
  const openAiRequest = (appt: Appointment) => {
    setAiRequestAppointment(appt);
    setIsAiRequestOpen(true);
  };

  const openPopOutWidget = () => {
    const width = 380;
    const height = 600;
    const left = window.screen.width - width - 20;
    const top = 100;
    window.open(
      `${window.location.origin}${window.location.pathname}?mode=widget`,
      'ChronosWidget',
      `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,status=no,toolbar=no`
    );
  };
  
  const getStatusInfo = (status: EventStatus = 'pending') => {
    switch (status) {
      case 'success': return { icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800', label: 'Done & Success' };
      case 'failed': return { icon: <XCircle className="w-3 h-3" />, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800', label: 'Done & Failed' };
      case 'in-progress': return { icon: <PlayCircle className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800', label: 'In Progress' };
      case 'needs-plan': return { icon: <AlertCircle className="w-3 h-3" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800', label: 'Needs Plan' };
      case 'needs-check': return { icon: <Eye className="w-3 h-3" />, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800', label: 'Needs Check' };
      default: return { icon: <Clock className="w-3 h-3" />, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700', label: 'Pending' };
    }
  };

  // --- WIDGET MODE RENDER ---
  if (isWidgetMode) {
    return (
      <div className="bg-slate-900 min-h-screen p-4 overflow-hidden flex flex-col">
        <NextWidget appointments={appointments} />
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      
      {/* --- HEADER --- */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            
            {/* Logo / Title */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-white/10 p-1 rounded-lg">
                <img src="/logo.png" alt="TechArja" className="w-10 h-10 object-contain rounded-md" onError={(e) => {
                    e.currentTarget.style.display = 'none'; 
                    e.currentTarget.parentElement?.classList.add('bg-blue-600');
                    e.currentTarget.parentElement?.classList.remove('bg-white/10');
                    e.currentTarget.parentElement?.appendChild(document.createElement('span'));
                }}/>
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 hidden sm:block">
                TechArja
              </h1>
            </div>

            {/* Smart Add Bar (Desktop) */}
            <form onSubmit={handleAiParse} className="hidden md:flex flex-1 max-w-xl mx-6 relative">
              <input
                type="text"
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                placeholder="Ask AI: 'When is the next El Clasico?' or 'Lunch tomorrow at 1pm'"
                className="w-full pl-4 pr-12 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-full focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition-all"
                disabled={isAiLoading}
              />
              <button 
                type="submit"
                disabled={isAiLoading}
                className="absolute right-1.5 top-1.5 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50"
                title="Search / Add with AI"
              >
                {isAiLoading ? (
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                   <Sparkles className="w-4 h-4" />
                )}
              </button>
            </form>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
               {/* Location Status */}
               {userLocation && (
                 <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mr-2" title="Location Tracking Active">
                   <Navigation className="w-3.5 h-3.5 text-blue-500" />
                 </div>
               )}

               {/* Auto Save Status */}
               <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mr-2">
                 <Cloud className={`w-3.5 h-3.5 ${saveStatus === 'saved' ? 'text-green-500' : saveStatus === 'error' ? 'text-red-500' : 'text-blue-500 animate-pulse'}`} />
                 <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                   {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Saving...'}
                 </span>
               </div>
               
               {/* Theme Toggle */}
               <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg mr-2">
                  <button 
                    onClick={() => setTheme('light')}
                    className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-white shadow-sm text-yellow-500' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Light Mode"
                  >
                    <Sun className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setTheme('semi')}
                    className={`p-1.5 rounded-md transition-all ${theme === 'semi' ? 'bg-slate-700 shadow-sm text-orange-400' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Semi/Twilight Mode"
                  >
                    <Sunset className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-slate-700 shadow-sm text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Dark Mode"
                  >
                    <Moon className="w-4 h-4" />
                  </button>
               </div>
               
               {/* Export / Import Actions */}
               <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg mr-2">
                  <button 
                    onClick={handleExport}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Export to iPhone / ICS"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <label className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer" title="Import ICS">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept=".ics" onChange={handleImport} className="hidden" />
                  </label>
               </div>

               <button 
                onClick={() => setIsSyncModalOpen(true)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors relative group"
                title="Sync Settings"
              >
                <RefreshCw className={`w-5 h-5 ${isProcessingSync ? 'animate-spin text-blue-500' : ''}`} />
                {syncSettings.isGoogleSignedIn && (
                   <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full ring-2 ring-white dark:ring-slate-800"></span>
                )}
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

              <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                {(['month', 'week', 'day', 'list', 'smart-plans'] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === m 
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {m === 'smart-plans' ? 'Smart Plans' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={openPopOutWidget}
                className="ml-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Pop Out Widget
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 text-slate-600 dark:text-slate-300"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mt-4 pb-2 space-y-4 animate-in slide-in-from-top-2">
              <div className="flex justify-center gap-4 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                 <button onClick={() => setTheme('light')} className={`p-2 rounded ${theme === 'light' ? 'bg-white shadow text-yellow-600' : 'text-slate-500'}`}><Sun className="w-5 h-5"/></button>
                 <button onClick={() => setTheme('semi')} className={`p-2 rounded ${theme === 'semi' ? 'bg-slate-600 shadow text-orange-400' : 'text-slate-500'}`}><Sunset className="w-5 h-5"/></button>
                 <button onClick={() => setTheme('dark')} className={`p-2 rounded ${theme === 'dark' ? 'bg-slate-700 shadow text-blue-400' : 'text-slate-500'}`}><Moon className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleAiParse} className="relative">
                <input
                  type="text"
                  value={naturalInput}
                  onChange={(e) => setNaturalInput(e.target.value)}
                  placeholder="Ask AI (e.g. Next World Cup)..."
                  className="w-full pl-4 pr-10 py-3 bg-slate-100 dark:bg-slate-900/50 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button type="submit" className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </button>
              </form>
              
              <div className="grid grid-cols-2 gap-2">
                 <button 
                    onClick={() => { handleExport(); setShowMobileMenu(false); }}
                    className="py-2 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                  >
                    <Download className="w-4 h-4" /> Export iPhone
                  </button>
                  <label className="py-2 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer">
                    <Upload className="w-4 h-4" /> Import ICS
                    <input type="file" accept=".ics" onChange={handleImport} className="hidden" />
                  </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['month', 'week', 'day', 'list', 'smart-plans'] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setViewMode(m); setShowMobileMenu(false); }}
                    className={`py-2 px-1 rounded-lg text-xs font-medium text-center border ${
                      viewMode === m 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                     {m === 'smart-plans' ? 'Plans' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

               <button 
                onClick={() => { setIsSyncModalOpen(true); setShowMobileMenu(false); }}
                className="w-full py-2 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
              >
                <RefreshCw className="w-4 h-4" /> Sync Settings
              </button>
            </div>
          )}
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* LEFT COLUMN (Widget & Mini Calendar) */}
        <div className="lg:col-span-4 space-y-6">
          <NextWidget appointments={appointments} />
          
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-semibold text-slate-800 dark:text-white">Quick Jump</h3>
               <div className="flex gap-1">
                 <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronLeft className="w-4 h-4" /></button>
                 <button onClick={() => setCurrentDate(new Date())} className="text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">Today</button>
                 <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronRight className="w-4 h-4" /></button>
               </div>
             </div>
             {/* Simple Mini Calendar for Navigation */}
             <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
               {['S','M','T','W','T','F','S'].map(d => <span key={d} className="text-slate-400 font-medium">{d}</span>)}
             </div>
             <div className="grid grid-cols-7 gap-1 text-center text-sm">
               {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate)), end: endOfWeek(endOfMonth(currentDate)) }).map((day, idx) => {
                 const isSelected = isSameDay(day, currentDate);
                 const hasEvent = appointments.some(a => isSameDay(a.start, day));
                 return (
                   <button
                     key={idx}
                     onClick={() => setCurrentDate(day)}
                     className={`
                       h-8 w-8 rounded-full flex items-center justify-center relative transition-all
                       ${!isSameMonth(day, currentDate) ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}
                       ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}
                     `}
                   >
                     {format(day, 'd')}
                     {hasEvent && !isSelected && (
                       <span className="absolute bottom-1 w-1 h-1 bg-blue-500 rounded-full"></span>
                     )}
                   </button>
                 );
               })}
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Main Calendar Views) */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-[500px] overflow-hidden">
          
          {/* Navigation Bar */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {viewMode === 'list' 
               ? 'Upcoming Events' 
               : viewMode === 'smart-plans' 
               ? 'Smart Plans & AI' 
               : format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => openForm(currentDate)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Event</span>
              </button>
            </div>
          </div>

          {/* --- VIEWS --- */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 overflow-hidden relative flex flex-col">
            
            {/* MONTH VIEW */}
            {viewMode === 'month' && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                <div className="w-full min-h-full flex flex-col">
                  {/* Header Row - Sticky */}
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 shadow-sm">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="py-3 text-center text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{d}</div>
                    ))}
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 auto-rows-fr flex-1">
                    {eachDayOfInterval({ 
                      start: startOfWeek(startOfMonth(currentDate)), 
                      end: endOfWeek(endOfMonth(currentDate)) 
                    }).map((day, idx) => {
                      const dayEvents = getAppointmentsForDate(day).sort((a,b) => a.start.getTime() - b.start.getTime());
                      const isCurrMonth = isSameMonth(day, currentDate);
                      
                      return (
                        <div 
                          key={idx}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, day)}
                          onClick={() => openForm(day)}
                          className={`
                            border-r border-b border-slate-100 dark:border-slate-700/50 p-2 min-h-[150px] transition-colors relative group flex flex-col
                            ${!isCurrMonth ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30'}
                            ${isToday(day) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                          `}
                        >
                           <div className="flex justify-between items-start mb-2">
                             <span className={`
                               text-sm font-medium p-1 rounded-full w-7 h-7 flex items-center justify-center
                               ${isToday(day) ? 'bg-blue-600 text-white shadow-sm' : isCurrMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}
                             `}>
                               {format(day, 'd')}
                             </span>
                             {dayEvents.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">{dayEvents.length}</span>
                             )}
                           </div>

                           {/* Scrollable container for events */}
                           <div className="space-y-1 overflow-y-auto flex-1 scrollbar-hide">
                             {dayEvents.map(event => (
                               <div 
                                 key={event.id}
                                 draggable
                                 onDragStart={(e) => handleDragStart(e, event.id)}
                                 onClick={(e) => { e.stopPropagation(); openForm(day, event); }}
                                 className={`
                                   text-[10px] px-1.5 py-1.5 rounded-md border border-transparent truncate cursor-pointer transition-all flex items-center gap-1 shadow-sm
                                   ${event.color.replace('bg-', 'bg-').replace('500', '100')} ${event.color.replace('bg-', 'text-').replace('500', '800')}
                                   dark:${event.color.replace('bg-', 'bg-').replace('500', '900')}/40 dark:${event.color.replace('bg-', 'text-').replace('500', '200')}
                                   hover:border-current hover:brightness-95
                                   ${dragState.appointmentId === event.id ? 'opacity-50 border-dashed border-slate-400' : ''}
                                 `}
                                 title={event.title}
                               >
                                 {event.urgency === 'high' && <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />}
                                 <span className="truncate font-medium">{event.title}</span>
                               </div>
                             ))}
                           </div>
                           
                           {/* Hover Add Button */}
                           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                           </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* LIST VIEW */}
            {viewMode === 'list' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 flex gap-2">
                   <div className="relative flex-1">
                     <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                     <input 
                       type="text" 
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       placeholder="Search events..."
                       className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                     />
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredAppointments
                    .sort((a,b) => a.start.getTime() - b.start.getTime())
                    .map((appt) => {
                      const statusInfo = getStatusInfo(appt.status);
                      const distance = userLocation && appt.coordinates 
                        ? calculateDistance(userLocation.lat, userLocation.lng, appt.coordinates.lat, appt.coordinates.lng) 
                        : null;

                      return (
                    <div 
                      key={appt.id}
                      className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative"
                    >
                      <div className="flex items-start gap-4">
                        {/* Date Box */}
                        <div className="flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg p-2 min-w-[3.5rem] shrink-0">
                          <span className="text-xs font-bold text-slate-500 uppercase">{format(appt.start, 'MMM')}</span>
                          <span className="text-xl font-bold text-slate-800 dark:text-white">{format(appt.start, 'd')}</span>
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                             <h3 className="font-bold text-slate-800 dark:text-white truncate">{appt.title}</h3>
                             {appt.urgency === 'high' && (
                               <span className="text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
                                 High Urgency
                               </span>
                             )}
                             {appt.aiStrategy && (
                                <Zap className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                             )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 mb-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {format(appt.start, 'h:mm a')} - {format(appt.end, 'h:mm a')}
                            </span>
                             <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusInfo.color}`}>
                               {statusInfo.icon} {statusInfo.label}
                             </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            {appt.location && (
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.location)}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline w-fit"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                {appt.location}
                              </a>
                            )}
                            {distance !== null && (
                              <span className="text-xs font-medium text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-md">
                                <Navigation className="w-3 h-3" />
                                {distance < 1 ? `${(distance * 1000).toFixed(0)}m away` : `${distance.toFixed(1)}km away`}
                              </span>
                            )}
                          </div>
                          
                          {appt.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-1 mb-2">{appt.description}</p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-1 rounded-lg">
                            {/* Quick Status Change Dropdown (Simple implementation: toggle pending/success/fail) */}
                            <div className="relative group/status">
                               <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                  <Flag className="w-4 h-4" />
                               </button>
                               <div className="absolute right-0 top-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-40 p-1 hidden group-hover/status:block z-50">
                                  {(['pending', 'in-progress', 'success', 'failed'] as EventStatus[]).map(s => {
                                      const sInfo = getStatusInfo(s);
                                      return (
                                        <button 
                                          key={s}
                                          onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(appt.id, s); }}
                                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2"
                                        >
                                          <div className={`p-0.5 rounded ${sInfo.color}`}>{sInfo.icon}</div>
                                          <span className="text-slate-700 dark:text-slate-300">{sInfo.label}</span>
                                        </button>
                                      );
                                  })}
                               </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); openForm(undefined, appt); }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(appt.id); }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Smart Plan Button */}
                        <div className="shrink-0 flex flex-col items-end gap-2">
                           <button
                             onClick={() => openSmartPlan(appt)}
                             className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-lg border border-blue-100 dark:border-blue-800 hover:shadow-sm transition-all whitespace-nowrap"
                           >
                             <Sparkles className="w-3.5 h-3.5" />
                             Smart Plan
                           </button>
                           {appt.attachments && appt.attachments.length > 0 && (
                             <span className="text-[10px] text-slate-400 flex items-center gap-1">
                               <FileText className="w-3 h-3" /> {appt.attachments.length} files
                             </span>
                           )}
                        </div>
                      </div>

                      {/* AI Strategy Footer Preview */}
                      {appt.aiStrategy && (
                        <div 
                           onClick={() => openSmartPlan(appt)}
                           className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-3 cursor-pointer group/plan"
                        >
                           <div className="bg-yellow-50 dark:bg-yellow-900/10 p-1.5 rounded-md text-yellow-600 dark:text-yellow-400">
                             <Zap className="w-4 h-4" />
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover/plan:text-blue-600 transition-colors">
                               AI Strategy Active
                             </p>
                             <p className="text-[10px] text-slate-400 truncate">
                               Click to view detailed schedule and execution plan...
                             </p>
                           </div>
                           <ArrowRight className="w-4 h-4 text-slate-300 group-hover/plan:text-blue-500 group-hover/plan:translate-x-1 transition-all" />
                        </div>
                      )}
                    </div>
                  );
                    })}
                  {filteredAppointments.length === 0 && (
                     <div className="text-center py-10 text-slate-400">
                       <LayoutList className="w-10 h-10 mx-auto mb-2 opacity-50" />
                       <p>No appointments found.</p>
                     </div>
                  )}
                </div>
              </div>
            )}
            
            {/* SMART PLANS VIEW */}
            {viewMode === 'smart-plans' && (
              <div className="h-full flex flex-col p-4 bg-slate-50/50 dark:bg-slate-900/20">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    AI Planning & Assistance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
                    Manage strategies, ask custom questions, and analyze attached files for your upcoming events.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-4">
                   {filteredAppointments
                    .sort((a,b) => a.start.getTime() - b.start.getTime())
                    .map((appt) => (
                      <div key={appt.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col">
                         <div className="flex justify-between items-start mb-3">
                           <div className="flex flex-col">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                               {format(appt.start, 'MMM d, yyyy')}
                             </span>
                             <h4 className="font-bold text-slate-800 dark:text-white text-lg line-clamp-1" title={appt.title}>
                               {appt.title}
                             </h4>
                           </div>
                           <div className={`w-2 h-2 rounded-full ${appt.color} mt-1.5`}></div>
                         </div>
                         
                         <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                           {appt.description || "No description provided."}
                         </p>

                         {/* Attachments Indicator */}
                         {appt.attachments && appt.attachments.length > 0 ? (
                           <div className="flex items-center gap-2 mb-4 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                             <FileText className="w-4 h-4" />
                             <span>{appt.attachments.length} file(s) ready for analysis</span>
                           </div>
                         ) : (
                           <div className="mb-4 h-9"></div> // Spacer
                         )}

                         {/* Action Buttons */}
                         <div className="grid grid-cols-2 gap-3 mt-auto">
                            <button 
                              onClick={() => openSmartPlan(appt)}
                              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
                            >
                              <Zap className="w-4 h-4" />
                              Plan
                            </button>
                            <button 
                              onClick={() => openAiRequest(appt)}
                              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
                            >
                              <MessageSquare className="w-4 h-4 text-indigo-500" />
                              Request
                            </button>
                         </div>
                      </div>
                    ))}
                    {filteredAppointments.length === 0 && (
                       <div className="col-span-full text-center py-10 text-slate-400">
                         <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
                         <p>No upcoming events to plan for.</p>
                       </div>
                    )}
                </div>
              </div>
            )}
            
            {/* WEEK & DAY VIEWS (Simplified Placeholders) */}
            {(viewMode === 'week' || viewMode === 'day') && (
               <div className="h-full flex items-center justify-center flex-col text-slate-400 p-8">
                 <CalendarIcon className="w-12 h-12 mb-3 opacity-50" />
                 <p className="text-lg font-medium">Coming Soon</p>
                 <p className="text-sm">We are refining the hourly grid for {viewMode} view.</p>
                 <button onClick={() => setViewMode('month')} className="mt-4 text-blue-500 hover:underline">Return to Month View</button>
               </div>
            )}

          </div>
        </div>
      </main>

      {/* --- MODALS --- */}
      <AppointmentForm 
        isOpen={isFormOpen} 
        onCancel={() => { setIsFormOpen(false); setSelectedAppointment(null); setAiDraft(null); }}
        onSave={handleSaveAppointment}
        onDelete={selectedAppointment ? handleDeleteAppointment : undefined}
        initialDate={currentDate}
        existingAppointment={selectedAppointment}
        initialValues={aiDraft}
        syncProvider={syncSettings.defaultProvider}
        readOnly={selectedAppointment ? new Date() > selectedAppointment.end : false}
      />
      
      <SyncSettingsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        settings={syncSettings}
        onUpdateSettings={setSyncSettings}
        appointments={appointments}
        onImportAppointments={handleImportAppointments}
      />

      <SmartPlanDrawer 
        isOpen={isSmartPlanOpen}
        onClose={() => setIsSmartPlanOpen(false)}
        appointment={smartPlanAppointment}
        onSaveStrategy={handleUpdateStrategy}
      />

      <AiRequestModal 
        isOpen={isAiRequestOpen}
        onClose={() => setIsAiRequestOpen(false)}
        appointment={aiRequestAppointment}
      />
    </div>
  );
}
