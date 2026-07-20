import { request } from "./api-client";
import type { DocumentType } from "./bookings-api";

export interface SavedTraveler {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  documentType: DocumentType;
  documentNumber: string;
  documentExpiry: string;
  documentIssuingCountry: string;
}

export const travelersApi = {
  list: () => request<SavedTraveler[]>("/travelers"),
  create: (input: Omit<SavedTraveler, "id">) =>
    request<SavedTraveler>("/travelers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  remove: (id: string) => request<void>(`/travelers/${id}`, { method: "DELETE" }),
};
