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
    queryFn: api.listNotes,
  });
}

export function useNotesForProject(projectId: string) {
  return useQuery({
    queryKey: noteKeys.byProject(projectId),
    queryFn: () => api.listNotesForProject(projectId),
    enabled: !!projectId,
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: () => api.getNote(id),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewNote) => api.createNote(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNote) => api.updateNote(input),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: noteKeys.detail(note.id) });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}
