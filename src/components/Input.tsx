import type React from "react"
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export const Input = ({ className = "", ...props }: InputProps) => {
  return (
    <input
      {...props}
      className={`input-field w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${className}`}
    />
  )
}

