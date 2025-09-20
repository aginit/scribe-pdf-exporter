# Secure Authentication System

Your Scribe Exporter is now protected with a secure authentication system. No assets or functionality can be accessed without logging in first.

## Features

### Security Features Implemented:
- ✅ **Password Hashing**: All passwords are hashed using bcrypt with salt rounds
- ✅ **Session Management**: Secure session-based authentication with httpOnly cookies
- ✅ **Protected Routes**: All assets and endpoints require authentication
- ✅ **User Registration**: New users can create accounts with email validation
- ✅ **Secure Middleware**: Authentication middleware protects all resources
- ✅ **Logout Functionality**: Users can securely end their sessions

### Protected Resources:
- `/dashboard` - Main dashboard (requires login)
- `/downloads/*` - All downloaded files (requires login)
- `/api/export` - Export functionality (requires login)
- `/api/user` - User information endpoint (requires login)
- All static assets except login/register pages

## Getting Started

### 1. Start the Server
```bash
npm start
```
The server will run on http://localhost:3000

### 2. Register a New User
1. Navigate to http://localhost:3000/register
2. Enter your desired username, email, and password
3. Passwords must be at least 6 characters
4. Click "Register" to create your account

### 3. Login
1. Navigate to http://localhost:3000/login (or http://localhost:3000)
2. Enter your username and password
3. Click "Login" to access the dashboard

### 4. Access Protected Dashboard
Once logged in, you can:
- Export Scribe documents
- View and download exported files
- Access all protected resources
- Logout when finished

## Security Configuration

### Environment Variables
Create or update your `.env` file with:
```
SESSION_SECRET=your-very-secure-random-string-here
PORT=3000
```

### Session Configuration
Sessions are configured with:
- HttpOnly cookies (prevents XSS attacks)
- 24-hour expiration
- Secure flag (enable in production with HTTPS)

### User Data Storage
- Users are stored in `users.json` file
- Passwords are never stored in plain text
- Each user has a unique ID and timestamp

## File Structure
```
/scribe-exporter/
├── server.js           # Main authentication server
├── users.json          # User database (created automatically)
├── public/
│   ├── login.html      # Login page
│   ├── register.html   # Registration page
│   └── dashboard.html  # Protected dashboard
└── downloads/          # Protected downloads directory
```

## API Endpoints

### Public Endpoints (No Auth Required):
- `GET /login` - Login page
- `POST /login` - Login authentication
- `GET /register` - Registration page
- `POST /register` - Create new user

### Protected Endpoints (Auth Required):
- `GET /dashboard` - Main dashboard
- `GET /logout` - Logout user
- `GET /api/user` - Get current user info
- `GET /api/export` - Run export process
- `GET /downloads/*` - Access downloaded files

## Production Recommendations

Before deploying to production:

1. **Use HTTPS**: Enable SSL/TLS certificates
2. **Strong Session Secret**: Use a cryptographically secure random string
3. **Database**: Consider using a proper database instead of JSON file
4. **Rate Limiting**: Add rate limiting to prevent brute force attacks
5. **Input Validation**: Add additional input validation and sanitization
6. **CORS**: Configure CORS policies if needed
7. **Helmet**: Add helmet.js for additional security headers
8. **Environment**: Use environment-specific configurations

## Troubleshooting

### Cannot Login
- Verify your username and password are correct
- Check that `users.json` exists and contains your user
- Ensure the server is running

### Session Expires
- Sessions last 24 hours by default
- Login again if your session expires
- Adjust `maxAge` in server.js if needed

### Port Already in Use
- Change the port in `.env` file
- Or stop other services using port 3000

## Support

For issues or questions about the authentication system, check:
- Server logs in the console
- User data in `users.json`
- Session configuration in `server.js`