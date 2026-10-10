import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useAdminSettings = () => {
  const queryClient = useQueryClient();
  
  const settingsQuery = useQuery({
    queryKey: ['adminSettings'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/settings`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        // Return default settings if API endpoint doesn't exist yet
        return {
          cluster_radius_m: '50',
          major_count_threshold: '10',
          stall_days_major: '14',
          secondary_gap_minutes: '60',
          grace_major_hours: '24',
          grace_moderate_hours: '72',
          grace_minor_days: '7',
          verify_radius_m: '200',
          max_accuracy_m: '50',
          quorum_threshold: '3',
          daily_verification_cap: '20',
          conflict_radius_m: '100',
          conflict_months: '6',
          warning_reports: '5',
          warning_days: '7',
          max_reports_per_day: '10',
          max_photos_per_report: '3',
          max_file_size_mb: '5',
          demo_location_mode: 'true',
          city_min_lat: '12.80',
          city_max_lat: '12.86',
          city_min_lng: '80.10',
          city_max_lng: '80.18',
        };
      }
      
      return response.json();
    },
  });
  
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await fetch(`/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update setting');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
    },
  });
  
  const updateSetting = async (key: string, value: string) => {
    await updateSettingMutation.mutateAsync({ key, value });
  };
  
  return {
    settings: settingsQuery.data || {},
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSetting,
  };
};