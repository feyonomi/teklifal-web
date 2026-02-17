import { LandingPage } from "@/components/landing-page";
import { getCategories, getProviders } from "@/lib/data";

export default function Home() {
  const categories = getCategories();
  const providers = getProviders();

  return <LandingPage categories={categories} providers={providers} />;
}
