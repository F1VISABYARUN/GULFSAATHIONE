export type EntityType =
  | 'money' | 'phone' | 'hours' | 'place' | 'name' | 'gulf' | 'passportType' | 'day' | 'distress' | 'job';

export interface Entity {
  type: EntityType;
  start: number;          // token index (inclusive)
  end: number;            // token index (exclusive)
  text: string;           // canonical display form
  surface: string;        // what the transcript literally said
  value?: unknown;
  layer: string;          // which harness layer produced it
  changed: boolean;       // true when the harness rewrote the surface form
  superseded?: boolean;   // replaced by a later self-correction
  risky?: boolean;        // needs read-back confirmation
  score?: number;         // match confidence (phonetic layer)
}

export interface Revision { type: EntityType; from: string; to: string; marker: string }

export interface CallContext {
  names?: string[];        // people expected on this call (worker, agent, kafeel)
  places?: string[];       // village / mandal / city expected
  employer?: string;
  promise?: CaseSlots;     // the stored promise record (for check-in calls)
}

export interface CaseSlots {
  agentName?: string;
  employerName?: string;
  pickupName?: string;
  feeINR?: number;
  visaType?: 'work' | 'visit';
  passportType?: 'ECR' | 'ECNR';
  salary?: { amount: number; currency?: string };
  hoursPerDay?: number;
  job?: string;
  salaryPaid?: boolean;
  passportHeld?: boolean;
  huroob?: boolean;
  distress?: string[];
  phones?: string[];
  places?: string[];
  country?: string;        // Gulf country (from city/country mentions)
  district?: string;       // Telangana district
  takenByStranger?: boolean; // picked up by someone other than the employer
}
