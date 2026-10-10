import { getDb } from '../db/database.js';
import { haversineDistance } from './clock.js';

const CITY_BOUNDS = {
  minLat: 12.80,
  maxLat: 12.86,
  minLng: 80.10,
  maxLng: 80.18,
};

const EXIF_DEVICE_MISMATCH_THRESHOLD_M = 200;
const EXIF_MAX_AGE_HOURS = 24;

export type LocationSource = 'exif' | 'device_gps' | 'manual_pin';
export type LocationTrust = 'high' | 'low';
export type LocationFlag = 'ok' | 'unverified';

export interface LocationInfo {
  source: LocationSource;
  trust: LocationTrust;
  flag: LocationFlag;
  weight: number;
  lat: number;
  lng: number;
  accuracyM?: number;
}

export function determineLocationTrust(
  exifLat: number | null,
  exifLng: number | null,
  exifTimestamp: Date | null,
  deviceLat: number | null,
  deviceLng: number | null,
  deviceAccuracy: number | null,
  manualLat: number | null,
  manualLng: number | null
): LocationInfo {
  // Priority 1: EXIF GPS (if recent)
  if (exifLat !== null && exifLng !== null && exifTimestamp) {
    const ageHours = (Date.now() - exifTimestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours <= EXIF_MAX_AGE_HOURS) {
      let flag: LocationFlag = 'ok';
      let trust: LocationTrust = 'high';
      
      // Check against device GPS if available
      if (deviceLat !== null && deviceLng !== null) {
        const mismatch = haversineDistance(exifLat, exifLng, deviceLat, deviceLng);
        if (mismatch > EXIF_DEVICE_MISMATCH_THRESHOLD_M) {
          flag = 'unverified';
        }
      }
      
      return {
        source: 'exif',
        trust,
        flag,
        weight: 1.0,
        lat: exifLat,
        lng: exifLng,
      };
    }
  }
  
  // Priority 2: Device GPS
  if (deviceLat !== null && deviceLng !== null) {
    return {
      source: 'device_gps',
      trust: 'high',
      flag: 'ok',
      weight: 1.0,
      lat: deviceLat,
      lng: deviceLng,
      accuracyM: deviceAccuracy || undefined,
    };
  }
  
  // Priority 3: Manual pin
  if (manualLat !== null && manualLng !== null) {
    // Check if within city bounds
    if (manualLat < CITY_BOUNDS.minLat || manualLat > CITY_BOUNDS.maxLat ||
        manualLng < CITY_BOUNDS.minLng || manualLng > CITY_BOUNDS.maxLng) {
      throw new Error('Manual pin location is outside the supported city area');
    }
    
    return {
      source: 'manual_pin',
      trust: 'low',
      flag: 'ok',
      weight: 0.5,
      lat: manualLat,
      lng: manualLng,
    };
  }
  
  throw new Error('No valid location source provided');
}

export function isWithinCityBounds(lat: number, lng: number): boolean {
  return lat >= CITY_BOUNDS.minLat && lat <= CITY_BOUNDS.maxLat &&
         lng >= CITY_BOUNDS.minLng && lng <= CITY_BOUNDS.maxLng;
}

export function getCityBounds(): typeof CITY_BOUNDS {
  return { ...CITY_BOUNDS };
}

export function getLocationTrustConfig(): { mismatchThresholdM: number; exifMaxAgeHours: number; cityBounds: typeof CITY_BOUNDS } {
  return { mismatchThresholdM: EXIF_DEVICE_MISMATCH_THRESHOLD_M, exifMaxAgeHours: EXIF_MAX_AGE_HOURS, cityBounds: { ...CITY_BOUNDS } };
}