"use client";

import React from "react";
import { DisplayCards } from "./display-cards";
import { DollarSign, Database, Code } from "lucide-react";

const defaultCards = [
  {
    icon: <DollarSign className="w-4 h-4 text-white" />,
    title: "Stripe Integration",
    description: "Full payment processing integration with Stripe",
    date: "Just now",
    iconClassName: "text-pink-500",
    titleClassName: "text-pink-500",
    className:
      "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-full before:outline-1 before:rounded-xl before:outline-border before:h-full before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
  },
  {
    icon: <Database className="w-4 h-4 text-white" />,
    title: "Postgres Database Setup",
    description: "Database with Neon",
    date: "2 days ago",
    iconClassName: "text-pink-500",
    titleClassName: "text-pink-500",
    className:
      "[grid-area:stack] translate-x-12 translate-y-10 hover:-translate-y-1 before:absolute before:w-full before:outline-1 before:rounded-xl before:outline-border before:h-full before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
  },
  {
    icon: <Code className="w-4 h-4 text-white" />,
    title: "Light and Fast Next.js Code",
    description: "Fast template built on top of supported framework",
    date: "Today",
    iconClassName: "text-pink-500",
    titleClassName: "text-pink-500",
    className: "[grid-area:stack] translate-x-24 translate-y-20 hover:translate-y-10",
  },
];

export function DisplayCardsDemo() {
  return (
    <div className="flex min-h-[28rem] w-full items-center justify-center">
      <div className="w-full max-w-3xl">
        <DisplayCards cards={defaultCards} />
      </div>
    </div>
  );
}
