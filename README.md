# Tic Tac Toe API - Backend Server

A robust Node.js/Express backend API for the multiplayer Tic Tac Toe game, featuring real-time WebSocket connections, user authentication, game statistics, and leaderboard management.

**API Base URL:** `https://tic-tac-toe-api-[deployment-id].onrender.com`

## Core Features

### **Authentication System**

- **User Registration & Login** with secure password hashing
- **JWT Token Authentication** for protected routes
- **Profile Management** with customizable user data
- **Guest Play Support** for anonymous users

### **Real-time Game Engine**

- **WebSocket Connections** using Socket.io for live gameplay
- **Room-based Game Sessions** with unique 6-character codes
- **Turn-based Game Logic** with automatic win/draw detection
- **Game State Persistence** in MongoDB

### **Chat System**

- **Real-time Messaging** during gameplay
- **Message Persistence** with timestamp tracking
- **Room-specific Chat** isolated per game session

### **Statistics & Leaderboard**

- **Player Statistics** tracking (wins, losses, draws, win rate)
- **Global Leaderboard** with multi-criteria ranking
- **Real-time Rank Updates** after each game
- **Pagination Support** for large datasets

### **Avatar System**

- **File Upload** support using GridFS
- **Image Storage** in MongoDB with GridFS
- **Avatar Management** with CRUD operations

## Tech Stack

### Core Technologies

- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.io** - Real-time bidirectional communication
- **MongoDB** - NoSQL database with Mongoose ODM

### Security & Validation

- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT token management
- **express-validator** - Input validation and sanitization
- **CORS** - Cross-origin resource sharing

### File Management

- **Multer** - File upload handling
- **GridFS** - File storage in MongoDB

### Development Tools

- **Nodemon** - Development server with auto-restart
- **Prettier** - Code formatting
- **dotenv** - Environment variable management

## Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (local installation or MongoDB Atlas)
- **npm** or **yarn** package manager

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd tic-tac-toe-api
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:

   ```bash
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/tic-tac-toe
   # For MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tic-tac-toe

   # JWT Configuration
   JWT_SECRET=your_super_secure_jwt_secret_key_here
   JWT_EXPIRES_IN=7d

   # CORS Configuration (comma-separated origins)
   CORS_ORIGINS=http://localhost:3000,https://tic-tac-toe-weblc.vercel.app
   ```

4. **Start the development server**

   ```bash
   npm run dev
   # or for production
   npm start
   ```

5. **Verify the server**
   Open [http://localhost:5000](http://localhost:5000) to see the API status

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint           | Description         | Auth Required |
| ------ | ------------------ | ------------------- | ------------- |
| POST   | `/register`        | Register new user   | ❌            |
| POST   | `/login`           | User login          | ❌            |
| GET    | `/profile`         | Get user profile    | ✅            |
| PUT    | `/profile`         | Update user profile | ✅            |
| PUT    | `/change-password` | Change password     | ✅            |

#### Register User

```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "player123",
  "email": "player@example.com",
  "password": "securepassword123"
}
```

#### Login User

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "player@example.com",
  "password": "securepassword123"
}
```

### Game Routes (`/api/games`)

| Method | Endpoint | Description                | Auth Required |
| ------ | -------- | -------------------------- | ------------- |
| GET    | `/`      | List games with pagination | ❌            |
| POST   | `/`      | Create new game session    | 🔶 Optional   |
| GET    | `/:id`   | Get specific game details  | ❌            |
| PUT    | `/:id`   | Update game state          | 🔶 Optional   |

### Leaderboard Routes (`/api/leaderboard`)

| Method | Endpoint   | Description             | Auth Required |
| ------ | ---------- | ----------------------- | ------------- |
| GET    | `/`        | Get global leaderboard  | ❌            |
| GET    | `/my/rank` | Get current user's rank | ✅            |

#### Get Leaderboard

```bash
GET /api/leaderboard?sortBy=winRate&limit=10&minGames=3&page=1
```

### Avatar Routes (`/api/avatar`)

| Method | Endpoint   | Description        | Auth Required |
| ------ | ---------- | ------------------ | ------------- |
| POST   | `/upload`  | Upload user avatar | ✅            |
| GET    | `/:fileId` | Get avatar image   | ❌            |
| DELETE | `/:fileId` | Delete avatar      | ✅            |

## WebSocket Events

### Client → Server Events

| Event          | Parameters                       | Description          |
| -------------- | -------------------------------- | -------------------- |
| `create_room`  | `{playerName, token?}`           | Create new game room |
| `join_room`    | `{roomCode, playerName, token?}` | Join existing room   |
| `make_move`    | `{roomCode, position, token?}`   | Make game move       |
| `send_message` | `roomCode, message, playerName`  | Send chat message    |
| `disconnect`   | -                                | Player disconnection |

### Server → Client Events

| Event                 | Data                               | Description           |
| --------------------- | ---------------------------------- | --------------------- |
| `room_created`        | `{roomCode, playerSymbol}`         | Room creation success |
| `player_joined`       | `{players, gameState}`             | Player joined room    |
| `game_updated`        | `{board, currentTurn, winner}`     | Game state update     |
| `new_message`         | `{message, playerName, timestamp}` | New chat message      |
| `player_disconnected` | `{playerName}`                     | Player left game      |
| `error`               | `{message}`                        | Error occurred        |

### Example WebSocket Usage

```javascript
// Client-side Socket.io connection
const socket = io("http://localhost:5000");

