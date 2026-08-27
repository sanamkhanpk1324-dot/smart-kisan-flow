import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  mobile: string;
  farmer_id: string;
  village: string;
  district: string;
  crop: string;
  land_size: number;
  language: string;
};

export function mobileToEmail(mobile: string) {
  return `${mobile.replace(/\D/g, "")}@kisanqueue.app`;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", s.user.id),
      ]);
      if (!active) return;
      setProfile((p as Profile) ?? null);
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void load(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, profile, isAdmin, loading, setProfile };
}
