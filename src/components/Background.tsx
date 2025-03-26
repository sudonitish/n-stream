export default function Background() {
    return (
        <>
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-purple-900/30"></div>
                <div id="animated-circles"
                    className="absolute top-0 left-0 w-full h-full overflow-hidden"></div>
                <div id="animated-waves" className="absolute bottom-0 left-0 w-full h-full overflow-hidden opacity-30"></div>
            </div>
        </>
    )
}
