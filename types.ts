export interface Appointment {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  color: string;
  alertMinutesBefore: number[]; // e.g., [1440, 60, 15] for 1 day, 1 hour, 15 mins
}

export type ViewMode = 'month' | 'week' | 'day' | 'list';

export interface CalendarState {
  currentDate: Date;
  viewMode: ViewMode;
  selectedDate: Date | null;
}

export interface DragState {
  isDragging: boolean;
  appointmentId: string | null;
}

export type CalendarProvider = 'google' | 'outlook' | 'apple' | 'none';

export interface SyncSettings {
  defaultProvider: CalendarProvider;
}

export const APPOINTMENT_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-gray-500',
];