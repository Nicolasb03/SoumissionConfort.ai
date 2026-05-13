import { notFound } from "next/navigation"
import TestUTMClient from "./_client"

// Dev-only UTM tester. Returns 404 in production so the page (which POSTs to
// /api/leads as a sanity check) cannot be used to bypass the OTP gate.
export default function Page() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }
  return <TestUTMClient />
}