// Create a room
socket.emit(
  "create_room",
  {
    playerName: "Player1",
    token: "jwt_token_here", // Optional for registered users
  },
  (response) => {
    if (response.success) {
      console.log("Room created:", response.roomCode);
    }
  }
);

// Listen for game updates
socket.on("game_updated", (gameState) => {
  console.log("Game state:", gameState);
});
```

## Database Schema

### User Model

```javascript
{
  _id: ObjectId,
  username: String (unique, required),
  email: String (unique, required),
  password: String (hashed, required),
  wins: Number (default: 0),
  losses: Number (default: 0),
  draws: Number (default: 0),
  totalGames: Number (default: 0),
  winRate: Number (calculated),
  avatar: String (GridFS file ID),
  bio: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Game Session Model

```javascript
{
  _id: ObjectId,
  roomCode: String (unique, 6 characters),
  players: [{
    socketId: String,
    name: String,
    symbol: String ('X' or 'O'),
    userId: ObjectId (optional)
  }],
  board: Array (9 elements, null or 'X'/'O'),
  currentTurn: String ('X' or 'O'),
  winner: String (null, 'X', 'O', or 'draw'),
  status: String ('waiting', 'active', 'finished'),
  chatMessages: [{
    id: String,
    message: String,
    playerName: String,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Configuration

### Environment Variables

| Variable         | Description                            | Default     | Required |
| ---------------- | -------------------------------------- | ----------- | -------- |
| `PORT`           | Server port                            | 5000        | ❌       |
| `NODE_ENV`       | Environment mode                       | development | ❌       |
| `MONGODB_URI`    | MongoDB connection string              | -           | ✅       |
| `JWT_SECRET`     | JWT signing secret                     | -           | ✅       |
| `JWT_EXPIRES_IN` | JWT expiration time                    | 7d          | ❌       |
| `CORS_ORIGINS`   | Allowed CORS origins (comma-separated) | -           | ✅       |

### CORS Configuration

The API supports multiple frontend origins. Configure them in the `CORS_ORIGINS` environment variable:

```bash
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com,https://tic-tac-toe-weblc.vercel.app
```

## Deployment

### Render Deployment

The API is configured for deployment on [Render](https://render.com) using the included `render.yaml`:

```yaml
services:
  - type: web
    name: tic-tac-toe-api
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        fromDatabase:
          name: mongodb
          property: connectionString
```

#### Deployment Steps:

1. **Connect Repository** to Render
2. **Configure Environment Variables** in Render dashboard:
   - `JWT_SECRET`
   - `CORS_ORIGINS`
3. **Set up MongoDB** database (Render MongoDB or MongoDB Atlas)
4. **Deploy** - Render will automatically build and start the service

## Performance Features

### Real-time Performance

- **Socket.io Clustering** support for horizontal scaling
- **Room-based Isolation** to prevent cross-game interference
- **Connection Management** with automatic cleanup

### Security Features

- **Input Validation** using express-validator
- **Password Hashing** with bcryptjs and salt rounds
- **JWT Token Expiration** and refresh handling
- **CORS Protection** with configurable origins
- **Rate Limiting** to prevent abuse

## Development

### Scripts

```bash
npm start          # Production server
npm run dev        # Development server with nodemon
```

### Project Structure

```
src/
├── app.js              # Main application setup
├── server.js           # Server startup
├── config/             # Configuration files
├── controllers/        # Route controllers
├── database/           # Database connection
├── errors/             # Error handling
├── mappers/            # Data mappers
├── middleware/         # Custom middleware
├── models/             # Mongoose models
├── routes/             # API routes
├── services/           # Business logic
└── validations/        # Input validations
```

### API Testing

Use tools like Postman, Insomnia, or curl to test the API endpoints:

```bash
# Health check
curl http://localhost:5000

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"test123"}'
```

**Related Projects:**

- [Tic Tac Toe Web Frontend](../tic-tac-toe-web) - Next.js frontend application
- [Live Demo](https://tic-tac-toe-weblc.vercel.app/) - Production deployment
