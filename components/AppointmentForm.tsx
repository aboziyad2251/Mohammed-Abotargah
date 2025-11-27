import React, { useState, useEffect } from 'react';
import { Appointment, APPOINTMENT_COLORS, CalendarProvider } from '../types';
import { X, Clock, Type, AlignLeft, Calendar as CalendarIcon, Check, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { generateGoogleCalendarLink, generateOutlookCalendarLink, generateICSContent, downloadICSFile } from '../services/calendarIntegration';

interface AppointmentFormProps {
  initialDate?: Date;
  existingAppointment?: Appointment | null;
  onSave: (appt: Omit<Appointment, 'id'>) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  isOpen: boolean;
  syncProvider: CalendarProvider;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ 
  initialDate, 
  existingAppointment, 
  onSave,
  onDelete, 
  onCancel,
  isOpen,
  syncProvider
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState(APPOINTMENT_COLORS[0]);

  useEffect(() => {
    if (existingAppointment) {
      setTitle(existingAppointment.title);
      setDescription(existingAppointment.description);
      setColor(existingAppointment.color);
      setStartDate(format(existingAppointment.start, 'yyyy-MM-dd'));
      setStartTime(format(existingAppointment.start, 'HH:mm'));
      setEndTime(format(existingAppointment.end, 'HH:mm'));
    } else {
      const d = initialDate || new Date();
      setTitle('');
      setDescription('');
      setColor(APPOINTMENT_COLORS[0]);
      setStartDate(format(d, 'yyyy-MM-dd'));
      setStartTime(format(d, 'HH:mm'));
      const end = new Date(d.getTime() + 60 * 60 * 1000);
      setEndTime(format(end, 'HH:mm'));
    }
  }, [existingAppointment, initialDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);

    onSave({
      title,
      description,
      start,
      end,
      color,
      alertMinutesBefore: [15] // Default alert
    });
  };

  const handleExternalSync = () => {
    if (!title || !startDate || !startTime || !endTime) return;
    
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);
    
    if (syncProvider === 'google') {
      const link = generateGoogleCalendarLink(title, description, start, end);
      window.open(link, '_blank');
    } else if (syncProvider === 'outlook') {
      const link = generateOutlookCalendarLink(title, description, start, end);
      window.open(link, '_blank');
    } else if (syncProvider === 'apple') {
      // Create a temporary single-event ICS
      const tempAppt: Appointment = {
        id: existingAppointment?.id || 'temp',
        title, description, start, end, color, alertMinutesBefore: []
      };
      const content = generateICSContent([tempAppt]);
      downloadICSFile(content, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {existingAppointment ? 'Edit Appointment' : 'New Appointment'}
          </h2>
          <div className="flex items-center gap-2">
            {syncProvider !== 'none' && (
              <button 
                type="button"
                onClick={handleExternalSync}
                className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                title={`Add to ${syncProvider === 'apple' ? 'Apple Calendar' : syncProvider === 'google' ? 'Google Calendar' : 'Outlook'}`}
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase">Title</label>
            <div className="relative">
              <Type className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting with Team"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>
             <div className="space-y-1">
               {/* Spacer or duration could go here */}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">Start Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>
             <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">End Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase">Description</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 uppercase">Color Tag</label>
            <div className="flex flex-wrap gap-2">
              {APPOINTMENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${c} flex items-center justify-center transition-transform hover:scale-110 focus:outline-none ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ${color === c ? 'ring-slate-400' : 'ring-transparent'}`}
                >
                  {color === c && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
             {existingAppointment && onDelete && (
                <button
                type="button"
                onClick={() => onDelete(existingAppointment.id)}
                className="px-4 py-2 text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg font-medium transition-colors flex items-center justify-center"
                title="Delete Appointment"
              >
                <Trash2 className="w-5 h-5" />
              </button>
             )}
             <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium shadow-md shadow-indigo-200 dark:shadow-indigo-900/20 transition-colors"
            >
              {existingAppointment ? 'Save Changes' : 'Create Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};