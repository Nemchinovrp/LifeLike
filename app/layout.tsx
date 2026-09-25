import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Как здесь живётся? — LifeLike",
  description:
    "Изучайте инфраструктуру вокруг дома и сравнивайте адреса с учётом своих приоритетов.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
