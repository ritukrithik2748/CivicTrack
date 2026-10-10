import { API_URL } from '../utils/constants';

interface ReportIssueData {
  category: string;
  description: string;
  lat: number;
  lng: number;
  location_source: 'exif' | 'device_gps' | 'manual_pin';
  exif_lat?: number | null;
  exif_lng?: number | null;
  exif_timestamp?: string | null;
  device_accuracy?: number | null;
  manual_lat?: number | null;
  manual_lng?: number | null;
}

interface UseReportIssueReturn {
  reportIssue: (reportData: ReportIssueData) => Promise<any>;
}

export const useReportIssue = (): UseReportIssueReturn => {
  const reportIssue = async (reportData: ReportIssueData) => {
    const response = await fetch(`${API_URL}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit report');
    }
    
    return response.json();
  };
  
  return { reportIssue };
};