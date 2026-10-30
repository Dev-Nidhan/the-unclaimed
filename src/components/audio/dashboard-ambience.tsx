"use client";

import { useEffect } from "react";
import { startDashboardAmbience } from "@/lib/audio/dashboard";

export function DashboardAmbience() {
  useEffect(() => startDashboardAmbience(), []);
  return null;
}
