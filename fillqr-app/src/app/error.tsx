"use client";

import ErrorLayout from "@/components/error-layout";

export default function GlobalError() {
  return (
    <ErrorLayout
      title="Ein Fehler ist aufgetreten"
      message="Bitte versuche es spaeter erneut. Falls das Problem bestehen bleibt, kontaktiere den Support."
    />
  );
}
