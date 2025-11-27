import React from 'react';
import { X, Calendar, Download, RefreshCw } from 'lucide-react';
import { CalendarProvider, SyncSettings, Appointment } from '../types';
import { generateICSContent, downloadICSFile } from '../services/calendarIntegration';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SyncSettings;
  onUpdateSettings: (settings: SyncSettings) => void;
  appointments: Appointment[];
}

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  appointments
}) => {
  if (!isOpen) return null;

  const handleExportICS = () => {
    const content = generateICSContent(appointments);
    downloadICSFile(content, 'chronos_calendar_export.ics');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Sync & External Calendars
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
              Default External Calendar Provider
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your preferred calendar service. We will provide quick links to add your appointments to this provider.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'google', name: 'Google Calendar' },
                { id: 'outlook', name: 'Outlook Calendar' },
                { id: 'apple', name: 'Apple Calendar / ICS File' },
                { id: 'none', name: 'None (Local Only)' }
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

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
             <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Bulk Actions</h3>
             <button 
               onClick={handleExportICS}
               className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors font-medium text-sm"
             >
               <Download className="w-4 h-4" />
               Export All as .ICS File
             </button>
             <p className="text-[10px] text-slate-400 mt-2 text-center">
               Use this file to import your entire schedule into Apple Calendar, Outlook Desktop, or Google Calendar.
             </p>
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