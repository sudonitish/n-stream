interface ComponentTypes {
    [key: string]: unknown;
}
export const Input = ({ ...props }:ComponentTypes) => {
    return (
        <input
            {...props}
            className="input-field w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
    )
}
