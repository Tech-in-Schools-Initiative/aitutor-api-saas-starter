"use client";
import React from "react";
import Image from 'next/image';
import AnimatedGradientBackground from "./animated-gradient-background";
import { Icons } from "./icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function StackedCircularFooter() {
  return (
    <footer className="relative min-h-[75vh] py-12 overflow-hidden">
      {/* Animated Gradient Background */}
      <AnimatedGradientBackground />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center">
          <div className="mb-8 mt-12 rounded-full">
            <Image alt="Logo" src="/logo-square.png" width={100} height={100} />
          </div>
          <nav className="mb-8 flex flex-wrap justify-center gap-6">
            <a href="#" className="hover:text-primary">Home</a>
            <a href="https://aitutor-api.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">AI Tutor API</a>
            <a href="https://account.myapps.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">AI Tutor</a>
            <a href="https://pixio.myapps.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Pixio</a>
            <a href="https://getmytsi.org/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Mytsi</a>
          </nav>
          <div className="mb-8 flex space-x-4">
            <Button variant="outline" size="icon" className="rounded-full" asChild>
              <a href="https://x.com/tsi_org" target="_blank" rel="noopener noreferrer">
                <Icons.twitter className="h-5 w-5" />
                <span className="sr-only">X</span>
              </a>
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" asChild>
              <a href="https://github.com/Tech-in-Schools-Initiative/aitutor-api-saas-starter" target="_blank" rel="noopener noreferrer">
                <Icons.gitHub className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </a>
            </Button>
          </div>
          {/* <div className="mb-8 w-full max-w-md">
            <form className="flex space-x-2">
              <div className="flex-grow">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <Input id="email" placeholder="Enter your email" type="email" className="rounded-full" />
              </div>
              <Button type="submit" className="rounded-full">Subscribe</Button>
            </form>
          </div> */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              © 2025 Tech in Schools Initiative. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export { StackedCircularFooter }
