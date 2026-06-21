import "./globals.css";

export const metadata = {
  title: "Florida Property Tax Estimator",
  description:
    "Estimate Florida property taxes for a new buyer — search by address, recalculate ad valorem taxes after a sale, pull actual non-ad valorem charges, and apply exemptions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
