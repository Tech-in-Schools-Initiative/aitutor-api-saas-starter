"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "motion/react";
import { MoveRight, Settings, ChevronRight } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { AnimatedGradientText } from "./components/animated-gradient-text";
import { SparklesText } from "./components/sparkles-text";
import { GlowEffect } from "./components/glow-effect";
import { Confetti } from "./components/confetti"; // Import Confetti component
import type { ConfettiRef } from "./components/confetti"; // Import ConfettiRef type

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["workflows", "chatbots", "personalities", "models"],
    []
  );
  const confettiRef = useRef<ConfettiRef>(null); // Ref to control confetti

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  // Function to trigger confetti on hover
  const handleConfetti = () => {
    confettiRef.current?.fire({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="w-full relative">
      <div className="container mx-auto">
        <div className="flex gap-8 py-20 lg:py-32 items-center justify-center flex-col">
          <div
            onMouseEnter={handleConfetti} // Trigger confetti on hover
            className="group"
          >
            <AnimatedGradientText>
              🎉{" "}
              <hr className="mx-2 h-4 w-px shrink-0 bg-gray-300" />{" "}
              <span
                className={cn(
                  `inline animate-gradient bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent`
                )}
              >
                Introducing AI Tutor API Stripe Starter
              </span>
              <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
            </AnimatedGradientText>
          </div>
          <div className="flex gap-4 flex-col">
            <h1 className="text-5xl md:text-7xl max-w-2xl tracking-tighter text-center font-regular">
              <span className="text-foreground">SaaS Wrapper for Your</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.div
                    key={index}
                    className="absolute"
                    initial={{ opacity: 0, y: "-100" }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? { y: 0, opacity: 1 }
                        : { y: titleNumber > index ? -150 : 150, opacity: 0 }
                    }
                  >
                    <SparklesText
                      text={title}
                      className="text-5xl md:text-7xl"
                    />
                  </motion.div>
                ))}
              </span>
            </h1>
            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center">
                Get started quickly with an online subscription product that uses AI Tutor API for agentic capabilities, Postgres for database management, and Stripe for payment processing.
            </p>
          </div>
          <div className="flex flex-row gap-3 relative">
            <Button size="lg" className="gap-4" variant="outline">
              Get AI Tutor API <Settings className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Button
                size="lg"
                className="gap-4 bg-black text-white relative z-10"
              >
                Try this app <MoveRight className="w-4 h-4" />
              </Button>
              <GlowEffect
                colors={["#FF5733", "#33FF57", "#3357FF", "#F1C40F"]}
                mode="colorShift"
                blur="soft"
                duration={3}
                scale={0.9}
                className="absolute inset-0"
              />
            </div>
          </div>
        </div>
      </div>
      {/* Confetti canvas positioned absolutely over the entire hero section */}
      <Confetti
        ref={confettiRef}
        className="absolute left-0 top-0 z-10 size-full pointer-events-none"
        manualstart={true} // Manual start to control via ref
      />
    </div>
  );
}

export { Hero };