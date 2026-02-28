import { LandingPage } from "@/components/landing-page";
import { getProviders } from "@/lib/data";

export default function Home() {
  const providers = getProviders();
  console.log("Home page rendering with providers:", providers ? providers.length : "null");
  
  if (!providers) {
    console.error("Providers data is missing!");
  }

  return <LandingPage providers={providers} />;
}
