import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import type { NewStory, UpdateStory } from "@/types/generated";

export const storyKeys = {
  byProject: (projectId: string) => ["stories", "project", projectId] as const,
  detail: (id: string) => ["stories", id] as const,
};

export function useStories(projectId: string) {
  return useQuery({
    queryKey: storyKeys.byProject(projectId),
    queryFn: () => api.listStories(projectId),
    enabled: !!projectId,
  });
}

export function useStory(id: string) {
  return useQuery({
    queryKey: storyKeys.detail(id),
    queryFn: () => api.getStory(id),
    enabled: !!id,
  });
}

export function useCreateStory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewStory) => api.createStory(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: storyKeys.byProject(projectId) }),
  });
}

export function useUpdateStory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStory) => api.updateStory(input),
    onSuccess: (story) => {
      qc.invalidateQueries({ queryKey: storyKeys.byProject(projectId) });
      qc.invalidateQueries({ queryKey: storyKeys.detail(story.id) });
    },
  });
}

export function useDeleteStory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteStory(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: storyKeys.byProject(projectId) }),
  });
}
