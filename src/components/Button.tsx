interface ComponentTypes {
    label: string;
    icon?: boolean;
    [key: string]: unknown;
}
export const Button = ({
    label,
    icon = false,
    ...rest
}: ComponentTypes) => {
    return (
        <button
            {...rest}
            className="gradient-button w-full py-2 px-4 rounded-lg text-white font-medium flex items-center justify-center">
            <span>{label}</span>
            {icon &&
                <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                </svg>
            }
        </button>
    )
}
