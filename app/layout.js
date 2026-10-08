import "./globals.css";

export const metadata = {
  title: "Aaron Yu",
  keywords: ["Auckland", "music", "maths", "opportunities"],
  description: "Aaron Yu — student, saxophonist, gamer, and French learner."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap" rel="stylesheet" />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2371d9f3'/%3E%3Ccircle cx='32' cy='32' r='19' fill='%23c8ed4e' stroke='%2314518b' stroke-width='3'/%3E%3Cpath d='M26 20v25m0-12h15' stroke='%2314518b' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E" />
      </head>
      <body>{children}</body>
    </html>
  );
}
