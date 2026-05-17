import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import type { NewComment } from "@/types/generated";

export const commentKeys = {
  byTask: (taskId: string) => ["comments", "task", taskId] as const,
};

export function useComments(taskId: string) {
  return useQuery({
    queryKey: commentKeys.byTask(taskId),
    queryFn: () => api.listComments(taskId),
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewComment) => api.createComment(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) }),
  });
}
