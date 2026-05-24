import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen relative bg-background overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
