import ErrorLayout from "@/components/error-layout";

export default function NotFound() {
  return (
    <ErrorLayout
      title="Seite nicht gefunden"
      message="Die angeforderte Seite existiert nicht. Prüfe die URL oder gehe zurück zur Startseite."
    />
  );
}
