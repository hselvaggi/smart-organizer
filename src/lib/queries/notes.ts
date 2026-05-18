import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";
import type { NewNote, UpdateNote } from "@/types/generated";

export const noteKeys = {
  standalone: ["notes", "standalone"] as const,
  byProject: (projectId: string) => ["notes", "project", projectId] as const,
  detail: (id: string) => ["notes", id] as const,
};

export function useNotes() {
  return useQuery({
    queryKey: noteKeys.standalone,
    queryFn: api.notes.list,
  });
}

export function useNotesForProject(projectId: string) {
  return useQuery({
    queryKey: noteKeys.byProject(projectId),
    queryFn: () => api.notes.listForProject(projectId),
    enabled: !!projectId,
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: () => api.notes.get(id),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewNote) => api.notes.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNote) => api.notes.update(input),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: noteKeys.detail(note.id) });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notes.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}
