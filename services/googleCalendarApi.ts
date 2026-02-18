import { Appointment } from '../types';

// Types for the Google API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let tokenClient: any;
let isInitialized = false;

const waitForGlobal = (key: 'gapi' | 'google', timeout = 10000) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (window[key]) {
        clearInterval(interval);
        resolve();
      }
      if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        // Final check
        if (window[key]) resolve();
        else reject(new Error(`${key} library failed to load within ${timeout}ms`));
      }
    }, 100);
  });
};

export const initGoogleApi = async (clientId: string) => {
  if (!clientId) return false;
  if (isInitialized) return true;

  try {
    // 1. Wait for libraries to be available (loaded via index.html)
    await Promise.all([waitForGlobal('gapi'), waitForGlobal('google')]);

    // 2. Initialize GAPI Client for REST calls
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('client', {
        callback: resolve,
        onerror: reject,
        timeout: 5000, 
        ontimeout: reject
      });
    });

    await window.gapi.client.init({
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    });

    // 3. Initialize GIS Token Client for Auth
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: '', // Will be set dynamically in signInToGoogle
    });

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing Google API:', error);
    return false;
  }
};

export const signInToGoogle = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!tokenClient) {
      console.error("Token Client not initialized. Call initGoogleApi first.");
      resolve(false);
      return;
    }

    // Define the callback for this specific request
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        console.error("Auth Error:", resp);
        resolve(false);
        return;
      }
      // CRITICAL: Set the token for gapi so subsequent REST calls are authorized
      if (window.gapi.client) {
        window.gapi.client.setToken(resp);
      }
      resolve(true);
    };

    // Prompt the user for consent
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

/**
 * Checks if we have a valid token. If not, attempts to get one.
 * Note: If this is called outside of a user gesture handler, the popup might be blocked
 * if we force prompt. However, usually we assume the user has consented if we are here.
 */
const ensureToken = async (): Promise<boolean> => {
  if (!isInitialized) {
     console.warn("Google API not initialized.");
     return false;
  }

  // Check if gapi has a token
  const token = window.gapi.client.getToken();
  if (token && token.access_token) {
    return true;
  }

  // If no token (e.g. page refresh), we need to request one.
  // Since we can't await the user interaction easily deep in a call stack without a promise wrapper,
  // we reuse signInToGoogle logic but maybe with different prompt if needed.
  // For simplicity in this app, we trigger the standard sign in flow.
  console.log("No active token found, requesting new token...");
  return await signInToGoogle();
};

export const createGoogleEvent = async (appt: Appointment): Promise<string | null> => {
  if (!await ensureToken()) return null;

  try {
    const event = {
      summary: appt.title,
      description: appt.description,
      start: { dateTime: appt.start.toISOString() },
      end: { dateTime: appt.end.toISOString() },
    };

    const response = await window.gapi.client.calendar.events.insert({
      'calendarId': 'primary',
      'resource': event,
    });

    return response.result.id;
  } catch (error) {
    console.error("Error creating Google event:", error);
    return null;
  }
};

export const updateGoogleEvent = async (appt: Appointment): Promise<boolean> => {
  if (!appt.googleEventId) return false;
  if (!await ensureToken()) return false;

  try {
    const event = {
      summary: appt.title,
      description: appt.description,
      start: { dateTime: appt.start.toISOString() },
      end: { dateTime: appt.end.toISOString() },
    };

    await window.gapi.client.calendar.events.update({
      'calendarId': 'primary',
      'eventId': appt.googleEventId,
      'resource': event,
    });
    return true;
  } catch (error) {
    console.error("Error updating Google event:", error);
    return false;
  }
};

export const deleteGoogleEvent = async (googleEventId: string): Promise<boolean> => {
  if (!await ensureToken()) return false;

  try {
    await window.gapi.client.calendar.events.delete({
      'calendarId': 'primary',
      'eventId': googleEventId,
    });
    return true;
  } catch (error) {
    console.error("Error deleting Google event:", error);
    return false;
  }
};