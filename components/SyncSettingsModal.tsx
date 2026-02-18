
import React, { useState } from 'react';
import { X, Calendar, Download, RefreshCw, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { CalendarProvider, SyncSettings, Appointment } from '../types';
import { generateICSContent, downloadICSFile, parseICSContent } from '../services/calendarIntegration';
import { initGoogleApi, signInToGoogle } from '../services/googleCalendarApi';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SyncSettings;
  onUpdateSettings: (settings: SyncSettings) => void;
  appointments: Appointment[];
  onImportAppointments?: (appointments: Appointment[]) => void;
}

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  appointments,
  onImportAppointments
}) => {
  const [googleClientId, setGoogleClientId] = useState(settings.googleClientId || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleExportICS = () => {
    const content = generateICSContent(appointments);
    downloadICSFile(content, 'chronos_calendar_export.ics');
  };

  const handleImportICS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportAppointments) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const newAppointments = parseICSContent(text);
        if (newAppointments.length > 0) {
          onImportAppointments(newAppointments);
          alert(`Successfully imported ${newAppointments.length} events from ICS file.`);
          onClose(); // Optional: close modal on success
        } else {
          alert('No valid events found in the selected ICS file.');
        }
      } catch (error) {
        console.error('ICS Parse Error:', error);
        alert('Failed to parse the ICS file. Please check the format.');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleConnectGoogle = async () => {
    setErrorMsg('');
    setIsConnecting(true);
    
    try {
      // 1. Initialize API with provided ID
      const inited = await initGoogleApi(googleClientId);
      if (!inited) {
        throw new Error("Failed to initialize Google API libraries.");
      }
      
      // 2. Trigger Sign In
      const success = await signInToGoogle();
      
      if (success) {
        onUpdateSettings({ 
          ...settings, 
          googleClientId, 
          isGoogleSignedIn: true,
          defaultProvider: 'google',
          autoSync: true
        });
      } else {
        throw new Error("Sign-in failed or was cancelled.");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Connection failed. Check Client ID and Origin.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Sync & Integration
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Google Auto-Sync Section */}
          <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              <span className="bg-white p-1 rounded-full shadow-sm">
                <img src="https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png" alt="Google" className="w-4 h-4"/>
              </span>
              Google Calendar Auto-Sync
            </h3>
            
            {!settings.isGoogleSignedIn ? (
              <div className="space-y-3">
                 <p className="text-xs text-slate-500 dark:text-slate-400">
                   To enable automatic background syncing (add/edit/delete), you need a Google Cloud Client ID.
                 </p>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client ID</label>
                   <input 
                     type="text" 
                     value={googleClientId}
                     onChange={(e) => setGoogleClientId(e.target.value)}
                     placeholder="12345...apps.googleusercontent.com"
                     className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                   />
                 </div>
                 {errorMsg && (
                   <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                     <AlertCircle className="w-4 h-4" /> {errorMsg}
                   </div>
                 )}
                 <button 
                   onClick={handleConnectGoogle}
                   disabled={!googleClientId || isConnecting}
                   className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                 >
                   {isConnecting ? 'Connecting...' : 'Connect & Sign In'}
                 </button>
                 <p className="text-[10px] text-slate-400">
                   *Requires a GCP Project with Google Calendar API enabled and this URL in Authorized Origins.
                 </p>
              </div>
            ) : (
              <div className="space-y-3">
                 <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 dark:bg-green-900/20 p-2 rounded">
                   <CheckCircle className="w-4 h-4" /> Connected
                 </div>
                 <div className="flex items-center justify-between">
                   <label className="text-sm text-slate-700 dark:text-slate-300">Auto-Sync Events</label>
                   <button 
                     onClick={() => onUpdateSettings({ ...settings, autoSync: !settings.autoSync })}
                     className={`w-10 h-5 rounded-full transition-colors relative ${settings.autoSync ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                   >
                     <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoSync ? 'translate-x-5' : 'translate-x-0'}`} />
                   </button>
                 </div>
                 <p className="text-xs text-slate-500">
                   Changes made in Chronos will automatically apply to your primary Google Calendar.
                 </p>
                 <button 
                    onClick={() => onUpdateSettings({...settings, isGoogleSignedIn: false, autoSync: false})}
                    className="text-xs text-red-500 hover:underline"
                 >
                   Disconnect / Sign Out
                 </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
              Manual Link Provider
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              For manual "Add to Calendar" links without full integration.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'outlook', name: 'Outlook Calendar' },
                { id: 'apple', name: 'Apple Calendar / ICS File' },
                { id: 'none', name: 'None' }
              ].map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => onUpdateSettings({ ...settings, defaultProvider: provider.id as CalendarProvider })}
                  className={`
                    flex items-center px-4 py-3 rounded-lg border transition-all text-sm font-medium
                    ${settings.defaultProvider === provider.id 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-slate-300'}
                  `}
                >
                  <Calendar className={`w-4 h-4 mr-3 ${settings.defaultProvider === provider.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                  {provider.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
             <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">File Operations</h3>
             <button 
               onClick={handleExportICS}
               className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors font-medium text-sm"
             >
               <Download className="w-4 h-4" />
               Export to iPhone / Calendar (.ics)
             </button>
             
             {onImportAppointments && (
               <label className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium text-sm cursor-pointer">
                 <Upload className="w-4 h-4" />
                 Import .ICS File
                 <input type="file" accept=".ics" onChange={handleImportICS} className="hidden" />
               </label>
             )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
