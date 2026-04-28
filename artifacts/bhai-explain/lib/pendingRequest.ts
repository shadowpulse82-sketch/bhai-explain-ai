import type { Language } from "@/contexts/SettingsContext";

export type PendingRequest = {
  question: string;
  subject?: string;
  gradeLevel?: string;
  language: Language;
  imageBase64?: string;
};

let pending: PendingRequest | null = null;

export function setPendingRequest(req: PendingRequest): void {
  pending = req;
}

export function takePendingRequest(): PendingRequest | null {
  const current = pending;
  pending = null;
  return current;
}
