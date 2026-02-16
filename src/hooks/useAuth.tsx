import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
// IMPORTANT: ONLY import the enum. Do not import components or hooks here.
import { AppRole } from "@/types/roles";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ data: { role: AppRole } | null; error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Define a clean function inside useEffect to avoid external dependencies
    const syncAuth = async () => {
      setLoading(true);
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role, approved")
            .eq("user_id", currentSession.user.id)
            .maybeSingle();

          // Strict check: if employee but not approved, log out
          if (roleData?.role === "employee" && !roleData?.approved) {
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
          } else {
            setUser(currentSession.user);
            setSession(currentSession);
            setRole(roleData?.role as AppRole || null);
          }
        }
      } catch (e) {
        console.error("Auth sync error", e);
      } finally {
        setLoading(false); // This MUST fire
      }
    };

    syncAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      syncAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { data: null, error: error as Error };

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, approved")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleData?.role === "employee" && !roleData?.approved) {
      await supabase.auth.signOut();
      return { data: null, error: new Error("not approved") };
    }

    setRole(roleData?.role as AppRole);
    return { data: { role: roleData?.role as AppRole }, error: null };
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export { AppRole };
