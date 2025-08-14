import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // For demo purposes, we'll use a mock user
    // In a real app, check for stored authentication token
    setTimeout(() => {
      setUser({
        id: "demo-user-id",
        username: "admin",
        email: "admin@whatsflow.com",
        password: "", // Never store passwords in frontend
        name: "Admin User",
        company: "WhatsFlow Tech",
        phone: "+55 11 99999-9999",
        plan: "pro",
        subscriptionStatus: "active",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setIsLoading(false);
    }, 500);
  }, []);

  const login = async (username: string, password: string) => {
    // Mock login - in real app, call authentication API
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setUser({
      id: "demo-user-id",
      username,
      email: "admin@whatsflow.com",
      password: "",
      name: "Admin User",
      company: "WhatsFlow Tech",
      phone: "+55 11 99999-9999",
      plan: "pro",
      subscriptionStatus: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
