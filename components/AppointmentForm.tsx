
import React, { useState, useEffect } from 'react';
import { Appointment, APPOINTMENT_COLORS, CalendarProvider, UrgencyLevel, Attachment, EventStatus } from '../types';
import { X, Clock, Type, AlignLeft, Calendar as CalendarIcon, Check, Trash2, ExternalLink, Paperclip, FileText, Loader2, Flag, CheckCircle, XCircle, AlertCircle, Eye, PlayCircle, Lock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { generateGoogleCalendarLink, generateOutlookCalendarLink, generateICSContent, downloadICSFile } from '../services/calendarIntegration';

interface AppointmentFormProps {
  initialDate?: Date;
  existingAppointment?: Appointment | null;
  initialValues?: Omit<Appointment, 'id'> | null;
  onSave: (appt: Omit<Appointment, 'id'>) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  isOpen: boolean;
  syncProvider: CalendarProvider;
  readOnly?: boolean;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ 
  initialDate, 
  existingAppointment, 
  initialValues,
  onSave,
  onDelete, 
  onCancel,
  isOpen,
  syncProvider,
  readOnly = false
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState(APPOINTMENT_COLORS[0]);
  const [urgency, setUrgency] = useState<UrgencyLevel>('medium');
  const [status, setStatus] = useState<EventStatus>('pending');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (existingAppointment) {
      setTitle(existingAppointment.title);
      setDescription(existingAppointment.description);
      setLocation(existingAppointment.location || '');
      setCoordinates(existingAppointment.coordinates);
      setColor(existingAppointment.color);
      setStartDate(format(existingAppointment.start, 'yyyy-MM-dd'));
      setStartTime(format(existingAppointment.start, 'HH:mm'));
      setEndTime(format(existingAppointment.end, 'HH:mm'));
      setUrgency(existingAppointment.urgency || 'medium');
      setStatus(existingAppointment.status || 'pending');
      setAttachments(existingAppointment.attachments || []);
    } else if (initialValues) {
      setTitle(initialValues.title);
      setDescription(initialValues.description);
      setLocation(initialValues.location || '');
      setCoordinates(initialValues.coordinates);
      setColor(initialValues.color);
      setStartDate(format(initialValues.start, 'yyyy-MM-dd'));
      setStartTime(format(initialValues.start, 'HH:mm'));
      setEndTime(format(initialValues.end, 'HH:mm'));
      setUrgency(initialValues.urgency || 'medium');
      setStatus(initialValues.status || 'pending');
      setAttachments(initialValues.attachments || []);
    } else {
      const d = initialDate || new Date();
      setTitle('');
      setDescription('');
      setLocation('');
      setCoordinates(undefined);
      setColor(APPOINTMENT_COLORS[0]);
      setStartDate(format(d, 'yyyy-MM-dd'));
      setStartTime(format(d, 'HH:mm'));
      const end = new Date(d.getTime() + 60 * 60 * 1000);
      setEndTime(format(end, 'HH:mm'));
      setUrgency('medium');
      setStatus('pending');
      setAttachments([]);
    }
  }, [existingAppointment, initialValues, initialDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);

    onSave({
      title,
      description,
      location,
      coordinates, // Pass through hidden coordinates
      start,
      end,
      color,
      urgency,
      status,
      attachments,
      alertMinutesBefore: [15],
      aiStrategy: existingAppointment?.aiStrategy
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Limit to 100MB
    const MAX_SIZE = 100 * 1024 * 1024; 

    if (file.size > MAX_SIZE) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). The limit is 100MB.`);
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      
      // Robust MIME type detection
      let mimeType = file.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (ext === 'txt') mimeType = 'text/plain';
        else if (ext === 'md') mimeType = 'text/plain';
        else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      }

      const newAttachment: Attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: mimeType || 'application/octet-stream',
        size: file.size,
        content: base64
      };
      setAttachments(prev => [...prev, newAttachment]);
      setIsUploading(false);
    };
    reader.onerror = (err) => {
      console.error("File reading failed", err);
      alert("Failed to read the file. Please try again.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    if (readOnly) return;
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleExternalSync = () => {
    if (!title || !startDate || !startTime || !endTime) return;
    
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);
    
    if (syncProvider === 'google') {
      const link = generateGoogleCalendarLink(title, description, location, start, end);
      window.open(link, '_blank');
    } else if (syncProvider === 'outlook') {
      const link = generateOutlookCalendarLink(title, description, location, start, end);
      window.open(link, '_blank');
    } else if (syncProvider === 'apple') {
      const tempAppt: Appointment = {
        id: existingAppointment?.id || 'temp',
        title, description, location, start, end, color, urgency, alertMinutesBefore: []
      };
      const content = generateICSContent([tempAppt]);
      downloadICSFile(content, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    }
  };

  const statusOptions: { value: EventStatus, label: string, icon: React.ReactNode, color: string }[] = [
    { value: 'pending', label: 'Pending', icon: <Clock className="w-4 h-4" />, color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
    { value: 'in-progress', label: 'In Progress', icon: <PlayCircle className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    { value: 'success', label: 'Done & Success', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    { value: 'failed', label: 'Done & Failed', icon: <XCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    { value: 'needs-plan', label: 'Need Plan', icon: <AlertCircle className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    { value: 'needs-check', label: 'Need Frequent Check', icon: <Eye className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              {readOnly ? 'View Appointment' : (existingAppointment ? 'Edit Appointment' : 'New Appointment')}
            </h2>
            {readOnly && (
               <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                 <Lock className="w-3 h-3" /> Read-Only
               </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {syncProvider !== 'none' && !readOnly && (
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase">Title</label>
            <div className="relative">
              <Type className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                disabled={readOnly}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting with Team"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-slate-500 uppercase">Location</label>
              {coordinates && (
                <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> GPS Verified
                </span>
              )}
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                disabled={readOnly}
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setCoordinates(undefined); // Clear coords on manual edit unless re-verified
                }}
                placeholder="e.g. Starbucks, 123 Main St"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
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
                  disabled={readOnly}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            </div>
             <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">Urgency</label>
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                {(['low', 'medium', 'high'] as UrgencyLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setUrgency(level)}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-all capitalize
                      ${urgency === level 
                        ? (level === 'high' ? 'bg-red-500 text-white' : level === 'medium' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white')
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }
                      ${readOnly ? 'cursor-not-allowed opacity-80' : ''}
                    `}
                  >
                    {level}
                  </button>
                ))}
              </div>
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
                  disabled={readOnly}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
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
                  disabled={readOnly}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
             <label className="text-xs font-medium text-slate-500 uppercase">Current Status</label>
             <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((opt) => (
                   <button
                     key={opt.value}
                     type="button"
                     disabled={readOnly}
                     onClick={() => setStatus(opt.value)}
                     className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all border ${
                       status === opt.value 
                         ? `${opt.color} border-current ring-1 ring-current shadow-sm` 
                         : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                     } ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                   >
                     {opt.icon}
                     {opt.label}
                   </button>
                ))}
             </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase">Description</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea
                value={description}
                disabled={readOnly}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white resize-none disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
               <label className="text-xs font-medium text-slate-500 uppercase">Attached Lectures / Notes</label>
               {!readOnly && (
                 isUploading ? (
                   <span className="text-xs flex items-center gap-1 text-slate-400 animate-pulse">
                     <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                   </span>
                 ) : (
                   <label className="cursor-pointer text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                     <Paperclip className="w-3 h-3" /> Add File
                     <input 
                       type="file" 
                       onChange={handleFileUpload} 
                       className="hidden" 
                       accept=".txt,.pdf,.md,application/pdf,image/*" 
                       disabled={isUploading}
                     />
                   </label>
                 )
               )}
            </div>
            {attachments.length > 0 ? (
               <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                       <div className="flex items-center gap-2 overflow-hidden">
                         <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                         <div className="flex flex-col min-w-0">
                           <span className="truncate text-slate-700 dark:text-slate-300 font-medium">{att.name}</span>
                           <span className="text-[10px] text-slate-400">{att.type} • {Math.round(att.size / 1024)}KB</span>
                         </div>
                       </div>
                       {!readOnly && (
                         <button type="button" onClick={() => removeAttachment(att.id)} className="text-red-400 hover:text-red-500 p-1">
                           <X className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                  ))}
               </div>
            ) : (
               !readOnly && (
                 <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3 text-center">
                   <p className="text-xs text-slate-400">Attach lecture notes (PDF/Img/Txt) for AI analysis.</p>
                   <p className="text-[10px] text-slate-400 mt-1">Max 100MB per file.</p>
                 </div>
               )
            )}
             {readOnly && attachments.length === 0 && (
                <p className="text-xs text-slate-400 italic">No attachments.</p>
             )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 uppercase">Color Tag</label>
            <div className="flex flex-wrap gap-2">
              {APPOINTMENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${c} flex items-center justify-center transition-transform focus:outline-none ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 
                    ${color === c ? 'ring-slate-400 scale-110' : 'ring-transparent'}
                    ${readOnly ? 'cursor-default hover:scale-100 opacity-80' : 'hover:scale-110'}
                  `}
                >
                  {color === c && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3 shrink-0">
             {existingAppointment && onDelete && !readOnly && (
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
              className={`flex-1 px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors ${readOnly ? 'w-full' : ''}`}
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={isUploading}
                className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium shadow-md shadow-indigo-200 dark:shadow-indigo-900/20 transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Processing...' : (existingAppointment ? 'Save Changes' : 'Create Appointment')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
