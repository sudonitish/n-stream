# N-Stream: Real-Time Video Synchronization App

N-Stream is a real-time video synchronization application built with [Next.js](https://nextjs.org), [Socket.IO](https://socket.io), and [react-youtube](https://www.npmjs.com/package/react-youtube). It allows multiple users to join a room and watch synchronized YouTube videos together, with real-time playback controls.

## Features

- **Real-Time Synchronization**: Play, pause, and seek videos in sync across all users in a room.
- **Room Management**: Create or join rooms to watch videos with friends.
- **YouTube Integration**: Stream YouTube videos directly in the app using the `react-youtube` library.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Error Handling**: Handles reconnections and sync issues gracefully.

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/n-stream.git
   cd n-stream
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file in the root directory and add the following environment variables:
   ```env
   # .env file structure
   NEXT_PUBLIC_SOCKET_URL=http://your-socket-url
   CLIENT_ORIGIN=http://your-client-origin
   ```

   **Note**: Do not push the `.env` file to version control. Instead, use a `.env.example` file to share the structure of the environment variables.

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## Running the Server

The server is built with Express and Socket.IO. To start the server:

1. Run the server:
   ```bash
   node server.js
   ```

2. The server will start on [http://localhost:3000](http://localhost:3000).

## Project Structure

```
n-stream/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── Container.tsx   # Main app container
│   │   ├── Player.tsx      # YouTube player component using react-youtube
│   │   ├── PlayerScreen.tsx# Player screen with controls
│   │   ├── JoinScreen.tsx  # Room join screen
│   ├── pages/              # Next.js pages
├── server.js               # Express and Socket.IO server
├── .env                    # Environment variables (not pushed to version control)
├── .env.example            # Example environment variables file
├── package.json            # Project dependencies
```

## Usage

1. **Join a Room**:
   - Enter a room ID to join an existing room or create a new one.

2. **Control Playback**:
   - Use the play, pause, and seek controls to synchronize video playback across all users in the room.

3. **Add Videos**:
   - Add YouTube video URLs to the playlist for everyone in the room to watch.

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API.
- [Socket.IO Documentation](https://socket.io/docs/) - Learn how Socket.IO enables real-time communication.
- [react-youtube Documentation](https://www.npmjs.com/package/react-youtube) - Learn how to embed and control YouTube videos using the `react-youtube` library.
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) - Learn how to embed and control YouTube videos.

## Contributing

Contributions are welcome! If you'd like to contribute, please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgments

- [Next.js](https://nextjs.org)
- [Socket.IO](https://socket.io)
- [react-youtube](https://www.npmjs.com/package/react-youtube)
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
