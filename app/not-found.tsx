import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ paddingTop: "3rem" }}>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>Страница не найдена</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem", maxWidth: "52ch" }}>
        Запрошенный адрес отсутствует в приложении.
      </p>
      <Link
        href="/"
        style={{
          color: "var(--accent)",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        На главную
      </Link>
    </main>
  );
}
