"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Particles } from "./components/particles";
import { GlowingEffectDemo } from "./components/glowing-effect-demo";
import { DisplayCardsDemo } from "./components/display-cards-demo";
import { ShuffleCards } from "./components/testimonial-cards";

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

export function TimelineContent() {
  // Define timeline entries
  const timelineData: TimelineEntry[] = [
    {
      title: "AI Tutor API",
      content: (
        <div className="relative">
          <GlowingEffectDemo />
        </div>
      ),
    },
    {
      title: "Features",
      content: (
        <div className="relative">
          <DisplayCardsDemo />
        </div>
      ),
    },
    {
      title: "Testimonials",
      content: (
        <div className="relative">
          <ShuffleCards />
        </div>
      ),
    },
  ];

  // References and state for the vertical timeline line animation
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [lineFullHeight, setLineFullHeight] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 90%"],
  });
  const animatedLineHeight = useTransform(scrollYProgress, [0, 1], [0, lineFullHeight]);

  useEffect(() => {
    if (lineRef.current) {
      setLineFullHeight(lineRef.current.offsetHeight);
    }
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Particles background */}

      <div ref={containerRef} className="max-w-7xl mx-auto px-4 md:px-8 lg:px-10 relative z-10">
        <div className="relative">
          {/* Vertical timeline line */}
          <div ref={lineRef} className="absolute left-8 top-0 h-full w-[2px] bg-neutral-200 dark:bg-neutral-700">
            <motion.div
              style={{ height: animatedLineHeight }}
              className="w-[2px] bg-gradient-to-t from-purple-500 via-blue-500 to-transparent rounded-full"
            />
          </div>
          {/* Timeline entries */}
          <div className="">
            {timelineData.map((entry, index) => (
              <div key={index} className="flex flex-col md:flex-row items-start md:gap-10">
                {/* Left: timeline indicator and title */}
                <div className="w-1/4 relative flex flex-col items-center">
                  <div className="h-15 w-15 rounded-full bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                    <span className="text-xl font-medium text-neutral-500 dark:text-neutral-500">{index + 1}</span>
                  </div>
                  <h3 className="mt-4 hidden md:block text-3xl font-bold text-neutral-500 dark:text-neutral-500">
                    {entry.title}
                  </h3>
                </div>
                {/* Right: entry content */}
                <div className="w-3/4 pl-4">
                  <h3 className="md:hidden block text-2xl font-bold text-neutral-500 dark:text-neutral-500 mb-4">
                    {entry.title}
                  </h3>
                  <div>
                    {entry.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
