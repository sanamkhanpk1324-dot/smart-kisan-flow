import { supabase } from "@/integrations/supabase/client";

export type Centre = {
  id: string;
  name: string;
  code: string;
  address: string;
  district: string;
  capacity_per_slot: number;
  avg_minutes_per_farmer: number;
  now_serving: string;
};

export type Slot = {
  id: string;
  centre_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  is_open: boolean;
};

export type Booking = {
  id: string;
  user_id: string;
  centre_id: string;
  slot_id: string;
  crop: string;
  expected_quantity: number;
  booking_date: string;
  start_time: string;
  token_code: string;
  queue_number: number;
  stage: string;
  created_at: string;
};

export type ProcurementRecord = {
  id: string;
  booking_id: string;
  actual_quantity: number;
  quality_grade: string;
  moisture: number | null;
  rate_per_quintal: number;
  amount: number;
};

export type Payment = {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  reference: string;
  paid_at: string | null;
};

export type NotificationRow = {
  id: string;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
};

export const ACTIVE_STAGES = ["booked", "arrived", "weighing", "quality_check", "completed", "payment_processing"];

export async function fetchCentres(): Promise<Centre[]> {
  const { data, error } = await supabase.from("centres").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Centre[];
}

export async function fetchSlots(centreId: string): Promise<Slot[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("centre_id", centreId)
    .gte("slot_date", today)
    .order("slot_date")
    .order("start_time");
  if (error) throw error;
  return (data ?? []) as Slot[];
}

export async function fetchMyBookings(userId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Booking[];
}

export async function fetchCentreQueue(centreId: string, date: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("centre_id", centreId)
    .eq("booking_date", date)
    .order("queue_number");
  if (error) throw error;
  return (data ?? []) as Booking[];
}

export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function fetchRecords(userId: string): Promise<ProcurementRecord[]> {
  const { data, error } = await supabase.from("procurement_records").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as ProcurementRecord[];
}

export async function fetchPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as Payment[];
}

export function activeBooking(bookings: Booking[]): Booking | null {
  const upcoming = bookings
    .filter((b) => ACTIVE_STAGES.includes(b.stage))
    .sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time));
  return upcoming[0] ?? null;
}

export async function notify(userId: string, title: string, message: string, category = "general") {
  await supabase.from("notifications").insert({ user_id: userId, title, message, category });
}
