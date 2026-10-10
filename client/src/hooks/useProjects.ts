import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useProjects = (filters: any = {}) => {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, filters[key]);
        }
      });
      
      const response = await fetch(`/api/projects?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useProblemGroups = (filters: any = {}) => {
  return useQuery({
    queryKey: ['problemGroups', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, filters[key]);
        }
      });
      
      const response = await fetch(`/api/groups?${params.toString()}`, {
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

export const useVerifyProjectMutation = () => {
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
        headers: {
          'Content-Type': 'application/json',
        },
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