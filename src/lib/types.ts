export interface TimelogEntry {
  name: string;
  month: string;
  date: string;       // formatted date string e.g. "2026-01-02"
  day: string;        // e.g. "Monday"
  jiraId: string;
  task: string;
  effort: number;     // hours
  status: string;
  sprint: string;
  jobName: string;    // e.g. "Development", "Client Calls", "Meeting"
  billing: string;    // e.g. "Billable", "Non-Billable"
}

export interface MemberConfig {
  name: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  clientName: string;
  projectName: string;
}

export interface SheetMeta {
  month: string;
  duration: string;
  totalWorkingDays: number;
  users: UserMeta[];
}

export interface UserMeta {
  name: string;
  sickLeave: number;
  vacationsPTO: number;
  publicHolidays: number;
  weekends: number;
  actualWorkingDays: number;
}

export interface SprintSummaryInput {
  startDate: string;
  endDate: string;
  userName?: string;
}

export interface SprintSummaryItem {
  userName: string;
  jiraId: string;
  task: string;
  status: string;
  totalEffort: number;
}
