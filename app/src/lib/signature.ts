"use client";

const STORAGE_KEY = "kitstash_signature_name";

export function getStoredSignature(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setStoredSignature(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, name);
}
