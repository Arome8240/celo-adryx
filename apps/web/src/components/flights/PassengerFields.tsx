"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PassengerInput } from "@/lib/bookings-api";
import type { SavedTraveler } from "@/lib/travelers-api";

const TITLE_OPTIONS = ["Mr", "Mrs", "Ms", "Dr", "Prof"].map((title) => ({
  value: title,
  label: title,
}));
const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];
const DOCUMENT_TYPE_OPTIONS = [
  { value: "NATIONAL_ID", label: "National ID" },
  { value: "PASSPORT", label: "Passport" },
];

export interface PassengerFieldsProps {
  label: string;
  passenger: PassengerInput;
  onChange: (patch: Partial<PassengerInput>) => void;
  savedTravelers: SavedTraveler[];
}

export function PassengerFields({
  label,
  passenger,
  onChange,
  savedTravelers,
}: PassengerFieldsProps) {
  function applySavedTraveler(id: string) {
    const traveler = savedTravelers.find((t) => t.id === id);
    if (!traveler) return;
    onChange({
      title: traveler.title,
      firstName: traveler.firstName,
      lastName: traveler.lastName,
      dateOfBirth: traveler.dateOfBirth.slice(0, 10),
      nationality: traveler.nationality.slice(0, 2).toUpperCase(),
      documentType: traveler.documentType,
      documentNumber: traveler.documentNumber,
      documentExpiry: traveler.documentExpiry.slice(0, 10),
      documentIssuingCountry: traveler.documentIssuingCountry.slice(0, 2).toUpperCase(),
    });
  }

  return (
    <Card className="p-5">
      <h3 className="mb-4 font-semibold">{label}</h3>

      {savedTravelers.length > 0 && (
        <div className="mb-4">
          <Select
            label="Fill from saved traveler"
            options={savedTravelers.map((t) => ({
              value: t.id,
              label: `${t.firstName} ${t.lastName}`,
            }))}
            value=""
            placeholder="Select a saved traveler"
            onChange={applySavedTraveler}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Select
          label="Title"
          options={TITLE_OPTIONS}
          value={passenger.title}
          onChange={(value) => onChange({ title: value })}
        />
        <Input
          label="First name"
          required
          value={passenger.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })}
        />
        <Input
          label="Last name"
          required
          value={passenger.lastName}
          onChange={(e) => onChange({ lastName: e.target.value })}
        />
        <Select
          label="Gender"
          options={GENDER_OPTIONS}
          value={passenger.gender}
          onChange={(value) => onChange({ gender: value as PassengerInput["gender"] })}
        />
        <Input
          label="Date of birth"
          type="date"
          required
          value={passenger.dateOfBirth}
          onChange={(e) => onChange({ dateOfBirth: e.target.value })}
        />
        <Input
          label="Nationality"
          placeholder="e.g. US"
          required
          maxLength={2}
          value={passenger.nationality}
          onChange={(e) => onChange({ nationality: e.target.value.toUpperCase() })}
        />
        <Select
          label="Document type"
          options={DOCUMENT_TYPE_OPTIONS}
          value={passenger.documentType}
          onChange={(value) =>
            onChange({ documentType: value as PassengerInput["documentType"] })
          }
        />
        <Input
          label="Document number"
          required
          value={passenger.documentNumber}
          onChange={(e) => onChange({ documentNumber: e.target.value })}
        />
        <Input
          label="Document expiry"
          type="date"
          required
          value={passenger.documentExpiry}
          onChange={(e) => onChange({ documentExpiry: e.target.value })}
        />
        <Input
          label="Issuing country"
          placeholder="e.g. US"
          required
          maxLength={2}
          value={passenger.documentIssuingCountry}
          onChange={(e) =>
            onChange({ documentIssuingCountry: e.target.value.toUpperCase() })
          }
        />
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={passenger.saveTraveler ?? false}
          onChange={(e) => onChange({ saveTraveler: e.target.checked })}
        />
        Save this traveler for next time
      </label>
    </Card>
  );
}
