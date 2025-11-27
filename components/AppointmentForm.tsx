import React, { useState, useEffect } from 'react';
import { Appointment, APPOINTMENT_COLORS } from '../types';
import { X, Clock, Type, AlignLeft, Calendar as CalendarIcon, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface AppointmentFormProps {
  initialDate?: Date;
  existingAppointment?: Appointment | null;
  onSave: (appt: Omit<Appointment, 'id'>) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ 
  initialDate, 
  existingAppointment, 
  onSave,
  onDelete, 
  onCancel,
  isOpen
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {existingAppointment ? 'Edit Appointment' : 'New Appointment'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
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
                  {color === c && <Check className="w-