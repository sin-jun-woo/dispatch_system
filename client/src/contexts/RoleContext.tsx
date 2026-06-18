import React, { createContext, useContext, useState, useEffect } from "react";

export type DemoRole = "admin" | "driver" | null;

interface RoleContextValue {
  role: DemoRole;
  driverId: number | null;
  setRole: (role: DemoRole, driverId?: number | null) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  driverId: null,
  setRole: () => {},
  clearRole: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>(() => {
    return (sessionStorage.getItem("demo_role") as DemoRole) ?? null;
  });
  const [driverId, setDriverId] = useState<number | null>(() => {
    const v = sessionStorage.getItem("demo_driver_id");
    return v ? Number(v) : null;
  });

  const setRole = (newRole: DemoRole, newDriverId?: number | null) => {
    setRoleState(newRole);
    if (newRole) {
      sessionStorage.setItem("demo_role", newRole);
    } else {
      sessionStorage.removeItem("demo_role");
    }
    if (newDriverId !== undefined && newDriverId !== null) {
      setDriverId(newDriverId);
      sessionStorage.setItem("demo_driver_id", String(newDriverId));
    } else if (newDriverId === null) {
      setDriverId(null);
      sessionStorage.removeItem("demo_driver_id");
    }
  };

  const clearRole = () => {
    setRoleState(null);
    setDriverId(null);
    sessionStorage.removeItem("demo_role");
    sessionStorage.removeItem("demo_driver_id");
  };

  return (
    <RoleContext.Provider value={{ role, driverId, setRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
