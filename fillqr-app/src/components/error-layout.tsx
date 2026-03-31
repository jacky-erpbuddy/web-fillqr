type ErrorLayoutProps = {
  title: string;
  message: string;
  linkText?: string;
  linkHref?: string;
};

export default function ErrorLayout({
  title,
  message,
  linkText = "Zur Startseite",
  linkHref = "https://fillqr.de",
}: ErrorLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          backgroundColor: "white",
          borderRadius: 12,
          padding: "48px 32px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#2563eb",
            marginBottom: 32,
            letterSpacing: "-0.5px",
          }}
        >
          fillQR
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 12,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 15,
            color: "#6b7280",
            marginBottom: 32,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        <a
          href={linkHref}
          style={{
            display: "inline-block",
            padding: "10px 24px",
            backgroundColor: "#2563eb",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          {linkText}
        </a>
      </div>
    </div>
  );
}
