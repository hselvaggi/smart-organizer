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
    queryFn: () => api.stories.list(projectId),
    enabled: !!projectId,
  });
}

export function useStory(id: string) {
  return useQuery({
    queryKey: storyKeys.detail(id),
    queryFn: () => api.stories.get(id),
    enabled: !!id,
  });
}

export function useCreateStory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewStory) => api.stories.create(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: storyKeys.byProject(projectId) }),
  });
}

export function useUpdateStory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStory) => api.stories.update(input),
    onSuccess: (story) => {
      qc.invalidateQueries({ queryKey: storyKeys.byProject(projectId) });
      qc.invalidateQueries({ queryKey: storyKeys.detail(story.id) });
    },
  });
}

export function useDeleteStory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.stories.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: storyKeys.byProject(projectId) }),
  });
}
