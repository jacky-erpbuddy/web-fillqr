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
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Electrolize&display=swap');
          `,
        }}
      />
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0f",
          padding: "20px",
          fontFamily:
            "'Electrolize', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
            backgroundColor: "rgba(26, 26, 36, 0.8)",
            borderRadius: 16,
            padding: "48px 32px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 32,
              background:
                "linear-gradient(135deg, #5bcbde 0%, #5cb85c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            FillQR
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#ffffff",
              marginBottom: 12,
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontSize: 15,
              color: "#a0a0b0",
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>

          <a
            href={linkHref}
            style={{
              display: "inline-block",
              padding: "12px 28px",
              background:
                "linear-gradient(135deg, #5bcbde 0%, #5cb85c 100%)",
              color: "#0a0a0f",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              boxShadow:
                "0 0 20px rgba(91, 203, 222, 0.3), 0 0 40px rgba(92, 184, 92, 0.2)",
            }}
          >
            {linkText}
          </a>
        </div>
      </div>
    </>
  );
}
