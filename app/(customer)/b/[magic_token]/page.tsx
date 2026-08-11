import { notFound } from "next/navigation";
import { getSessionByToken } from "@/lib/api/public";
import { isApiError } from "@/lib/errors";
import { BookingExperience } from "@/components/customer/booking-experience";

export default async function BookingPage({ params }: { params: Promise<{ magic_token: string }> }) {
  try {
    const { magic_token } = await params;
    const session = await getSessionByToken(magic_token);
    return <BookingExperience session={session} />;
  } catch (e) {
    if (isApiError(e) && e.code === "SESSION_NOT_FOUND") notFound();
    throw e;
  }
}
