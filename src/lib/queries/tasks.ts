import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import type { NewTask, UpdateTask } from "@/types/generated";

export const taskKeys = {
  byStory: (storyId: string) => ["tasks", "story", storyId] as const,
  detail: (id: string) => ["tasks", id] as const,
};

export function useTasks(storyId: string) {
  return useQuery({
    queryKey: taskKeys.byStory(storyId),
    queryFn: () => api.listTasks(storyId),
    enabled: !!storyId,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => api.getTask(id),
    enabled: !!id,
  });
}

export function useCreateTask(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewTask) => api.createTask(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: taskKeys.byStory(storyId) }),
  });
}

export function useUpdateTask(storyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTask) => api.updateTask(input),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
      if (storyId) {
        qc.invalidateQueries({ queryKey: taskKeys.byStory(storyId) });
      }
    },
  });
}

export function useDeleteTask(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: taskKeys.byStory(storyId) }),
  });
}
