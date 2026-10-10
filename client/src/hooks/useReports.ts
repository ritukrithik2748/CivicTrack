import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export const useReports = (filters: any = {}) => {
  const { user } = useAuth();
  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'admin';
  
  return useQuery({
    queryKey: ['reports', filters, isOfficerOrAdmin],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, filters[key]);
        }
      });
      
      // Citizens use /mine endpoint, officers/admins might have different access
      const endpoint = isOfficerOrAdmin ? '/api/reports' : '/api/reports/mine';
      
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useProblemGroups = (filters: any = {}) => {
  const { user } = useAuth();
  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'admin';
  
  return useQuery({
    queryKey: ['problemGroups', filters, isOfficerOrAdmin],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, filters[key]);
        }
      });
      
      // Citizens use public endpoint, officers/admins use authenticated endpoint
      const endpoint = isOfficerOrAdmin ? '/api/groups' : '/api/groups/public';
      
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch problem groups');
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useGroupDetail = (groupId: string | undefined) => {
  return useQuery({
    queryKey: ['groupDetail', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const response = await fetch(`/api/groups/${groupId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch group detail');
      }
      
      return response.json();
    },
    enabled: !!groupId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useSubscriptions = () => {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await fetch(`/api/subscriptions`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        return { data: [] };
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useDisruptions = (days: number) => {
  return useQuery({
    queryKey: ['disruptions', days],
    queryFn: async () => {
      const response = await fetch(`/api/subscriptions/disruptions?days=${days}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        return { disruptions: [] };
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useWorkOrders = (filters: any = {}) => {
  return useQuery({
    queryKey: ['workOrders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, filters[key]);
        }
      });
      
      const response = await fetch(`/api/workorders?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch work orders');
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useDashboardStats = (departmentId: string) => {
  return useQuery({
    queryKey: ['dashboardStats', departmentId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/dashboard?department_id=${departmentId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        // Return mock data if API endpoint doesn't exist yet
        return {
          active_issues: 12,
          new_issues_today: 3,
          work_in_progress: 5,
          overdue_items: 2,
          avg_response_time: 4.5,
          satisfaction_rate: 87,
          budget_utilization: 68,
          budget_remaining: '₹8,20,000',
        };
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAnalyticsData = (timeRange: string) => {
  return useQuery({
    queryKey: ['analyticsData', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/summary?days=${timeRange}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        // Return mock data if API endpoint doesn't exist yet
        return {
          total_reports: 156,
          reports_change: 12,
          avg_response_time: 4.2,
          response_time_change: -8,
          resolution_rate: 78,
          resolution_rate_change: 5,
          budget_variance: -4.2,
          budget_variance_change: 2,
        };
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useBudgetSummary = () => {
  return useQuery({
    queryKey: ['budgetSummary'],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/budget`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        return {
          byDepartment: [],
          byContractor: [],
          byWard: [],
          totals: { sanctioned: 0, spent: 0, maintenance_budget: 0, maintenance_spent: 0 }
        };
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useVerifyProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (verifyData: {
      projectId: string;
      statusType: 'in_progress' | 'completed';
      lat: number;
      lng: number;
      accuracy_m: number;
      demo_lat?: number | null;
      demo_lng?: number | null;
    }) => {
      const response = await fetch(`/api/projects/${verifyData.projectId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyData),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Verification failed');
      }
      
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['problemGroups'] });
    },
  });
};