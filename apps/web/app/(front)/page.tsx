import { Button } from '@/components/ui/button';
import { ArrowRight, CreditCard, Database } from 'lucide-react';
import { Hero } from '@/components/landing-page/hero/hero';
import { TimelineSection } from '@/components/landing-page/timeline/TImelineSecion';
import PricingPage from './pricing/page';
import { StackedCircularFooter } from '@/components/landing-page/footer/footer';

export default function HomePage() {
  return (
    <main>
      <section>
        <Hero />
      </section>

      <section>
       <TimelineSection />
      </section>

      <section>
        <PricingPage />
      </section>
      
<StackedCircularFooter />
    </main>
  );
}
