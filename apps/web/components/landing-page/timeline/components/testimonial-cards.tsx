"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useState } from "react";

export interface TestimonialCardProps {
  handleShuffle: () => void;
  testimonial: string;
  position: "front" | "middle" | "back";
  id: number;
  author: string;
  imageSrc: string; // Add imageSrc to props
}

const getClientX = (e: MouseEvent | PointerEvent | TouchEvent): number => {
  if ("clientX" in e) {
    return e.clientX;
  } else if ("touches" in e && e.touches.length > 0) {
    return e.touches[0].clientX;
  }
  return 0;
};

export function TestimonialCard({
  handleShuffle,
  testimonial,
  position,
  id,
  author,
  imageSrc, // Destructure imageSrc
}: TestimonialCardProps) {
  const dragRef = React.useRef(0);
  const isFront = position === "front";
  return (
    <motion.div
      style={{
        zIndex: position === "front" ? "2" : position === "middle" ? "1" : "0",
      }}
      animate={{
        rotate: position === "front" ? "-6deg" : position === "middle" ? "0deg" : "6deg",
        x: position === "front" ? "0%" : position === "middle" ? "33%" : "66%",
      }}
      drag={true}
      dragElastic={0.35}
      dragListener={isFront}
      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
      onDragStart={(e: MouseEvent | PointerEvent | TouchEvent) => {
        const clientX = getClientX(e);
        dragRef.current = clientX;
      }}
      onDragEnd={(e: MouseEvent | PointerEvent | TouchEvent) => {
        const clientX = getClientX(e);
        if (dragRef.current - clientX > 150) {
          handleShuffle();
        }
        dragRef.current = 0;
      }}
      transition={{ duration: 0.35 }}
      className={`absolute left-0 top-0 grid h-[450px] w-[350px] select-none place-content-center space-y-6 rounded-2xl border-2 border-gray-700 bg-gray-300/20 p-6 shadow-xl backdrop-blur-md ${
        isFront ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <img
        src={imageSrc} // Use imageSrc here
        alt={`Avatar of ${author}`}
        className="pointer-events-none mx-auto h-32 w-32 rounded-full border-2 border-slate-700 bg-slate-200 object-cover"
      />
      <span className="text-center text-lg italic text-slate-950">"{testimonial}"</span>
      <span className="text-center text-sm font-medium text-pink-400">{author}</span>
    </motion.div>
  );
}

const testimonials = [
  {
    id: 1,
    testimonial:
      "It started as a quick pilot yesterday to test @myaitutor's beta API and turned into my own little fridge wiz",
    author: "Masha - @ohheymasha",
    imageSrc: "/masha.jpg", // Add image source
  },
  {
    id: 2,
    testimonial:
      "Thanks to them, I built a paid subscription Netflix-style platform using their AI tool @myaitutor",
    author: "John - @AiJohnAllen",
    imageSrc: "/john.jpg", // Add image source
  },
  {
    id: 3,
    testimonial:
      "… thankfully @tsi_org solves this by putting everything under one umbrella…",
    author: "Sarah - @sarahndipitous",
    imageSrc: "/sarah.jpeg", // Add image source
  },
];

export function ShuffleCards() {
  const [positions, setPositions] = useState<("front" | "middle" | "back")[]>([
    "front",
    "middle",
    "back",
  ]);

  const handleShuffle = () => {
    const newPositions = [...positions];
    newPositions.unshift(newPositions.pop()!);
    setPositions(newPositions);
  };

  return (
    <div className="grid place-content-center overflow-hidden px-8 text-gray-900 min-h-[70vh] h-full w-full">
      <div className="relative -ml-[100px] h-[450px] w-[350px] md:-ml-[175px]">
        {testimonials.map((testimonial, index) => (
          <TestimonialCard
            key={testimonial.id}
            {...testimonial}
            handleShuffle={handleShuffle}
            position={positions[index]}
          />
        ))}
      </div>
    </div>
  );
}
