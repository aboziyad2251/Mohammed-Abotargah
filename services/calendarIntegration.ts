
import { Appointment, APPOINTMENT_COLORS } from '../types';
import { format } from 'date-fns';

export const generateGoogleCalendarLink = (title: string, description: string, location: string | undefined, start: Date, end: Date) => {
  const startStr = format(start, "yyyyMMdd'T'HHmmss");
  const endStr = format(end, "yyyyMMdd'T'HHmmss");
  const details = encodeURIComponent(description || '');
  const summary = encodeURIComponent(title);
  const loc = encodeURIComponent(location || '');
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${startStr}/${endStr}&details=${details}&location=${loc}`;
};

export const generateOutlookCalendarLink = (title: string, description: string, location: string | undefined, start: Date, end: Date) => {
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const details = encodeURIComponent(description || '');
  const summary = encodeURIComponent(title);
  const loc = encodeURIComponent(location || '');

  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${summary}&startdt=${startStr}&enddt=${endStr}&body=${details}&location=${loc}`;
};

export const generateICSContent = (appointments: Appointment[]) => {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TechArja//AI Smart Calendar//EN\n";
  
  appointments.forEach(appt => {
    ics += "BEGIN:VEVENT\n";
    ics += `UID:${appt.id}\n`;
    ics += `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}\n`;
    ics += `DTSTART:${format(appt.start, "yyyyMMdd'T'HHmmss")}\n`;
    ics += `DTEND:${format(appt.end, "yyyyMMdd'T'HHmmss")}\n`;
    ics += `SUMMARY:${appt.title}\n`;
    ics += `DESCRIPTION:${(appt.description || '').replace(/\n/g, '\\n')}\n`;
    if (appt.location) {
      ics += `LOCATION:${appt.location.replace(/\,/g, '\\,')}\n`;
    }
    ics += "END:VEVENT\n";
  });
  
  ics += "END:VCALENDAR";
  return ics;
};

export const downloadICSFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper to parse ICS date strings
const parseICSDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  
  // Clean up standard ICS date format complications
  const cleanStr = dateStr.replace('Z', '').trim();
  
  // Format: YYYYMMDD
  if (cleanStr.length === 8) {
    const y = parseInt(cleanStr.substring(0, 4));
    const m = parseInt(cleanStr.substring(4, 6)) - 1; // Month is 0-indexed
    const d = parseInt(cleanStr.substring(6, 8));
    return new Date(y, m, d);
  }
  
  // Format: YYYYMMDDTHHMMSS
  if (cleanStr.length >= 15) {
    const y = parseInt(cleanStr.substring(0, 4));
    const m = parseInt(cleanStr.substring(4, 6)) - 1;
    const d = parseInt(cleanStr.substring(6, 8));
    const h = parseInt(cleanStr.substring(9, 11));
    const min = parseInt(cleanStr.substring(11, 13));
    const s = parseInt(cleanStr.substring(13, 15));
    return new Date(y, m, d, h, min, s);
  }
  
  return new Date();
};

export const parseICSContent = (icsData: string): Appointment[] => {
  const appointments: Appointment[] = [];
  
  // 1. Unfold lines (handle multi-line properties)
  const lines = icsData.split(/\r\n|\n|\r/);
  const unfoldedLines: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfoldedLines.length > 0) {
        // Append to previous line, removing the first space
        unfoldedLines[unfoldedLines.length - 1] += line.slice(1);
      }
    } else {
      if (line.trim()) unfoldedLines.push(line.trim());
    }
  }

  let currentEvent: Partial<Appointment> | null = null;
  
  for (const line of unfoldedLines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {
        id: crypto.randomUUID(),
        alertMinutesBefore: [15],
        color: APPOINTMENT_COLORS[Math.floor(Math.random() * APPOINTMENT_COLORS.length)],
        urgency: 'medium',
        attachments: []
      };
      continue;
    }
    
    if (line.startsWith('END:VEVENT')) {
      if (currentEvent && currentEvent.title && currentEvent.start) {
        // If end time is missing, default to start + 1 hour
        if (!currentEvent.end) {
          currentEvent.end = new Date(currentEvent.start.getTime() + 60 * 60 * 1000);
        }
        appointments.push(currentEvent as Appointment);
      }
      currentEvent = null;
      continue;
    }
    
    if (currentEvent) {
      // Split by first colon to separate key and value
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const keyPart = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      
      // Handle params (e.g., DTSTART;TZID=America/New_York)
      const key = keyPart.split(';')[0];

      if (key === 'SUMMARY') {
        currentEvent.title = value;
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
      } else if (key === 'LOCATION') {
        currentEvent.location = value.replace(/\\,/g, ',');
      } else if (key === 'DTSTART') {
        currentEvent.start = parseICSDate(value);
      } else if (key === 'DTEND') {
        currentEvent.end = parseICSDate(value);
      }
    }
  }
  
  return appointments;
};
