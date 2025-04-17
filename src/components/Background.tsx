"use client"

import { useEffect, useRef } from "react"

export default function Background() {
  const circlesRef = useRef<HTMLDivElement>(null)
  const wavesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!circlesRef.current || !wavesRef.current) return

    // Create circles
    for (let i = 0; i < 30; i++) {
      const circle = document.createElement("div")
      circle.className = "animated-circle"

      const size = Math.random() * 20 + 5
      const r = Math.random() * 100 + 100
      const g = Math.random() * 50
      const b = Math.random() * 255
      const opacity = Math.random() * 0.5 + 0.2

      circle.style.width = `${size}px`
      circle.style.height = `${size}px`
      circle.style.top = `${Math.random() * 100}%`
      circle.style.left = `${Math.random() * 100}%`
      circle.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`
      circle.style.boxShadow = `0 0 ${Math.random() * 30 + 10}px rgba(${r}, ${g}, ${b}, ${opacity + 0.1})`
      circle.style.animation = `float ${Math.random() * 15 + 10}s linear infinite, pulse ${
        Math.random() * 5 + 2
      }s ease-in-out infinite alternate`
      circle.style.animationDelay = `${Math.random() * 5}s`

      circlesRef.current.appendChild(circle)
    }

    // Create waves
    for (let i = 0; i < 5; i++) {
      const wave = document.createElement("div")
      wave.className = "animated-wave"

      const r = Math.random() * 100 + 100
      const g = Math.random() * 100
      const b = Math.random() * 255

      wave.style.background = `rgba(${r}, ${g}, ${b}, 0.1)`
      wave.style.animation = `wave ${10 + i * 3}s ease-in-out infinite alternate`
      wave.style.animationDelay = `${i * 0.5}s`
      wave.style.bottom = `${i * 10 - 40}px`

      wavesRef.current.appendChild(wave)
    }
  }, [])

  return (
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-purple-900/30"></div>
      <div id="animated-circles" ref={circlesRef} className="absolute top-0 left-0 w-full h-full overflow-hidden"></div>
      <div
        id="animated-waves"
        ref={wavesRef}
        className="absolute bottom-0 left-0 w-full h-full overflow-hidden opacity-30"
      ></div>
    </div>
  )
}

